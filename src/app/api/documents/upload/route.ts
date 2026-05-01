import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { pool, ensureUser } from '@/db/client';
import { ingestPdf } from '@/rag/ingest';

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
    await pool.query(
      `UPDATE documents SET status = 'failed', error = $1 WHERE id = $2`,
      [String(err?.message || err).slice(0, 500), documentId]
    );
    console.error('Ingest failed:', err);
    return NextResponse.json({ error: 'Ingest failed', detail: String(err?.message || err) }, { status: 500 });
  }
}
