import React, { useState } from 'react';
import { Wifi, Server, Sliders, RefreshCw, Zap, Shield, HelpCircle } from 'lucide-react';
import { DetectedInterface } from '../types/network';

interface ZoneDetectorCardProps {
  cidr: string;
  setCidr: (val: string) => void;
  ports: string;
  setPorts: (val: string) => void;
  timeout: number;
  setTimeoutVal: (val: number) => void;
  concurrency: number;
  setConcurrency: (val: number) => void;
  detectedIface: DetectedInterface | null;
  detectingIface: boolean;
  onRefreshDetection: () => void;
  isScanning: boolean;
  onStartScan: () => void;
}

export const ZoneDetectorCard: React.FC<ZoneDetectorCardProps> = ({
  cidr,
  setCidr,
  ports,
  setPorts,
  timeout,
  setTimeoutVal,
  concurrency,
  setConcurrency,
  detectedIface,
  detectingIface,
  onRefreshDetection,
  isScanning,
  onStartScan,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const presets = [
    { label: 'Auto-Detected Subnet', cidr: detectedIface?.detected_cidr || '192.168.1.0/24', desc: 'Current active interface' },
    { label: 'Android Hotspot', cidr: '192.168.43.0/24', desc: 'Default Android AP subnet' },
    { label: 'iOS Personal Hotspot', cidr: '172.20.10.0/28', desc: 'Apple 14-host subnet' },
    { label: 'Windows Mobile Hotspot', cidr: '192.168.137.0/24', desc: 'Windows virtual AP' },
    { label: 'Home / Lab LAN', cidr: '192.168.1.0/24', desc: 'Standard RFC1918 gateway' },
    { label: 'Localhost / Container', cidr: '127.0.0.1/32', desc: 'Host container loopback' },
  ];

  const portPresets = [
    { label: 'Remote Access & MCP', value: '22,3389,8000,8080,5000', badge: 'Default' },
    { label: 'Shell & RDP Only', value: '22,3389', badge: 'Fast' },
    { label: 'MCP & APIs Only', value: '8000,8080,5000,3000,8888', badge: 'MCP' },
    { label: 'Extended Infrastructure', value: '22,3389,8000,8080,5000,5900,8443,9000', badge: 'Thorough' },
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur-sm">
      {/* Header section with active interface indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Zone & Subnet Discovery Configuration</h2>
            <span className="text-xs text-slate-500 font-mono">IPv4 / CIDR</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Configure target hotspot subnet, remote management ports, and asynchronous socket concurrency parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300">
            <Wifi className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-slate-400">Active:</span>
            <span className="font-mono text-cyan-300 font-semibold">
              {detectedIface ? detectedIface.interface_type : 'Detecting...'}
            </span>
            {detectedIface?.local_ip && (
              <span className="font-mono text-slate-500">({detectedIface.local_ip})</span>
            )}
          </div>

          <button
            onClick={onRefreshDetection}
            disabled={detectingIface}
            title="Re-probe local routing table for active gateway"
            className="rounded border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white hover:border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${detectingIface ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Configuration Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* CIDR input & presets (7 columns) */}
        <div className="md:col-span-7 space-y-3">
          <div>
            <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span>Target Network CIDR</span>
              <span className="text-[11px] text-slate-500 font-mono">Supports /24 (254 hosts), /28, /32</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={cidr}
                onChange={(e) => setCidr(e.target.value.trim())}
                placeholder="e.g. 192.168.43.0/24 or 172.20.10.0/28"
                className="w-full rounded-md border border-slate-700 bg-slate-900/90 px-3.5 py-2 font-mono text-sm text-cyan-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <div className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                {cidr.includes('/') ? `${cidr.split('/')[1]} mask` : 'single host'}
              </div>
            </div>
          </div>

          {/* Quick Subnet Presets */}
          <div>
            <div className="text-[11px] text-slate-400 font-medium mb-1.5">Subnet Quick Select:</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {presets.map((p) => {
                const isActive = cidr === p.cidr;
                return (
                  <button
                    key={p.label}
                    onClick={() => setCidr(p.cidr)}
                    className={`text-left px-2.5 py-1.5 rounded border text-xs transition-colors ${
                      isActive
                        ? 'border-cyan-500/70 bg-cyan-950/40 text-cyan-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-medium truncate">{p.label}</div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">{p.cidr}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Port Probes & Presets (5 columns) */}
        <div className="md:col-span-5 space-y-3">
          <div>
            <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span>Target Remote & MCP Ports</span>
              <span className="text-[11px] text-slate-500 font-mono">SSH:22 · RDP:3389 · MCP:8000+</span>
            </label>
            <input
              type="text"
              value={ports}
              onChange={(e) => setPorts(e.target.value.trim())}
              placeholder="e.g. 22,3389,8000,8080,5000"
              className="w-full rounded-md border border-slate-700 bg-slate-900/90 px-3.5 py-2 font-mono text-sm text-cyan-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <div className="text-[11px] text-slate-400 font-medium mb-1.5">Port Profile:</div>
            <div className="grid grid-cols-2 gap-1.5">
              {portPresets.map((pp) => {
                const isSelected = ports === pp.value;
                return (
                  <button
                    key={pp.label}
                    onClick={() => setPorts(pp.value)}
                    className={`text-left px-2.5 py-1.5 rounded border text-xs transition-colors ${
                      isSelected
                        ? 'border-cyan-500/70 bg-cyan-950/40 text-cyan-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-medium truncate">{pp.label}</div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">{pp.value}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Performance & Socket Parameters Toggle */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Sliders className="h-3.5 w-3.5 text-slate-500" />
          <span>{showAdvanced ? 'Hide Socket Tuning' : 'Advanced Tuning (Timeout, Concurrency)'}</span>
        </button>

        <div className="text-xs text-slate-500 font-mono">
          Timeout: <span className="text-slate-300">{timeout}s</span> · Concurrency:{' '}
          <span className="text-slate-300">{concurrency} workers</span>
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded border border-slate-800 bg-slate-900/50 p-3">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>TCP Socket Timeout</span>
              <span className="font-mono text-cyan-400">{timeout.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.05"
              value={timeout}
              onChange={(e) => setTimeoutVal(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Low values (0.3s - 0.5s) are optimal for local Wi-Fi hotspots and low latency links.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Parallel Socket Concurrency</span>
              <span className="font-mono text-cyan-400">{concurrency} tasks</span>
            </div>
            <input
              type="range"
              min="20"
              max="300"
              step="10"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Controlled via asyncio.Semaphore to prevent socket file descriptor exhaustion.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
