# ChatDocs — Chat with your documents

> Production-grade RAG SaaS. Upload PDFs, ask questions, get answers grounded in your sources with inline citations. Multi-tenant, streaming, Stripe-billed.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Stack](https://img.shields.io/badge/stack-Next.js%2014%20%7C%20pgvector%20%7C%20Stripe-blue)

🔗 **Live demo:** _coming soon_

---

## What it does

1. **Upload** — drop a PDF, paste a URL, connect a Notion page.
2. **Ingest** — text is extracted, chunked, embedded with `text-embedding-3-small`, stored in Postgres (pgvector).
3. **Ask** — chat UI. Each answer streams token-by-token via SSE and **cites the source chunks** (page numbers, char offsets) it grounded on.
4. **Bill** — Free plan (10 queries/month) + Pro plan ($19/month, unlimited) via Stripe subscription.

Multi-tenant: every chunk, document, and message is scoped to the authenticated user. No cross-tenant data leaks possible at the DB layer.

---

## Tech stack

| Layer        | Technology                                    |
|--------------|-----------------------------------------------|
| Framework    | Next.js 14 (App Router, server components)    |
| Auth         | Clerk                                         |
| Database     | PostgreSQL + pgvector (Neon)                  |
| LLM          | OpenRouter (Claude/GPT-4 fallback)            |
| Embeddings   | OpenAI `text-embedding-3-small` (1536 dims)   |
| Streaming    | Vercel AI SDK (SSE)                           |
| File storage | Vercel Blob                                   |
| Billing      | Stripe (subscription + customer portal)       |
| Deploy       | Vercel                                        |

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

- [ ] Project scaffold + Next.js + Clerk + Neon + pgvector
- [ ] Document upload (PDF parse with `pdf-parse`)
- [ ] Chunk + embed + store
- [ ] RAG retrieval with citations
- [ ] Streaming chat UI (Vercel AI SDK)
- [ ] Stripe subscription + customer portal
- [ ] Free-tier query rate limit
- [ ] Vercel deploy + Loom demo

---

## License

MIT.

## Author

[Rafaela Santos](https://github.com/rafaelasantosfeitosa)
