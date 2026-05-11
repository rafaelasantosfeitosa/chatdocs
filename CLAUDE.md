# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from repo root. Node 22.x required (pinned in `engines`).

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (Next.js, port 3000) |
| Build | `npm run build` |
| Prod start | `npm start` |
| Lint | `npm run lint` (Next ESLint) |
| Apply DB schema | `npm run db:push` — runs `tsx --env-file=.env.local src/db/applySchema.ts` against `DATABASE_URL`. Idempotent (uses `CREATE ... IF NOT EXISTS`). |

No test suite yet. Env config copied from `.env.example` → `.env.local` (Clerk, Gemini, Stripe, `DATABASE_URL`, `FREE_TIER_QUERY_LIMIT`).

`db:push` uses `--env-file=.env.local` explicitly; other scripts rely on Next.js `.env.local` auto-load. Schema lives in `src/db/schema.sql` — edit + re-run `db:push`. Neon DB must have `vector` extension available (script runs `CREATE EXTENSION IF NOT EXISTS vector`).

## Architecture

Single Next.js 14 App Router app. No separate backend. All server work runs in Route Handlers under `src/app/api/*` with `runtime = 'nodejs'` (pdf-parse + pg need Node, not edge).

### Request flow: ingest

`POST /api/documents/upload` (`src/app/api/documents/upload/route.ts`)
→ multipart parse, MIME + magic-byte check (`%PDF-`), 25 MB cap
→ INSERT `documents` row (status=`processing`)
→ `ingestPdf()` in `src/rag/ingest.ts`:
  1. `pdf-parse` with `max: 501` pages; throws typed `IngestError` (`PDF_ENCRYPTED` / `PDF_INVALID` / `PDF_NO_TEXT` / `PDF_TOO_MANY_PAGES`)
  2. Split on `\f` form-feed for page boundaries (pdf-parse convention)
  3. `chunkText()` — ~750 char chunks, 100 char overlap, sentence-boundary aware
  4. `embedTexts()` — Gemini `gemini-embedding-001`, 768 dims
  5. Single transaction: INSERT chunks + UPDATE doc to `ready` + INSERT `usage_events` ingest row. ROLLBACK on any failure.
→ on `IngestError`: UPDATE doc → `failed` with user-facing message, return 422 (typed code) or 500 (unknown).

### Request flow: chat

`POST /api/chat` (`src/app/api/chat/route.ts`)
1. `auth()` + `ensureUser()` upsert
2. **`reserveQuery()`** (`src/lib/usage.ts`) — atomic quota: `BEGIN` → `pg_advisory_xact_lock(hashtextextended(userId))` → count `usage_events` for current month → INSERT slot or ROLLBACK → `COMMIT`. Returns 402 if free-tier exhausted. **Critical:** do NOT replace with read-then-write; the advisory lock is what blocks concurrent bypass.
3. Get-or-create `conversations` row (ownership-checked)
4. INSERT user message
5. `retrieveChunks(userId, query, k=6)` — pgvector cosine: `ORDER BY embedding <=> $query ASC LIMIT $k`, scoped to `c.user_id = $userId`
6. Load last 8 history messages
7. `buildMessages()` injects chunks into `systemInstruction` as `[chunk-N]` blocks with filename + page
8. `streamCompletion()` → Gemini SSE → emit custom SSE events to client: `meta` (chunk metadata, sent first), `token` (deltas), `done`, `error`
9. After stream closes: INSERT assistant message + `citations` JSONB (best-effort, errors logged not raised)

Citations are resolved client-side from the initial `meta` event — the model emits `[^chunk-N]` markers in its text, the UI maps N → chunk metadata.

### Multi-tenancy

Every row in `documents`, `chunks`, `conversations`, `messages`, `usage_events` carries `user_id TEXT REFERENCES users(id)` (Clerk's `user_id`, not internal). All queries filter by `user_id` at the DB layer. `ON DELETE CASCADE` chains from `users` down. There is no row-level security — isolation is enforced by always including `user_id` in `WHERE`. When adding new queries against these tables, include the user filter or document why not.

`users.id` is the Clerk identity; `ensureUser()` upserts on every authenticated entry point.

### Vector store

- Single table `chunks` with `embedding vector(768)` column.
- HNSW index `idx_chunks_embedding_hnsw` on `vector_cosine_ops` (m=16, ef_construction=64).
- `idx_chunks_user_id` exists but pgvector HNSW doesn't combine with btree filters — multi-tenant filtering happens post-index in the planner. Fine at portfolio scale; revisit if vectors >> 100k.
- Use `<=>` (cosine distance) for similarity. `similarity = 1 - distance`.

### Routes (App Router)

- `/` — marketing landing (`src/app/page.tsx`)
- `/dashboard` — server component, lists user's documents, embeds `DocumentsPanel` + `UpgradeButton` clients
- `/chat` and `/chat/[id]` — `ChatClient.tsx` consumes the SSE stream
- `/api/documents`, `/api/documents/[id]`, `/api/documents/upload`
- `/api/chat`
- `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/webhook` — Stripe; webhook flips `users.plan` to `pro`

Middleware (`src/middleware.ts`) protects `/dashboard`, `/api/documents`, `/api/chat`, `/api/billing` via Clerk.

### DB pool

`src/db/client.ts` exports a singleton `pg.Pool`. Reused across hot reloads via `global.__pgPool` in dev. SSL on in production or when `sslmode=require` in URL (Neon).

## Gotchas

- `pdf-parse` is CJS and pulls in a `test/` folder at import time; the import works but don't be surprised by warnings. Keep `runtime = 'nodejs'`, never edge.
- `date_trunc(..., NOW())` is not `IMMUTABLE` for `timestamptz`, so the usage-events index is plain `(user_id, created_at)` and the month filter lives in the query. Don't try to index on `date_trunc`.
- The `meta` SSE event is sent **before** the first `token` so the client has citation metadata ready when the markers stream in. Don't reorder.
- `reserveQuery()` advisory lock key is `hashtextextended(userId, 0)` returning a bigint — `pg_advisory_xact_lock` accepts a single 64-bit key. If you split it into two ints, lock semantics change.
- File storage is `documents.file_data BYTEA` — no S3, no Vercel Blob. Acceptable for portfolio scale; replace if total stored PDFs > a few hundred MB.
- The portfolio's parent `git/CLAUDE.md` is authoritative for repo-shape rules (don't `git add -A` from workspace root, etc.).
