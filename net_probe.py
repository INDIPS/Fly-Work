#!/usr/bin/env python3
"""
================================================================================
NetProbe Sentinel - Standalone Subnet Discovery & Port Verification Utility
================================================================================
Author: Senior Network Systems Engineer & Python Developer
Compatibility: Python 3.8+ (No external pip packages required)
Optional Enhancements: 'rich' for enhanced TUI tables, 'scapy' for raw ARP

Description:
    A high-performance, asynchronous network scanner engineered for active
    hotspot discovery, custom subnet enumeration, and rapid remote management
    service verification (RDP:3389, SSH:22, MCP endpoints:8000/8080/5000, etc.).

    Designed for 'inline execution' - capable of streaming structured NDJSON
    to stdout in real time for immediate pipe consumption by MCP servers,
    orchestration pipelines, or Unix toolchains (jq, awk, fzf).

Usage Examples:
    # 1. Automatic interface & hotspot detection, interactive terminal output
    python3 net_probe.py

    # 2. Inline mode: real-time streaming NDJSON for pipes / MCP tools
    python3 net_probe.py --inline | jq '.ip, .open_ports'

    # 3. Custom zone with specific management & MCP ports
    python3 net_probe.py --zone 192.168.43.0/24 --ports 22,3389,8000,8080,5000

    # 4. Machine-readable JSON output for automated toolchains
    python3 net_probe.py --json > scan_report.json

    # 5. MCP (Model Context Protocol) tool execution format
    python3 net_probe.py --mcp --timeout 0.4
================================================================================
"""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import ipaddress
import json
import os
import platform
import re
import signal
import socket
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple

# ------------------------------------------------------------------------------
# Terminal ANSI Color & Styling Definitions (Zero-dependency fallback)
# ------------------------------------------------------------------------------
HAS_RICH = False
try:
    import rich  # type: ignore
    from rich.console import Console  # type: ignore
    from rich.table import Table  # type: ignore
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn  # type: ignore
    HAS_RICH = True
except ImportError:
    HAS_RICH = False


class Colors:
    """ANSI color codes for portable, zero-dependency CLI output."""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    UNDERLINE = "\033[4m"
    
    # Foreground
    RED = "\033[38;5;196m"
    GREEN = "\033[38;5;46m"
    YELLOW = "\033[38;5;220m"
    BLUE = "\033[38;5;39m"
    MAGENTA = "\033[38;5;201m"
    CYAN = "\033[38;5;51m"
    WHITE = "\033[38;5;255m"
    GRAY = "\033[38;5;244m"
    DARK_GRAY = "\033[38;5;238m"
    
    # High-contrast badges
    BG_CYAN = "\033[48;5;31m\033[38;5;255m"
    BG_GREEN = "\033[48;5;28m\033[38;5;255m"
    BG_YELLOW = "\033[48;5;178m\033[38;5;16m"
    BG_RED = "\033[48;5;160m\033[38;5;255m"

    @classmethod
    def strip(cls, text: str) -> str:
        return re.sub(r"\033\[[0-9;]*m", "", text)


# ------------------------------------------------------------------------------
# Well-Known Service Signatures & Handshakes
# ------------------------------------------------------------------------------
DEFAULT_TARGET_PORTS: Dict[int, str] = {
    22: "SSH / Root Shell",
    3389: "RDP (Remote Desktop)",
    8000: "MCP Endpoint / FastAPI",
    8080: "MCP Gateway / HTTP Alt",
    5000: "Flask / MCP Microservice",
    3000: "Node.js / Web Console",
    5900: "VNC Remote Display",
    8443: "HTTPS Management",
    8888: "Jupyter / MCP Agent",
    9000: "Portainer / Edge Agent",
    23: "Telnet",
    445: "SMB / Windows Sharing",
    80: "HTTP Web Server",
    443: "HTTPS Secure Server",
}

# RDP TPKT Connection-Request payload (X.224 CR-TPDU) to verify active RDP daemon
RDP_PROBE_PAYLOAD = (
    b"\x03\x00\x00\x13"  # TPKT Header (Version 3, Length 19)
    b"\x0e\xe0\x00\x00"  # X.224 CR-TPDU (Length 14, Connection Request)
    b"\x00\x00\x00\x01"  # DST-REF 0, SRC-REF 0, Class 0
    b"\x00\x08\x00\x03"  # RDP Negotiation Request (Type 1, Flags 0, Length 8)
    b"\x00\x00\x00"      # Protocols: PROTOCOL_RDP | PROTOCOL_SSL
)

