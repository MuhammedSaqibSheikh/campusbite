import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import SessionLocal, engine
from .media import media_root
from .middleware import reminder_loop, register_middleware
from .migrations import upgrade_schema
from .routers import ai, auth, delivery, orders, owner, profile, restaurants
from .seed import seed_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    upgrade_schema(engine)
    if settings.seed_demo_data:
        with SessionLocal() as db:
            seed_demo_data(db)
    task = asyncio.create_task(reminder_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="CampusBite API",
    description="Restaurant ordering and delivery platform for customers, restaurant owners and delivery partners.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time-Ms", "X-Request-ID"],
)
register_middleware(app)

for module in (auth, profile, restaurants, orders, owner, delivery, ai):
    app.include_router(module.router)

# Uploaded avatars, restaurant covers and dish photos/videos (file types are validated on upload).
app.mount("/media", StaticFiles(directory=media_root()), name="media")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
