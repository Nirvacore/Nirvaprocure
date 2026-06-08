import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PG_POOL } from '../../common/db/db.module';
import { PeopleService } from './people.service';

/* ---------- tiny helpers ------------------------------------------------- */

/**
 * withOrg issues: BEGIN → SET LOCAL → fn(client) → COMMIT (or ROLLBACK).
 * We set up the mock so BEGIN and SET LOCAL always succeed, then the
 * actual query uses the provided response, then COMMIT succeeds.
 */
const OK = { rows: [], rowCount: 0 };

const makePool = (queryFn: jest.Mock) => ({
  connect: jest.fn().mockResolvedValue({
    query: queryFn,
    release: jest.fn(),
  }),
});

/** Enqueue: BEGIN ok, SET LOCAL ok, then the caller's rows, then COMMIT ok. */
function enqueue(query: jest.Mock, response: { rows: unknown[]; rowCount: number }) {
  query.mockResolvedValueOnce(OK);       // BEGIN
  query.mockResolvedValueOnce(OK);       // SET LOCAL
  query.mockResolvedValueOnce(response); // actual query
  query.mockResolvedValueOnce(OK);       // COMMIT
}

/** Enqueue for a path that throws (ROLLBACK instead of COMMIT). */
function enqueueEmpty(query: jest.Mock) {
  query.mockResolvedValueOnce(OK); // BEGIN
  query.mockResolvedValueOnce(OK); // SET LOCAL
  query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // actual → triggers error
  query.mockResolvedValueOnce(OK); // ROLLBACK
}

const fakeUser = {
  userId: '11111111-1111-1111-1111-111111111111',
  orgId:  '22222222-2222-2222-2222-222222222222',
  email:  'alice@test.com',
  role:   'admin',
};

/* ---------- suite -------------------------------------------------------- */
describe('PeopleService', () => {
  let service: PeopleService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        PeopleService,
        { provide: PG_POOL, useValue: makePool(query) },
      ],
    }).compile();
    service = mod.get(PeopleService);
  });

  // ── getMe ───────────────────────────────────────────────
  describe('getMe', () => {
    it('returns the current user profile', async () => {
      const row = {
        id: fakeUser.userId,
        email: 'alice@test.com',
        full_name: 'Alice Admin',
        is_active: true,
        preferred_locale: 'th',
        department: 'IT',
        role: 'admin',
        org_name: 'Acme Corp',
      };
      enqueue(query, { rows: [row], rowCount: 1 });

      const result = await service.getMe(fakeUser);
      expect(result).toEqual(row);
      expect(result.full_name).toBe('Alice Admin');
      expect(result.org_name).toBe('Acme Corp');
    });

    it('throws NotFoundException when user not found', async () => {
      enqueueEmpty(query);
      await expect(service.getMe(fakeUser)).rejects.toThrow(NotFoundException);
    });
  });

  // ── listUsers ───────────────────────────────────────────
  describe('listUsers', () => {
    it('returns all active users', async () => {
      const rows = [
        { id: '1', email: 'a@t.com', full_name: 'Alice', is_active: true, department: null, role: null },
        { id: '2', email: 'b@t.com', full_name: 'Bob',   is_active: true, department: 'IT', role: 'user' },
      ];
      enqueue(query, { rows, rowCount: 2 });

      const result = await service.listUsers(fakeUser);
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('a@t.com');
    });

    it('applies search filter when provided', async () => {
      enqueue(query, { rows: [], rowCount: 0 });

      await service.listUsers(fakeUser, 'alice');
      // The SELECT is the 3rd query call (index 2)
      const selectCall = query.mock.calls[2];
      expect(selectCall[0]).toContain('ILIKE');
      expect(selectCall[1]).toContain('%alice%');
    });
  });

  // ── listDepartments ─────────────────────────────────────
  describe('listDepartments', () => {
    it('returns departments with numeric member count', async () => {
      const rows = [
        { id: 'd1', name: 'Engineering', cost_center: 'CC01', members: '3' },
      ];
      enqueue(query, { rows, rowCount: 1 });

      const result = await service.listDepartments(fakeUser);
      expect(result).toHaveLength(1);
      expect(result[0].members).toBe(3); // coerced to number
    });
  });

  // ── setLocale ───────────────────────────────────────────
  describe('setLocale', () => {
    it('updates preferred_locale', async () => {
      const row = { id: fakeUser.userId, preferred_locale: 'en' };
      enqueue(query, { rows: [row], rowCount: 1 });

      const result = await service.setLocale(fakeUser, 'en');
      expect(result.preferred_locale).toBe('en');
    });

    it('throws NotFoundException for deleted user', async () => {
      enqueueEmpty(query);
      await expect(service.setLocale(fakeUser, 'en')).rejects.toThrow(NotFoundException);
    });
  });

  // ── setActive ───────────────────────────────────────────
  describe('setActive', () => {
    it('deactivates a user', async () => {
      const row = { id: '3', is_active: false };
      enqueue(query, { rows: [row], rowCount: 1 });

      const result = await service.setActive(fakeUser, '3', false);
      expect(result.is_active).toBe(false);
    });

    it('throws NotFoundException for unknown user', async () => {
      enqueueEmpty(query);
      await expect(service.setActive(fakeUser, 'nope', true)).rejects.toThrow(NotFoundException);
    });
  });
});
