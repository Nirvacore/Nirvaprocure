import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

const BCRYPT_ROUNDS = 10;

export interface UserListRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  department: string | null;
  role: string | null;
}

/**
 * NirvaPeople — directory + role administration.
 *
 * Why this is its own module rather than reused from auth: the auth module
 * deals with credentials and tokens; this module deals with the workforce
 * graph (departments, roles, who reports to whom). Different audience, so
 * different module.
 */
@Injectable()
export class PeopleService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // -----------------------------------------------------------------------
  // Profile (current user)
  // -----------------------------------------------------------------------

  getMe(caller: CurrentUser) {
    return withOrg(this.pool, caller.orgId, async (c) => {
      const r = await c.query(
        `SELECT u.id, u.email, u.full_name, u.is_active,
                u.preferred_locale,
                d.name AS department, r.name AS role,
                o.name AS org_name
         FROM users u
         LEFT JOIN user_roles  ur ON ur.user_id = u.id
         LEFT JOIN roles        r ON r.id = ur.role_id
         LEFT JOIN departments  d ON d.id = ur.department_id
         LEFT JOIN organizations o ON o.id = u.org_id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [caller.userId],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      return r.rows[0];
    });
  }

  // -----------------------------------------------------------------------
  // Users
  // -----------------------------------------------------------------------

  listUsers(user: CurrentUser, search?: string): Promise<UserListRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const params: unknown[] = [];
      let filter = 'u.deleted_at IS NULL';
      if (search?.trim()) {
        params.push(`%${search.trim()}%`);
        filter += ` AND (u.email ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
      }
      const r = await c.query(
        `SELECT u.id, u.email, u.full_name, u.is_active,
                d.name AS department, r.name AS role
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles       r ON r.id = ur.role_id
         LEFT JOIN departments d ON d.id = ur.department_id
         WHERE ${filter}
         ORDER BY u.full_name`,
        params,
      );
      return r.rows;
    });
  }

  async createUser(
    caller: CurrentUser,
    body: { email: string; full_name: string; password: string; department_id?: string; role_id?: string },
  ) {
    return withOrg(this.pool, caller.orgId, async (c) => {
      const exists = await c.query(
        `SELECT id FROM users WHERE org_id = $1 AND email = $2`,
        [caller.orgId, body.email],
      );
      if ((exists.rowCount ?? 0) > 0) throw new ConflictException('Email already in use');

      const hash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
      const inserted = await c.query(
        `INSERT INTO users (org_id, email, full_name, password_hash, is_active)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING id, email, full_name`,
        [caller.orgId, body.email, body.full_name, hash],
      );
      const userId = inserted.rows[0].id as string;

      if (body.role_id || body.department_id) {
        await c.query(
          `INSERT INTO user_roles (user_id, role_id, department_id)
           VALUES ($1, $2, $3)`,
          [userId, body.role_id ?? null, body.department_id ?? null],
        );
      }
      return inserted.rows[0];
    });
  }

  setActive(caller: CurrentUser, userId: string, isActive: boolean) {
    return withOrg(this.pool, caller.orgId, async (c) => {
      const r = await c.query(
        `UPDATE users SET is_active = $2, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, is_active`,
        [userId, isActive],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      return r.rows[0];
    });
  }

  // -----------------------------------------------------------------------
  // Departments
  // -----------------------------------------------------------------------

  listDepartments(user: CurrentUser) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT d.id, d.name, d.cost_center,
                COUNT(DISTINCT ur.user_id) AS members
         FROM departments d
         LEFT JOIN user_roles ur ON ur.department_id = d.id
         WHERE d.deleted_at IS NULL
         GROUP BY d.id
         ORDER BY d.name`,
      );
      return r.rows.map((d) => ({ ...d, members: Number(d.members) }));
    });
  }

  createDepartment(caller: CurrentUser, body: { name: string; cost_center?: string }) {
    return withOrg(this.pool, caller.orgId, async (c) => {
      const r = await c.query(
        `INSERT INTO departments (org_id, name, cost_center) VALUES ($1, $2, $3)
         RETURNING id, name, cost_center`,
        [caller.orgId, body.name, body.cost_center ?? null],
      );
      return r.rows[0];
    });
  }

  // -----------------------------------------------------------------------
  // Roles
  // -----------------------------------------------------------------------

  listRoles(user: CurrentUser) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT id, name, permissions FROM roles ORDER BY name`,
      );
      return r.rows;
    });
  }

  /**
   * Persist the caller's preferred locale. Used by the web app so that
   * server-emitted messages (LINE, email) render in the user's language.
   *
   * RLS handles the org scoping — we still pass orgId through `withOrg` so
   * the UPDATE can't leak across tenants if a stale token shows up.
   */
  setLocale(caller: CurrentUser, locale: string) {
    return withOrg(this.pool, caller.orgId, async (c) => {
      const r = await c.query(
        `UPDATE users SET preferred_locale = $2, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, preferred_locale`,
        [caller.userId, locale],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      return r.rows[0];
    });
  }

  /**
   * Record the caller's cookie consent decision in two places:
   *   1. users.cookie_consent (JSONB) — the current state
   *   2. users.pdpa_consent_at / pdpa_consent_version — bumped if this is
   *      the user's first acceptance of the current privacy notice version
   *
   * The audit_log table captures the history (write-only, append-only) so
   * the DPO can show "version v1 accepted at T1, v2 at T2" without us
   * adding a separate consent-events table.
   */
  setCookieConsent(
    caller: CurrentUser,
    consent: {
      essential: boolean; analytics: boolean; marketing: boolean;
      decided_at: string; version: string;
    },
  ) {
    return withOrg(this.pool, caller.orgId, async (c) => {
      const r = await c.query(
        `UPDATE users
            SET cookie_consent       = $2::jsonb,
                pdpa_consent_at      = COALESCE(pdpa_consent_at, now()),
                pdpa_consent_version = COALESCE(pdpa_consent_version, $3),
                updated_at           = now()
          WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, cookie_consent, pdpa_consent_at, pdpa_consent_version`,
        [caller.userId, JSON.stringify(consent), consent.version],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      // Append to audit_log so the consent timeline survives even if the
      // user later changes their mind (consent_at/version are COALESCE'd
      // above to keep the FIRST acceptance timestamp; the history lives here).
      await c.query(
        `INSERT INTO audit_log (org_id, actor_id, entity_type, entity_id, action, diff)
         VALUES ($1, $2, 'user', $2, 'cookie_consent.set', $3::jsonb)`,
        [caller.orgId, caller.userId, JSON.stringify(consent)],
      );
      return r.rows[0];
    });
  }
}
