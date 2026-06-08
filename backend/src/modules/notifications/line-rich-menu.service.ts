import { Injectable, Logger } from '@nestjs/common';

const LINE_API      = 'https://api.line.me/v2/bot';
const LINE_DATA_API = 'https://api-data.line.me/v2/bot';

export interface RichMenuStatus {
  richMenuId: string | null;
}

/**
 * Manages the LINE OA default rich menu — the button bar shown at the bottom
 * of every conversation with the NIRVAPROCURE official account.
 *
 * Layout: 2 rows × 3 columns, each 833 or 834 px wide, full 2500×843 canvas.
 *
 *   [ 📥 รออนุมัติ ] [ 📋 ใบขอของฉัน ] [ ➕ ขอซื้อใหม่ ]
 *   [ 📊 รายงาน    ] [ 🔔 ตั้งค่า LINE ] [ 🏠 หน้าหลัก  ]
 *
 * Actions are URI links to the web app. The image is generated in the
 * browser (HTML Canvas) and uploaded here as a base64 PNG string.
 */
@Injectable()
export class LineRichMenuService {
  private readonly logger = new Logger(LineRichMenuService.name);

  private get token(): string | undefined {
    return process.env.LINE_CHANNEL_ACCESS_TOKEN;
  }

  private authHeader() {
    return { Authorization: `Bearer ${this.token}` };
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  async getStatus(): Promise<RichMenuStatus> {
    if (!this.token) return { richMenuId: null };
    try {
      const res = await fetch(`${LINE_API}/user/all/richmenu`, {
        headers: this.authHeader(),
      });
      if (res.status === 404) return { richMenuId: null };
      if (!res.ok) return { richMenuId: null };
      const data = await res.json() as { richMenuId?: string };
      return { richMenuId: data.richMenuId ?? null };
    } catch {
      return { richMenuId: null };
    }
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  /**
   * Create (or replace) the default rich menu.
   *
   * @param imageBase64  Raw base64 PNG data (no data: prefix)
   * @param appUrl       Public base URL of the web app (e.g. https://nirvaprocure.com)
   */
  async setup(imageBase64: string, appUrl: string): Promise<{ richMenuId: string }> {
    if (!this.token) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
    }

    const structure = buildRichMenuStructure(appUrl);

    // 1. Create the rich menu structure.
    const createRes = await fetch(`${LINE_API}/richmenu`, {
      method: 'POST',
      headers: { ...this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(structure),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`LINE create rich menu: ${createRes.status} ${err.slice(0, 200)}`);
    }
    const { richMenuId } = await createRes.json() as { richMenuId: string };
    this.logger.log(`Rich menu created: ${richMenuId}`);

    // 2. Upload the image.
    const imgBuffer = Buffer.from(imageBase64, 'base64');
    const uploadRes = await fetch(`${LINE_DATA_API}/richmenu/${richMenuId}/content`, {
      method:  'POST',
      headers: { ...this.authHeader(), 'Content-Type': 'image/png' },
      body:    imgBuffer,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`LINE upload image: ${uploadRes.status} ${err.slice(0, 200)}`);
    }
    this.logger.log(`Rich menu image uploaded for ${richMenuId}`);

    // 3. Delete the old default menu if one exists (LINE allows only one default).
    const existing = await this.getStatus();
    if (existing.richMenuId && existing.richMenuId !== richMenuId) {
      await this.deleteMenu(existing.richMenuId);
    }

    // 4. Set this menu as default for ALL users.
    const defaultRes = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
      method:  'POST',
      headers: this.authHeader(),
    });
    if (!defaultRes.ok) {
      const err = await defaultRes.text();
      throw new Error(`LINE set default menu: ${defaultRes.status} ${err.slice(0, 200)}`);
    }
    this.logger.log(`Rich menu set as default: ${richMenuId}`);

    return { richMenuId };
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async deleteDefault(): Promise<void> {
    if (!this.token) return;
    const { richMenuId } = await this.getStatus();
    if (!richMenuId) return;

    // Unlink from all users first.
    await fetch(`${LINE_API}/user/all/richmenu`, {
      method:  'DELETE',
      headers: this.authHeader(),
    });
    await this.deleteMenu(richMenuId);
    this.logger.log(`Rich menu deleted: ${richMenuId}`);
  }

  private async deleteMenu(id: string): Promise<void> {
    await fetch(`${LINE_API}/richmenu/${id}`, {
      method:  'DELETE',
      headers: this.authHeader(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function buildRichMenuStructure(appUrl: string) {
  const base = appUrl.replace(/\/$/, '');
  const W = 2500;
  const H = 843;
  const col = [0, 833, 1667];   // x offsets for 3 columns
  const cw  = [833, 834, 833];  // widths
  const row = [0, 422];          // y offsets for 2 rows
  const rh  = [421, 421];        // heights

  const cell = (r: number, c: number) => ({
    x: col[c], y: row[r], width: cw[c], height: rh[r],
  });

  return {
    size: { width: W, height: H },
    selected: false,
    name: 'NIRVAPROCURE Menu',
    chatBarText: 'เมนู',
    areas: [
      { bounds: cell(0, 0), action: { type: 'uri', uri: `${base}/approvals`, label: 'รออนุมัติ' } },
      { bounds: cell(0, 1), action: { type: 'uri', uri: `${base}/pr`,        label: 'ใบขอของฉัน' } },
      { bounds: cell(0, 2), action: { type: 'uri', uri: `${base}/pr/new`,    label: 'ขอซื้อใหม่' } },
      { bounds: cell(1, 0), action: { type: 'uri', uri: `${base}/analytics`, label: 'รายงาน' } },
      { bounds: cell(1, 1), action: { type: 'uri', uri: `${base}/line`,      label: 'ตั้งค่า LINE' } },
      { bounds: cell(1, 2), action: { type: 'uri', uri: `${base}`,           label: 'หน้าหลัก' } },
    ],
  };
}
