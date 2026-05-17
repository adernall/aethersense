import type { AnalysisResult, TelemetrySample } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function pingBackend(): Promise<{ latency: number; serverTs: number }> {
  const start = performance.now();
  const response = await fetch(`${API_BASE}/api/ping?client_ts=${Date.now()}`, {
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Backend ping failed");
  const body = await response.json();
  return { latency: performance.now() - start, serverTs: body.server_ts };
}

export async function submitSample(sample: TelemetrySample): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sample)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function loadAnalysis(sessionId: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/analysis`, {
    cache: "no-store"
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export function createAnalysisSocket(
  sessionId: string,
  onMessage: (_analysis: AnalysisResult) => void,
  onState: (_state: "open" | "closed" | "error") => void
) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const base = import.meta.env.VITE_WS_BASE ?? `${proto}://${window.location.host}`;
  const socket = new WebSocket(`${base}/ws/${sessionId}`);
  socket.onopen = () => onState("open");
  socket.onclose = () => onState("closed");
  socket.onerror = () => onState("error");
  socket.onmessage = (event) => onMessage(JSON.parse(event.data));
  return socket;
}
