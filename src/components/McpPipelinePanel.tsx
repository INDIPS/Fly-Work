import React, { useState } from 'react';
import { Terminal, Copy, Check, Cpu, ArrowRight, ShieldCheck, Play } from 'lucide-react';

export const McpPipelinePanel: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const pipelines = [
    {
      title: 'Real-time Pipe into jq for Remote Management Detection',
      description: 'Stream live NDJSON lines and immediately filter for vulnerable or active SSH / RDP hosts as they are discovered.',
      command: `python3 net_probe.py --inline | jq --unbuffered -r 'select(.open_port_numbers | contains([22]) or contains([3389])) | "\\(.ip) -> \\(.services_detected | join(", ")) (\\(.min_latency_ms)ms)"'`,
      explanation: 'Streams each discovered host with zero buffering. As soon as a live host responds, jq prints the IP and service list immediately.',
    },
    {
      title: 'Automated Hotspot Inventory Pipeline (Bash While-Loop)',
      description: 'Process each discovered host in real-time to trigger automated diagnostics, SSH fingerprinting, or alerting.',
      command: `python3 net_probe.py --zone 192.168.43.0/24 --ports 22,3389,8000 --inline | while IFS= read -r line; do
  TARGET_IP=$(echo "$line" | jq -r '.ip')
  PORTS=$(echo "$line" | jq -r '.open_port_numbers | join(",")')
  echo "[ALERT] Live Host Found on Hotspot: $TARGET_IP with open ports: $PORTS"
  # Optional: ssh-keyscan -H "$TARGET_IP" >> known_hosts
done`,
      explanation: 'Pipeable stdout allows seamless Unix composability without waiting for the full subnet sweep to finish.',
    },
    {
      title: 'MCP Server Tool Registration (Claude Desktop / Cursor / Agent)',
      description: 'Register net_probe.py as a native MCP tool in your claude_desktop_config.json or MCP agent server.',
      command: `{
  "mcpServers": {
    "network-sentinel": {
      "command": "python3",
      "args": [
        "/absolute/path/to/net_probe.py",
        "--mcp"
      ],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}`,
      explanation: 'The --mcp flag formats stdout according to the Model Context Protocol specification, returning structured JSON content directly to AI agents.',
    },
    {
      title: 'One-Line CI/CD Network Perimeter Verification',
      description: 'Ensure no unauthorized management ports (22, 3389, 5900) are exposed on the host zone before deployment.',
      command: `python3 net_probe.py --zone 127.0.0.1/32 --ports 22,3389,5900 --json | jq -e '.hosts | map(select(.open_ports | length > 0)) | length == 0'`,
      explanation: 'Exits with 0 if clean, or non-zero if exposed ports are detected in the perimeter.',
    },
  ];

  const mcpToolDeclaration = `{
  "name": "discover_network_ports",
  "description": "Scans local hotspot or target subnet for active hosts and probes remote management ports (SSH:22, RDP:3389, MCP:8000/8080/5000).",
  "parameters": {
    "type": "object",
    "properties": {
      "zone": {
        "type": "string",
        "description": "Target CIDR (e.g. 192.168.43.0/24). Defaults to auto-detected active hotspot."
      },
      "ports": {
        "type": "string",
        "description": "Comma-separated ports or presets (ssh, rdp, mcp, 22,3389,8000)."
      },
      "timeout": {
        "type": "number",
        "description": "Socket probe timeout in seconds (default 0.5s)."
      }
    }
  }
}`;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-800 bg-[#111827]/80 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">
            Inline Pipe Execution & MCP Integration Architecture
          </h2>
        </div>
        <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
          NetProbe Sentinel is engineered from the ground up for Unix composability and AI tool calling.
          By separating human-facing ANSI formatting from machine-readable NDJSON (<code className="text-cyan-300">--inline</code>)
          and MCP protocol (<code className="text-cyan-300">--mcp</code>), it integrates directly into automated bash pipelines,
          security daemons, and Model Context Protocol hosts.
        </p>
      </div>

      {/* Pipelines List */}
      <div className="space-y-4">
        {pipelines.map((pipe, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-800 bg-[#0E131F] p-4 shadow-md hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">{pipe.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{pipe.description}</p>
              </div>
              <button
                onClick={() => copyToClipboard(pipe.command, idx)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors shrink-0"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative mt-2 rounded bg-[#070A10] border border-slate-900 p-3 font-mono text-xs text-cyan-300 overflow-x-auto whitespace-pre">
              {pipe.command}
            </div>

            <p className="mt-2 text-[11px] text-slate-500 font-sans">
              <span className="font-semibold text-slate-400">Mechanism:</span> {pipe.explanation}
            </p>
          </div>
        ))}
      </div>

      {/* MCP Tool Specification Card */}
      <div className="rounded-lg border border-slate-800 bg-[#0E131F] p-5 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Model Context Protocol (MCP) Tool Declaration</h3>
          </div>
          <button
            onClick={() => copyToClipboard(mcpToolDeclaration, 99)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {copiedIndex === 99 ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-slate-400" />
                <span>Copy JSON Schema</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Paste this JSON schema into any MCP tool provider so language models can discover hosts, verify SSH/RDP connectivity, and query active services on demand.
        </p>
        <pre className="rounded bg-[#070A10] border border-slate-900 p-3.5 font-mono text-xs text-slate-300 overflow-x-auto">
          {mcpToolDeclaration}
        </pre>
      </div>
    </div>
  );
};
