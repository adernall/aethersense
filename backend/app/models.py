from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


CollectorSource = Literal["browser", "android", "pc", "manual"]


class TelemetrySample(BaseModel):
    session_id: str = Field(min_length=4, max_length=128)
    source: CollectorSource
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    ts: float
    ssid: str | None = None
    bssid: str | None = None
    rssi: float | None = None
    latency_ms: float | None = None
    jitter_ms: float | None = None
    packet_loss: float | None = None
    downlink_mbps: float | None = None
    effective_type: str | None = None
    notes: str | None = None


class HeatCell(BaseModel):
    x: float
    y: float
    value: float
    confidence: float


class EventItem(BaseModel):
    ts: float
    level: Literal["info", "warning", "critical"]
    title: str
    detail: str


class MovementState(BaseModel):
    state: Literal["quiet", "possible_motion", "unstable_network", "insufficient_data"]
    confidence: float
    reason: str


class BreathingState(BaseModel):
    enabled: bool
    confidence: float
    reason: str
    waveform: list[float]


class AnalysisResult(BaseModel):
    session_id: str
    sample_count: int
    fidelity: Literal["none", "low", "medium", "high"]
    browser_rssi_available: bool
    heatmap: list[HeatCell]
    dead_zones: list[HeatCell]
    weak_zone_ratio: float
    fluctuation_hotspots: list[HeatCell]
    possible_movement: MovementState
    breathing: BreathingState
    events: list[EventItem]
