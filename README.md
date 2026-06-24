# EZStats Backend

API server for **EZStats Football Analysis** (senior project, CAMT — Chiang Mai University).

Stack (per the project proposal §2.2.4): **NestJS (Node.js) · PostgreSQL · Prisma · Docker**, with **Redis + BullMQ** to be added for the cloud video-processing queue.

This service is the central app server in the architecture (proposal Fig. 5):
it owns team/match management, will accept video uploads, enqueue jobs to the
**EZ Stats AI Worker**, and serve analysis results to the **EZ Stats Frontend**.

## What's implemented now

**Feature #2 — Football Team Management** (Progress 1):

- Teams — CRUD (`/api/teams`)
- Players / roster — CRUD under a team (`/api/teams/:teamId/players`, `/api/players/:id`)
- Match sessions — CRUD under a team (`/api/teams/:teamId/matches`, `/api/matches/:id`)
- Health check (`/api/health`)

The data model already carries seams for later milestones (auth, video upload,
worker run linkage, player-ID mapping) so they slot in without a redesign — see
`prisma/schema.prisma`.

## Prerequisites

- Docker Desktop (for PostgreSQL — no manual DB install needed)
- Node.js 20+

## Quick start (local dev)

```bash
# 1. Install deps
npm install

# 2. Start PostgreSQL in Docker (data persists in a Docker volume)
docker compose up -d postgres

# 3. Create the database schema
npx prisma migrate dev --name init

# 4. (optional) Seed sample data
npm run db:seed

# 5. Run the API with hot reload
npm run start:dev
```

API is at **http://localhost:4000/api**. CORS is open to the frontend at
`http://localhost:3000` (configurable via `CORS_ORIGINS`).

Inspect the database in a GUI (pgAdmin / DBeaver / VS Code) or:

```bash
npx prisma studio
```

Connection: `localhost:5432`, db `ezstats`, user `ezstats`, password `ezstats`.

## Run everything in Docker (API + DB)

```bash
docker compose --profile full up --build
```

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | liveness + DB connectivity |
| POST | `/api/teams` | create a team |
| GET | `/api/teams` | list teams (with player/match counts) |
| GET | `/api/teams/:id` | one team incl. roster + matches |
| PATCH | `/api/teams/:id` | update a team |
| DELETE | `/api/teams/:id` | delete a team (cascades) |
| POST | `/api/teams/:teamId/players` | add a player |
| GET | `/api/teams/:teamId/players` | list a team's roster |
| GET | `/api/players/:id` | one player |
| PATCH | `/api/players/:id` | update a player |
| DELETE | `/api/players/:id` | remove a player |
| POST | `/api/teams/:teamId/matches` | create a match session |
| GET | `/api/teams/:teamId/matches` | list a team's matches |
| GET | `/api/matches/:id` | one match |
| PATCH | `/api/matches/:id` | update a match (incl. status) |
| DELETE | `/api/matches/:id` | delete a match |

### Example

```bash
curl -X POST http://localhost:4000/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name":"CMU Lions","primaryColor":"#1E40AF"}'
```

## Roadmap (aligned to proposal milestones)

- **Progress 2** — Feature #1 auth (User table already present), Feature #6 player-ID mapping (`PlayerTrackMap` seam present), Feature #8 dashboard endpoints.
- **Final Progress** — Feature #3 video upload, Feature #4 cloud processing (Redis + BullMQ queue → AI worker), ingest `match_report_merged.json` + videos + crops from the worker `outputs/<run_id>` contract.
