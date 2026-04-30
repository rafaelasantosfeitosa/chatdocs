import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { pool, ensureUser } from '@/db/client';
import { stripe, PRICE_PRO } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? null;
  await ensureUser(userId, email);

  if (!PRICE_PRO) {
    return NextResponse.json({ error: 'STRIPE_PRICE_PRO not configured' }, { status: 500 });
  }

  const userRow = await pool.query<{ stripe_customer: string | null }>(
    'SELECT stripe_customer FROM users WHERE id = $1',
    [userId]
  );

  let customerId = userRow.rows[0]?.stripe_customer || undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email || undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await pool.query('UPDATE users SET stripe_customer = $1 WHERE id = $2', [customerId, userId]);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_PRO, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?upgraded=true`,
    cancel_url: `${baseUrl}/dashboard?upgraded=false`,
    metadata: { userId },
  });

  return NextResponse.json({ url: session.url });
}
