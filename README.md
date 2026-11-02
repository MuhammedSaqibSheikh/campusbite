# CampusBite – Restaurant Ordering & Delivery Platform

CampusBite is a full-stack food ordering and delivery app with three user roles: **Customers** browse restaurants and order food, **Restaurant Owners** manage menus and orders, and **Delivery Partners** deliver assigned orders. Customers also get **AI-generated insights** about their order history (OpenAI).

## Technologies used

| Layer | Stack |
|---|---|
| Frontend | React 18, JavaScript (ES6+), React Hooks, React Router DOM 6, Axios, Vite |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 ORM, JWT (PyJWT), bcrypt |
| Database | PostgreSQL 16 (Docker). SQLite is supported for quick local runs and tests |
| AI | OpenAI API (`openai` Python SDK) |
| DevOps | Docker, Docker Compose, Git/GitHub |

## Features implemented

**Customer**
- Register / log in; browse restaurants; view menus; search dishes by name and filter by price
- Cart (add, update quantity, remove) kept in React state and `localStorage`
- Place orders with a **dummy payment** (order becomes `mock_paid`, a payment ledger entry is stored)
- Order history with filters (status, date), live status tracker, cancel while `PLACED`
- Rate and review delivered orders; request a return/refund (one per order, reason required)
- **AI order insights**: summary of recent orders and free-form questions about your own history

**Restaurant owner**
- Add / edit / delete dishes and toggle availability
- Incoming orders with status and date filters; accept, prepare, mark ready, assign a delivery partner
- Approve or reject return/refund requests (approval refunds the payment and moves the order to `REFUNDED`)
- Statistics (orders, revenue, rating, top dishes) and **reminders** for orders idle in `PLACED`/`ACCEPTED` for more than 15 minutes

**Delivery partner**
- See only orders assigned to them with customer delivery details
- Move orders `ASSIGNED → OUT_FOR_DELIVERY → DELIVERED`; view delivery history

**Platform**
- JWT auth, bcrypt password hashing, role-based access control enforced on the **backend** and mirrored by protected routes on the frontend
- Server-side order state machine; invalid transitions return `409`
- Pagination on all list endpoints (`page`, `page_size`)
- Middleware that logs method/path and adds `X-Process-Time-Ms` and `X-Request-ID` headers
- Background task that scans for stale orders and writes reminder records
- Dockerised backend with PostgreSQL, automated tests (`pytest`)

### Order lifecycle

```
PLACED → ACCEPTED → PREPARING → READY → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED → (REFUNDED)
   └→ CANCELLED (customer, only while PLACED)
```

| Transition | Who |
|---|---|
| `PLACED → ACCEPTED → PREPARING → READY` | Restaurant owner |
| `READY → ASSIGNED` | Restaurant owner (via assign endpoint) |
| `ASSIGNED → OUT_FOR_DELIVERY → DELIVERED` | Assigned delivery partner |
| `PLACED → CANCELLED` | Customer (payment is refunded) |
| `DELIVERED → REFUNDED` | System, when the owner approves a return |

## Project structure

```
campusbite/
├── docker-compose.yml        # PostgreSQL + FastAPI backend
├── .env.example              # variables for docker-compose
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example          # variables for running without Docker
│   ├── app/
│   │   ├── main.py           # app, CORS, lifespan (create tables, seed, background task)
│   │   ├── config.py         # settings from environment
│   │   ├── database.py       # engine / session
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── security.py       # bcrypt + JWT
│   │   ├── deps.py           # auth, RBAC, pagination dependencies
│   │   ├── services.py       # order state machine, refunds, reminder scan
│   │   ├── middleware.py     # logging/timing middleware + reminder loop
│   │   ├── seed.py           # demo data
│   │   └── routers/          # auth, restaurants, orders, owner, delivery, ai
│   └── tests/                # pytest suite
└── frontend/                 # React (Vite) app
    └── src/{api,components,context,hooks,pages}
```

## Prerequisites

- Docker Desktop (for the backend + database)
- Node.js 18+ and npm (for the frontend)
- Optional: Python 3.11+ to run the backend or tests without Docker

## Run the backend with Docker Compose

