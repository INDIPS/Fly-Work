import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, Trash2, Download, Play, Pause, ArrowDown } from 'lucide-react';
import { HostResult } from '../types/network';

interface TerminalRunnerProps {
  logs: string[];
  hosts: HostResult[];
  isScanning: boolean;
  onClearLogs: () => void;
  onStartScan: () => void;
  activeCommand: string;
}

export const TerminalRunner: React.FC<TerminalRunnerProps> = ({
  logs,
  hosts,
  isScanning,
  onClearLogs,
  onStartScan,
  activeCommand,
}) => {
  const [viewFormat, setViewFormat] = useState<'ansi' | 'ndjson' | 'json'>('ansi');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, hosts, autoScroll]);

  const handleCopy = () => {
    let contentToCopy = '';
    if (viewFormat === 'ndjson') {
      contentToCopy = hosts.map((h) => JSON.stringify(h)).join('\n');
    } else if (viewFormat === 'json') {
      contentToCopy = JSON.stringify({ hosts }, null, 2);
    } else {
      contentToCopy = logs.join('\n');
    }
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    let content = '';
    let filename = 'net_probe_output.log';
    if (viewFormat === 'ndjson') {
      content = hosts.map((h) => JSON.stringify(h)).join('\n');
      filename = 'net_probe_inline.ndjson';
    } else if (viewFormat === 'json') {
      content = JSON.stringify({ hosts }, null, 2);
      filename = 'net_probe_scan.json';
    } else {
      content = logs.join('\n');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0A0E17] shadow-2xl flex flex-col h-[650px] font-mono">
      {/* Terminal Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-[#0F1420] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-xs font-semibold text-slate-300">
            net_probe.py inline stdout stream
          </span>
          {isScanning && (
            <span className="flex items-center gap-1 text-[11px] text-cyan-400 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              LIVE PROBE ACTIVE
            </span>
          )}
        </div>

        {/* View mode segmented buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-slate-800 bg-slate-900/90 p-0.5 text-[11px]">
            <button
              onClick={() => setViewFormat('ansi')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewFormat === 'ansi'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ANSI Log View
            </button>
            <button
              onClick={() => setViewFormat('ndjson')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewFormat === 'ndjson'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              NDJSON (--inline)
            </button>
            <button
              onClick={() => setViewFormat('json')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewFormat === 'json'
                  ? 'bg-cyan-950 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              JSON Object
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll'}
              className={`p-1.5 rounded border border-slate-800 transition-colors ${
                autoScroll ? 'bg-slate-800 text-cyan-400' : 'bg-slate-900 text-slate-500'
              }`}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCopy}
              title="Copy output to clipboard"
              className="p-1.5 rounded border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={handleDownload}
              title="Download stdout output"
              className="p-1.5 rounded border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClearLogs}
              title="Clear terminal buffer"
              className="p-1.5 rounded border border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Command prompt banner */}
      <div className="border-b border-slate-800/60 bg-[#080B12] px-4 py-2 text-xs flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-emerald-400 select-none">$</span>
          <span className="text-slate-200 font-mono select-all">{activeCommand}</span>
        </div>
        <div className="text-[11px] text-slate-500 tabular-nums shrink-0 ml-2">
          {hosts.length} hosts captured
        </div>
      </div>

      {/* Terminal Output Body */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed font-mono bg-[#0B0F17] select-text"
      >
        {viewFormat === 'ndjson' ? (
          hosts.length > 0 ? (
            <div className="space-y-1.5">
              {hosts.map((host, idx) => (
                <div key={idx} className="text-emerald-300 break-all hover:bg-slate-900/60 p-0.5 rounded">
                  {JSON.stringify(host)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-600 italic">No NDJSON objects captured yet. Start discovery scan.</div>
          )
        ) : viewFormat === 'json' ? (
          <pre className="text-cyan-300 whitespace-pre-wrap">
            {JSON.stringify({ hosts }, null, 2)}
          </pre>
        ) : logs.length > 0 ? (
          <div className="space-y-1">
            {logs.map((line, idx) => {
              const isDiscovered = line.includes('[DISCOVERED]') || line.includes('"ip"');
              const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('refused');
              return (
                <div
                  key={idx}
                  className={`${
                    isDiscovered
                      ? 'text-emerald-300 font-semibold'
                      : isError
                      ? 'text-rose-400'
                      : line.startsWith('$')
                      ? 'text-cyan-400'
                      : 'text-slate-300'
                  }`}
                >
                  {line}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-slate-600 italic">
            Terminal ready. Click "Run Discovery" to execute asynchronous inline probe.
          </div>
        )}
      </div>

      {/* Terminal Footer Info Bar */}
      <div className="border-t border-slate-800/80 bg-[#0F1420] px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
        <div>Pipeable stdin/stdout: <span className="text-slate-400">Ready for | jq / xargs / MCP server</span></div>
        <div className="tabular-nums">Async Event Loop: <span className="text-emerald-400">Active</span></div>
      </div>
    </div>
  );
};
