from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from threading import RLock

from .models import TelemetrySample


class SessionStore:
    def __init__(self, data_dir: str | Path = "data") -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._sessions: dict[str, list[TelemetrySample]] = defaultdict(list)

    def append(self, sample: TelemetrySample) -> list[TelemetrySample]:
        with self._lock:
            items = self._sessions[sample.session_id]
            items.append(sample)
            if len(items) > 2500:
                del items[: len(items) - 2500]
            self._persist(sample.session_id, items)
            return list(items)

    def get(self, session_id: str) -> list[TelemetrySample]:
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = self._load(session_id)
            return list(self._sessions[session_id])

    def _persist(self, session_id: str, items: list[TelemetrySample]) -> None:
        path = self.data_dir / f"{safe_name(session_id)}.jsonl"
        tail = items[-2500:]
        path.write_text("\n".join(item.model_dump_json() for item in tail), encoding="utf-8")

    def _load(self, session_id: str) -> list[TelemetrySample]:
        path = self.data_dir / f"{safe_name(session_id)}.jsonl"
        if not path.exists():
            return []
        samples: list[TelemetrySample] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                samples.append(TelemetrySample.model_validate(json.loads(line)))
        return samples[-2500:]


def safe_name(value: str) -> str:
    return "".join(char if char.isalnum() or char in "-_" else "_" for char in value)[:128]
