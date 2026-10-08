import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth, signInWithGoogle, logOut, testFirestoreConnection } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon, Database, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface AuthBarProps {
  onOpenHistory?: () => void;
  savedScansCount?: number;
}

export const AuthBar: React.FC<AuthBarProps> = ({ onOpenHistory, savedScansCount = 0 }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    testFirestoreConnection().then(setDbConnected);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (_err) {
      // User closed popup or cancelled
    }
  };

  const handleSignOut = async () => {
    await logOut();
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      {/* Database status indicator (Zero-pill discipline: unboxed text) */}
      <div className="hidden sm:flex items-center gap-1.5 text-slate-400 font-mono">
        <Database className={`h-3.5 w-3.5 ${dbConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span>Firestore:</span>
        <span className={dbConnected ? 'text-emerald-400' : 'text-slate-400'}>
          {dbConnected ? 'Connected' : 'Ready'}
        </span>
      </div>

      {user ? (
        <div className="flex items-center gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="h-6 w-6 rounded-full border border-slate-700"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-cyan-900 border border-cyan-700 flex items-center justify-center text-cyan-200">
              <UserIcon className="h-3.5 w-3.5" />
            </div>
          )}
          <span className="hidden md:inline font-medium text-slate-200 text-xs truncate max-w-[120px]">
            {user.displayName || user.email}
          </span>
          <button
            onClick={handleSignOut}
            title="Sign out from Firebase"
            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <LogIn className="h-3.5 w-3.5 text-cyan-400" />
          <span>Google Sign In</span>
        </button>
      )}
    </div>
  );
};
