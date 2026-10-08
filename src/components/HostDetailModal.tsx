import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Monitor, Cpu, Shield, Clock, Hash, Globe } from 'lucide-react';
import { HostResult } from '../types/network';

interface HostDetailModalProps {
  host: HostResult | null;
  onClose: () => void;
}

export const HostDetailModal: React.FC<HostDetailModalProps> = ({ host, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!host) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const sshPort = host.open_ports.find((p) => p.port === 22);
  const rdpPort = host.open_ports.find((p) => p.port === 3389);
  const mcpPorts = host.open_ports.filter((p) => [8000, 8080, 5000, 3000].includes(p.port));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-lg border border-slate-700 bg-[#0F1420] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <h2 className="text-lg font-bold font-mono text-white">{host.ip}</h2>
            {host.hostname && (
              <span className="text-xs font-mono text-slate-400">({host.hostname})</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
            <span>MAC: {host.mac_address || 'Unresolved (Local Interface)'}</span>
            <span>·</span>
            <span>Vendor: {host.mac_vendor || 'Unknown'}</span>
            <span>·</span>
            <span className="text-emerald-400 tabular-nums">Latency: {host.min_latency_ms} ms</span>
          </div>
        </div>

        {/* Quick Remote Shell & Access Affordances */}
        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-300">Remote Management Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sshPort && (
              <div className="rounded border border-cyan-800/60 bg-cyan-950/30 p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>SSH Remote Shell (22)</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    ssh root@{host.ip}
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(`ssh root@${host.ip}`, 'ssh')}
                  className="p-1.5 rounded border border-cyan-700 bg-cyan-900/50 text-cyan-200 hover:text-white transition-colors"
                >
                  {copiedKey === 'ssh' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}

            {rdpPort && (
              <div className="rounded border border-amber-800/60 bg-amber-950/30 p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <Monitor className="h-3.5 w-3.5" />
                    <span>RDP Remote Desktop (3389)</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    xfreerdp /v:{host.ip}
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(`xfreerdp /v:${host.ip}`, 'rdp')}
                  className="p-1.5 rounded border border-amber-700 bg-amber-900/50 text-amber-200 hover:text-white transition-colors"
                >
                  {copiedKey === 'rdp' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}

            {mcpPorts.map((mcp) => (
              <div
                key={mcp.port}
                className="rounded border border-purple-800/60 bg-purple-950/30 p-3 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                    <Cpu className="h-3.5 w-3.5" />
                    <span>MCP API Endpoint ({mcp.port})</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    curl http://{host.ip}:{mcp.port}/
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(`curl http://${host.ip}:${mcp.port}/`, `mcp-${mcp.port}`)}
                  className="p-1.5 rounded border border-purple-700 bg-purple-900/50 text-purple-200 hover:text-white transition-colors"
                >
                  {copiedKey === `mcp-${mcp.port}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Port Probes Table */}
        <div className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold text-slate-300">Verified Port Signatures</h3>
          <div className="rounded border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-mono">
                  <th className="py-2 px-3">Port</th>
                  <th className="py-2 px-3">Service</th>
                  <th className="py-2 px-3">Banner / Handshake Response</th>
                  <th className="py-2 px-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {host.open_ports.map((p) => (
                  <tr key={p.port} className="text-slate-300">
                    <td className="py-2.5 px-3 font-mono font-semibold text-cyan-400">
                      {p.port}/tcp
                    </td>
                    <td className="py-2.5 px-3">{p.service}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      {p.banner || 'Socket Connect Confirmed'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                      {p.latency_ms.toFixed(1)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Structured JSON representation */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300">Raw JSON Representation</h3>
            <button
              onClick={() => handleCopy(JSON.stringify(host, null, 2), 'json')}
              className="text-[11px] font-mono text-cyan-400 hover:underline"
            >
              {copiedKey === 'json' ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <pre className="rounded bg-[#080B12] border border-slate-900 p-3 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48">
            {JSON.stringify(host, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