# ------------------------------------------------------------------------------
# Data Models
# ------------------------------------------------------------------------------
@dataclasses.dataclass
class PortProbeResult:
    port: int
    is_open: bool
    service: str
    latency_ms: float
    banner: str = ""
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "port": self.port,
            "is_open": self.is_open,
            "service": self.service,
            "latency_ms": round(self.latency_ms, 2),
            "banner": self.banner.strip() if self.banner else "",
            "error": self.error,
        }


@dataclasses.dataclass
class HostResult:
    ip: str
    is_alive: bool
    hostname: str = ""
    mac_address: str = ""
    mac_vendor: str = ""
    open_ports: List[PortProbeResult] = dataclasses.field(default_factory=list)
    ping_latency_ms: Optional[float] = None

    @property
    def min_latency_ms(self) -> float:
        if self.open_ports:
            return round(min(p.latency_ms for p in self.open_ports), 2)
        return round(self.ping_latency_ms or 0.0, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ip": self.ip,
            "is_alive": self.is_alive,
            "hostname": self.hostname,
            "mac_address": self.mac_address,
            "mac_vendor": self.mac_vendor,
            "open_ports": [p.to_dict() for p in self.open_ports],
            "open_port_numbers": [p.port for p in self.open_ports],
            "services_detected": [p.service for p in self.open_ports],
            "min_latency_ms": self.min_latency_ms,
            "timestamp": time.time(),
        }


# ------------------------------------------------------------------------------
# Network & Subnet Discovery Subsystem
# ------------------------------------------------------------------------------
class NetworkInterfaceDetector:
    """Detects active network interfaces, hotspot configurations, and IP ranges."""

    KNOWN_HOTSPOT_PREFIXES = {
        "192.168.43.": "Android Wi-Fi Hotspot",
        "172.20.10.": "Apple iOS Personal Hotspot",
        "192.168.137.": "Windows Mobile Hotspot",
        "192.168.12.": "T-Mobile Home Internet / Hotspot",
        "192.168.8.": "Huawei / Generic LTE Hotspot",
    }

    @staticmethod
    def get_default_gateway_and_ip() -> Tuple[Optional[str], Optional[str]]:
        """Determine outbound IP and gateway without sending real packets to external net."""
        local_ip: Optional[str] = None
        gateway_ip: Optional[str] = None
        try:
            # Connect via UDP socket (does not initiate handshake or send data)
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.settimeout(0.5)
                # Public DNS IP used solely to resolve routing table entry
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
        except Exception:
            pass

        # Parse Linux /proc/net/route if on Linux
        if platform.system() == "Linux" and os.path.exists("/proc/net/route"):
            try:
                with open("/proc/net/route", "r") as f:
                    for line in f.readlines()[1:]:
                        fields = line.strip().split()
                        if len(fields) >= 3 and fields[1] == "00000000":  # Default route
                            gw_hex = fields[2]
                            # Little endian hex to IPv4
                            gw_int = int(gw_hex, 16)
                            gateway_ip = socket.inet_ntoa(gw_int.to_bytes(4, byteorder="little"))
                            break
            except Exception:
                pass

        # Fallback to ip route / netstat / route print
        if not gateway_ip:
            try:
                if platform.system() == "Darwin":
                    res = subprocess.run(["route", "-n", "get", "default"], capture_output=True, text=True, timeout=1)
                    for line in res.stdout.splitlines():
                        if "gateway:" in line:
                            gateway_ip = line.split("gateway:")[1].strip()
                elif platform.system() == "Windows":
                    res = subprocess.run(["route", "print", "0.0.0.0"], capture_output=True, text=True, timeout=1)
                    for line in res.stdout.splitlines():
                        if "0.0.0.0" in line and len(line.split()) >= 3:
                            gateway_ip = line.split()[2]
                            break
            except Exception:
                pass

        return local_ip, gateway_ip

    @classmethod
    def detect_active_subnet(cls) -> Tuple[str, str, str, str]:
        """
        Auto-detects active network subnet.
        Returns: (cidr_network, local_ip, interface_type, notes)
        """
        local_ip, gateway = cls.get_default_gateway_and_ip()

        # If unable to determine via default route, search local interfaces
        if not local_ip or local_ip.startswith("127."):
            local_ip = "192.168.1.100"  # Sensible standard fallback

        # Determine CIDR and hotspot type
        hotspot_type = "Standard Local Subnet"
        for prefix, name in cls.KNOWN_HOTSPOT_PREFIXES.items():
            if local_ip.startswith(prefix):
                hotspot_type = name
                break

        # Calculate /24 network for class C, or /28 for iOS Hotspot
        try:
            if "iOS" in hotspot_type:
                # iOS personal hotspot default is 172.20.10.0/28 (14 usable hosts)
                ip_obj = ipaddress.IPv4Interface(f"{local_ip}/28")
                cidr = str(ip_obj.network)
            else:
                ip_obj = ipaddress.IPv4Interface(f"{local_ip}/24")
                cidr = str(ip_obj.network)
        except Exception:
            cidr = f"{local_ip.rsplit('.', 1)[0]}.0/24"

        notes = f"{hotspot_type} (Gateway: {gateway or 'Unknown'})"
        return cidr, local_ip, hotspot_type, notes


