import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth & Firestore with provisioned database ID
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Auth with anonymous session if available
export async function initAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    try {
      const unsub = onAuthStateChanged(auth, async (user) => {
        unsub();
        if (user) {
          resolve(user);
        } else {
          try {
            const anon = await signInAnonymously(auth);
            resolve(anon.user);
          } catch {
            resolve(null);
          }
        }
      });
    } catch {
      resolve(null);
    }
  });
}

// Validate Connection to Firestore on startup (Mandatory skill constraint)
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (_error) {
    return false;
  }
}

// Authentication Helpers
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      try {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(
          userRef,
          {
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (_err) {}
    }
    return result.user;
  } catch (error) {
    throw error;
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Firestore Persistence Helpers with LocalStorage Fallback
export async function saveScanRecord(
  userId: string,
  scanData: {
    cidr: string;
    ports: string;
    liveHostsCount: number;
    durationSeconds: number;
    hosts: any[];
  }
) {
  const localKey = 'netprobe_saved_scans';
  try {
    const scansCol = collection(db, 'users', userId, 'scans');
    return await addDoc(scansCol, {
      userId,
      cidr: scanData.cidr,
      ports: scanData.ports,
      liveHostsCount: scanData.liveHostsCount,
      durationSeconds: scanData.durationSeconds,
      hosts: JSON.stringify(scanData.hosts),
      createdAt: new Date().toISOString(),
    });
  } catch (_err) {
    try {
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
      existing.unshift({ id: String(Date.now()), ...scanData, createdAt: new Date().toISOString() });
      localStorage.setItem(localKey, JSON.stringify(existing.slice(0, 50)));
    } catch {}
  }
}

export async function loadUserScans(userId: string) {
  const localKey = 'netprobe_saved_scans';
  try {
    const scansCol = collection(db, 'users', userId, 'scans');
    const q = query(scansCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (_err) {
    try {
      return JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch {
      return [];
    }
  }
}
