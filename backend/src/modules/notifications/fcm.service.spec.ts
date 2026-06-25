import { Test, TestingModule } from '@nestjs/testing';
import { PG_POOL } from '../../common/db/db.module';

// Mock firebase-admin before importing the service.
// firebase-admin v14 no longer exports admin.apps / admin.credential / admin.messaging
// at the type level, but the service uses the legacy namespace pattern which still
// works at runtime via the CommonJS default export. TS2339 is suppressed in jest config.
const mockSend = jest.fn().mockResolvedValue('message-id-123');
const mockApps: any[] = [];
jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: {
    apps: mockApps,
    initializeApp: jest.fn(),
    credential: { cert: jest.fn().mockReturnValue('mock-credential') },
    messaging: jest.fn().mockReturnValue({ send: mockSend }),
  },
  apps: mockApps,
  initializeApp: jest.fn(),
  credential: { cert: jest.fn().mockReturnValue('mock-credential') },
  messaging: jest.fn().mockReturnValue({ send: mockSend }),
}));

import { FcmService } from './fcm.service';
const admin = require('firebase-admin');

function mockPool(queryResponses: any[]) {
  let callIdx = 0;
  const mockQuery = jest.fn().mockImplementation(() => {
    const resp = queryResponses[callIdx] ?? { rows: [], rowCount: 0 };
    callIdx++;
    return Promise.resolve(resp);
  });
  return { query: mockQuery };
}

describe('FcmService', () => {
  let service: FcmService;
  let pool: ReturnType<typeof mockPool>;

  afterEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    jest.clearAllMocks();
    // Reset apps array for next test
    admin.apps.length = 0;
  });

  // ── onModuleInit ────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should not initialize Firebase when FIREBASE_SERVICE_ACCOUNT is not set', async () => {
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      pool = mockPool([]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);

      service.onModuleInit();

      expect(admin.initializeApp).not.toHaveBeenCalled();
    });

    it('should initialize Firebase when FIREBASE_SERVICE_ACCOUNT is set', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
      pool = mockPool([]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);

      service.onModuleInit();

      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: 'mock-credential',
      });
    });

    it('should skip initializeApp when an app already exists', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
      admin.apps.push('existing-app'); // simulate an existing app
      pool = mockPool([]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);

      service.onModuleInit();

      expect(admin.initializeApp).not.toHaveBeenCalled();
    });

    it('should handle Firebase init errors gracefully (fallback to stub mode)', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = 'INVALID JSON!!!';
      pool = mockPool([]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);

      // Should not throw even though JSON.parse will fail
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });

  // ── registerToken ─────────────────────────────────────────────────────────

  describe('registerToken', () => {
    it('should upsert token into fcm_tokens table', async () => {
      pool = mockPool([{ rows: [], rowCount: 1 }]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);

      await service.registerToken('user-1', 'token-abc', 'android');

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fcm_tokens'),
        ['user-1', 'token-abc', 'android'],
      );
    });
  });

  // ── removeToken ───────────────────────────────────────────────────────────

  describe('removeToken', () => {
    it('should delete token from fcm_tokens table', async () => {
      pool = mockPool([{ rows: [], rowCount: 1 }]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);

      await service.removeToken('token-abc');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM fcm_tokens'),
        ['token-abc'],
      );
    });
  });

  // ── sendToUser ────────────────────────────────────────────────────────────

  describe('sendToUser', () => {
    const notification = { title: 'Test', body: 'Hello world' };

    it('should return 0 when user has no tokens', async () => {
      pool = mockPool([{ rows: [], rowCount: 0 }]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);

      const sent = await service.sendToUser('user-no-tokens', notification);
      expect(sent).toBe(0);
    });

    it('should send to all tokens and return count (stub mode)', async () => {
      pool = mockPool([
        { rows: [{ token: 'tok-1' }, { token: 'tok-2' }], rowCount: 2 },
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);
      // Not calling onModuleInit, so fbInitialized = false (stub mode)

      const sent = await service.sendToUser('user-1', notification);
      expect(sent).toBe(2);
    });

    it('should send via Firebase when initialized', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
      pool = mockPool([
        { rows: [{ token: 'tok-1' }], rowCount: 1 },
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);
      service.onModuleInit();


      mockSend.mockResolvedValue('ok');

      const sent = await service.sendToUser('user-1', notification);
      expect(sent).toBe(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'tok-1',
          notification: { title: 'Test', body: 'Hello world' },
          android: { priority: 'high' },
        }),
      );
    });

    it('should pass data payload to Firebase when provided', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
      pool = mockPool([
        { rows: [{ token: 'tok-1' }], rowCount: 1 },
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);
      service.onModuleInit();


      mockSend.mockResolvedValue('ok');

      const data = { prId: 'pr-123', action: 'approve' };
      await service.sendToUser('user-1', { title: 'PR', body: 'Approve?', data });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ data }),
      );
    });

    it('should remove expired tokens and not count them as sent', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
      pool = mockPool([
        // SELECT tokens
        { rows: [{ token: 'expired-tok' }, { token: 'good-tok' }], rowCount: 2 },
        // DELETE expired token
        { rows: [], rowCount: 1 },
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);
      service.onModuleInit();


      // First token fails with expired error, second succeeds
      mockSend
        .mockRejectedValueOnce({ code: 'messaging/registration-token-not-registered' })
        .mockResolvedValueOnce('ok');

      const sent = await service.sendToUser('user-1', notification);
      expect(sent).toBe(1);
      // The expired token should be removed via removeToken -> pool.query(DELETE)
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM fcm_tokens'),
        ['expired-tok'],
      );
    });

    it('should remove invalid tokens as well', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
      pool = mockPool([
        { rows: [{ token: 'invalid-tok' }], rowCount: 1 },
        { rows: [], rowCount: 1 },
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);
      service.onModuleInit();


      mockSend.mockRejectedValueOnce({ code: 'messaging/invalid-registration-token' });

      const sent = await service.sendToUser('user-1', notification);
      expect(sent).toBe(0);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM fcm_tokens'),
        ['invalid-tok'],
      );
    });

    it('should log but not remove tokens on other errors', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
      pool = mockPool([
        { rows: [{ token: 'tok-1' }], rowCount: 1 },
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [FcmService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(FcmService);
      service.onModuleInit();


      mockSend.mockRejectedValueOnce({ code: 'messaging/internal-error', message: 'Server error' });

      const sent = await service.sendToUser('user-1', notification);
      expect(sent).toBe(0);
      // Only the initial SELECT query, no DELETE
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });
});
