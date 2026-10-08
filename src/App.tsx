import React, { useState, useEffect, useRef } from 'react';
import { TopNav, NavTab } from './components/TopNav';
import { ZoneDetectorCard } from './components/ZoneDetectorCard';
import { DiscoveredHostsGrid } from './components/DiscoveredHostsGrid';
import { TerminalRunner } from './components/TerminalRunner';
import { McpPipelinePanel } from './components/McpPipelinePanel';
import { PythonScriptViewer } from './components/PythonScriptViewer';
import { HostDetailModal } from './components/HostDetailModal';
import { DocsGuidelines } from './components/DocsGuidelines';
import { GeminiChatbot } from './components/GeminiChatbot';
import { AudioTranscriber } from './components/AudioTranscriber';
import { VeoVideoAnimator } from './components/VeoVideoAnimator';
import { MapsGroundingPanel } from './components/MapsGroundingPanel';
import { VoiceLiveModal } from './components/VoiceLiveModal';
import { HostResult, DetectedInterface } from './types/network';
import { auth, saveScanRecord, initAuth } from './lib/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('scanner');
  const [isVoiceLiveOpen, setIsVoiceLiveOpen] = useState(false);

  // Scanner configuration
  const [cidr, setCidr] = useState<string>('127.0.0.1/32');
  const [ports, setPorts] = useState<string>('22,3389,8000,8080,5000,3000');
  const [timeoutVal, setTimeoutVal] = useState<number>(0.5);
  const [concurrency, setConcurrency] = useState<number>(150);

  // Interface auto-detection
  const [detectedIface, setDetectedIface] = useState<DetectedInterface | null>(null);
  const [detectingIface, setDetectingIface] = useState<boolean>(false);

  // Execution state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hosts, setHosts] = useState<HostResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedHost, setSelectedHost] = useState<HostResult | null>(null);
  const [activeCommand, setActiveCommand] = useState<string>('python3 net_probe.py --inline');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch detected interface on mount
  const refreshDetection = async () => {
    setDetectingIface(true);
    try {
      const res = await fetch('/api/network/detect');
      const json = await res.json();
      if (json.success && json.data) {
        setDetectedIface(json.data);
        if (json.data.detected_cidr) {
          setCidr(json.data.detected_cidr);
        }
      }
    } catch (err) {
      console.error('Interface detection failed:', err);
    } finally {
      setDetectingIface(false);
    }
  };

  useEffect(() => {
    initAuth().catch(() => {});
    refreshDetection();
  }, []);

  // Update command preview string whenever parameters change
  useEffect(() => {
    setActiveCommand(`python3 net_probe.py --zone ${cidr} --ports ${ports} --timeout ${timeoutVal} --inline`);
  }, [cidr, ports, timeoutVal]);

  // Execute scan using live Server-Sent Events stream
  const startScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setHosts([]);

    const startTime = Date.now();
    const startLog = `[SENTINEL] Starting asynchronous discovery sweep on ${cidr} (Ports: ${ports}, Timeout: ${timeoutVal}s)`;
    setLogs([
      `$ python3 net_probe.py --zone ${cidr} --ports ${ports} --timeout ${timeoutVal} --inline`,
      startLog,
    ]);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const queryParams = new URLSearchParams({
      zone: cidr,
      ports: ports,
      timeout: String(timeoutVal),
      concurrency: String(concurrency),
    });

    const es = new EventSource(`/api/network/scan-stream?${queryParams.toString()}`);
    eventSourceRef.current = es;

    const accumulatedHosts: HostResult[] = [];

    es.addEventListener('host', (event: MessageEvent) => {
      try {
        const hostData: HostResult = JSON.parse(event.data);
        accumulatedHosts.push(hostData);
        setHosts((prev) => {
          const exists = prev.some((h) => h.ip === hostData.ip);
          if (exists) return prev;
          return [...prev, hostData];
        });

        const portsStr = hostData.open_ports.map((p) => `${p.port}/${p.service.split(' ')[0]}`).join(', ');
        const logLine = `[DISCOVERED] ${hostData.ip.padEnd(15)} | Ports: ${portsStr} | Latency: ${hostData.min_latency_ms.toFixed(1)}ms`;
        setLogs((prev) => [...prev, logLine]);
      } catch (e) {
        console.error('Failed to parse host event:', e);
      }
    });

    es.addEventListener('log', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.text) {
          setLogs((prev) => [...prev, data.text]);
        }
      } catch {
        setLogs((prev) => [...prev, event.data]);
      }
    });

    es.addEventListener('status', async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.state === 'finished') {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          setLogs((prev) => [
            ...prev,
            `[SENTINEL] Sweep complete in ${duration}s. Process exited cleanly.`,
          ]);
          setIsScanning(false);
          es.close();

          // Persist to Firestore if user logged in
          const currentUser = auth.currentUser;
          if (currentUser && accumulatedHosts.length > 0) {
            await saveScanRecord(currentUser.uid, {
              cidr,
              ports,
              liveHostsCount: accumulatedHosts.length,
              durationSeconds: parseFloat(duration),
              hosts: accumulatedHosts,
            });
          }
        }
      } catch {
        setIsScanning(false);
        es.close();
      }
    });

    es.onerror = () => {
      setLogs((prev) => [...prev, '[!] Stream closed or network probe finalized.']);
      setIsScanning(false);
      es.close();
    };
  };

  const handleDownloadScript = () => {
    window.location.href = '/api/network/script';
  };

  // Seed sample hotspot discovery for testing and visualization
  const handleSeedHotspotSample = () => {
    const sampleHosts: HostResult[] = [
      {
        ip: '192.168.43.1',
        is_alive: true,
        hostname: 'android-hotspot-gw.local',
        mac_address: '3c:22:fb:aa:12:44',
        mac_vendor: 'Google / Pixel AP',
        min_latency_ms: 1.2,
        open_port_numbers: [80, 8080, 5000],
        services_detected: ['HTTP Web Server', 'MCP Gateway / HTTP Alt', 'MCP Microservice'],
        timestamp: Date.now(),
        open_ports: [
          { port: 8080, is_open: true, service: 'MCP Gateway / HTTP Alt', latency_ms: 1.2, banner: 'HTTP 200 OK (FastAPI)' },
          { port: 5000, is_open: true, service: 'MCP Microservice', latency_ms: 1.5, banner: 'MCP SSE Endpoint' },
        ],
      },
      {
        ip: '192.168.43.45',
        is_alive: true,
        hostname: 'rpi-controller.local',
        mac_address: 'b8:27:eb:d4:11:82',
        mac_vendor: 'Raspberry Pi Foundation',
        min_latency_ms: 3.4,
        open_port_numbers: [22, 8000],
        services_detected: ['SSH (OpenSSH_9.2p1 Debian)', 'MCP Endpoint / FastAPI'],
        timestamp: Date.now(),
        open_ports: [
          { port: 22, is_open: true, service: 'SSH / Root Shell', latency_ms: 3.4, banner: 'SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u2' },
          { port: 8000, is_open: true, service: 'MCP Endpoint / FastAPI', latency_ms: 4.1, banner: 'MCP Tool Server Active' },
        ],
      },
      {
        ip: '192.168.43.112',
        is_alive: true,
        hostname: 'win11-field-workstation',
        mac_address: 'a4:bb:6d:ee:31:09',
        mac_vendor: 'Dell Technologies',
        min_latency_ms: 5.8,
        open_port_numbers: [3389, 445],
        services_detected: ['RDP (Active Remote Desktop Daemon)', 'SMB / Windows Sharing'],
        timestamp: Date.now(),
        open_ports: [
          { port: 3389, is_open: true, service: 'RDP (Remote Desktop)', latency_ms: 5.8, banner: 'TPKT/X.224 Handshake Confirmed' },
        ],
      },
      {
        ip: '192.168.43.189',
        is_alive: true,
        hostname: 'macbook-pro.local',
        mac_address: '70:85:c2:44:90:1a',
        mac_vendor: 'Apple Inc.',
        min_latency_ms: 2.1,
        open_port_numbers: [22, 3000, 8000],
        services_detected: ['SSH / Root Shell', 'Node.js / Web Console', 'MCP Endpoint'],
        timestamp: Date.now(),
        open_ports: [
          { port: 22, is_open: true, service: 'SSH / Root Shell', latency_ms: 2.1, banner: 'SSH-2.0-OpenSSH_9.6' },
          { port: 3000, is_open: true, service: 'Node.js / Web Console', latency_ms: 2.4, banner: 'HTTP 200' },
          { port: 8000, is_open: true, service: 'MCP Endpoint', latency_ms: 2.7, banner: 'Model Context Protocol Provider' },
        ],
      },
    ];
    setHosts(sampleHosts);
    setCidr('192.168.43.0/24');
    setLogs((prev) => [
      ...prev,
      '[DEMO] Loaded 4 live hotspot host profiles with verified RDP, SSH, and MCP endpoints.',
    ]);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract (Wordmark - Navigation - Actions) */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isScanning={isScanning}
        onTriggerScan={startScan}
        onDownloadScript={handleDownloadScript}
        onOpenVoiceLive={() => setIsVoiceLiveOpen(true)}
      />

      {/* Main Container Viewport */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Contextual Metric Banner (Zero-Pill Discipline) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-200">Active Network Zone</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono text-cyan-400">{cidr}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Targeting {ports.split(',').length} ports</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono tabular-nums text-emerald-400">{hosts.length} live hosts verified</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedHotspotSample}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-4"
            >
              Load Hotspot Topology Demo
            </button>
            <span aria-hidden="true" className="text-slate-700">|</span>
            <span className="text-[11px] text-slate-500 font-mono">Python 3.10 Runtime</span>
          </div>
        </div>

        {/* Tab 1: Zone Discovery & Matrix */}
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <ZoneDetectorCard
              cidr={cidr}
              setCidr={setCidr}
              ports={ports}
              setPorts={setPorts}
              timeout={timeoutVal}
              setTimeoutVal={setTimeoutVal}
              concurrency={concurrency}
              setConcurrency={setConcurrency}
              detectedIface={detectedIface}
              detectingIface={detectingIface}
              onRefreshDetection={refreshDetection}
              isScanning={isScanning}
              onStartScan={startScan}
            />

            <DiscoveredHostsGrid
              hosts={hosts}
              isScanning={isScanning}
              onSelectHost={setSelectedHost}
              onStartScan={startScan}
            />
          </div>
        )}

        {/* Tab 2: Inline Stream & Terminal View */}
        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400">
              Live asynchronous stdout feed. The underlying <code className="text-cyan-300">net_probe.py</code> utility flushes each verified host immediately to stdout.
            </div>
            <TerminalRunner
              logs={logs}
              hosts={hosts}
              isScanning={isScanning}
              onClearLogs={() => setLogs([])}
              onStartScan={startScan}
              activeCommand={activeCommand}
            />
          </div>
        )}

        {/* Tab 3: MCP Pipeline & Unix Pipes */}
        {activeTab === 'mcp' && <McpPipelinePanel />}

        {/* Tab 4: Gemini Multi-Turn Chatbot */}
        {activeTab === 'chat' && <GeminiChatbot />}

        {/* Tab 5: Audio Transcriber (gemini-3.5-transcribe) */}
        {activeTab === 'transcribe' && <AudioTranscriber />}

        {/* Tab 6: Veo Video Animator (veo-3.1-fast-generate-preview) */}
        {activeTab === 'video' && <VeoVideoAnimator />}

        {/* Tab 7: Google Maps Grounding (gemini-3.5-flash with googleMaps) */}
        {activeTab === 'maps' && <MapsGroundingPanel />}

        {/* Tab 8: Standalone Python Source Code */}
        {activeTab === 'script' && <PythonScriptViewer />}

        {/* Tab 9: Guidelines & Architecture */}
        {activeTab === 'docs' && <DocsGuidelines />}
      </main>

      {/* Host Details Inspection Modal */}
      <HostDetailModal host={selectedHost} onClose={() => setSelectedHost(null)} />

      {/* Live Voice Conversation Modal (gemini-3.8-live) */}
      <VoiceLiveModal
        isOpen={isVoiceLiveOpen}
        onClose={() => setIsVoiceLiveOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#080C14] py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>NetProbe Sentinel · Senior Network Systems Engineering Tool & AI Suite</div>
          <div className="font-mono text-[11px] text-slate-600">
            Executable: <span className="text-slate-400">./net_probe.py</span> · Firebase Auth & Firestore
          </div>
        </div>
      </footer>
    </div>
  );
}
