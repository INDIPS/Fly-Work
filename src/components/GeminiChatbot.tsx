import React, { useState, useEffect, useRef } from 'react';
import { Bot, User as UserIcon, Send, Trash2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, orderBy, getDocs } from 'firebase/firestore';

interface Message {
  id?: string;
  role: 'user' | 'model';
  content: string;
  modelUsed?: string;
  timestamp: number;
}

export const GeminiChatbot: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content:
        'Hello! I am your Network Systems & Security Architect AI. I can assist with hotspot discovery analysis, SSH/RDP port hardening, subnet mask calculations, and firewall rules. What network task are you working on?',
      timestamp: Date.now(),
      modelUsed: 'gemini-3.5-flash',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('Network Systems & Security Architect');
  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview'>('gemini-3.5-flash');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const msgsCol = collection(db, 'users', user.uid, 'messages');
          const q = query(msgsCol, orderBy('timestamp', 'asc'));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const loaded = snap.docs.map((d) => d.data() as Message);
            setMessages(loaded);
          }
        } catch (_err) {
          // Graceful fallback without warning
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          role,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        const modelMsg: Message = {
          role: 'model',
          content: data.text,
          modelUsed: data.modelUsed || selectedModel,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, modelMsg]);

        // Save to Firestore if authenticated, or localStorage if guest
        if (currentUser) {
          try {
            const msgsCol = collection(db, 'users', currentUser.uid, 'messages');
            await addDoc(msgsCol, userMsg);
            await addDoc(msgsCol, modelMsg);
          } catch (_err) {
            // Silently fallback without warning
          }
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            content: `Error: ${data.error || 'Failed to generate response'}`,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: `Network Error: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: 'model',
        content: `Chat cleared. Ready for your questions as ${role}.`,
        timestamp: Date.now(),
        modelUsed: selectedModel,
      },
    ]);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#111827]/90 shadow-xl backdrop-blur-md flex flex-col h-[650px]">
      {/* Top Controls Bar */}
      <div className="border-b border-slate-800/80 bg-[#0F1420] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-cyan-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Gemini Network Systems Assistant</h3>
            <div className="text-[11px] text-slate-400">Multi-turn chat with contextual role guidance</div>
          </div>
        </div>

        {/* Role & Model Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
          >
            <option value="Network Systems & Security Architect">Network Systems Architect</option>
            <option value="Cloud Infrastructure & Hotspot Engineer">Cloud & Hotspot Engineer</option>
            <option value="DevOps Site Reliability Engineer">DevOps SRE</option>
            <option value="Penetration Tester & Ethical Hacker">Ethical Security Auditor</option>
          </select>

          <div className="flex items-center rounded border border-slate-700 bg-slate-900 p-0.5 text-xs">
            <button
              onClick={() => setSelectedModel('gemini-3.5-flash')}
              className={`px-2 py-0.5 rounded transition-colors ${
                selectedModel === 'gemini-3.5-flash'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="General tasks (gemini-3.5-flash)"
            >
              Flash (General)
            </button>
            <button
              onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
              className={`px-2 py-0.5 rounded transition-colors ${
                selectedModel === 'gemini-3.1-flash-lite'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Fast tasks (gemini-3.1-flash-lite)"
            >
              Flash-Lite (Fast)
            </button>
            <button
              onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
              className={`px-2 py-0.5 rounded transition-colors ${
                selectedModel === 'gemini-3.1-pro-preview'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Complex reasoning (gemini-3.1-pro-preview)"
            >
              Pro (Complex)
            </button>
          </div>

          <button
            onClick={handleClear}
            title="Clear Chat"
            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isUser
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 border border-cyan-800/60 text-cyan-400'
                }`}
              >
                {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-lg p-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-cyan-950/70 border border-cyan-800 text-cyan-100'
                    : 'bg-[#0E131F] border border-slate-800 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {m.modelUsed && <span>model: {m.modelUsed}</span>}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-cyan-800/60 text-cyan-400">
              <Bot className="h-4 w-4 animate-spin" />
            </div>
            <div className="rounded-lg bg-[#0E131F] border border-slate-800 p-3 text-xs text-slate-400 italic">
              Analyzing with {selectedModel}...
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="border-t border-slate-800 p-3 bg-[#0F1420] flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask ${role} about subnets, open ports, or security...`}
          className="flex-1 rounded-md border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
