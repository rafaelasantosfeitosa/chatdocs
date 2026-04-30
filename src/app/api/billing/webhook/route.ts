import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { pool } from '@/db/client';
import type Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature/secret' }, { status: 400 });
  }
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  // Resolve userId from customer metadata for any subscription event.
  async function resolveUserId(customerId: string): Promise<string | null> {
    const row = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE stripe_customer = $1',
      [customerId]
    );
    if (row.rows[0]) return row.rows[0].id;
    // Fallback: check Stripe customer metadata.
    const cust = await stripe.customers.retrieve(customerId);
    if (cust && !cust.deleted && (cust as Stripe.Customer).metadata?.userId) {
      return (cust as Stripe.Customer).metadata.userId;
    }
    return null;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const obj = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
        const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
        if (!customerId) break;
        const userId = await resolveUserId(customerId);
        if (!userId) break;

        // Determine plan from subscription status.
        let active = false;
        if ('status' in obj) {
          active = ['active', 'trialing'].includes(obj.status as string);
        } else {
          // checkout.session.completed — assume active.
          active = true;
        }
        await pool.query(
          'UPDATE users SET plan = $1, stripe_customer = $2, updated_at = NOW() WHERE id = $3',
          [active ? 'pro' : 'free', customerId, userId]
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const userId = await resolveUserId(customerId);
        if (userId) {
          await pool.query(
            'UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2',
            ['free', userId]
          );
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handling error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
