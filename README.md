# ChatDocs — Chat with your documents

> Production-grade RAG SaaS. Upload PDFs, ask questions, get answers grounded in your sources with inline citations. Multi-tenant, streaming, Stripe-billed.

![Status](https://img.shields.io/badge/status-live-green)
![Stack](https://img.shields.io/badge/stack-Next.js%2014%20%7C%20pgvector%20%7C%20Gemini-blue)

🔗 **Live demo:** https://chatdocs-git-main-rafaelasantosfeitosas-projects.vercel.app

---

## What it does

1. **Upload** — drop a PDF, paste a URL, connect a Notion page.
2. **Ingest** — text is extracted, chunked, embedded with Gemini `gemini-embedding-001` (768 dims), stored in Postgres (pgvector).
3. **Ask** — chat UI. Each answer streams token-by-token via SSE and **cites the source chunks** (page numbers, char offsets) it grounded on.
4. **Bill** — Free plan (10 queries/month) + Pro plan ($19/month, unlimited) via Stripe subscription.

Multi-tenant: every chunk, document, and message is scoped to the authenticated user. No cross-tenant data leaks possible at the DB layer.

---

## Tech stack

| Layer        | Technology                                    |
|--------------|-----------------------------------------------|
| Framework    | Next.js 14 (App Router, server components)    |
| Auth         | Clerk v6                                      |
| Database     | PostgreSQL + pgvector (Neon)                  |
| LLM          | Google Gemini (`gemini-2.5-flash-lite`)       |
| Embeddings   | Google Gemini (`gemini-embedding-001`, 768 dims) |
| Streaming    | Native SSE over fetch ReadableStream          |
| File storage | Postgres `bytea` column (no separate object store) |
| Billing      | Stripe (subscription + customer portal)       |
| Deploy       | Vercel                                        |

**Zero-cost demo stack:** Neon free + Clerk free + Gemini free + Vercel hobby = $0/month for the live portfolio demo.

---

## Architecture decisions

### Why pgvector over Pinecone

- One database. No separate vector store to provision, monitor, or pay for.
- Postgres ACID guarantees apply to embeddings: a failed ingest rolls back cleanly.
- Neon's free tier includes pgvector. Zero infra cost up to ~10k vectors.
- HNSW index handles up to ~1M vectors with sub-100ms query latency.

### Why streaming with citations is hard

The model can hallucinate citations if you let it generate freely. The pattern used here:

1. Retrieve top-K chunks via cosine similarity.
2. Inject chunks into the prompt with explicit IDs (`[chunk-1]`, `[chunk-2]`).
3. Instruct the model to cite IDs inline as it answers.
4. Stream tokens to the client. After the stream ends, parse cited IDs and resolve them back to chunks (page numbers, source URL) for the UI.

### Why Stripe metered billing

Pro plan is flat $19/mo, but the architecture supports per-query metering — the schema tracks `usage_events` so a future "pay-per-query" tier requires no DB migration.

---

## Roadmap

- [x] Project scaffold + Next.js + Clerk + Neon + pgvector
- [x] Document upload (PDF parse with `pdf-parse`)
- [x] Chunk + embed + store
- [x] RAG retrieval with citations (clickable badges)
- [x] Streaming chat UI (native SSE)
- [x] Free-tier query rate limit
- [x] Vercel deploy
- [ ] Stripe subscription + customer portal (test mode wired, needs prod webhook)
- [ ] Custom domain
- [ ] Loom demo walkthrough

---

## License

MIT.

## Author

[Rafaela Santos](https://github.com/rafaelasantosfeitosa)
