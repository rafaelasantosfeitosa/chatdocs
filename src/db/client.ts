import { Pool } from 'pg';

const url = process.env.DATABASE_URL || '';
const needsSsl = process.env.NODE_ENV === 'production' || /sslmode=require/.test(url);

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== 'production') global.__pgPool = pool;

export async function ensureUser(userId: string, email: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO users (id, email)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
    [userId, email]
  );
}
