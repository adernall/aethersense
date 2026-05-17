# AetherSense API

Base URL locally: `http://127.0.0.1:8000`

## `GET /api/health`

Returns backend health.

## `GET /api/ping?client_ts=...`

Used by the browser to measure latency and jitter. Returns server time. The client measures round-trip time.

## `POST /api/samples`

Ingests one real sample.

```json
{
  "session_id": "uuid",
  "floor_id": "floor-1",
  "source": "browser",
  "x": 42,
  "y": 58,
  "ts": 1730000000.0,
  "rssi": null,
  "latency_ms": 31.2,
  "jitter_ms": 5.4,
  "downlink_mbps": 8.1,
  "effective_type": "4g"
}
```

Returns the current `AnalysisResult`.

## `GET /api/sessions/{session_id}/analysis?floor_id=floor-1`

Returns interpolated heatmap cells, weak-zone estimates, anomaly clusters, movement inference, breathing gate status, and events. If `floor_id` is provided, analysis is scoped to samples from that floor.

## `WS /ws/{session_id}`

Pushes `AnalysisResult` updates when samples arrive.

## Honesty Contract

The API never fabricates RSSI. If a browser sample cannot access RSSI, `rssi` remains `null` and analysis uses timing proxies only.

The backend does not implement CSI, heartbeat detection, true RF tomography, accurate person imaging, hidden-human detection, or medical sensing.

Door and window state is not directly sensed. The frontend labels it as likely/changed/manual based on nearby sample shifts and user overrides.
