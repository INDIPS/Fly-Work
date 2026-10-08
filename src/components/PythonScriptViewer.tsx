import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, FileCode, Terminal, Shield, CheckCircle } from 'lucide-react';

export const PythonScriptViewer: React.FC = () => {
  const [scriptCode, setScriptCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/network/script')
      .then((res) => res.text())
      .then((text) => {
        setScriptCode(text);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([scriptCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'net_probe.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Overview & Quickstart Card */}
      <div className="rounded-lg border border-slate-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">net_probe.py — Complete Executable Script</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Zero-dependency standalone Python 3.8+ network probe. Engineered with standard library asyncio, socket, and ipaddress.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-700 bg-slate-800 text-slate-200 hover:text-white transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Full Code'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download net_probe.py</span>
            </button>
          </div>
        </div>

        {/* Quick Setup Guide */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              Zero External Dependencies
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Runs instantly with pure <code className="text-cyan-300">python3 net_probe.py</code> on Linux, macOS, or Windows. No <code className="text-slate-300">pip install</code> required.
            </p>
          </div>

          <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-cyan-400" />
              Direct CLI & Pipe Ready
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Use <code className="text-cyan-300">--inline</code> to stream line-by-line NDJSON to stdout for real-time <code className="text-slate-300">jq</code>, bash, or MCP integration.
            </p>
          </div>

          <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
            <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              Safe & Non-Destructive
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Performs non-intrusive TCP handshake connect probes. Configurable concurrency protects against socket saturation.
            </p>
          </div>
        </div>
      </div>

      {/* CLI Options Reference Table */}
      <div className="rounded-lg border border-slate-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-white mb-3">Command-Line Flags Reference</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-800 font-mono text-slate-400">
                <th className="py-2 px-3">Flag</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Default</th>
                <th className="py-2 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              <tr>
                <td className="py-2 px-3 text-cyan-400">-z, --zone</td>
                <td className="py-2 px-3 text-slate-400">string</td>
                <td className="py-2 px-3 text-slate-500">Auto-detect</td>
                <td className="py-2 px-3 font-sans text-slate-300">Target subnet CIDR (e.g. 192.168.43.0/24 or 172.20.10.0/28).</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400">-p, --ports</td>
                <td className="py-2 px-3 text-slate-400">string</td>
                <td className="py-2 px-3 text-slate-500">22,3389,8000,8080,5000</td>
                <td className="py-2 px-3 font-sans text-slate-300">Comma-separated port numbers, ranges, or aliases: ssh, rdp, mcp, all_remote.</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400">-t, --timeout</td>
                <td className="py-2 px-3 text-slate-400">float</td>
                <td className="py-2 px-3 text-slate-500">0.5s</td>
                <td className="py-2 px-3 font-sans text-slate-300">TCP socket connection timeout in seconds.</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400">-c, --concurrency</td>
                <td className="py-2 px-3 text-slate-400">integer</td>
                <td className="py-2 px-3 text-slate-500">150</td>
                <td className="py-2 px-3 font-sans text-slate-300">Maximum concurrent async tasks via asyncio.Semaphore.</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400">--inline</td>
                <td className="py-2 px-3 text-slate-400">flag</td>
                <td className="py-2 px-3 text-slate-500">False</td>
                <td className="py-2 px-3 font-sans text-slate-300">Streams real-time NDJSON logs to stdout for Unix pipes and MCP tools.</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400">--json</td>
                <td className="py-2 px-3 text-slate-400">flag</td>
                <td className="py-2 px-3 text-slate-500">False</td>
                <td className="py-2 px-3 font-sans text-slate-300">Prints final structured JSON document on stdout upon completion.</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400">--mcp</td>
                <td className="py-2 px-3 text-slate-400">flag</td>
                <td className="py-2 px-3 text-slate-500">False</td>
                <td className="py-2 px-3 font-sans text-slate-300">Formats output conforming to Model Context Protocol (MCP) Tool format.</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-cyan-400">--detect-only</td>
                <td className="py-2 px-3 text-slate-400">flag</td>
                <td className="py-2 px-3 text-slate-500">False</td>
                <td className="py-2 px-3 font-sans text-slate-300">Inspects routing table and returns active interface details without scanning.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Display Box */}
      <div className="rounded-lg border border-slate-800 bg-[#0A0E17] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#0F1420] px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
            <span className="text-cyan-400">python</span>
            <span>net_probe.py</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {scriptCode.split('\n').length} lines · UTF-8
          </div>
        </div>

        <div className="max-h-[700px] overflow-y-auto p-4 text-xs font-mono leading-relaxed bg-[#0B0F17] text-slate-300 select-text">
          {loading ? (
            <div className="text-slate-500 py-8 text-center animate-pulse">Loading script contents...</div>
          ) : (
            <pre className="whitespace-pre overflow-x-auto text-emerald-400/90">{scriptCode}</pre>
          )}
        </div>
      </div>
    </div>
  );
};