# ------------------------------------------------------------------------------
# ARP & DNS Resolution Helpers
# ------------------------------------------------------------------------------
class HostResolver:
    """Performs non-blocking DNS PTR lookups and ARP table extraction."""

    OUI_DATABASE = {
        "b8:27:eb": "Raspberry Pi",
        "dc:a6:32": "Raspberry Pi",
        "e4:5f:01": "Raspberry Pi",
        "00:1a:11": "Google",
        "f4:f5:e8": "Google",
        "3c:22:fb": "Apple",
        "ac:de:48": "Apple",
        "bc:d0:74": "Apple",
        "70:85:c2": "Apple",
        "00:50:56": "VMware",
        "08:00:27": "VirtualBox",
        "52:54:00": "QEMU/KVM",
        "b0:a7:37": "Intel",
        "a4:bb:6d": "Dell",
        "24:4b:fe": "Espressif (ESP32/ESP8266)",
    }

    _arp_cache: Dict[str, str] = {}
    _arp_loaded: bool = False

    @classmethod
    def load_arp_cache(cls) -> None:
        """Parses local OS ARP table into memory cache."""
        if cls._arp_loaded:
            return
        cls._arp_loaded = True
        try:
            if platform.system() == "Linux" and os.path.exists("/proc/net/arp"):
                with open("/proc/net/arp", "r") as f:
                    for line in f.readlines()[1:]:
                        parts = line.split()
                        if len(parts) >= 4:
                            ip, mac = parts[0], parts[3]
                            if mac != "00:00:00:00:00:00":
                                cls._arp_cache[ip] = mac.lower()
            else:
                # Run arp -a
                proc = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=1)
                for line in proc.stdout.splitlines():
                    # Matches IP and MAC in typical arp output
                    ip_match = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", line)
                    mac_match = re.search(r"([0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2})", line)
                    if ip_match and mac_match:
                        cls._arp_cache[ip_match.group(1)] = mac_match.group(1).lower().replace("-", ":")
        except Exception:
            pass

    @classmethod
    async def resolve_hostname(cls, ip: str, timeout: float = 0.3) -> str:
        """Asynchronously resolve reverse DNS pointer."""
        loop = asyncio.get_running_loop()
        try:
            name, _, _ = await asyncio.wait_for(
                loop.run_in_executor(None, socket.gethostbyaddr, ip),
                timeout=timeout
            )
            return name
        except Exception:
            return ""

    @classmethod
    def get_mac_and_vendor(cls, ip: str) -> Tuple[str, str]:
        cls.load_arp_cache()
        mac = cls._arp_cache.get(ip, "")
        vendor = ""
        if mac:
            prefix = ":".join(mac.split(":")[:3]).lower()
            vendor = cls.OUI_DATABASE.get(prefix, "Network Device")
        return mac, vendor


