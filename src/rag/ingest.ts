import pdf from 'pdf-parse';
import { pool } from '@/db/client';
import { chunkText } from './chunker';
import { embedTexts, toPgVector } from './embedder';

interface IngestResult {
  documentId: string;
  numChunks: number;
  numPages: number;
}

/**
 * End-to-end ingest: parse PDF buffer → chunk → embed → persist.
 * Caller is responsible for inserting the documents row first (status=pending)
 * and updating it to ready/failed based on the result.
 */
export async function ingestPdf(
  documentId: string,
  userId: string,
  buffer: Buffer
): Promise<IngestResult> {
  const parsed = await pdf(buffer);
  const numPages = parsed.numpages;

  // pdf-parse gives us the full text concatenated. We approximate per-page by
  // splitting on form-feed (\f), which pdf-parse uses as page separator.
  const pages = parsed.text.split('\f');
  const chunks = chunkText(pages);

  if (!chunks.length) {
    throw new Error('No extractable text found in PDF');
  }

  const embeddings = await embedTexts(chunks.map((c) => c.content));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      await client.query(
        `INSERT INTO chunks (document_id, user_id, page, position, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [documentId, userId, c.page, c.position, c.content, toPgVector(embeddings[i])]
      );
    }
    await client.query(
      `UPDATE documents
         SET status = 'ready', num_pages = $1, ready_at = NOW()
       WHERE id = $2`,
      [numPages, documentId]
    );
    await client.query(
      `INSERT INTO usage_events (user_id, kind, metadata)
       VALUES ($1, 'ingest', $2)`,
      [userId, JSON.stringify({ document_id: documentId, num_chunks: chunks.length })]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { documentId, numChunks: chunks.length, numPages };
}
