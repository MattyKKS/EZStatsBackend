# Frontend → Backend API Integration

> **For the EZ Stats Frontend session.** Point your Claude session at this file
> (absolute path: `C:\Users\kaung\EZStatsBackend\docs\FRONTEND_API_INTEGRATION.md`).

## Task

Rewrite **only** the API-calling layer of the Next.js frontend to talk to this
backend. **Do NOT change any UI design, components, styling, layout, routing, or
navigation.** Touch only data-fetching code (`lib/api.ts`, `lib/types.ts`, and the
`fetch`/`await` call sites inside pages/components). The visual app must stay
identical. Confirm `npm run build` still passes at the end.

## Backend (already built and running)

- Stack: **NestJS**. Base URL: **`http://localhost:4000/api`** (note the `/api` prefix).
- Configure via env — do **not** hardcode. Create/confirm `.env.local` in the
  frontend root:

  ```
  NEXT_PUBLIC_API_URL=http://localhost:4000/api
  ```

  Keep `lib/api.ts` reading the env var first; change the fallback from
  `http://localhost:8000` to `http://localhost:4000/api`.

## Endpoints served now (Feature #2 — Team Management)

All paths are relative to the base URL. JSON in/out. Methods matter.

### Teams
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/teams` | `CreateTeam` | `Team` |
| GET | `/teams` | — | `(Team & { _count: { players: number; matches: number } })[]` |
| GET | `/teams/:id` | — | `Team & { players: Player[]; matches: Match[] }` |
| PATCH | `/teams/:id` | `Partial<CreateTeam>` | `Team` |
| DELETE | `/teams/:id` | — | deleted `Team` (cascades players + matches) |

### Players (roster) — nested for create/list, direct for item ops
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/teams/:teamId/players` | `CreatePlayer` | `Player` |
| GET | `/teams/:teamId/players` | — | `Player[]` |
| GET | `/players/:id` | — | `Player` |
| PATCH | `/players/:id` | `Partial<CreatePlayer>` | `Player` |
| DELETE | `/players/:id` | — | deleted `Player` |

### Match sessions — nested for create/list, direct for item ops
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/teams/:teamId/matches` | `CreateMatch` | `Match` |
| GET | `/teams/:teamId/matches` | — | `Match[]` |
| GET | `/matches/:id` | — | `Match & { team: Team }` |
| PATCH | `/matches/:id` | `Partial<CreateMatch> & UpdateMatchExtra` | `Match` |
| DELETE | `/matches/:id` | — | deleted `Match` |

### Health
| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ status: "ok"; db: "up" \| "down"; timestamp: string }` |

## Types (add to `lib/types.ts`)

Dates are ISO strings.

```ts
export type Team = {
  id: string;
  name: string;
  description: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Player = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string | null;
  teamId: string;
  createdAt: string;
  updatedAt: string;
};

export type MatchStatus =
  | "CREATED" | "UPLOADED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export type Match = {
  id: string;
  date: string | null;
  opponent: string | null;
  teamColor: string | null;
  opponentColor: string | null;
  teamId: string;
  status: MatchStatus;
  videoPath: string | null;
  runId: string | null;
  reportPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTeam = {
  name: string;
  description?: string;
  primaryColor?: string;   // hex, e.g. "#1E40AF"
  secondaryColor?: string; // hex
};

export type CreatePlayer = {
  name: string;
  jerseyNumber?: number;   // 0–999
  position?: string;
};

export type CreateMatch = {
  date?: string;           // ISO date, e.g. "2026-06-20"
  opponent?: string;
  teamColor?: string;      // hex
  opponentColor?: string;  // hex
};

// Allowed extra fields when updating a match (used by later milestones).
export type UpdateMatchExtra = {
  status?: MatchStatus;
  videoPath?: string;
  runId?: string;
  reportPath?: string;
};
```

## Request rules (backend validates strictly)

- **Color fields must be valid hex** like `"#1E40AF"`. A name like `"red"` → **400**.
- **Do not send unknown/extra fields** in bodies — unrecognized props are rejected (**400**).
- `date` is an **ISO date string** (e.g. `"2026-06-20"`).
- `jerseyNumber` is **unique per team** — a duplicate returns **409**.
- Missing id returns **404**.
- Error body shape: `{ statusCode: number; message: string | string[]; error: string }`
  (`message` is a `string[]` for validation errors).

## Functions to add to `lib/api.ts`

Add a generic request helper supporting `GET/POST/PATCH/DELETE` with an optional
JSON body that throws on `!res.ok`, then:

```
getTeams()                         // GET    /teams
getTeam(id)                        // GET    /teams/:id
createTeam(body)                   // POST   /teams
updateTeam(id, body)               // PATCH  /teams/:id
deleteTeam(id)                     // DELETE /teams/:id

getPlayers(teamId)                 // GET    /teams/:teamId/players
createPlayer(teamId, body)         // POST   /teams/:teamId/players
updatePlayer(id, body)             // PATCH  /players/:id
deletePlayer(id)                   // DELETE /players/:id

getMatches(teamId)                 // GET    /teams/:teamId/matches  (team-scoped!)
getMatch(id)                       // GET    /matches/:id
createMatch(teamId, body)          // POST   /teams/:teamId/matches
updateMatch(id, body)              // PATCH  /matches/:id
deleteMatch(id)                    // DELETE /matches/:id
```

## Do not break the build

- The existing functions `getMatchReport`, `getStatsVideoUrl`,
  `getSpatialVideoUrl`, `getCropUrl` (and the old `getMatches` that returned
  `string[]`) target the **AI-worker RESULTS** endpoints, which this backend does
  **not** serve yet. **Leave those functions in place** (so nothing that imports
  them fails to compile) — they belong to a later milestone.
- Name collision: the old run-id `getMatches(): Promise<string[]>` clashes with
  the new team-scoped match list. **Rename the old one to `getWorkerRuns()`** and
  update its (currently non-functional) callers — without changing their UI.
- If a page currently calls a not-yet-available results function and would now
  error at runtime, guard it with a graceful loading/empty state. **Do not
  redesign the page.**

## Deliverable

Only `lib/api.ts` + `lib/types.ts` rewritten/extended, `.env.local` set, and
minimal call-site edits so the team / roster / match pages fetch from this
backend. No visual / design / navigation changes. `npm run build` must pass.

---

### Run order for testing
```bash
# Backend (this repo)
docker compose up -d postgres
npm run start:dev          # http://localhost:4000/api

# Frontend
npm run dev                # http://localhost:3000
```
Backend must be running or every call returns a connection error. The backend
already allows CORS from `http://localhost:3000`.
