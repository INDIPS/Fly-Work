import React from 'react';
import { Download, Play, Cpu, Radio, Sparkles } from 'lucide-react';
import { AuthBar } from './AuthBar';

export type NavTab =
  | 'scanner'
  | 'terminal'
  | 'mcp'
  | 'chat'
  | 'transcribe'
  | 'video'
  | 'maps'
  | 'script'
  | 'docs';

interface TopNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isScanning: boolean;
  onTriggerScan: () => void;
  onDownloadScript: () => void;
  onOpenVoiceLive: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  isScanning,
  onTriggerScan,
  onDownloadScript,
  onOpenVoiceLive,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#0B0F17]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('scanner')}
            className="flex items-center gap-2 text-left font-semibold tracking-tight text-white hover:text-cyan-400 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Cpu className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">NetProbe Sentinel</span>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Text with hover underlines, no pills) */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'scanner'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Discovery
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'terminal'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Inline Stream
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'mcp'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            MCP Pipeline
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'chat'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Gemini Chat
          </button>
          <button
            onClick={() => setActiveTab('transcribe')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'transcribe'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Transcribe
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'video'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Veo Video
          </button>
          <button
            onClick={() => setActiveTab('maps')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'maps'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Maps
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'script'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Python CLI
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`transition-colors pb-0.5 border-b-2 ${
              activeTab === 'docs'
                ? 'text-cyan-400 border-cyan-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Docs
          </button>
        </nav>

        {/* Zone 3: Primary Actions + Live Voice & Firebase Auth */}
        <div className="flex items-center gap-2.5">
          {/* Live Voice API trigger button */}
          <button
            onClick={onOpenVoiceLive}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 transition-colors"
            title="Start live voice conversation using gemini-3.8-live"
          >
            <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">Voice Live</span>
          </button>

          {/* Firebase Authentication */}
          <AuthBar />

          {/* Quick Scan Action */}
          <button
            onClick={onTriggerScan}
            disabled={isScanning}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap ${
              isScanning
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-700 cursor-wait animate-pulse'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold'
            }`}
          >
            <Play className={`h-3 w-3 ${isScanning ? 'animate-spin' : 'fill-current'}`} />
            <span className="hidden md:inline">{isScanning ? 'Probing...' : 'Run Discovery'}</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation row for smaller screens */}
      <div className="flex lg:hidden overflow-x-auto border-t border-slate-800/60 px-4 py-2 gap-4 text-xs font-medium text-slate-400 whitespace-nowrap">
        <button onClick={() => setActiveTab('scanner')} className={activeTab === 'scanner' ? 'text-cyan-400 font-semibold' : ''}>Discovery</button>
        <button onClick={() => setActiveTab('terminal')} className={activeTab === 'terminal' ? 'text-cyan-400 font-semibold' : ''}>Inline Stream</button>
        <button onClick={() => setActiveTab('chat')} className={activeTab === 'chat' ? 'text-cyan-400 font-semibold' : ''}>Gemini Chat</button>
        <button onClick={() => setActiveTab('transcribe')} className={activeTab === 'transcribe' ? 'text-cyan-400 font-semibold' : ''}>Transcribe</button>
        <button onClick={() => setActiveTab('video')} className={activeTab === 'video' ? 'text-cyan-400 font-semibold' : ''}>Veo Video</button>
        <button onClick={() => setActiveTab('maps')} className={activeTab === 'maps' ? 'text-cyan-400 font-semibold' : ''}>Maps</button>
        <button onClick={() => setActiveTab('mcp')} className={activeTab === 'mcp' ? 'text-cyan-400 font-semibold' : ''}>MCP</button>
        <button onClick={() => setActiveTab('script')} className={activeTab === 'script' ? 'text-cyan-400 font-semibold' : ''}>Python CLI</button>
        <button onClick={() => setActiveTab('docs')} className={activeTab === 'docs' ? 'text-cyan-400 font-semibold' : ''}>Docs</button>
      </div>
    </header>
  );
};
