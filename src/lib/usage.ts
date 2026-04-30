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

export async function recordQuery(userId: string, metadata: Record<string, unknown> = {}) {
  await pool.query(
    `INSERT INTO usage_events (user_id, kind, metadata) VALUES ($1, 'query', $2)`,
    [userId, JSON.stringify(metadata)]
  );
}
