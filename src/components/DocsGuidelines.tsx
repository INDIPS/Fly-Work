import React from 'react';
import { ShieldAlert, BookOpen, Cpu, Terminal, CheckCircle, AlertTriangle, Zap } from 'lucide-react';

export const DocsGuidelines: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Architecture Overview */}
      <div className="rounded-lg border border-slate-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">
            Network Systems Engineering Architecture & Invariants
          </h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          NetProbe Sentinel is engineered as a standalone, non-blocking asynchronous Python utility designed for zero-install portability.
          Unlike traditional synchronous scanners or heavy C-extension tools, it relies entirely on the Python 3.8+ standard library
          (<code className="text-cyan-300">asyncio</code>, <code className="text-cyan-300">socket</code>, <code className="text-cyan-300">ipaddress</code>)
          to achieve sub-second sweeps across /24 (254 hosts) and /28 subnets.
        </p>
      </div>

      {/* Grid of Key Technical Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Subnet & Hotspot Detection */}
        <div className="rounded-lg border border-slate-800 bg-[#0E131F] p-4 shadow-md space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
            <Zap className="h-4 w-4" />
            <h3>1. Active Subnet & Hotspot Resolution</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The script determines the active default route without sending external ICMP or UDP packets over the WAN.
            By connecting an unconnected <code className="text-slate-300">SOCK_DGRAM</code> socket to a dummy public IP (8.8.8.8),
            the kernel routing table selects the primary outbound network interface and local IP.
          </p>
          <div className="rounded bg-[#070A10] border border-slate-900 p-2.5 font-mono text-[11px] text-slate-300">
            • Android Hotspot: 192.168.43.0/24<br />
            • iOS Personal Hotspot: 172.20.10.0/28 (14 usable hosts)<br />
            • Windows Mobile Hotspot: 192.168.137.0/24<br />
            • Standard RFC1918: 192.168.1.0/24, 10.0.0.0/24
          </div>
        </div>

        {/* Async TCP Probing */}
        <div className="rounded-lg border border-slate-800 bg-[#0E131F] p-4 shadow-md space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Cpu className="h-4 w-4" />
            <h3>2. Asynchronous Socket Verification & Throttling</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            To prevent socket file descriptor starvation (avoiding <code className="text-slate-300">EMFILE: Too many open files</code>),
            the engine utilizes an <code className="text-cyan-300">asyncio.Semaphore(concurrency=150)</code>.
            Each probe sets a short timeout (0.4s – 0.6s), enabling 254 hosts × 5 ports (1,270 socket checks) to finish in ~1.8 seconds.
          </p>
          <div className="rounded bg-[#070A10] border border-slate-900 p-2.5 font-mono text-[11px] text-slate-300">
            • RDP Handshake: Validates TPKT / X.224 connection-request frame.<br />
            • SSH Banner: Non-blocking read of SSH-2.0 daemon identification.<br />
            • MCP / HTTP: Evaluates GET / header signatures.
          </div>
        </div>

        {/* Robustness & Permissions */}
        <div className="rounded-lg border border-slate-800 bg-[#0E131F] p-4 shadow-md space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <h3>3. Firewall Timeouts & Permission Limits</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Unreachable hosts or firewalls dropping packets without sending TCP RST will trigger socket timeouts.
            The scanner gracefully catches <code className="text-slate-300">asyncio.TimeoutError</code>,
            <code className="text-slate-300">ConnectionRefusedError</code>, and OS permission limits without crashing.
          </p>
          <div className="rounded bg-[#070A10] border border-slate-900 p-2.5 font-mono text-[11px] text-slate-300">
            • No root / sudo privileges required for standard TCP connect.<br />
            • Clean SIGINT (Ctrl+C) trap flushes all live records before exit.<br />
            • Reverse DNS errors fail over to raw IP without blocking loop.
          </div>
        </div>

        {/* Safe Execution Guidelines */}
        <div className="rounded-lg border border-slate-800 bg-[#0E131F] p-4 shadow-md space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
            <ShieldAlert className="h-4 w-4" />
            <h3>4. Safe Execution Guidelines & Compliance</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Always restrict network sweeps to authorized subnets, personal hotspots, or test labs.
            Probing external enterprise subnets without explicit authorization violates network policies.
          </p>
          <div className="rounded bg-[#070A10] border border-slate-900 p-2.5 font-mono text-[11px] text-slate-300">
            • Always verify your target CIDR with <code className="text-cyan-300">--detect-only</code> first.<br />
            • Use conservative concurrency (50–100) on constrained Wi-Fi links.<br />
            • RFC 1918 Private Address spaces only.
          </div>
        </div>
      </div>
    </div>
  );
};