```bash
# from the project root
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Edit `.env` and set at least:

- `POSTGRES_PASSWORD` – any password
- `JWT_SECRET` – a long random string, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `OPENAI_API_KEY` – your OpenAI key (only needed for the AI insights page)

No OpenAI key? Use the free, rate-limited [GitHub Models](https://docs.github.com/en/github-models) endpoint instead: create a fine-grained GitHub personal access token with the **Models: read** permission and set

```env
OPENAI_API_KEY=<your GitHub token>
OPENAI_BASE_URL=https://models.github.ai/inference
OPENAI_MODEL=openai/gpt-4o-mini
```

Then start everything:

```bash
docker compose up --build
```

- API: http://localhost:8000
- Interactive docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/health

Stop with `Ctrl+C`; `docker compose down` removes the containers (add `-v` to also delete the database volume).

## Run the frontend locally

```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:5173. The backend must be running and `CORS_ORIGINS` must include the frontend URL (the default does).

## Run the backend without Docker (optional)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # edit JWT_SECRET; uses SQLite by default
uvicorn app.main:app --reload
```

## Environment variables

Never commit real values. `.env` files are git-ignored; only `.env.example` files are tracked.

| Variable | Used by | Description | Default |
|---|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | compose | Database credentials (compose builds `DATABASE_URL` from them) | required |
| `DATABASE_URL` | backend | SQLAlchemy URL (set by compose in Docker) | `sqlite:///./campusbite.db` |
| `JWT_SECRET` | backend | Secret used to sign JWTs | **required** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | backend | Token lifetime | `1440` |
| `CORS_ORIGINS` | backend | Comma-separated allowed frontend origins | `http://localhost:5173` |
| `OPENAI_API_KEY` | backend | OpenAI key; AI endpoints return `503` if empty | empty |
| `OPENAI_MODEL` | backend | Chat model (`openai/gpt-4o-mini` for GitHub Models) | `gpt-4o-mini` |
| `OPENAI_BASE_URL` | backend | Optional OpenAI-compatible endpoint, e.g. `https://models.github.ai/inference` | empty (OpenAI) |
| `AI_RATE_LIMIT_PER_MINUTE` | backend | Max AI requests per customer per minute | `10` |
| `REMINDER_THRESHOLD_MINUTES` | backend | Idle time before a reminder is created | `15` |
| `REMINDER_INTERVAL_SECONDS` | backend | How often the background scan runs | `60` |
| `SEED_DEMO_DATA` | backend | Insert demo users/restaurants on first start | `true` |
| `ALLOW_STAFF_REGISTRATION` | backend | Allow self-registration as owner / delivery partner. Set `false` in production | `true` |
| `VITE_API_URL` | frontend | Backend base URL | `http://localhost:8000` |

## Database setup

No manual setup is needed. On startup the backend creates all tables with `Base.metadata.create_all` and, when `SEED_DEMO_DATA=true` and the database is empty, inserts demo data. With Docker Compose the PostgreSQL data persists in the `pgdata` volume.

Tables: `users`, `restaurants`, `menu_items`, `orders`, `order_items`, `reviews`, `return_requests`, `payment_ledger`, `reminder_logs`.

Relationships: a customer has many orders; a restaurant has many menu items and orders; an order has many order items and many ledger entries, and at most one review and one return request (both unique per order); a delivery partner can be assigned to many orders. Order items snapshot the dish name and price so history is unaffected by later menu edits.

To reset the data: `docker compose down -v` and start again.

### Demo accounts (seeded; password `Password@123`)

| Role | Email |
|---|---|
| Customer | `customer@campusbite.dev` |
| Restaurant owner | `owner1@campusbite.dev` (Spice Route), `owner2@campusbite.dev` (Campus Pizza Co.) |
| Delivery partner | `driver1@campusbite.dev`, `driver2@campusbite.dev` |

Change or disable these (`SEED_DEMO_DATA=false`) outside local development.

### Suggested walkthrough

1. Log in as the customer, add dishes from **Spice Route**, and place an order.
2. Log in as `owner1`: accept → start preparing → mark ready → assign `Demo Driver One`.
3. Log in as `driver1`: mark out for delivery, then delivered.
4. As the customer: leave a review, request a return, and try **AI Insights**.
5. As `owner1`: approve the return on the **Returns** page.

To see reminders quickly, set `REMINDER_THRESHOLD_MINUTES=1`, leave an order in `PLACED`, then use **Check now** on the owner dashboard.

## API documentation

