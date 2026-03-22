# PLAN.md

## Project

PoE1 Local Item Value Prediction System - Public Stash Collector PoC

## Goal

Build a local PoC on macOS for collecting and analyzing PoE1 public stash data.

This phase is **not** about model training yet.  
This phase is about proving that we can:

1. authenticate with the approved OAuth app,
2. collect public stash data continuously,
3. store raw responses safely,
4. normalize a filtered subset into PostgreSQL,
5. resume from the last `next_change_id`,
6. inspect whether the collected data is useful enough for later learning.

## Current constraints

- Local development environment: **MacBook**
- IDE: **Cursor**
- Language: **Node.js + TypeScript**
- Database: **PostgreSQL**
- Initial execution target: **local only**
- Cloud deployment (AWS) is **out of scope for now**
- Use **raw + normalized 2-layer storage**
- Do **not** start model training in this phase
- Do **not** build overlay/UI in this phase

## Very important instructions

You must not assume undocumented API behavior.

For anything related to:

- OAuth token usage,
- Public Stash API request format,
- required headers,
- pagination / `next_change_id`,
- response field structure,
- rate limit behavior,
- note/price field structure,

**first verify by either:**

1. reading the official Path of Exile developer docs,
2. inspecting the actual API response we can fetch locally,
3. running a real local curl test if necessary.

Do not invent field names or endpoint behavior from memory.

If there is uncertainty, prefer:

- checking docs,
- checking a real response,
- or leaving a TODO note with the uncertainty clearly documented.

## Existing known setup

We already have an approved OAuth application.

Environment will be provided via `.env`.

Expected environment variables:

- `POE_CLIENT_ID`
- `POE_CLIENT_SECRET`
- `POE_USER_AGENT`
- `DATABASE_URL`
- `START_NEXT_CHANGE_ID` (optional)

Do not hardcode secrets.
Do not print secrets in logs.
Do not commit secrets.

## Deliverable for this phase

A runnable local collector PoC that can:

- fetch an OAuth access token,
- call the public stash endpoint,
- save the full raw JSON response into PostgreSQL,
- extract a filtered subset of items into normalized tables,
- save/update the latest `next_change_id`,
- resume from the last saved state,
- provide at least one inspection script or SQL query for quick sanity checks.

## Development principles

1. Keep the architecture simple.
2. Prefer correctness and debuggability over abstraction.
3. Preserve raw data first, normalize second.
4. Separate collection logic from normalization logic.
5. Make restart/resume behavior reliable.
6. Add enough logging to debug failures.
7. Avoid overengineering.

## Non-goals

The following are explicitly out of scope for this phase:

- AWS deployment
- ECS / Docker production hosting
- monitoring dashboards
- ML training pipelines
- rare item feature engineering
- overlay app integration
- UI
- automated in-game actions
- full price-note parsing coverage for every edge case

## Preferred stack

- Node.js
- TypeScript
- `axios` for HTTP
- `pg` for PostgreSQL
- `dotenv` for env loading
- `pino` for logging
- `tsx` for local TypeScript execution
- Docker Compose only for local PostgreSQL if convenient

You may suggest small improvements, but do not replace the stack with a completely different one unless there is a strong reason.

## Suggested repo structure

Use a structure close to this:

```text
poe-stash-collector/
├─ src/
│  ├─ config/
│  │  └─ env.ts
│  ├─ db/
│  │  ├─ client.ts
│  │  ├─ schema.sql
│  │  └─ migrations/
│  ├─ services/
│  │  ├─ auth.service.ts
│  │  ├─ poe-api.service.ts
│  │  ├─ collector.service.ts
│  │  ├─ normalize.service.ts
│  │  └─ price-note-parser.service.ts
│  ├─ repositories/
│  │  ├─ raw-response.repository.ts
│  │  ├─ collector-state.repository.ts
│  │  └─ normalized-item.repository.ts
│  ├─ scripts/
│  │  ├─ run-collector.ts
│  │  ├─ inspect-sample.ts
│  │  └─ backfill-from-id.ts
│  ├─ types/
│  │  └─ poe.types.ts
│  └─ utils/
│     ├─ logger.ts
│     ├─ retry.ts
│     └─ time.ts
├─ .env
├─ .env.example
├─ docker-compose.yml
├─ package.json
├─ tsconfig.json
└─ README.md
```

You can simplify this if needed, but keep the separation between:

- auth,
- API calls,
- DB access,
- normalization,
- runnable scripts.

## Data strategy

Use a **2-layer storage strategy**.

### Layer 1: Raw responses

Store the full raw API response payload exactly as received, together with:

- fetch timestamp,
- request `next_change_id`,
- response `next_change_id`.

Purpose:

- debugging,
- reprocessing later,
- avoiding data loss,
- validating field assumptions against actual payloads.

### Layer 2: Normalized items

Create a normalized table for filtered items only.

