import type { AnalysisResult, TracePoint } from "../types";

export function Sparkline({ trace }: { trace: TracePoint[] }) {
  const width = 320;
  const height = 150;
  const points = trace.slice(-80);
  const path = points
    .map((point, index) => {
      const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
      const y = height - (point.quality / 100) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Signal quality trend">
      <defs>
        <linearGradient id="traceGlow" x1="0" x2="1">
          <stop offset="0" stopColor="#42d9ff" />
          <stop offset="1" stopColor="#ffaa35" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((y) => (
        <line key={y} x1="0" x2={width} y1={y * 1.5} y2={y * 1.5} />
      ))}
      <path d={path} />
    </svg>
  );
}

export function DensityBars({ analysis }: { analysis: AnalysisResult | null }) {
  const cells = analysis?.heatmap ?? [];
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
  cells.forEach((cell) => {
    const index = Math.min(buckets.length - 1, Math.floor((cell.x / 100) * buckets.length));
    buckets[index] += cell.confidence;
  });
  const max = Math.max(1, ...buckets);
  return (
    <div className="density-bars" aria-label="Sample density">
      {buckets.map((bucket, index) => (
        <span key={index} style={{ height: `${Math.max(8, (bucket / max) * 100)}%` }} />
      ))}
    </div>
  );
}
