import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { pool } from '@/db/client';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await pool.query<{
    id: string;
    title: string;
    created_at: string;
  }>(
    `SELECT id, title, created_at FROM conversations
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
    [userId]
  );
  return NextResponse.json({ data: result.rows });
}
