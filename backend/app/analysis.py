from __future__ import annotations

import math
import time
from collections.abc import Sequence

import numpy as np
from scipy.signal import butter, filtfilt, periodogram
from sklearn.cluster import DBSCAN

from .models import AnalysisResult, BreathingState, EventItem, HeatCell, MovementState, TelemetrySample


def analyze_session(session_id: str, samples: Sequence[TelemetrySample], floor_id: str | None = None) -> AnalysisResult:
    scoped = [sample for sample in samples if floor_id is None or sample.floor_id in (None, floor_id)]
    recent = list(scoped)[-900:]
    if not recent:
        return AnalysisResult(
            session_id=session_id,
            sample_count=0,
            fidelity="none",
            browser_rssi_available=False,
            heatmap=[],
            dead_zones=[],
            weak_zone_ratio=0,
            fluctuation_hotspots=[],
            possible_movement=MovementState(
                state="insufficient_data",
                confidence=0,
                reason="No samples have been collected yet.",
            ),
            breathing=BreathingState(
                enabled=False,
                confidence=0,
                reason="Disabled until a stable high-resolution signal stream exists.",
                waveform=[],
            ),
            events=[],
        )

    values = np.array([sample_quality(sample) for sample in recent], dtype=float)
    xs = np.array([sample.x for sample in recent], dtype=float)
    ys = np.array([sample.y for sample in recent], dtype=float)
    has_rssi = any(sample.rssi is not None for sample in recent)
    fidelity = estimate_fidelity(recent, has_rssi)
    heatmap = interpolate_heatmap(xs, ys, values)
    weak = [cell for cell in heatmap if cell.value < 38 and cell.confidence > 0.2]
    weak_zone_ratio = len(weak) / max(1, len(heatmap))
    hotspots = fluctuation_hotspots(recent)
    movement = movement_state(recent)
    breathing = breathing_state(recent, has_rssi, fidelity)
    events = build_events(recent, weak, hotspots, movement)

    return AnalysisResult(
        session_id=session_id,
        sample_count=len(scoped),
        fidelity=fidelity,
        browser_rssi_available=has_rssi,
        heatmap=heatmap,
        dead_zones=weak[:24],
        weak_zone_ratio=weak_zone_ratio,
        fluctuation_hotspots=hotspots[:18],
        possible_movement=movement,
        breathing=breathing,
        events=events[:24],
    )


def sample_quality(sample: TelemetrySample) -> float:
    if sample.rssi is not None:
        # Convert common RSSI range around -95..-35 dBm into a 0..100 quality index.
        rssi_score = max(0.0, min(100.0, (sample.rssi + 95.0) / 60.0 * 100.0))
    else:
        latency = sample.latency_ms if sample.latency_ms is not None else 120.0
        jitter = sample.jitter_ms if sample.jitter_ms is not None else 30.0
        downlink_bonus = min(12.0, (sample.downlink_mbps or 0.0) * 1.4)
        loss_penalty = (sample.packet_loss or 0.0) * 80.0
        rssi_score = 86.0 - max(0.0, latency - 22.0) * 0.42 - jitter * 1.05 - loss_penalty + downlink_bonus
    return float(max(0.0, min(100.0, rssi_score)))


def estimate_fidelity(samples: Sequence[TelemetrySample], has_rssi: bool) -> str:
    count = len(samples)
    duration = max(sample.ts for sample in samples) - min(sample.ts for sample in samples) if count > 1 else 0
    unique_positions = len({(round(sample.x / 8), round(sample.y / 8)) for sample in samples})
    if count < 8:
        return "low" if count else "none"
    if has_rssi and count >= 80 and duration >= 90 and unique_positions >= 8:
        return "high"
    if count >= 50 and duration >= 45 and unique_positions >= 6:
        return "medium"
    return "low"


def interpolate_heatmap(xs: np.ndarray, ys: np.ndarray, values: np.ndarray) -> list[HeatCell]:
    grid: list[HeatCell] = []
    if len(values) == 0:
        return grid
    for gx in np.linspace(4, 96, 24):
        for gy in np.linspace(4, 96, 18):
            distances = np.sqrt((xs - gx) ** 2 + (ys - gy) ** 2)
            weights = 1 / np.maximum(distances, 4) ** 2
            value = float(np.sum(weights * values) / np.sum(weights))
            nearest = float(np.min(distances)) if len(distances) else 100
            confidence = max(0.05, min(1.0, 1.0 - nearest / 42.0))
            grid.append(HeatCell(x=float(gx), y=float(gy), value=value, confidence=confidence))
    return grid


def fluctuation_hotspots(samples: Sequence[TelemetrySample]) -> list[HeatCell]:
    if len(samples) < 10:
        return []
    rows = []
    for index, sample in enumerate(samples[1:], start=1):
        prior = samples[index - 1]
        delta = abs(sample_quality(sample) - sample_quality(prior))
        jitter = sample.jitter_ms or 0
        if delta > 12 or jitter > 18:
            rows.append([sample.x, sample.y, min(100.0, delta + jitter)])
    if not rows:
        return []
    matrix = np.array(rows)
    labels = DBSCAN(eps=9, min_samples=2).fit_predict(matrix[:, :2]) if len(matrix) >= 3 else np.zeros(len(matrix))
    cells: list[HeatCell] = []
    for label in set(labels):
        if label == -1:
            continue
        cluster = matrix[labels == label]
        cells.append(
            HeatCell(
                x=float(np.mean(cluster[:, 0])),
                y=float(np.mean(cluster[:, 1])),
                value=float(np.mean(cluster[:, 2])),
                confidence=float(min(1, len(cluster) / 8)),
            )
        )
    return sorted(cells, key=lambda item: item.value * item.confidence, reverse=True)


