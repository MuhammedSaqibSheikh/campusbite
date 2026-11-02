import asyncio
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from .config import get_settings
from .database import SessionLocal
from .services import scan_reminders

logger = logging.getLogger("campusbite")


def register_middleware(app: FastAPI) -> None:
    max_body = (get_settings().max_video_mb + 1) * 1024 * 1024

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        request_id = uuid.uuid4().hex[:8]
        start = time.perf_counter()
        logger.info("[%s] -> %s %s", request_id, request.method, request.url.path)
        # Reject oversized uploads before the body is read.
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > max_body:
            return JSONResponse(status_code=413, content={"detail": "Request body is too large"})
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("[%s] unhandled error on %s %s", request_id, request.method, request.url.path)
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.2f}"
        response.headers["X-Request-ID"] = request_id
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        logger.info("[%s] <- %s %s %s (%.2f ms)", request_id, request.method, request.url.path, response.status_code, elapsed_ms)
        return response


def _scan_once() -> int:
    with SessionLocal() as db:
        return scan_reminders(db)


async def reminder_loop() -> None:
    """Periodically flag orders left in PLACED/ACCEPTED past the threshold."""
    interval = get_settings().reminder_interval_seconds
    while True:
        try:
            created = await run_in_threadpool(_scan_once)
            if created:
                logger.info("Created %d reminder(s)", created)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Reminder scan failed")
        await asyncio.sleep(interval)
