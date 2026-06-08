import { Pool, PoolClient } from 'pg';

/**
 * Runs `fn` inside a transaction with `app.current_org` set so that
 * row-level security policies isolate the caller's organization.
 *
 * Every request handler that touches tenant data must use this.
 */
export async function withOrg<T>(
  pool: Pool,
  orgId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_org = $1`, [orgId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