# ------------------------------------------------------------------------------
# Asynchronous Port Verification & Fingerprinting Engine
# ------------------------------------------------------------------------------
class PortVerifier:
    """Rapid asynchronous TCP socket verification with service fingerprinting."""

    def __init__(self, timeout: float = 0.6, grab_banners: bool = True):
        self.timeout = timeout
        self.grab_banners = grab_banners

    async def probe_port(self, ip: str, port: int) -> PortProbeResult:
        """Attempts an asynchronous TCP connection and extracts service identity."""
        service_label = DEFAULT_TARGET_PORTS.get(port, f"Custom Port {port}")
        start_time = time.perf_counter()
        
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port),
                timeout=self.timeout
            )
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            banner = ""

            if self.grab_banners:
                try:
                    # 1. SSH banner grab (port 22)
                    if port == 22:
                        raw_banner = await asyncio.wait_for(reader.read(256), timeout=0.4)
                        banner = raw_banner.decode(errors="replace").strip()
                        if "SSH" in banner:
                            service_label = f"SSH ({banner.splitlines()[0]})"
                    
                    # 2. RDP handshake probe (port 3389)
                    elif port == 3389:
                        writer.write(RDP_PROBE_PAYLOAD)
                        await writer.drain()
                        resp = await asyncio.wait_for(reader.read(64), timeout=0.4)
                        if len(resp) >= 4 and resp[0] == 0x03:  # TPKT response
                            service_label = "RDP (Active Remote Desktop Daemon)"
                            banner = "TPKT/X.224 Handshake Confirmed"
                        else:
                            service_label = "RDP (TCP Port Open)"

                    # 3. HTTP / MCP API endpoints (8000, 8080, 5000, 3000, etc.)
                    elif port in (8000, 8080, 5000, 3000, 8888, 80, 8443):
                        # Send light HTTP OPTIONS or GET request to detect MCP / Server header
                        req = f"GET / HTTP/1.1\r\nHost: {ip}:{port}\r\nUser-Agent: NetProbe-Sentinel/1.0\r\nConnection: close\r\n\r\n"
                        writer.write(req.encode())
                        await writer.drain()
                        http_resp = await asyncio.wait_for(reader.read(512), timeout=0.4)
                        decoded = http_resp.decode(errors="replace")
                        
                        # Inspect headers for MCP or server signatures
                        server_match = re.search(r"Server:\s*([^\r\n]+)", decoded, re.IGNORECASE)
                        if "mcp" in decoded.lower():
                            service_label = f"MCP Endpoint ({port})"
                            banner = "MCP Protocol Keyword Detected"
                        elif server_match:
                            banner = server_match.group(1).strip()
                            service_label = f"HTTP Service [{banner}]"
                        else:
                            status_match = re.search(r"HTTP/\d\.\d\s+(\d{3})", decoded)
                            if status_match:
                                banner = f"HTTP {status_match.group(1)}"
                except Exception:
                    # Non-fatal banner grab timeout
                    pass

            # Gracefully close socket
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

            return PortProbeResult(
                port=port,
                is_open=True,
                service=service_label,
                latency_ms=latency_ms,
                banner=banner,
            )

        except (asyncio.TimeoutError, TimeoutError):
            return PortProbeResult(port=port, is_open=False, service=service_label, latency_ms=0.0, error="Timeout")
        except ConnectionRefusedError:
            return PortProbeResult(port=port, is_open=False, service=service_label, latency_ms=0.0, error="Refused")
        except OSError as e:
            return PortProbeResult(port=port, is_open=False, service=service_label, latency_ms=0.0, error=str(e))
        except Exception as e:
            return PortProbeResult(port=port, is_open=False, service=service_label, latency_ms=0.0, error=str(e))


