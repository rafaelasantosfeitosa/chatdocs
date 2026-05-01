import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { pool } from '@/db/client';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const r = await pool.query<{ stripe_customer: string | null }>(
    'SELECT stripe_customer FROM users WHERE id = $1',
    [userId]
  );
  const customerId = r.rows[0]?.stripe_customer;
  if (!customerId) return NextResponse.json({ error: 'No Stripe customer' }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/dashboard`,
  });
  return NextResponse.json({ url: session.url });
}
