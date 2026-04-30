import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { pool, ensureUser } from '@/db/client';

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser();
  await ensureUser(userId, user?.emailAddresses[0]?.emailAddress ?? null);

  const result = await pool.query(
    `SELECT id, filename, status, num_pages, bytes, created_at, ready_at
     FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return NextResponse.json({ data: result.rows });
}