# ------------------------------------------------------------------------------
# Orchestration & Subnet Scan Manager
# ------------------------------------------------------------------------------
class SentinelScanner:
    """Coordinates host discovery, concurrency limits, and output formatters."""

    def __init__(
        self,
        cidr: str,
        ports: List[int],
        timeout: float = 0.5,
        concurrency: int = 150,
        inline_mode: bool = False,
        json_mode: bool = False,
        mcp_mode: bool = False,
        resolve_names: bool = True,
    ):
        self.cidr = cidr
        self.ports = sorted(list(set(ports)))
        self.timeout = timeout
        self.concurrency = concurrency
        self.inline_mode = inline_mode
        self.json_mode = json_mode
        self.mcp_mode = mcp_mode
        self.resolve_names = resolve_names
        
        self.semaphore = asyncio.Semaphore(self.concurrency)
        self.verifier = PortVerifier(timeout=self.timeout, grab_banners=True)
        self.results: List[HostResult] = []
        self._is_cancelled = False

    def emit_inline_log(self, host: HostResult) -> None:
        """Stream real-time structured output to stdout for pipes or MCP consumption."""
        if not host.open_ports:
            return

        if self.inline_mode:
            # Emit single-line compact JSON (NDJSON)
            payload = host.to_dict()
            sys.stdout.write(json.dumps(payload) + "\n")
            sys.stdout.flush()
        elif not self.json_mode and not self.mcp_mode:
            # Emit formatted ANSI status line
            ports_str = ", ".join([f"{p.port}/{p.service.split()[0]}" for p in host.open_ports])
            lat_str = f"{host.min_latency_ms:.1f}ms"
            host_info = f" ({host.hostname})" if host.hostname else ""
            mac_info = f" [{host.mac_address} - {host.mac_vendor}]" if host.mac_address else ""
            
            line = (
                f"{Colors.GREEN}[DISCOVERED]{Colors.RESET} "
                f"{Colors.BOLD}{host.ip:<15}{Colors.RESET}{host_info} "
                f"| Ports: {Colors.CYAN}{ports_str:<25}{Colors.RESET} "
                f"| Lat: {Colors.YELLOW}{lat_str:>7}{Colors.RESET}{mac_info}"
            )
            print(line, flush=True)

    async def scan_single_host(self, ip_str: str) -> Optional[HostResult]:
        """Scans specified ports on an individual IP host."""
        if self._is_cancelled:
            return None

        open_ports: List[PortProbeResult] = []
        
        # Parallel port probes for this host governed by semaphore
        async def probe_with_sem(port: int):
            async with self.semaphore:
                return await self.verifier.probe_port(ip_str, port)

        probe_tasks = [probe_with_sem(p) for p in self.ports]
        probe_results = await asyncio.gather(*probe_tasks, return_exceptions=True)

        for res in probe_results:
            if isinstance(res, PortProbeResult) and res.is_open:
                open_ports.append(res)

        # If any port is open or reachable, catalog host as live
        if open_ports:
            hostname = ""
            if self.resolve_names:
                hostname = await HostResolver.resolve_hostname(ip_str, timeout=0.3)
            mac, vendor = HostResolver.get_mac_and_vendor(ip_str)

            host = HostResult(
                ip=ip_str,
                is_alive=True,
                hostname=hostname,
                mac_address=mac,
                mac_vendor=vendor,
                open_ports=open_ports,
                ping_latency_ms=min([p.latency_ms for p in open_ports]),
            )
            self.emit_inline_log(host)
            return host

        return None

    async def run(self) -> List[HostResult]:
        """Executes full subnet sweep with concurrency orchestration."""
        try:
            network = ipaddress.ip_network(self.cidr, strict=False)
        except ValueError as e:
            sys.stderr.write(f"{Colors.RED}Error: Invalid CIDR range '{self.cidr}': {e}{Colors.RESET}\n")
            return []

        hosts = [str(ip) for ip in network.hosts()]
        total_hosts = len(hosts)

        # Header for human-readable mode
        if not self.inline_mode and not self.json_mode and not self.mcp_mode:
            print(f"{Colors.BOLD}{Colors.CYAN}NetProbe Sentinel - Active Network Scanner{Colors.RESET}")
            print(f"{Colors.DIM}Target Zone: {self.cidr} ({total_hosts} hosts) | Ports: {self.ports} | Timeout: {self.timeout}s{Colors.RESET}")
            print(f"{Colors.DIM}{'─' * 76}{Colors.RESET}")

        start_time = time.perf_counter()
        tasks = [self.scan_single_host(ip) for ip in hosts]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        for item in raw_results:
            if isinstance(item, HostResult):
                self.results.append(item)

        elapsed = time.perf_counter() - start_time

        # Final output rendering
        if self.json_mode:
            self._render_json_output(total_hosts, elapsed)
        elif self.mcp_mode:
            self._render_mcp_output(total_hosts, elapsed)
        elif not self.inline_mode:
            self._render_human_summary(total_hosts, elapsed)

        return self.results

    def _render_human_summary(self, total_hosts: int, elapsed: float) -> None:
        """Render beautiful summary table for interactive CLI users."""
        print(f"\n{Colors.DIM}{'─' * 76}{Colors.RESET}")
        print(f"{Colors.BOLD}Scan Complete:{Colors.RESET} Scanned {total_hosts} hosts in {elapsed:.2f}s | Live with open ports: {len(self.results)}")
        
        if not self.results:
            print(f"{Colors.YELLOW}No hosts with open target ports discovered in {self.cidr}.{Colors.RESET}")
            return

        if HAS_RICH:
            console = Console()
            table = Table(title=f"Discovered Hosts ({self.cidr})", header_style="bold cyan")
            table.add_column("IP Address", style="bold green")
            table.add_column("Hostname / Host", style="white")
            table.add_column("MAC / Vendor", style="dim")
            table.add_column("Open Management Ports", style="cyan")
            table.add_column("Detected Services", style="yellow")
            table.add_column("Latency", justify="right", style="green")

            for host in self.results:
                ports_list = ", ".join([str(p.port) for p in host.open_ports])
                services_list = "\n".join([f"{p.port}: {p.service}" for p in host.open_ports])
                table.add_row(
                    host.ip,
                    host.hostname or "—",
                    f"{host.mac_address}\n{host.mac_vendor}".strip() or "—",
                    ports_list,
                    services_list,
                    f"{host.min_latency_ms:.1f} ms",
                )
            console.print(table)
        else:
            # Fallback ANSI Table
            print(f"\n{Colors.BOLD}{'IP ADDRESS':<16} {'HOSTNAME':<20} {'PORTS':<18} {'PRIMARY SERVICE':<22} {'LATENCY':>8}{Colors.RESET}")
            print(f"{Colors.DARK_GRAY}{'─' * 88}{Colors.RESET}")
            for host in self.results:
                ports_str = ",".join(str(p.port) for p in host.open_ports)
                primary_svc = host.open_ports[0].service if host.open_ports else "Unknown"
                print(
                    f"{Colors.GREEN}{host.ip:<16}{Colors.RESET} "
                    f"{host.hostname[:18] or '—':<20} "
                    f"{Colors.CYAN}{ports_str:<18}{Colors.RESET} "
                    f"{primary_svc[:20]:<22} "
                    f"{Colors.YELLOW}{host.min_latency_ms:>6.1f}ms{Colors.RESET}"
                )
            print(f"{Colors.DARK_GRAY}{'─' * 88}{Colors.RESET}")

    def _render_json_output(self, total_hosts: int, elapsed: float) -> None:
        """Render complete machine-readable JSON document."""
        output = {
            "metadata": {
                "utility": "NetProbe Sentinel",
                "version": "1.0.0",
                "cidr_zone": self.cidr,
                "ports_probed": self.ports,
                "total_hosts_scanned": total_hosts,
                "live_hosts_count": len(self.results),
                "duration_seconds": round(elapsed, 3),
                "timestamp": time.time(),
            },
            "hosts": [h.to_dict() for h in self.results],
        }
        sys.stdout.write(json.dumps(output, indent=2) + "\n")
        sys.stdout.flush()

    def _render_mcp_output(self, total_hosts: int, elapsed: float) -> None:
        """Render formatted response conforming to Model Context Protocol (MCP) Tool schema."""
        summary_lines = [
            f"Network Discovery Report for {self.cidr}",
            f"- Scanned Hosts: {total_hosts}",
            f"- Responsive Live Hosts: {len(self.results)}",
            f"- Scan Duration: {elapsed:.2f}s",
            "",
            "Discovered Endpoints:",
        ]
        for h in self.results:
            ports_summary = ", ".join([f"{p.port} ({p.service})" for p in h.open_ports])
            summary_lines.append(f"• IP {h.ip} [{h.hostname or 'No DNS'}] | Latency: {h.min_latency_ms:.1f}ms | Open: {ports_summary}")

        mcp_payload = {
            "content": [
                {
                    "type": "text",
                    "text": "\n".join(summary_lines),
                }
            ],
            "isError": False,
            "structuredContent": {
                "cidr": self.cidr,
                "hosts_found": len(self.results),
                "hosts": [h.to_dict() for h in self.results],
            }
        }
        sys.stdout.write(json.dumps(mcp_payload, indent=2) + "\n")
        sys.stdout.flush()


