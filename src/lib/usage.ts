import { pool } from '@/db/client';

const FREE_LIMIT = Number(process.env.FREE_TIER_QUERY_LIMIT) || 10;

interface UsageStatus {
  plan: 'free' | 'pro';
  monthlyQueries: number;
  limit: number | null; // null for pro (unlimited)
  remaining: number | null;
  exceeded: boolean;
}

export async function getUserUsage(userId: string): Promise<UsageStatus> {
  const userRes = await pool.query<{ plan: 'free' | 'pro' }>(
    'SELECT plan FROM users WHERE id = $1',
    [userId]
  );
  const plan = userRes.rows[0]?.plan ?? 'free';

  const usageRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM usage_events
      WHERE user_id = $1 AND kind = 'query'
        AND created_at >= date_trunc('month', NOW())`,
    [userId]
  );
  const monthlyQueries = parseInt(usageRes.rows[0]?.count || '0', 10);

  if (plan === 'pro') {
    return { plan, monthlyQueries, limit: null, remaining: null, exceeded: false };
  }
  return {
    plan: 'free',
    monthlyQueries,
    limit: FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - monthlyQueries),
    exceeded: monthlyQueries >= FREE_LIMIT,
  };
}

interface ReserveResult {
  reserved: boolean;
  status: UsageStatus;
}

/**
 * Atomically check the user's free-tier quota and consume one slot if available.
 * Uses a per-user advisory lock so concurrent requests cannot both pass the
 * check and bypass the limit. Pro users are not gated.
 *
 * Returns reserved=true if the caller may proceed (quota slot was consumed),
 * reserved=false if quota was exhausted (no row inserted).
 */
export async function reserveQuery(
  userId: string,
  metadata: Record<string, unknown> = {}
): Promise<ReserveResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Per-user mutex held until COMMIT/ROLLBACK. hashtextextended returns bigint,
    // which pg_advisory_xact_lock accepts as a single 64-bit key.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId]);

    const userRes = await client.query<{ plan: 'free' | 'pro' }>(
      'SELECT plan FROM users WHERE id = $1',
      [userId]
    );
    const plan = userRes.rows[0]?.plan ?? 'free';

    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM usage_events
        WHERE user_id = $1 AND kind = 'query'
          AND created_at >= date_trunc('month', NOW())`,
      [userId]
    );
    const monthlyQueries = parseInt(countRes.rows[0]?.count || '0', 10);

    if (plan === 'free' && monthlyQueries >= FREE_LIMIT) {
      await client.query('ROLLBACK');
      return {
        reserved: false,
        status: {
          plan: 'free',
          monthlyQueries,
          limit: FREE_LIMIT,
          remaining: 0,
          exceeded: true,
        },
      };
    }

    await client.query(
      `INSERT INTO usage_events (user_id, kind, metadata) VALUES ($1, 'query', $2)`,
      [userId, JSON.stringify(metadata)]
    );
    await client.query('COMMIT');

    if (plan === 'pro') {
      return {
        reserved: true,
        status: { plan, monthlyQueries: monthlyQueries + 1, limit: null, remaining: null, exceeded: false },
      };
    }
    return {
      reserved: true,
      status: {
        plan: 'free',
        monthlyQueries: monthlyQueries + 1,
        limit: FREE_LIMIT,
        remaining: Math.max(0, FREE_LIMIT - (monthlyQueries + 1)),
        exceeded: monthlyQueries + 1 >= FREE_LIMIT,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
