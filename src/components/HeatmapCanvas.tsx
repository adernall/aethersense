import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { AnalysisResult, FloorPlan, HeatCell, Portal, RouterPlacement, TelemetrySample, WallSegment } from "../types";

interface HeatmapCanvasProps {
  analysis: AnalysisResult | null;
  samples: TelemetrySample[];
  currentPosition: { x: number; y: number };
  collecting: boolean;
  floor: FloorPlan;
  router: RouterPlacement;
  portalStates: Portal[];
  onPositionChange: (_position: { x: number; y: number }) => void;
  onMapClick?: (_position: { x: number; y: number }) => void;
}

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
  floor,
  router,
  portalStates,
  onPositionChange,
  onMapClick
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
    draw(ctx, size.width, size.height, cells, samples, currentPosition, collecting, floor, router, portalStates);
  }, [cells, samples, currentPosition, collecting, floor, router, portalStates, size]);

  function pointFromEvent(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    };
    onPositionChange(position);
    onMapClick?.(position);
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
        <strong>{collecting ? "Collecting samples" : `Mapping ${floor.name}`}</strong>
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
  collecting: boolean,
  floor: FloorPlan,
  router: RouterPlacement,
  portals: Portal[]
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
  drawWalls(ctx, width, height, floor.walls);

  for (const room of floor.rooms) {
    const x = (room.x / 100) * width;
    const y = (room.y / 100) * height;
    const w = (room.w / 100) * width;
    const h = (room.h / 100) * height;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "rgba(3, 10, 14, 0.72)";
    ctx.fillRect(x + 10, y + 12, ctx.measureText(room.name).width + 22, 24);
    ctx.fillStyle = "rgba(237, 249, 252, 0.9)";
    ctx.font = "12px Inter, system-ui";
    ctx.fillText(room.name, x + 20, y + 29);
    const dim = room.dimensions;
    if (dim?.width_m || dim?.length_m || dim?.height_m) {
      const text = `${dim.width_m ?? "?"}m x ${dim.length_m ?? "?"}m${dim.height_m ? ` x ${dim.height_m}m` : ""}`;
      ctx.fillStyle = "rgba(142, 164, 173, 0.82)";
      ctx.font = "11px Inter, system-ui";
      ctx.fillText(text, x + 20, y + h - 14);
    }
  }

  drawPortals(ctx, width, height, portals);
  if (router.floorId === floor.id) drawRouter(ctx, width, height, router);

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

function drawWalls(ctx: CanvasRenderingContext2D, width: number, height: number, walls: WallSegment[]) {
  for (const wall of walls) {
    const x1 = (wall.x1 / 100) * width;
    const y1 = (wall.y1 / 100) * height;
    const x2 = (wall.x2 / 100) * width;
    const y2 = (wall.y2 / 100) * height;
    ctx.strokeStyle = wall.material === "concrete" ? "rgba(255, 255, 255, 0.7)" : "rgba(218, 242, 245, 0.5)";
    ctx.lineWidth = wall.material === "concrete" || wall.material === "brick" ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = "rgba(3, 10, 14, 0.7)";
    ctx.font = "10px Inter, system-ui";
    ctx.fillText(wall.material, (x1 + x2) / 2 + 4, (y1 + y2) / 2 - 4);
  }
}

function drawPortals(ctx: CanvasRenderingContext2D, width: number, height: number, portals: Portal[]) {
  for (const portal of portals) {
    const x = (portal.x / 100) * width;
    const y = (portal.y / 100) * height;
    const color = portal.state.includes("open") ? "#43f07d" : portal.state === "changed" ? "#ffaa35" : "#8ea4ad";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    if (portal.kind === "door") {
      ctx.beginPath();
      ctx.arc(x, y, 16, Math.PI * 1.1, Math.PI * 1.75);
      ctx.stroke();
      ctx.fillRect(x - 2, y - 14, 4, 28);
    } else {
      ctx.strokeRect(x - 18, y - 5, 36, 10);
      ctx.beginPath();
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x + 12, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(3, 10, 14, 0.76)";
    ctx.fillRect(x + 8, y - 14, ctx.measureText(portal.name).width + 16, 22);
    ctx.fillStyle = color;
    ctx.font = "11px Inter, system-ui";
    ctx.fillText(portal.name, x + 16, y + 1);
  }
}

function drawRouter(ctx: CanvasRenderingContext2D, width: number, height: number, router: RouterPlacement) {
  const x = (router.x / 100) * width;
  const y = (router.y / 100) * height;
  ctx.strokeStyle = "rgba(255, 170, 53, 0.9)";
  ctx.fillStyle = "rgba(255, 170, 53, 0.2)";
  ctx.lineWidth = 2;
  for (const radius of [14, 27, 40]) {
    ctx.beginPath();
    ctx.arc(x, y, radius, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffaa35";
  ctx.font = "11px Inter, system-ui";
  ctx.fillText(`${router.height_m}m`, x + 12, y + 4);
}
