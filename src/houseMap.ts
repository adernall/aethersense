import type { FloorPlan, HouseMap, Portal, PortalState, TelemetrySample } from "./types";
import { qualityFromTiming } from "./telemetry";

const HOUSE_KEY = "aethersense.houseMap";

export const defaultHouseMap: HouseMap = {
  activeFloorId: "floor-1",
  router: { floorId: "floor-1", x: 18, y: 58, height_m: 1.2 },
  floors: [
    {
      id: "floor-1",
      name: "Ground Floor",
      elevation_m: 0,
      rooms: [
        { id: "room-living", name: "Living", x: 7, y: 48, w: 38, h: 36, dimensions: { width_m: 4.2, length_m: 5.4 } },
        { id: "room-bedroom", name: "Bedroom", x: 7, y: 8, w: 32, h: 35 },
        { id: "room-bath", name: "Bath", x: 42, y: 8, w: 18, h: 22 },
        { id: "room-kitchen", name: "Kitchen", x: 65, y: 10, w: 28, h: 32 },
        { id: "room-hall", name: "Hall", x: 48, y: 42, w: 13, h: 42 },
        { id: "room-office", name: "Office", x: 66, y: 50, w: 28, h: 34 }
      ],
      walls: [
        { id: "wall-1", x1: 45, y1: 8, x2: 45, y2: 85, material: "drywall" },
        { id: "wall-2", x1: 62, y1: 45, x2: 62, y2: 85, material: "brick" }
      ],
      portals: [
        { id: "door-living", kind: "door", name: "Living Door", roomId: "room-living", x: 46, y: 66, width_m: 0.9, state: "unknown" },
        { id: "window-kitchen", kind: "window", name: "Kitchen Window", roomId: "room-kitchen", x: 82, y: 10, width_m: 1.2, state: "unknown" }
      ]
    },
    { id: "floor-2", name: "Floor 2", elevation_m: 3, rooms: [], walls: [], portals: [] }
  ]
};

export function loadHouseMap(): HouseMap {
  try {
    const saved = localStorage.getItem(HOUSE_KEY);
    if (!saved) return defaultHouseMap;
    const parsed = JSON.parse(saved) as HouseMap;
    return normalizeHouseMap(parsed);
  } catch {
    return defaultHouseMap;
  }
}

export function saveHouseMap(map: HouseMap) {
  localStorage.setItem(HOUSE_KEY, JSON.stringify(normalizeHouseMap(map)));
}

export function normalizeHouseMap(map: HouseMap): HouseMap {
  const floors = map.floors.slice(0, 4);
  const activeFloorId = floors.some((floor) => floor.id === map.activeFloorId) ? map.activeFloorId : floors[0]?.id ?? "floor-1";
  const routerFloor = floors.some((floor) => floor.id === map.router.floorId) ? map.router.floorId : activeFloorId;
  return {
    floors,
    activeFloorId,
    router: { ...map.router, floorId: routerFloor }
  };
}

export function floorById(map: HouseMap, floorId: string): FloorPlan {
  return map.floors.find((floor) => floor.id === floorId) ?? map.floors[0];
}

export function addFloor(map: HouseMap): HouseMap {
  if (map.floors.length >= 4) return map;
  const index = map.floors.length + 1;
  const floor = { id: `floor-${index}`, name: `Floor ${index}`, elevation_m: (index - 1) * 3, rooms: [], walls: [], portals: [] };
  return { ...map, floors: [...map.floors, floor], activeFloorId: floor.id };
}

export function inferPortalStates(portals: Portal[], samples: TelemetrySample[]): Portal[] {
  const floorSamples = samples.slice(-240);
  return portals.map((portal) => {
    const near = floorSamples.filter((sample) => distance(sample.x, sample.y, portal.x, portal.y) < 13);
    if (near.length < 8) return { ...portal, state: manualOr("unknown", portal.state) };
    const quality = near.reduce((sum, sample) => {
      const value = sample.rssi == null ? qualityFromTiming(sample.latency_ms ?? null, sample.jitter_ms ?? null, sample.downlink_mbps ?? null) : Math.max(0, 100 + sample.rssi);
      return sum + value;
    }, 0) / near.length;
    const baseline = portal.baselineQuality ?? quality;
    const delta = quality - baseline;
    const volatility = stdev(
      near.map((sample) => qualityFromTiming(sample.latency_ms ?? null, sample.jitter_ms ?? null, sample.downlink_mbps ?? null))
    );
    let state: PortalState = "likely_closed";
    if (volatility > 14 || Math.abs(delta) > 12) state = "changed";
    else if (delta > 5) state = "likely_open";
    return { ...portal, state: manualOr(state, portal.state), baselineQuality: baseline };
  });
}

function manualOr(inferred: PortalState, current: PortalState): PortalState {
  if (current === "manual_open" || current === "manual_closed") return current;
  return inferred;
}

function distance(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function stdev(values: number[]) {
  if (!values.length) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}
