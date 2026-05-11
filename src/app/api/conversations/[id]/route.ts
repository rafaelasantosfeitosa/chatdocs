import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { pool } from '@/db/client';

export const runtime = 'nodejs';

const uuidSchema = z.string().uuid();

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!uuidSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
  }

  // Cascade in schema removes messages automatically.
  const result = await pool.query(
    `DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
    [params.id, userId]
  );
  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
