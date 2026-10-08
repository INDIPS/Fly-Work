export interface PortProbeResult {
  port: number;
  is_open: boolean;
  service: string;
  latency_ms: number;
  banner?: string;
  error?: string | null;
}

export interface HostResult {
  ip: string;
  is_alive: boolean;
  hostname: string;
  mac_address: string;
  mac_vendor: string;
  open_ports: PortProbeResult[];
  open_port_numbers: number[];
  services_detected: string[];
  min_latency_ms: number;
  timestamp: number;
}

export interface ScanMetadata {
  utility: string;
  version: string;
  cidr_zone: string;
  ports_probed: number[];
  total_hosts_scanned: number;
  live_hosts_count: number;
  duration_seconds: number;
  timestamp: number;
}

export interface DetectedInterface {
  detected_cidr: string;
  local_ip: string;
  interface_type: string;
  details: string;
}

export interface ScanPreset {
  id: string;
  label: string;
  category: 'hotspot' | 'management' | 'custom';
  cidr?: string;
  ports: string;
  description: string;
}
