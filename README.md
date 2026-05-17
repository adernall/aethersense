# AetherSense

AetherSense is a 100% free, zero-hardware, open-source Wi-Fi environmental visualization and analysis platform. It uses an existing home Wi-Fi connection, an Android phone browser, and optionally a low-end PC or native Android collector.

It is intentionally honest: this is not CSI, not Wi-Fi X-ray imaging, not medical sensing, and not exact room reconstruction.

## What It Does

- Live browser-safe Wi-Fi/network monitoring
- Latency, jitter, interruption, downlink hint, and timing fluctuation capture
- Manual walk-around room sampling from an Android phone
- Custom house mapping with up to 4 floors
- Editable rooms, walls, doors, windows, room names, and optional room dimensions
- Router floor, position, and height placement
- Floor-by-floor heatmap switching
- 2D room heatmap for weak, strong, dead, and unstable zones
- Pseudo-3D signal cloud visualization
- Approximate movement and occupancy disturbance inference
- Interruption and reflection-heavy zone heuristics
- Experimental breathing gate that disables itself when fidelity is insufficient
- Approximate door/window state changes from nearby signal behavior, with manual override
- Optional RSSI ingestion from local open-source collectors

## What It Does Not Claim

- No true CSI-based sensing
- No accurate heartbeat or BPM
- No medical-grade vitals
- No hidden human imaging
- No true Wi-Fi tomography
- No perfect obstacle detection
- No guaranteed door/window state detection
- No fake hardcoded live sensing data

## Stack

- Frontend: React, Vite, TypeScript, Three.js, lucide icons, CSS
- Backend: FastAPI, WebSockets, NumPy, SciPy, scikit-learn
- Storage: local JSONL session files by default
- Deployment: free frontend host plus free backend host

## Quick Start

```bash
npm install
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In a second terminal:

```bash
npm run dev
```

Open `http://localhost:5173`.

For Android walk mode, connect the phone to the same Wi-Fi and open `http://YOUR_PC_LAN_IP:5173`.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## API

See [docs/API.md](docs/API.md).

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Compatibility

See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## License

MIT. Use, modify, and self-host for free.