def movement_state(samples: Sequence[TelemetrySample]) -> MovementState:
    if len(samples) < 16:
        return MovementState(
            state="insufficient_data",
            confidence=0.1,
            reason="Needs at least 16 timing samples to compare against a short baseline.",
        )
    recent = np.array([sample_quality(sample) for sample in samples[-16:]], dtype=float)
    baseline = np.array([sample_quality(sample) for sample in samples[:-16]], dtype=float)
    if len(baseline) < 8:
        baseline = np.array([sample_quality(sample) for sample in samples], dtype=float)
    shift = abs(float(np.mean(recent) - np.mean(baseline)))
    volatility = float(np.std(recent))
    jitter_values = np.array([sample.jitter_ms or 0 for sample in samples[-16:]], dtype=float)
    jitter = float(np.percentile(jitter_values, 85))
    if jitter > 42 and volatility > 18:
        return MovementState(
            state="unstable_network",
            confidence=min(0.92, (jitter + volatility) / 90),
            reason="Timing is too unstable to separate movement from network congestion.",
        )
    if shift > 9 or volatility > 11 or jitter > 20:
        return MovementState(
            state="possible_motion",
            confidence=min(0.82, max(shift / 22, volatility / 22, jitter / 40)),
            reason="Recent timing quality changed beyond the local baseline.",
        )
    return MovementState(
        state="quiet",
        confidence=max(0.2, 1 - max(shift / 18, volatility / 16, jitter / 28)),
        reason="Recent signal timing is close to the baseline.",
    )


def breathing_state(samples: Sequence[TelemetrySample], has_rssi: bool, fidelity: str) -> BreathingState:
    if not has_rssi or fidelity != "high" or len(samples) < 120:
        return BreathingState(
            enabled=False,
            confidence=0,
            reason="Disabled because browser timing/RSSI fidelity is insufficient for low-frequency periodic analysis.",
            waveform=[],
        )
    ordered = sorted(samples[-240:], key=lambda sample: sample.ts)
    ts = np.array([sample.ts for sample in ordered], dtype=float)
    values = np.array([sample.rssi or sample_quality(sample) for sample in ordered], dtype=float)
    duration = ts[-1] - ts[0]
    if duration < 90:
        return BreathingState(enabled=False, confidence=0.05, reason="Disabled until at least 90 seconds of stable samples exist.", waveform=[])
    sample_rate = len(values) / duration
    if sample_rate < 0.8:
        return BreathingState(enabled=False, confidence=0.08, reason="Disabled because sample rate is below 0.8 Hz.", waveform=[])
    centered = values - np.mean(values)
    try:
        b, a = butter(2, [0.08 / (sample_rate / 2), 0.5 / (sample_rate / 2)], btype="band")
        filtered = filtfilt(b, a, centered)
        freq, power = periodogram(filtered, fs=sample_rate)
    except ValueError:
        return BreathingState(enabled=False, confidence=0.05, reason="Disabled because filtering could not be applied safely.", waveform=[])
    band = (freq >= 0.12) & (freq <= 0.45)
    confidence = float(np.max(power[band]) / (np.sum(power) + 1e-9)) if np.any(band) else 0
    enabled = confidence > 0.22
    waveform = [float(x) for x in filtered[-80:]]
    return BreathingState(
        enabled=enabled,
        confidence=min(0.55, confidence),
        reason="Experimental periodic fluctuation found in RSSI stream." if enabled else "No reliable breathing-like periodic component detected.",
        waveform=waveform,
    )


def build_events(
    samples: Sequence[TelemetrySample],
    weak: Sequence[HeatCell],
    hotspots: Sequence[HeatCell],
    movement: MovementState,
) -> list[EventItem]:
    events: list[EventItem] = []
    now = time.time()
    if weak:
        events.append(
            EventItem(
                ts=now,
                level="warning",
                title="Weak zone inferred",
                detail=f"{len(weak)} interpolated cells are below the quality threshold.",
            )
        )
    if hotspots:
        events.append(
            EventItem(
                ts=now,
                level="warning",
                title="Fluctuation hotspot",
                detail="Clustered signal timing changes suggest an unstable or reflective region.",
            )
        )
    if movement.state == "possible_motion":
        events.append(
            EventItem(
                ts=now,
                level="info",
                title="Possible disturbance",
                detail=movement.reason,
            )
        )
    latest = samples[-1]
    if latest.latency_ms and latest.latency_ms > 500:
        events.append(
            EventItem(
                ts=now,
                level="critical",
                title="Connectivity interruption",
                detail=f"Last backend ping was {math.ceil(latest.latency_ms)} ms.",
            )
        )
    return events
