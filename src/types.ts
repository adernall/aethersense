export type CollectorSource = "browser" | "android" | "pc" | "manual";

export interface TelemetrySample {
  session_id: string;
  source: CollectorSource;
  x: number;
  y: number;
  ts: number;
  ssid?: string | null;
  bssid?: string | null;
  rssi?: number | null;
  latency_ms?: number | null;
  jitter_ms?: number | null;
  packet_loss?: number | null;
  downlink_mbps?: number | null;
  effective_type?: string | null;
  notes?: string | null;
}

export interface HeatCell {
  x: number;
  y: number;
  value: number;
  confidence: number;
}

export interface EventItem {
  ts: number;
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

export interface AnalysisResult {
  session_id: string;
  sample_count: number;
  fidelity: "none" | "low" | "medium" | "high";
  browser_rssi_available: boolean;
  heatmap: HeatCell[];
  dead_zones: HeatCell[];
  weak_zone_ratio: number;
  fluctuation_hotspots: HeatCell[];
  possible_movement: {
    state: "quiet" | "possible_motion" | "unstable_network" | "insufficient_data";
    confidence: number;
    reason: string;
  };
  breathing: {
    enabled: boolean;
    confidence: number;
    reason: string;
    waveform: number[];
  };
  events: EventItem[];
}

export interface TracePoint {
  ts: number;
  latency: number | null;
  jitter: number | null;
  quality: number;
  rssi: number | null;
}