The normalized layer should be derived from the raw layer and should be easy to query for:

- league,
- item rarity,
- item base/type,
- note presence,
- parsed price amount/currency,
- later data quality checks.

## Filtering strategy

Do not try to make this perfect immediately.

Initial normalization/filtering should focus only on an early useful subset.

Suggested first-pass filtering:

- public stash only,
- target league only,
- priced items only (`note` / `forum_note`-based if present in actual response),
- keep raw item JSON in normalized rows too.

Important:
Do not assume exact field names if not confirmed.
Verify them from:

- docs,
- real sample response,
- or both.

## Price note parsing

Implement only a minimal parser in this phase.

Goals:

- preserve raw note string,
- extract listing mode if visible,
- extract amount if possible,
- extract currency token if possible.

Do not try to support every edge case now.
Keep parsing conservative.
If parsing fails, store the raw note and mark parsed fields as null.

## Database goals

Use PostgreSQL.

Need at least:

1. a table for raw responses,
2. a table for collector state,
3. a table for normalized priced items.

Keep schema practical, not academically perfect.

Use JSONB for raw payload and also keep raw item JSON inside normalized rows.

## Collector behavior

The collector should:

1. get a token,
2. call the API,
3. store raw response,
4. normalize selected records,
5. persist the latest `next_change_id`,
6. repeat.

It must also:

- handle restart safely,
- not lose the last known state,
- log major events,
- avoid crashing on a single malformed row.

## Error-handling requirements

Implement basic defensive behavior:

- retry or backoff for temporary request failures,
- clear logging on auth/API/DB failures,
- skip malformed records rather than crash the whole run,
- save enough context for debugging.

Do not implement an overly complex job system yet.

## Logging requirements

Use structured logs where practical.

At minimum log:

- token fetch success/failure,
- API request success/failure,
- response size or counts,
- raw insert success,
- normalized insert counts,
- current / next `next_change_id`,
- retry/backoff events.

Do not log secrets or full tokens.

## README requirements

Create a README that explains:

- project purpose,
- setup steps,
- `.env` values,
- how to run PostgreSQL locally,
- how to initialize schema,
- how to run the collector,
- how to run a quick inspection script,
- what is intentionally out of scope for now.

## Development workflow

Work in this order.

### Step 1 - Project bootstrap

Create:

- `package.json`
- `tsconfig.json`
- `.env.example`
- `docker-compose.yml`
- base src folders

### Step 2 - Local PostgreSQL

Provide a local Postgres option via Docker Compose.
Add schema SQL.

### Step 3 - Auth service

Implement OAuth token retrieval from env credentials.

Important:
Do not trust assumptions.
If exact request format is uncertain, verify from official docs or with local curl.

### Step 4 - API client

Implement the public stash API caller with:

- bearer auth,
- user-agent,
- JSON accept header,
- optional `next_change_id` parameter support.

If the endpoint path or query behavior is uncertain, verify first.

### Step 5 - Raw storage

Insert the full raw response into PostgreSQL before normalization.

### Step 6 - Normalization

Normalize the initial filtered subset into a separate table.

### Step 7 - Collector state

Save and update the latest `next_change_id` so the collector can resume.

### Step 8 - Inspection tooling

Add one small script for sample inspection or counts, for example:

- number of raw responses,
- number of normalized rows,
- top leagues,
- top currencies,
- rarity distribution.

## Acceptance criteria

This phase is considered successful if all of the following are true:

1. the project runs locally on macOS,
2. token retrieval works from code,
3. the stash endpoint can be called from code,
4. raw responses are saved to PostgreSQL,
5. normalized rows are saved to PostgreSQL,
6. `next_change_id` is persisted,
7. rerunning resumes from prior state,
8. a simple inspection script confirms usable collected data.

## Coding style

- Prefer readable code over clever code.
- Keep functions reasonably small.
- Avoid unnecessary abstractions.
- Add comments only where they help explain decisions.
- Keep files focused.
- Make the first version runnable quickly.

## What to do when API details are unclear

When in doubt:

1. search the official docs,
2. inspect a real sample response,
3. test with a local curl command,
4. then implement.

Do not silently guess.

## First implementation request

Start by generating the following files first:

- `package.json`
- `tsconfig.json`
- `.env.example`
- `docker-compose.yml`
- `src/config/env.ts`
- `src/db/client.ts`
- `src/db/schema.sql`
- `src/services/auth.service.ts`
- `src/services/poe-api.service.ts`
- `src/scripts/run-collector.ts`
- `README.md`

After that, implement:

- raw response persistence,
- collector state persistence,
- normalized priced item persistence.

## Final note

This project is being developed in stages.

Stage 1:
Local collector PoC only.

Stage 2:
data quality inspection and normalization refinement.

Stage 3:
AWS migration if needed.

Stage 4:
dataset building for ML.

Do not jump ahead to later stages unless explicitly asked.