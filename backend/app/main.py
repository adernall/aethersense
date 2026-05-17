from __future__ import annotations

import asyncio
import time
from collections import defaultdict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .analysis import analyze_session
from .models import AnalysisResult, TelemetrySample
from .store import SessionStore

app = FastAPI(
    title="AetherSense API",
    version="0.1.0",
    description="Zero-cost Wi-Fi environmental analysis backend using honest browser-safe telemetry and optional RSSI collectors.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

store = SessionStore()
clients: dict[str, set[WebSocket]] = defaultdict(set)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "stack": "fastapi-free-open-source"}


@app.get("/api/ping")
def ping(client_ts: int | None = None) -> dict[str, float | int | None]:
    return {"server_ts": time.time(), "client_ts": client_ts}


@app.post("/api/samples", response_model=AnalysisResult)
async def ingest_sample(sample: TelemetrySample) -> AnalysisResult:
    samples = store.append(sample)
    analysis = analyze_session(sample.session_id, samples, sample.floor_id)
    await broadcast(sample.session_id, analysis)
    return analysis


@app.get("/api/sessions/{session_id}/analysis", response_model=AnalysisResult)
def session_analysis(session_id: str, floor_id: str | None = None) -> AnalysisResult:
    return analyze_session(session_id, store.get(session_id), floor_id)


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    clients[session_id].add(websocket)
    await websocket.send_text(analyze_session(session_id, store.get(session_id)).model_dump_json())
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        clients[session_id].discard(websocket)


async def broadcast(session_id: str, analysis: AnalysisResult) -> None:
    if not clients[session_id]:
        return
    message = analysis.model_dump_json()
    stale: list[WebSocket] = []
    for socket in list(clients[session_id]):
        try:
            await socket.send_text(message)
        except RuntimeError:
            stale.append(socket)
    for socket in stale:
        clients[session_id].discard(socket)


async def periodic_keepalive() -> None:
    while True:
        await asyncio.sleep(30)
        for session_id, sockets in list(clients.items()):
            if sockets:
                analysis = analyze_session(session_id, store.get(session_id))
                await broadcast(session_id, analysis)
