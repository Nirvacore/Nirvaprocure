import { Test, TestingModule } from '@nestjs/testing';
import { LineRichMenuService } from './line-rich-menu.service';

// Track all fetch calls for assertions
let fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
let fetchResponses: Array<{ ok: boolean; status: number; body: any }> = [];
let fetchCallIdx = 0;

// Replace global fetch with a mock
const originalFetch = global.fetch;
beforeEach(() => {
  fetchCalls = [];
  fetchResponses = [];
  fetchCallIdx = 0;
  global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    const resp = fetchResponses[fetchCallIdx] ?? { ok: true, status: 200, body: {} };
    fetchCallIdx++;
    return Promise.resolve({
      ok: resp.ok,
      status: resp.status,
      json: () => Promise.resolve(resp.body),
      text: () => Promise.resolve(typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body)),
    });
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
});

describe('LineRichMenuService', () => {
  let service: LineRichMenuService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LineRichMenuService],
    }).compile();
    service = module.get(LineRichMenuService);
  });

  // ── getStatus ─────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return null richMenuId when no LINE token configured', async () => {
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
      const result = await service.getStatus();
      expect(result).toEqual({ richMenuId: null });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return richMenuId from LINE API when configured', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push({ ok: true, status: 200, body: { richMenuId: 'rm-123' } });

      const result = await service.getStatus();
      expect(result).toEqual({ richMenuId: 'rm-123' });
      expect(fetchCalls[0].url).toBe('https://api.line.me/v2/bot/user/all/richmenu');
      expect(fetchCalls[0].init?.headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer test-token' }),
      );
    });

    it('should return null richMenuId on 404', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push({ ok: false, status: 404, body: {} });

      const result = await service.getStatus();
      expect(result).toEqual({ richMenuId: null });
    });

    it('should return null richMenuId on non-ok response', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push({ ok: false, status: 500, body: 'Server Error' });

      const result = await service.getStatus();
      expect(result).toEqual({ richMenuId: null });
    });

    it('should return null richMenuId when API response has no richMenuId', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push({ ok: true, status: 200, body: {} });

      const result = await service.getStatus();
      expect(result).toEqual({ richMenuId: null });
    });

    it('should return null richMenuId on fetch exception', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getStatus();
      expect(result).toEqual({ richMenuId: null });
    });
  });

  // ── setup ─────────────────────────────────────────────────────────────────

  describe('setup', () => {
    const imageBase64 = Buffer.from('fake-png-data').toString('base64');
    const appUrl = 'https://nirvaprocure.com';

    it('should throw when LINE token is not configured', async () => {
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
      await expect(service.setup(imageBase64, appUrl)).rejects.toThrow(
        'LINE_CHANNEL_ACCESS_TOKEN not configured',
      );
    });

    it('should create menu, upload image, and set as default', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        // 1. Create rich menu
        { ok: true, status: 200, body: { richMenuId: 'rm-new' } },
        // 2. Upload image
        { ok: true, status: 200, body: {} },
        // 3. getStatus (check existing default)
        { ok: false, status: 404, body: {} },
        // 4. Set as default
        { ok: true, status: 200, body: {} },
      );

      const result = await service.setup(imageBase64, appUrl);
      expect(result).toEqual({ richMenuId: 'rm-new' });

      // Verify create call
      expect(fetchCalls[0].url).toBe('https://api.line.me/v2/bot/richmenu');
      expect(fetchCalls[0].init?.method).toBe('POST');
      const createBody = JSON.parse(fetchCalls[0].init?.body as string);
      expect(createBody.name).toBe('NIRVAPROCURE Menu');
      expect(createBody.size).toEqual({ width: 2500, height: 843 });
      expect(createBody.areas).toHaveLength(6);

      // Verify image upload
      expect(fetchCalls[1].url).toBe('https://api-data.line.me/v2/bot/richmenu/rm-new/content');
      expect(fetchCalls[1].init?.method).toBe('POST');
      expect((fetchCalls[1].init?.headers as Record<string, string>)['Content-Type']).toBe('image/png');

      // Verify set default
      expect(fetchCalls[3].url).toBe('https://api.line.me/v2/bot/user/all/richmenu/rm-new');
      expect(fetchCalls[3].init?.method).toBe('POST');
    });

    it('should delete existing default menu before setting new one', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        // 1. Create rich menu
        { ok: true, status: 200, body: { richMenuId: 'rm-new' } },
        // 2. Upload image
        { ok: true, status: 200, body: {} },
        // 3. getStatus → existing menu
        { ok: true, status: 200, body: { richMenuId: 'rm-old' } },
        // 4. deleteMenu(rm-old)
        { ok: true, status: 200, body: {} },
        // 5. Set new as default
        { ok: true, status: 200, body: {} },
      );

      const result = await service.setup(imageBase64, appUrl);
      expect(result).toEqual({ richMenuId: 'rm-new' });

      // Verify old menu was deleted
      expect(fetchCalls[3].url).toBe('https://api.line.me/v2/bot/richmenu/rm-old');
      expect(fetchCalls[3].init?.method).toBe('DELETE');
    });

    it('should not delete existing menu if it is the same as the new one', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        // 1. Create rich menu
        { ok: true, status: 200, body: { richMenuId: 'rm-same' } },
        // 2. Upload image
        { ok: true, status: 200, body: {} },
        // 3. getStatus → same menu ID
        { ok: true, status: 200, body: { richMenuId: 'rm-same' } },
        // 4. Set as default (no delete needed)
        { ok: true, status: 200, body: {} },
      );

      await service.setup(imageBase64, appUrl);
      // Should be 4 calls (create, upload, getStatus, set default) — no delete
      expect(fetchCalls).toHaveLength(4);
    });

    it('should throw when create menu API fails', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        { ok: false, status: 400, body: 'Bad Request' },
      );

      await expect(service.setup(imageBase64, appUrl)).rejects.toThrow(
        /LINE create rich menu: 400/,
      );
    });

    it('should throw when image upload API fails', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        { ok: true, status: 200, body: { richMenuId: 'rm-1' } },
        { ok: false, status: 413, body: 'Entity Too Large' },
      );

      await expect(service.setup(imageBase64, appUrl)).rejects.toThrow(
        /LINE upload image: 413/,
      );
    });

    it('should throw when set default API fails', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        { ok: true, status: 200, body: { richMenuId: 'rm-1' } },
        { ok: true, status: 200, body: {} },
        { ok: false, status: 404, body: {} }, // getStatus → no existing
        { ok: false, status: 500, body: 'Internal Error' },
      );

      await expect(service.setup(imageBase64, appUrl)).rejects.toThrow(
        /LINE set default menu: 500/,
      );
    });

    it('should strip trailing slash from appUrl in menu action URIs', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        { ok: true, status: 200, body: { richMenuId: 'rm-1' } },
        { ok: true, status: 200, body: {} },
        { ok: false, status: 404, body: {} },
        { ok: true, status: 200, body: {} },
      );

      await service.setup(imageBase64, 'https://nirvaprocure.com/');

      const createBody = JSON.parse(fetchCalls[0].init?.body as string);
      // First area action should use the base URL without trailing slash
      expect(createBody.areas[0].action.uri).toBe('https://nirvaprocure.com/approvals');
      // Last area (homepage) should be clean base URL
      expect(createBody.areas[5].action.uri).toBe('https://nirvaprocure.com');
    });

    it('should set correct menu areas with proper URIs and labels', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        { ok: true, status: 200, body: { richMenuId: 'rm-1' } },
        { ok: true, status: 200, body: {} },
        { ok: false, status: 404, body: {} },
        { ok: true, status: 200, body: {} },
      );

      await service.setup(imageBase64, 'https://app.test');

      const createBody = JSON.parse(fetchCalls[0].init?.body as string);
      const areas = createBody.areas;

      expect(areas[0].action).toEqual({ type: 'uri', uri: 'https://app.test/approvals', label: 'รออนุมัติ' });
      expect(areas[1].action).toEqual({ type: 'uri', uri: 'https://app.test/pr', label: 'ใบขอของฉัน' });
      expect(areas[2].action).toEqual({ type: 'uri', uri: 'https://app.test/pr/new', label: 'ขอซื้อใหม่' });
      expect(areas[3].action).toEqual({ type: 'uri', uri: 'https://app.test/analytics', label: 'รายงาน' });
      expect(areas[4].action).toEqual({ type: 'uri', uri: 'https://app.test/line', label: 'ตั้งค่า LINE' });
      expect(areas[5].action).toEqual({ type: 'uri', uri: 'https://app.test', label: 'หน้าหลัก' });
    });
  });

  // ── deleteDefault ─────────────────────────────────────────────────────────

  describe('deleteDefault', () => {
    it('should do nothing when no LINE token configured', async () => {
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
      await service.deleteDefault();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should do nothing when no default menu exists', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        // getStatus → no menu
        { ok: false, status: 404, body: {} },
      );

      await service.deleteDefault();
      expect(fetchCalls).toHaveLength(1); // only the getStatus call
    });

    it('should unlink from all users then delete the menu', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
      fetchResponses.push(
        // getStatus → existing menu
        { ok: true, status: 200, body: { richMenuId: 'rm-123' } },
        // Unlink from all users
        { ok: true, status: 200, body: {} },
        // Delete menu
        { ok: true, status: 200, body: {} },
      );

      await service.deleteDefault();

      // Verify unlink call
      expect(fetchCalls[1].url).toBe('https://api.line.me/v2/bot/user/all/richmenu');
      expect(fetchCalls[1].init?.method).toBe('DELETE');

      // Verify delete menu call
      expect(fetchCalls[2].url).toBe('https://api.line.me/v2/bot/richmenu/rm-123');
      expect(fetchCalls[2].init?.method).toBe('DELETE');
    });

    it('should include authorization header in all requests', async () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = 'my-secret-token';
      fetchResponses.push(
        { ok: true, status: 200, body: { richMenuId: 'rm-1' } },
        { ok: true, status: 200, body: {} },
        { ok: true, status: 200, body: {} },
      );

      await service.deleteDefault();

      for (const call of fetchCalls) {
        expect((call.init?.headers as Record<string, string>)?.Authorization).toBe(
          'Bearer my-secret-token',
        );
      }
    });
  });
});
