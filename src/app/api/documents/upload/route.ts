import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { pool, ensureUser } from '@/db/client';
import { ingestPdf, IngestError } from '@/rag/ingest';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser();
  await ensureUser(userId, user?.emailAddresses[0]?.emailAddress ?? null);

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" form field' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 25 MB limit' }, { status: 413 });
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Magic-byte check: real PDFs start with "%PDF-".
  if (buffer.length < 5 || buffer.slice(0, 5).toString('utf8') !== '%PDF-') {
    return NextResponse.json({ error: 'File is not a valid PDF (missing %PDF- header)' }, { status: 415 });
  }

  const docResult = await pool.query<{ id: string }>(
    `INSERT INTO documents (user_id, filename, file_data, bytes, status)
     VALUES ($1, $2, $3, $4, 'processing') RETURNING id`,
    [userId, file.name, buffer, file.size]
  );
  const documentId = docResult.rows[0].id;

  try {
    const result = await ingestPdf(documentId, userId, buffer);
    return NextResponse.json({ data: { id: documentId, ...result } });
  } catch (err: any) {
    const isIngestErr = err instanceof IngestError;
    const userMessage = isIngestErr
      ? err.message
      : 'Ingest failed unexpectedly. Try again or use a different PDF.';
    await pool.query(
      `UPDATE documents SET status = 'failed', error = $1 WHERE id = $2`,
      [userMessage.slice(0, 500), documentId]
    );
    if (!isIngestErr) console.error('Unexpected ingest failure:', err);
    return NextResponse.json(
      { error: userMessage, code: isIngestErr ? err.code : 'UNKNOWN' },
      { status: isIngestErr ? 422 : 500 }
    );
  }
}
