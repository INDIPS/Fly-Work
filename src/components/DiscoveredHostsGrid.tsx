import React, { useState } from 'react';
import {
  Server,
  Shield,
  ExternalLink,
  Copy,
  Check,
  Search,
  Terminal,
  Monitor,
  Cpu,
  Layers,
} from 'lucide-react';
import { HostResult } from '../types/network';

interface DiscoveredHostsGridProps {
  hosts: HostResult[];
  isScanning: boolean;
  onSelectHost: (host: HostResult) => void;
  onStartScan: () => void;
}

export const DiscoveredHostsGrid: React.FC<DiscoveredHostsGridProps> = ({
  hosts,
  isScanning,
  onSelectHost,
  onStartScan,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const filteredHosts = hosts.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.ip.toLowerCase().includes(q) ||
      h.hostname.toLowerCase().includes(q) ||
      h.mac_address.toLowerCase().includes(q) ||
      h.mac_vendor.toLowerCase().includes(q) ||
      h.services_detected.some((s) => s.toLowerCase().includes(q)) ||
      h.open_port_numbers.some((p) => p.toString().includes(q))
    );
  });

  return (
    <div className="rounded-lg border border-slate-800 bg-[#111827]/80 shadow-lg backdrop-blur-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Discovered Live Hosts & Ports</h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              ({filteredHosts.length} of {hosts.length} live)
            </span>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter IP, port, service..."
            className="w-full rounded border border-slate-700 bg-slate-900/90 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Table / Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium font-mono">
              <th className="py-2.5 px-4">Host IP / Hostname</th>
              <th className="py-2.5 px-4">Hardware MAC / Vendor</th>
              <th className="py-2.5 px-4">Verified Open Ports</th>
              <th className="py-2.5 px-4">Remote Service / Protocol</th>
              <th className="py-2.5 px-4 text-right">Round-Trip Latency</th>
              <th className="py-2.5 px-4 text-right">Quick Shell Commands</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredHosts.length > 0 ? (
              filteredHosts.map((host) => {
                const hasSsh = host.open_port_numbers.includes(22);
                const hasRdp = host.open_port_numbers.includes(3389);
                const hasMcp = host.open_port_numbers.some((p) =>
                  [8000, 8080, 5000].includes(p)
                );
                const sshCmd = `ssh root@${host.ip}`;
                const rdpCmd = `xfreerdp /v:${host.ip}`;

                return (
                  <tr
                    key={host.ip}
                    onClick={() => onSelectHost(host)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* IP & Hostname */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-emerald-400 text-sm">
                        {host.ip}
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono truncate max-w-[200px]">
                        {host.hostname || 'No reverse PTR'}
                      </div>
                    </td>

                    {/* MAC & Vendor */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-300">
                        {host.mac_address || '—'}
                      </div>
                      <div className="text-slate-500 text-[11px] truncate max-w-[160px]">
                        {host.mac_vendor || 'Local Interface / Loopback'}
                      </div>
                    </td>

                    {/* Open Ports */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono">
                        {host.open_ports.map((p) => (
                          <span
                            key={p.port}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              p.port === 22
                                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/50'
                                : p.port === 3389
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                                : [8000, 8080, 5000].includes(p.port)
                                ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {p.port}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Detected Services */}
                    <td className="py-3 px-4 text-slate-300">
                      <div className="space-y-0.5">
                        {host.open_ports.slice(0, 2).map((p) => (
                          <div key={p.port} className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-mono text-slate-500">{p.port}:</span>
                            <span className="text-slate-200">{p.service}</span>
                            {p.banner && (
                              <span className="text-slate-500 truncate max-w-[140px]" title={p.banner}>
                                [{p.banner}]
                              </span>
                            )}
                          </div>
                        ))}
                        {host.open_ports.length > 2 && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            +{host.open_ports.length - 2} additional services
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Latency */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-xs tabular-nums text-emerald-400 font-semibold">
                        {host.min_latency_ms.toFixed(1)} ms
                      </span>
                    </td>

                    {/* Quick Shell Commands */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {hasSsh && (
                          <button
                            onClick={(e) => handleCopy(sshCmd, e)}
                            title={`Copy '${sshCmd}'`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] transition-colors"
                          >
                            {copiedText === sshCmd ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Terminal className="h-3 w-3 text-cyan-400" />
                            )}
                            <span className="font-mono">SSH</span>
                          </button>
                        )}

                        {hasRdp && (
                          <button
                            onClick={(e) => handleCopy(rdpCmd, e)}
                            title={`Copy '${rdpCmd}'`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] transition-colors"
                          >
                            {copiedText === rdpCmd ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Monitor className="h-3 w-3 text-amber-400" />
                            )}
                            <span className="font-mono">RDP</span>
                          </button>
                        )}

                        <button
                          onClick={() => onSelectHost(host)}
                          className="px-2 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-400 border border-cyan-800/60 text-[11px] transition-colors"
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-12 px-4 text-center">
                  <div className="mx-auto max-w-sm space-y-3">
                    <Server className="mx-auto h-8 w-8 text-slate-600" />
                    <div>
                      <div className="text-sm font-semibold text-slate-300">
                        {isScanning ? 'Probing Target Zone...' : 'No Live Hosts In Current Scope'}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {isScanning
                          ? 'Asynchronous TCP sockets actively probing live endpoints.'
                          : 'Trigger a scan on the active Wi-Fi hotspot or specify a custom CIDR subnet above.'}
                      </p>
                    </div>
                    {!isScanning && (
                      <button
                        onClick={onStartScan}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
                      >
                        Start Discovery Scan
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
