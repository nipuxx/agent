from __future__ import annotations

import json
import time
from typing import Iterable

from .db import list_events, log_event


def publish(
    stream_type: str,
    stream_id: str,
    event_type: str,
    payload: dict,
    *,
    level: str = "info",
) -> dict:
    return log_event(stream_type, stream_id, event_type, payload, level=level)


def read_events(
    *,
    after_id: int = 0,
    stream_type: str | None = None,
    stream_id: str | None = None,
    limit: int = 200,
) -> list[dict]:
    return list_events(
        after_id=after_id,
        stream_type=stream_type,
        stream_id=stream_id,
        limit=limit,
    )


def stream_sse(
    *,
    stream_type: str | None = None,
    stream_id: str | None = None,
    heartbeat_seconds: float = 5.0,
) -> Iterable[str]:
    last_id = 0
    last_heartbeat = time.time()
    while True:
        events = read_events(after_id=last_id, stream_type=stream_type, stream_id=stream_id)
        if events:
            for event in events:
                last_id = max(last_id, int(event["id"]))
                yield (
                    f"id: {event['id']}\n"
                    f"event: {event['event_type']}\n"
                    f"data: {json.dumps(event, separators=(',', ':'))}\n\n"
                )
            last_heartbeat = time.time()
        elif time.time() - last_heartbeat >= heartbeat_seconds:
            yield "event: heartbeat\ndata: {}\n\n"
            last_heartbeat = time.time()
        time.sleep(0.75)
