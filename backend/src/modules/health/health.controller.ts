import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';

/**
 * /health — public liveness + readiness probe used by Docker.
 *
 * Always returns 200 if the process is alive; the `db` field tells you whether
 * Postgres is reachable so the orchestrator can wait before declaring "ready".
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async check() {
    let db: 'ok' | 'down' = 'ok';
    try {
      await this.pool.query('SELECT 1');
    } catch {
      db = 'down';
    }
    return { status: 'ok', db, ts: new Date().toISOString() };
  }
}
