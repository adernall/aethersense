import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { AnalysisResult, HeatCell, TelemetrySample } from "../types";

interface HeatmapCanvasProps {
  analysis: AnalysisResult | null;
  samples: TelemetrySample[];
  currentPosition: { x: number; y: number };
  collecting: boolean;
  onPositionChange: (_position: { x: number; y: number }) => void;
}

const rooms = [
  { x: 7, y: 8, w: 32, h: 35, label: "Bedroom" },
  { x: 42, y: 8, w: 18, h: 22, label: "Bath" },
  { x: 65, y: 10, w: 28, h: 32, label: "Kitchen" },
  { x: 8, y: 48, w: 37, h: 36, label: "Living" },
  { x: 48, y: 42, w: 13, h: 42, label: "Hall" },
  { x: 66, y: 50, w: 28, h: 34, label: "Office" }
];

function valueColor(value: number, alpha = 0.8) {
  const clamped = Math.max(0, Math.min(100, value));
  if (clamped < 35) return `rgba(113, 78, 255, ${alpha})`;
  if (clamped < 55) return `rgba(25, 206, 191, ${alpha})`;
  if (clamped < 75) return `rgba(181, 226, 67, ${alpha})`;
  return `rgba(255, 171, 53, ${alpha})`;
}

export function HeatmapCanvas({
  analysis,
  samples,
  currentPosition,
  collecting,
  onPositionChange
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 960, height: 520 });

  const cells = useMemo(() => analysis?.heatmap ?? [], [analysis]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(320, entry.contentRect.height)
      });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.scale(dpr, dpr);
    draw(ctx, size.width, size.height, cells, samples, currentPosition, collecting);
  }, [cells, samples, currentPosition, collecting, size]);

  function pointFromEvent(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onPositionChange({
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    });
  }

  return (
    <div className="map-frame" ref={wrapRef} onPointerDown={pointFromEvent}>
      <canvas ref={canvasRef} aria-label="Room heatmap canvas" />
      <div className="map-legend">
        <span>Signal index</span>
        <b>Strong</b>
        <i />
        <b>Weak</b>
      </div>
      <div className="position-chip" style={{ left: `${currentPosition.x}%`, top: `${currentPosition.y}%` }}>
        <span />
      </div>
      <div className="map-hud">
        <strong>{collecting ? "Collecting samples" : "Set position on map"}</strong>
        <span>{samples.length} samples</span>
        <span>{analysis?.fidelity ?? "none"} fidelity</span>
      </div>
    </div>
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cells: HeatCell[],
  samples: TelemetrySample[],
  current: { x: number; y: number },
  collecting: boolean
) {
  ctx.clearRect(0, 0, width, height);
  const grid = ctx.createLinearGradient(0, 0, width, height);
  grid.addColorStop(0, "#08181d");
  grid.addColorStop(1, "#0b1116");
  ctx.fillStyle = grid;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(134, 232, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (const cell of cells) {
    const x = (cell.x / 100) * width;
    const y = (cell.y / 100) * height;
    const radius = Math.max(width, height) * 0.09 * Math.max(0.25, cell.confidence);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, valueColor(cell.value, 0.34));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.strokeStyle = "rgba(218, 242, 245, 0.42)";
  ctx.lineWidth = 2;
  for (const room of rooms) {
    const x = (room.x / 100) * width;
    const y = (room.y / 100) * height;
    const w = (room.w / 100) * width;
    const h = (room.h / 100) * height;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "rgba(3, 10, 14, 0.72)";
    ctx.fillRect(x + 10, y + 12, ctx.measureText(room.label).width + 22, 24);
    ctx.fillStyle = "rgba(237, 249, 252, 0.9)";
    ctx.font = "12px Inter, system-ui";
    ctx.fillText(room.label, x + 20, y + 29);
  }

  if (samples.length > 1) {
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "rgba(235, 251, 255, 0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    samples.slice(-160).forEach((sample, index) => {
      const x = (sample.x / 100) * width;
      const y = (sample.y / 100) * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const sample of samples.slice(-240)) {
    const x = (sample.x / 100) * width;
    const y = (sample.y / 100) * height;
    ctx.fillStyle = sample.rssi == null ? "rgba(64, 221, 214, 0.65)" : valueColor(Math.max(0, 100 + sample.rssi), 0.82);
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const pulse = collecting ? 11 + Math.sin(Date.now() / 220) * 4 : 9;
  const px = (current.x / 100) * width;
  const py = (current.y / 100) * height;
  ctx.strokeStyle = "rgba(68, 217, 255, 0.9)";
  ctx.fillStyle = "rgba(68, 152, 255, 0.88)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px, py, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
}
