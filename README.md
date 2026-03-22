# PoE1 Local Item Value Prediction System

Local PoC for collecting Path of Exile 1 public stash data, storing raw responses, and normalizing a priced-item subset into PostgreSQL.

This phase focuses on collection and inspection only. Model training, UI, and deployment are intentionally out of scope.

## Verified API assumptions

The current implementation follows the official Path of Exile developer documentation:

- OAuth token retrieval uses `POST https://www.pathofexile.com/oauth/token`
- Public Stash access uses the `client_credentials` grant type with `service:psapi`
- Public stash collection uses `GET https://api.pathofexile.com/public-stash-tabs`
- Pagination is passed via the `id` query parameter and persisted using `next_change_id`

## Requirements

- Node.js 20+
- Docker Desktop or a local PostgreSQL instance

## Environment variables

Create a local `.env` file.

Required:

- `POE_CLIENT_ID`
- `POE_CLIENT_SECRET`
- `POE_USER_AGENT`
- `DATABASE_URL`

Optional:

- `START_NEXT_CHANGE_ID`
- `TARGET_LEAGUE`
- `POE_REALM` (`pc`, `xbox`, `sony`)
- `POLL_INTERVAL_MS`

Compatibility note:

- The loader also accepts `POE_API_CLIENT_ID`
- The loader also accepts `POE_API_SECRET_KEY`
- The loader also accepts `POE_API_SCRET_KEY` for backwards compatibility with a typo

The `User-Agent` must start with `OAuth ` and should follow the format documented by GGG, for example:

```text
OAuth mypoeapp/1.0.0 (contact: you@example.com)
```

## Local PostgreSQL

Start PostgreSQL with Docker Compose:

```bash
docker compose up -d
```

This project mounts `src/db/schema.sql` into the container so the schema is initialized automatically on first startup.

## Install dependencies

```bash
npm install
```

## Run the collector

Run continuously:

```bash
npm run collector
```

Run one cycle only:

```bash
npm run collector:once
```

Collector flow:

1. Fetch OAuth token
2. Call public stash API
3. Save full raw payload
4. Normalize priced items
5. Save latest `next_change_id`
6. Resume from stored state on next run

## Inspect collected data

```bash
npm run inspect
```

The inspection script prints:

- raw response count
- normalized item count
- top leagues
- top currencies

## Notes on normalization

- Raw responses are preserved in `raw_api_responses`
- Collector state is stored in `collector_state`
- Filtered priced items are stored in `normalized_priced_items`
- Price-note parsing is intentionally conservative and currently supports basic `~b/o` and `~price` patterns only

## Out of scope for this phase

- ML training
- overlay/UI
- AWS deployment
- full price-note edge case coverage
- advanced data pipelines

## Third-party notice

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
