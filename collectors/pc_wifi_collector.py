from __future__ import annotations

import argparse
import json
import platform
import re
import subprocess
import time
import urllib.request
from dataclasses import dataclass


@dataclass
class WifiReading:
    ssid: str | None
    bssid: str | None
    rssi: float | None


def run(command: list[str]) -> str:
    return subprocess.check_output(command, text=True, stderr=subprocess.STDOUT, timeout=8)


def read_windows() -> WifiReading:
    output = run(["netsh", "wlan", "show", "interfaces"])
    ssid = find_value(output, r"^\s*SSID\s*:\s*(.+)$")
    bssid = find_value(output, r"^\s*BSSID\s*:\s*(.+)$")
    signal = find_value(output, r"^\s*Signal\s*:\s*(\d+)%")
    rssi = None
    if signal is not None:
        # Windows exposes percent, not true dBm. This rough conversion is labeled as estimated.
        rssi = (float(signal) / 2.0) - 100.0
    return WifiReading(ssid=ssid, bssid=bssid, rssi=rssi)


def read_linux() -> WifiReading:
    try:
        output = run(["iwconfig"])
    except Exception:
        output = run(["iw", "dev"])
    ssid = find_value(output, r'ESSID:"([^"]+)"') or find_value(output, r"ssid\s+(.+)")
    bssid = find_value(output, r"Access Point:\s*([0-9A-Fa-f:]+)") or find_value(output, r"addr\s+([0-9A-Fa-f:]+)")
    signal = find_value(output, r"Signal level[=:](-?\d+)")
    return WifiReading(ssid=ssid, bssid=bssid, rssi=float(signal) if signal else None)


def read_macos() -> WifiReading:
    output = run(["/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", "-I"])
    ssid = find_value(output, r"^\s*SSID:\s*(.+)$")
    bssid = find_value(output, r"^\s*BSSID:\s*(.+)$")
    rssi = find_value(output, r"^\s*agrCtlRSSI:\s*(-?\d+)$")
    return WifiReading(ssid=ssid, bssid=bssid, rssi=float(rssi) if rssi else None)


def find_value(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, re.MULTILINE)
    return match.group(1).strip() if match else None


def read_wifi() -> WifiReading:
    system = platform.system().lower()
    if "windows" in system:
        return read_windows()
    if "linux" in system:
        return read_linux()
    if "darwin" in system:
        return read_macos()
    raise RuntimeError(f"Unsupported OS: {platform.system()}")


def post_sample(api: str, payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{api.rstrip('/')}/api/samples",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        response.read()


def main() -> None:
    parser = argparse.ArgumentParser(description="Optional AetherSense PC Wi-Fi RSSI collector")
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    parser.add_argument("--session", required=True)
    parser.add_argument("--x", type=float, default=50)
    parser.add_argument("--y", type=float, default=50)
    parser.add_argument("--interval", type=float, default=2.0)
    args = parser.parse_args()

    while True:
      reading = read_wifi()
      if reading.rssi is None:
          raise SystemExit("RSSI unavailable on this OS/interface. Collector will not invent signal values.")
      post_sample(
          args.api,
          {
              "session_id": args.session,
              "source": "pc",
              "x": args.x,
              "y": args.y,
              "ts": time.time(),
              "ssid": reading.ssid,
              "bssid": reading.bssid,
              "rssi": reading.rssi,
              "notes": "Optional local PC RSSI collector.",
          },
      )
      print(f"posted {reading.ssid or 'unknown'} {reading.rssi:.1f} dBm")
      time.sleep(args.interval)


if __name__ == "__main__":
    main()
