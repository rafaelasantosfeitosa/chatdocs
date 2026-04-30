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
