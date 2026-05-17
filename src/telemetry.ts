import { pingBackend } from "./api";
import type { TracePoint } from "./types";

type NetworkInformation = {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
};

export function readNetworkInformation() {
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  return {
    downlink_mbps: connection?.downlink ?? null,
    effective_type: connection?.effectiveType ?? null,
    rtt_ms: connection?.rtt ?? null,
    save_data: connection?.saveData ?? null,
    available: Boolean(connection)
  };
}

export function qualityFromTiming(latency: number | null, jitter: number | null, downlink: number | null) {
  let score = 82;
  if (typeof latency === "number") score -= Math.max(0, latency - 25) * 0.45;
  if (typeof jitter === "number") score -= jitter * 1.1;
  if (typeof downlink === "number") score += Math.min(12, downlink * 1.6);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function measureTrace(previous: TracePoint | null): Promise<TracePoint> {
  const info = readNetworkInformation();
  const ping = await pingBackend();
  const latency = ping.latency;
  const jitter = previous?.latency == null ? 0 : Math.abs(latency - previous.latency);
  return {
    ts: Date.now(),
    latency,
    jitter,
    rssi: null,
    quality: qualityFromTiming(latency, jitter, info.downlink_mbps)
  };
}
