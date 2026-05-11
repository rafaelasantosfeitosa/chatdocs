import { pool } from '@/db/client';
import { embedQuery, toPgVector } from './embedder';

export interface RetrievedChunk {
  id: string;
  document_id: string;
  filename: string;
  page: number | null;
  content: string;
  similarity: number; // 0..1, higher = more similar
}

/**
 * Builds a human-friendly snippet from a chunk: normalize whitespace and
 * truncate on a sentence boundary when possible (falls back to last space).
 * Avoids the mid-word/mid-sentence cuts that a naive `.slice(0, N)` produces.
 */
export function cleanSnippet(text: string, maxLen = 240): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Find a clean start: skip any leading fragment that begins mid-sentence
  // (chunker may slice at overlap boundary). If the first 80 chars contain a
  // sentence terminator, start from the next sentence.
  let start = 0;
  const head = normalized.slice(0, 80);
  const headBoundary = head.search(/[.!?]\s+[A-ZÀ-Ý0-9]/);
  if (headBoundary !== -1) {
    const lead = normalized[0];
    const startsClean = lead && /[A-ZÀ-Ý0-9"'¿¡]/.test(lead);
    if (!startsClean) start = headBoundary + 2;
  }

  const body = normalized.slice(start);
  if (body.length <= maxLen) return body;

  const window = body.slice(0, maxLen);
  const sentenceMatch = window.match(/^[\s\S]*[.!?](?=\s|$)/);
  if (sentenceMatch && sentenceMatch[0].length >= maxLen * 0.6) {
    return sentenceMatch[0].trim();
  }

  const lastSpace = window.lastIndexOf(' ');
  if (lastSpace >= maxLen * 0.5) return window.slice(0, lastSpace).trim() + '…';
  return window.trim() + '…';
}

/**
 * Retrieves top-K most similar chunks scoped to a single user.
 * Uses pgvector cosine distance (`<=>`); similarity = 1 - distance.
 */
export async function retrieveChunks(
  userId: string,
  query: string,
  k = 6
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  const result = await pool.query(
    `SELECT
       c.id,
       c.document_id,
       d.filename,
       c.page,
       c.content,
       1 - (c.embedding <=> $1::vector) AS similarity
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.user_id = $2
     ORDER BY c.embedding <=> $1::vector ASC
     LIMIT $3`,
    [toPgVector(queryEmbedding), userId, k]
  );
  return result.rows;
}