Swagger UI: `http://localhost:8000/docs` (use **Authorize** and paste the `access_token` from `/auth/login`). ReDoc: `/redoc`. OpenAPI JSON: `/openapi.json`.

List endpoints return `{ items, total, page, page_size, pages }` and accept `page` (default 1) and `page_size` (default 10, max 100).

| Method & path | Role | Description |
|---|---|---|
| `POST /auth/register` | public | Register (customer, owner with `restaurant_name`, or delivery partner) |
| `POST /auth/login` | public | Returns `access_token` and user |
| `GET /auth/me` | any | Current user |
| `GET /restaurants` | public | List; `search`, `cuisine` |
| `GET /restaurants/{id}` | public | Restaurant with average rating |
| `GET /restaurants/{id}/menu` | public | Menu; `search`, `min_price`, `max_price`, `category` |
| `GET /restaurants/{id}/reviews` | public | Reviews |
| `POST /orders` | customer | Place order (dummy payment, status `PLACED`, payment `mock_paid`) |
| `GET /orders` | customer | Own orders; `status`, `date_from`, `date_to` |
| `GET /orders/{id}` | customer / owner / assigned partner | Order details (only if related to the user) |
| `POST /orders/{id}/cancel` | customer | Cancel while `PLACED` |
| `POST /orders/{id}/review` | customer | Rate a delivered order (once) |
| `POST /orders/{id}/return` | customer | Request return/refund with `reason` (once) |
| `GET /owner/restaurant`, `PUT /owner/restaurant` | owner | View / update restaurant |
| `GET/POST /owner/menu`, `PUT/DELETE /owner/menu/{id}` | owner | Manage dishes |
| `PATCH /owner/menu/{id}/availability` | owner | Mark available/unavailable |
| `GET /owner/orders` | owner | Restaurant orders; `status`, `date_from`, `date_to` |
| `PATCH /owner/orders/{id}/status` | owner | `ACCEPTED`, `PREPARING`, `READY` |
| `GET /owner/delivery-partners` | owner | Delivery partners to choose from |
| `POST /owner/orders/{id}/assign` | owner | Assign partner to a `READY` order |
| `GET /owner/returns` | owner | Return requests; `status` |
| `POST /owner/returns/{id}/approve` / `reject` | owner | Decide (optional `note`) |
| `GET /owner/stats` | owner | Restaurant statistics |
| `GET /owner/reminders`, `POST /owner/reminders/scan` | owner | Open reminders / run a scan now |
| `GET /delivery/orders` | delivery | Active assigned orders; `status` |
| `GET /delivery/history` | delivery | Delivered history |
| `PATCH /delivery/orders/{id}/status` | delivery | `OUT_FOR_DELIVERY`, `DELIVERED` |
| `POST /ai/summary` | customer | AI summary of recent orders |
| `POST /ai/ask` | customer | Body `{"question": "..."}` |
| `GET /health` | public | Liveness check |

Status codes: `400` bad input, `401` missing/invalid token, `403` wrong role, `404` not found or not yours, `409` business-rule conflict (invalid transition, duplicate review/return), `422` validation error, `429` rate limited, `503` AI not configured or unreachable.

### How AI insights work

The backend loads **only the authenticated customer's** latest 50 orders from the database, adds a few precomputed totals (weekly spend, most ordered items, undelivered orders), and sends them with the question to OpenAI. The model is instructed to answer only from that data. The API key stays in backend environment variables, requests are rate limited per user, and OpenAI errors (rate limit, timeout, auth) are mapped to clear HTTP responses.

## Running the tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest
```

The suite uses a temporary SQLite database and covers the full order lifecycle, RBAC, ownership checks, cancellation rules, returns/refunds, filters, and reminders.

## Security notes

- Passwords are hashed with bcrypt; JWTs are signed with `JWT_SECRET` and the user's role is always read from the database.
- Every protected endpoint checks the role and ownership on the server. Order prices are computed on the server, never taken from the client.
- The JWT is stored in `localStorage` as the assignment requires; this is exposed to XSS, so keep dependencies updated and avoid rendering untrusted HTML.
- Secrets live only in `.env` files, which are git-ignored and excluded from the Docker image.
- `ALLOW_STAFF_REGISTRATION` exists for demo convenience; disable it in production and create staff accounts through an admin process.
- Tables are created with `create_all`; use Alembic migrations if the schema will evolve in production.
