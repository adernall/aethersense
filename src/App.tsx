import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  AreaChart,
  Box,
  BrainCircuit,
  DoorOpen,
  Cpu,
  Gauge,
  Home,
  Map,
  Pause,
  Play,
  Radar,
  RefreshCw,
  Router,
  Smartphone,
  Wifi,
  Workflow,
  Zap
} from "lucide-react";
import { createAnalysisSocket, loadAnalysis, submitSample } from "./api";
import { DensityBars, Sparkline } from "./components/Charts";
import { HeatmapCanvas } from "./components/HeatmapCanvas";
import { SignalCloud } from "./components/SignalCloud";
import { addFloor, floorById, inferPortalStates, loadHouseMap, saveHouseMap } from "./houseMap";
import { measureTrace, readNetworkInformation } from "./telemetry";
import type { AnalysisResult, HouseMap, Portal, TelemetrySample, TracePoint } from "./types";

const SESSION_KEY = "aethersense.session";
type MapTool = "sample" | "room" | "wall" | "door" | "window" | "router";

function sessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, fresh);
  return fresh;
}

export function App() {
  const [session] = useState(sessionId);
  const [collecting, setCollecting] = useState(false);
  const [position, setPosition] = useState({ x: 28, y: 62 });
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [socketState, setSocketState] = useState<"open" | "closed" | "error">("closed");
  const [mode, setMode] = useState<"walk" | "passive">("walk");
  const [houseMap, setHouseMap] = useState<HouseMap>(loadHouseMap);
  const [mapTool, setMapTool] = useState<MapTool>("sample");
  const [newRoomName, setNewRoomName] = useState("New Room");
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const traceRef = useRef<TracePoint | null>(null);

  const network = readNetworkInformation();
  const activeFloor = floorById(houseMap, houseMap.activeFloorId);
  const floorSamples = samples.filter((sample) => sample.floor_id === activeFloor.id || (!sample.floor_id && activeFloor.id === "floor-1"));
  const inferredPortals = useMemo(
    () => inferPortalStates(activeFloor.portals, floorSamples),
    [activeFloor.portals, floorSamples]
  );

  useEffect(() => {
    loadAnalysis(session, houseMap.activeFloorId).then(setAnalysis).catch(() => undefined);
    const socket = createAnalysisSocket(session, setAnalysis, setSocketState);
    return () => socket.close();
  }, [session, houseMap.activeFloorId]);

  useEffect(() => {
    saveHouseMap(houseMap);
  }, [houseMap]);

  useEffect(() => {
    let active = true;
    const loop = async () => {
      try {
        const point = await measureTrace(traceRef.current);
        if (!active) return;
        traceRef.current = point;
        setTrace((items) => [...items.slice(-179), point]);
        if (collecting) {
          const info = readNetworkInformation();
          const sample: TelemetrySample = {
            session_id: session,
            floor_id: activeFloor.id,
            source: "browser",
            x: mode === "passive" ? position.x + (Math.random() - 0.5) * 0.7 : position.x,
            y: mode === "passive" ? position.y + (Math.random() - 0.5) * 0.7 : position.y,
            ts: Date.now() / 1000,
            rssi: null,
            latency_ms: point.latency,
            jitter_ms: point.jitter,
            packet_loss: null,
            downlink_mbps: info.downlink_mbps,
            effective_type: info.effective_type,
            notes: "Browser-safe timing sample; RSSI unavailable unless optional collector is connected."
          };
          setSamples((items) => [...items, sample]);
          const next = await submitSample(sample);
          if (!active) return;
          setAnalysis(next);
        }
      } catch {
        if (active) {
          const failure: TracePoint = { ts: Date.now(), latency: null, jitter: null, quality: 0, rssi: null };
          setTrace((items) => [...items.slice(-179), failure]);
        }
      } finally {
        if (active) window.setTimeout(loop, collecting ? 1400 : 2500);
      }
    };
    loop();
    return () => {
      active = false;
    };
  }, [activeFloor.id, collecting, mode, position, session]);

  const latest = trace.length ? trace[trace.length - 1] : undefined;
  const apiRestricted = !analysis?.browser_rssi_available;
  const weakRatio = Math.round((analysis?.weak_zone_ratio ?? 0) * 100);
  const avgQuality = useMemo(() => {
    if (!trace.length) return 0;
    return Math.round(trace.reduce((sum, item) => sum + item.quality, 0) / trace.length);
  }, [trace]);

  function updateHouseMap(next: HouseMap) {
    setHouseMap(next);
  }

  function updateActiveFloor(updater: (floor: typeof activeFloor) => typeof activeFloor) {
    updateHouseMap({
      ...houseMap,
      floors: houseMap.floors.map((floor) => (floor.id === activeFloor.id ? updater(floor) : floor))
    });
  }

  function handleMapToolClick(point: { x: number; y: number }) {
    if (mapTool === "sample") return;
    if (mapTool === "router") {
      updateHouseMap({ ...houseMap, router: { ...houseMap.router, floorId: activeFloor.id, x: point.x, y: point.y } });
      return;
    }
    if (mapTool === "room") {
      const id = crypto.randomUUID();
      updateActiveFloor((floor) => ({
        ...floor,
        rooms: [
          ...floor.rooms,
          {
            id,
            name: newRoomName || `Room ${floor.rooms.length + 1}`,
            x: Math.max(2, point.x - 12),
            y: Math.max(2, point.y - 9),
            w: 24,
            h: 18,
            dimensions: { width_m: 3, length_m: 3, height_m: 2.7 }
          }
        ]
      }));
      return;
    }
    if (mapTool === "wall") {
      if (!wallStart) {
        setWallStart(point);
        return;
      }
      updateActiveFloor((floor) => ({
        ...floor,
        walls: [...floor.walls, { id: crypto.randomUUID(), x1: wallStart.x, y1: wallStart.y, x2: point.x, y2: point.y, material: "unknown" }]
      }));
      setWallStart(null);
      return;
    }
    if (mapTool === "door" || mapTool === "window") {
      const portal: Portal = {
        id: crypto.randomUUID(),
        kind: mapTool,
        name: `${mapTool === "door" ? "Door" : "Window"} ${activeFloor.portals.length + 1}`,
        x: point.x,
        y: point.y,
        width_m: mapTool === "door" ? 0.9 : 1.2,
        state: "unknown"
      };
      updateActiveFloor((floor) => ({ ...floor, portals: [...floor.portals, portal] }));
    }
  }

  function setActiveFloor(floorId: string) {
    updateHouseMap({ ...houseMap, activeFloorId: floorId });
  }

  function renameActiveFloor(name: string) {
    updateActiveFloor((floor) => ({ ...floor, name }));
  }

  function setRouterHeight(height: number) {
    updateHouseMap({ ...houseMap, router: { ...houseMap.router, height_m: height } });
  }

  function cyclePortalState(portalId: string) {
    updateActiveFloor((floor) => ({
      ...floor,
      portals: floor.portals.map((portal) => {
        if (portal.id !== portalId) return portal;
        const next = portal.state === "manual_open" ? "manual_closed" : portal.state === "manual_closed" ? "unknown" : "manual_open";
        return { ...portal, state: next };
      })
    }));
  }

  function updateRoom(roomId: string, updates: { name?: string; width_m?: number; length_m?: number; height_m?: number }) {
    updateActiveFloor((floor) => ({
      ...floor,
      rooms: floor.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              name: updates.name ?? room.name,
              dimensions: {
                ...room.dimensions,
                width_m: updates.width_m ?? room.dimensions?.width_m,
                length_m: updates.length_m ?? room.dimensions?.length_m,
                height_m: updates.height_m ?? room.dimensions?.height_m
              }
            }
          : room
      )
    }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>AetherSense</strong>
            <span>Wi-Fi field lab</span>
          </div>
        </div>
        <nav>
          {(
            [
              ["Overview", Radar],
              ["House Map", Home],
              ["Map & Heatmap", Map],
              ["Collection", Smartphone],
              ["Telemetry", Activity],
              ["Anomalies", AlertTriangle],
              ["Analysis", BrainCircuit],
              ["Signal Cloud", Box]
            ] as const
          ).map(([label, Icon]) => (
            <button className={label === "Overview" ? "active" : ""} key={label}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <section className="stack-card">
          <h2>Free Stack</h2>
          {[
            ["Browser client", "Active"],
            ["Android collector", "Optional"],
            ["PC collector", "Optional"],
            ["Backend", "FastAPI"],
            ["Storage", "In-memory / JSON"]
          ].map(([label, value]) => (
            <div className="stack-row" key={label}>
              <span />
              <p>{label}</p>
              <b>{value}</b>
            </div>
          ))}
        </section>
        <section className="phone-preview">
          <Smartphone size={22} />
          <strong>Android Walk Mode</strong>
          <p>Open this app on your phone, tap your room position, and collect browser-safe timing samples.</p>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="status-pill live">
            <span />
            Live
          </div>
          <div className={`status-pill ${socketState}`}>
            <span />
            WebSocket {socketState}
          </div>
          <label>
            Project
            <select defaultValue="home">
              <option value="home">Home Lab</option>
            </select>
          </label>
          <label>
            Floor
            <select value={houseMap.activeFloorId} onChange={(event) => setActiveFloor(event.target.value)}>
              {houseMap.floors.map((floor) => (
                <option value={floor.id} key={floor.id}>
                  {floor.name}
                </option>
              ))}
            </select>
          </label>
          {apiRestricted && (
            <div className="notice">
              <AlertTriangle size={16} />
              RSSI restricted in browser
            </div>
          )}
        </header>

        <section className="control-strip">
          <div>
            <span>Collection Mode</span>
            <div className="segmented">
              <button className={mode === "walk" ? "selected" : ""} onClick={() => setMode("walk")}>
                Walk & Collect
              </button>
              <button className={mode === "passive" ? "selected" : ""} onClick={() => setMode("passive")}>
                Passive Monitor
              </button>
            </div>
          </div>
          <div>
            <span>Map Tool</span>
            <div className="segmented toolset">
              {(
                [
                  ["sample", "Sample"],
                  ["room", "Room"],
                  ["wall", "Wall"],
                  ["door", "Door"],
                  ["window", "Window"],
                  ["router", "Router"]
                ] as const
              ).map(([tool, label]) => (
                <button className={mapTool === tool ? "selected" : ""} onClick={() => setMapTool(tool)} key={tool}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span>Sampling Profile</span>
            <select defaultValue="balanced">
              <option value="balanced">Balanced</option>
              <option value="potato">Potato PC</option>
              <option value="dense">Dense Mapping</option>
            </select>
          </div>
          <button className="primary-action" onClick={() => setCollecting((value) => !value)}>
            {collecting ? <Pause size={18} /> : <Play size={18} />}
            {collecting ? "Pause Collection" : "Start Collection"}
          </button>
        </section>

        <section className="main-grid">
          <div className="map-panel">
            <HeatmapCanvas
              analysis={analysis}
              samples={samples}
              currentPosition={position}
              collecting={collecting}
              floor={activeFloor}
              router={houseMap.router}
              portalStates={inferredPortals}
              onPositionChange={setPosition}
              onMapClick={handleMapToolClick}
            />
          </div>
          <aside className="inspector">
            <Panel title="House Map Builder" icon={<Workflow size={18} />} tone="cyan">
              <div className="map-builder">
                <label>
                  Floor name
                  <input value={activeFloor.name} onChange={(event) => renameActiveFloor(event.target.value)} />
                </label>
                <label>
                  New room
                  <input value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} />
                </label>
                <div className="builder-actions">
                  <button onClick={() => updateHouseMap(addFloor(houseMap))} disabled={houseMap.floors.length >= 4}>
                    Add Floor
                  </button>
                  <label>
                    Router height
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={houseMap.router.height_m}
                      onChange={(event) => setRouterHeight(Number(event.target.value))}
                    />
                  </label>
                </div>
                <small>Max 4 floors. Pick a map tool, then tap the plan. Walls are drawn but never block samples.</small>
                <div className="room-editor">
                  {activeFloor.rooms.slice(0, 6).map((room) => (
                    <div className="room-editor-row" key={room.id}>
                      <input value={room.name} onChange={(event) => updateRoom(room.id, { name: event.target.value })} />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={room.dimensions?.width_m ?? ""}
                        placeholder="W m"
                        onChange={(event) => updateRoom(room.id, { width_m: Number(event.target.value) })}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={room.dimensions?.length_m ?? ""}
                        placeholder="L m"
                        onChange={(event) => updateRoom(room.id, { length_m: Number(event.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="Door & Window State" icon={<DoorOpen size={18} />} tone="amber">
              <div className="portal-list">
                {inferredPortals.length ? (
                  inferredPortals.map((portal) => (
                    <button key={portal.id} onClick={() => cyclePortalState(portal.id)}>
                      <span>{portal.name}</span>
                      <strong>{portal.state.replace(/_/g, " ")}</strong>
                      <small>
                        {activeFloor.name} · {portal.kind} · click to override
                      </small>
                    </button>
                  ))
                ) : (
                  <p className="honesty">Add doors/windows to infer nearby open, closed, or changed states from signal behavior.</p>
                )}
              </div>
            </Panel>
            <Panel title="Movement Inference" icon={<Radar size={18} />} tone="cyan">
              <div className="signal-state">
                <strong>{analysis?.possible_movement.state.replace(/_/g, " ") ?? "insufficient data"}</strong>
                <p>{analysis?.possible_movement.reason ?? "Collect samples to build a baseline."}</p>
                <meter min="0" max="1" value={analysis?.possible_movement.confidence ?? 0} />
                <small>Approximate inference only. Not a security system.</small>
              </div>
            </Panel>
            <Panel title="Interruption & Weak Zones" icon={<Zap size={18} />} tone="amber">
              <div className="metric-pair">
                <div>
                  <span>Weak zone estimate</span>
                  <strong>{weakRatio}%</strong>
                  <small>Area below inferred quality threshold</small>
                </div>
                <div>
                  <span>Hotspots</span>
                  <strong>{analysis?.fluctuation_hotspots.length ?? 0}</strong>
                  <small>Clustered instability regions</small>
                </div>
              </div>
            </Panel>
            <Panel title="Experimental Breathing Gate" icon={<BrainCircuit size={18} />} tone="purple">
              <div className="signal-state">
                <strong>{analysis?.breathing.enabled ? "Enabled" : "Disabled / Low confidence"}</strong>
                <p>{analysis?.breathing.reason ?? "Requires high-quality RSSI or stable timing fidelity."}</p>
                <meter min="0" max="1" value={analysis?.breathing.confidence ?? 0} />
                <small>Very low reliability. Not medical.</small>
              </div>
            </Panel>
            <Panel title="Browser Compatibility" icon={<Wifi size={18} />} tone="warning">
              <p className="honesty">
                Browser APIs expose latency, jitter, connectivity, and sometimes downlink estimates. They do not expose
                raw RSSI, CSI, hidden people, heartbeat, or true RF tomography.
              </p>
            </Panel>
          </aside>
        </section>

        <section className="bottom-grid">
          <Panel title="Live Network Telemetry" icon={<Router size={18} />}>
            <div className="telemetry-list">
              <Row label="Latency" value={latest?.latency == null ? "offline" : `${latest.latency.toFixed(1)} ms`} />
              <Row label="Jitter" value={latest?.jitter == null ? "unknown" : `${latest.jitter.toFixed(1)} ms`} />
              <Row label="Downlink" value={network.downlink_mbps == null ? "restricted" : `${network.downlink_mbps} Mbps`} />
              <Row label="Effective type" value={network.effective_type ?? "unavailable"} />
              <Row label="Signal source" value={analysis?.browser_rssi_available ? "RSSI collector" : "timing proxy"} />
              <Row label="Quality index" value={`${avgQuality}/100`} />
            </div>
          </Panel>
          <Panel title="Signal Over Time" icon={<AreaChart size={18} />}>
            <Sparkline trace={trace} />
          </Panel>
          <Panel title="Sample Density" icon={<Gauge size={18} />}>
            <DensityBars analysis={analysis} />
            <div className="coverage">
              <span>{samples.length} local samples</span>
              <span>{analysis?.sample_count ?? 0} backend samples</span>
            </div>
          </Panel>
          <Panel title="Pseudo-3D Signal Cloud" icon={<Cpu size={18} />}>
            <SignalCloud analysis={analysis} />
          </Panel>
        </section>
      </section>
    </main>
  );
}

function Panel({
  title,
  icon,
  children,
  tone = "neutral"
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <section className={`panel ${tone}`}>
      <header>
        <div>
          {icon}
          <h2>{title}</h2>
        </div>
        <RefreshCw size={15} />
      </header>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