# ------------------------------------------------------------------------------
# Command Line Interface (CLI) Parser & Entrypoint
# ------------------------------------------------------------------------------
def parse_ports_arg(ports_str: str) -> List[int]:
    """Parse comma-separated ports and ranges (e.g. '22,80,8000-8005,rdp,ssh')."""
    port_list: List[int] = []
    shortcuts = {
        "ssh": [22],
        "rdp": [3389],
        "mcp": [8000, 8080, 5000],
        "web": [80, 443, 8080, 3000],
        "vnc": [5900],
        "all_remote": [22, 3389, 5900, 8000, 8080, 5000],
    }

    for item in ports_str.split(","):
        token = item.strip().lower()
        if not token:
            continue
        if token in shortcuts:
            port_list.extend(shortcuts[token])
        elif "-" in token:
            try:
                start_p, end_p = token.split("-", 1)
                port_list.extend(range(int(start_p), int(end_p) + 1))
            except ValueError:
                pass
        else:
            try:
                port_list.append(int(token))
            except ValueError:
                pass

    return sorted(list(set(port_list))) if port_list else [22, 3389, 8000, 8080, 5000]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="NetProbe Sentinel: Asynchronous Network Zone Discovery & Port Verifier",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 net_probe.py                                 # Auto-detect interface & scan management ports
  python3 net_probe.py --inline                        # Real-time NDJSON stream for pipes & MCP servers
  python3 net_probe.py --zone 192.168.43.0/24          # Android hotspot scan
  python3 net_probe.py --ports 22,3389,8000,8080,5000  # Explicit ports verification
  python3 net_probe.py --json > report.json            # Machine-readable output
        """
    )

    parser.add_argument(
        "-z", "--zone",
        dest="zone",
        type=str,
        default=None,
        help="Target IP subnet CIDR (e.g., 192.168.1.0/24). If omitted, automatically detects active hotspot/subnet."
    )
    parser.add_argument(
        "-p", "--ports",
        dest="ports",
        type=str,
        default="22,3389,8000,8080,5000",
        help="Comma-separated ports/ranges or aliases: ssh, rdp, mcp, all_remote (default: 22,3389,8000,8080,5000)"
    )
    parser.add_argument(
        "-t", "--timeout",
        dest="timeout",
        type=float,
        default=0.5,
        help="TCP connection socket timeout in seconds (default: 0.5s for fast local network)"
    )
    parser.add_argument(
        "-c", "--concurrency",
        dest="concurrency",
        type=int,
        default=150,
        help="Maximum concurrent async socket tasks (default: 150)"
    )
    parser.add_argument(
        "--inline",
        dest="inline",
        action="store_true",
        help="Inline execution mode: stream real-time NDJSON logs to stdout for pipes or MCP orchestration."
    )
    parser.add_argument(
        "--json",
        dest="json",
        action="store_true",
        help="Emit full structured JSON output upon scan completion."
    )
    parser.add_argument(
        "--mcp",
        dest="mcp",
        action="store_true",
        help="Emit output in Model Context Protocol (MCP) Tool Execution format."
    )
    parser.add_argument(
        "--no-dns",
        dest="no_dns",
        action="store_true",
        help="Disable reverse DNS PTR hostname resolution."
    )
    parser.add_argument(
        "--detect-only",
        dest="detect_only",
        action="store_true",
        help="Only display detected active network interfaces and exit."
    )

    args = parser.parse_args()

    # Handle interface detection
    cidr = args.zone
    if not cidr or args.detect_only:
        detected_cidr, local_ip, iface_type, notes = NetworkInterfaceDetector.detect_active_subnet()
        if args.detect_only:
            info = {
                "detected_cidr": detected_cidr,
                "local_ip": local_ip,
                "interface_type": iface_type,
                "details": notes,
            }
            print(json.dumps(info, indent=2))
            return 0
        if not cidr:
            cidr = detected_cidr

    target_ports = parse_ports_arg(args.ports)

    # Initialize scanner
    scanner = SentinelScanner(
        cidr=cidr,
        ports=target_ports,
        timeout=args.timeout,
        concurrency=args.concurrency,
        inline_mode=args.inline,
        json_mode=args.json,
        mcp_mode=args.mcp,
        resolve_names=not args.no_dns,
    )

    # Clean signal handling for Ctrl+C
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def handle_signal():
        scanner._is_cancelled = True
        sys.stderr.write(f"\n{Colors.YELLOW}[!] Interrupt received, finalizing scanned hosts...{Colors.RESET}\n")

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, handle_signal)
        except (NotImplementedError, AttributeError):
            # Windows does not support loop.add_signal_handler
            pass

    try:
        loop.run_until_complete(scanner.run())
    except KeyboardInterrupt:
        pass
    finally:
        loop.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
