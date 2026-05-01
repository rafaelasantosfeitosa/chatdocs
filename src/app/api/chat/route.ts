import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { pool, ensureUser } from '@/db/client';
import { retrieveChunks } from '@/rag/retriever';
import { buildMessages, streamCompletion } from '@/rag/llm';
import { getUserUsage, recordQuery } from '@/lib/usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  conversation_id: z.string().uuid().nullish(),
  message: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser();
  await ensureUser(userId, user?.emailAddresses[0]?.emailAddress ?? null);

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const usage = await getUserUsage(userId);
  if (usage.exceeded) {
    return NextResponse.json(
      { error: 'Free-tier query limit reached. Upgrade to Pro for unlimited queries.', usage },
      { status: 402 }
    );
  }

  // Get-or-create conversation.
  let conversationId = parsed.data.conversation_id;
  if (!conversationId) {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id`,
      [userId, parsed.data.message.slice(0, 60)]
    );
    conversationId = r.rows[0].id;
  } else {
    // Verify ownership.
    const owns = await pool.query(
      'SELECT 1 FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (!owns.rows[0]) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Persist user message.
  await pool.query(
    `INSERT INTO messages (conversation_id, user_id, role, content) VALUES ($1, $2, 'user', $3)`,
    [conversationId, userId, parsed.data.message]
  );

  // Retrieve top-K chunks for this user.
  const chunks = await retrieveChunks(userId, parsed.data.message, 6);

  // Load short history (last 8 messages, excluding the one we just inserted).
  const histRes = await pool.query<{ role: 'user' | 'assistant'; content: string }>(
    `SELECT role, content FROM messages
       WHERE conversation_id = $1 AND role IN ('user','assistant')
       ORDER BY created_at DESC
       LIMIT 9 OFFSET 1`,
    [conversationId]
  );
  const history = histRes.rows.reverse();

  const prepared = buildMessages({ question: parsed.data.message, chunks, history });
  const stream = streamCompletion(prepared);

  // Stream tokens to client. After the stream ends, persist assistant message + citations.
  let fullText = '';
  const encoder = new TextEncoder();

  const responseStream = new ReadableStream({
    async start(controller) {
      // First event: send chunks metadata so the client can resolve citations.
      const meta = chunks.map((c, i) => ({
        ref: i + 1,
        chunk_id: c.id,
        document_id: c.document_id,
        filename: c.filename,
        page: c.page,
        snippet: c.content.slice(0, 200),
      }));
      controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversation_id: conversationId, chunks: meta })}\n\n`));

      try {
        for await (const delta of stream) {
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ delta })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (err: any) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(err?.message || err) })}\n\n`));
      } finally {
        // Persist assistant message + citations + usage event (best-effort).
        const citations = chunks.map((c, i) => ({
          ref: i + 1,
          chunk_id: c.id,
          document_id: c.document_id,
          page: c.page,
          filename: c.filename,
          snippet: c.content.slice(0, 200),
        }));
        try {
          await pool.query(
            `INSERT INTO messages (conversation_id, user_id, role, content, citations)
             VALUES ($1, $2, 'assistant', $3, $4)`,
            [conversationId, userId, fullText, JSON.stringify(citations)]
          );
          await recordQuery(userId, { conversation_id: conversationId });
        } catch (e) {
          console.error('Persist after stream failed:', e);
        }
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
