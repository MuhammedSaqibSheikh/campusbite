import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, SessionLocal, engine
from .middleware import reminder_loop, register_middleware
from .routers import ai, auth, delivery, orders, owner, restaurants
from .seed import seed_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
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

for module in (auth, restaurants, orders, owner, delivery, ai):
    app.include_router(module.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
