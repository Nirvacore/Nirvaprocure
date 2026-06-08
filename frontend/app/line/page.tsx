'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Bell, Check, CheckCircle2, ChevronLeft, Copy,
  ExternalLink, Grid3x3, Link2, Link2Off, Loader2, Menu, Phone,
  RefreshCw, Send, Unlink, X,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';

// ─── API helpers ─────────────────────────────────────────────────────────────

// Rich menu API
async function fetchRichMenuStatus(): Promise<string | null> {
  const res = await fetch('/api/notifications/line/rich-menu/status', { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json() as { richMenuId: string | null };
  return data.richMenuId;
}

async function setupRichMenu(imageBase64: string, appUrl: string): Promise<string> {
  const res = await fetch('/api/notifications/line/rich-menu/setup', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, appUrl }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json() as { richMenuId: string };
  return data.richMenuId;
}

async function deleteRichMenu(): Promise<void> {
  const res = await fetch('/api/notifications/line/rich-menu', {
    method: 'DELETE', credentials: 'include',
  });
  if (!res.ok && res.status !== 204) throw new Error(`${res.status}`);
}

// Binding API
async function fetchStatus(): Promise<boolean> {
  const res = await fetch('/api/notifications/line/status', { credentials: 'include' });
  if (!res.ok) return false;
  const data = await res.json() as { linked: boolean };
  return data.linked;
}

async function requestCode(): Promise<{ code: string; expires_at: string }> {
  const res = await fetch('/api/notifications/line/bind', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<{ code: string; expires_at: string }>;
}

async function unlinkLine(): Promise<void> {
  const res = await fetch('/api/notifications/line/bind', {
    method: 'DELETE', credentials: 'include',
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LinePage() {
  const { toast }     = useToast();
  const { t, locale } = useT();

  // Rich menu state
  const [richMenuId,  setRichMenuId]  = useState<string | null | undefined>(undefined); // undefined = not fetched yet
  const [rmBusy,      setRmBusy]      = useState(false);
  const rmCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchRichMenuStatus().then(setRichMenuId).catch(() => setRichMenuId(null));
  }, []);

  const handleSetupRichMenu = useCallback(async () => {
    const canvas = rmCanvasRef.current;
    if (!canvas) return;
    setRmBusy(true);
    try {
      // Render the rich menu image on the canvas, export as PNG base64.
      drawRichMenu(canvas, t);
      const dataUrl = canvas.toDataURL('image/png');
      const base64  = dataUrl.replace(/^data:image\/png;base64,/, '');
      const appUrl  = window.location.origin;
      const id = await setupRichMenu(base64, appUrl);
      setRichMenuId(id);
      toast(t('line.richmenu.toast.ok'), 'ok');
    } catch {
      toast(t('line.richmenu.toast.err'), 'err');
    } finally {
      setRmBusy(false);
    }
  }, [t, toast]);

  const handleDeleteRichMenu = useCallback(async () => {
    if (!confirm(t('line.richmenu.remove') + '?')) return;
    setRmBusy(true);
    try {
      await deleteRichMenu();
      setRichMenuId(null);
      toast(t('line.richmenu.toast.del'), 'ok');
    } catch {
      toast(t('line.richmenu.toast.err'), 'err');
    } finally {
      setRmBusy(false);
    }
  }, [t, toast]);

  // Binding state
  const [linked,    setLinked]   = useState<boolean | null>(null); // null = loading
  const [code,      setCode]     = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [minsLeft,  setMinsLeft] = useState<number>(10);
  const [copied,    setCopied]   = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [unlinking,   setUnlinking]   = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load linked status on mount
  useEffect(() => {
    fetchStatus().then(setLinked).catch(() => setLinked(false));
  }, []);

  // Countdown timer while a code is in flight
  useEffect(() => {
    if (!expiresAt) { timerRef.current && clearInterval(timerRef.current); return; }
    const tick = () => {
      const mins = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60_000));
      setMinsLeft(mins);
      if (mins === 0) { setCode(null); setExpiresAt(null); }
    };
    tick();
    timerRef.current = setInterval(tick, 15_000);
    return () => { timerRef.current && clearInterval(timerRef.current); };
  }, [expiresAt]);

  const handleGetCode = useCallback(async () => {
    setCodeLoading(true);
    try {
      const data = await requestCode();
      setCode(data.code);
      setExpiresAt(new Date(data.expires_at));
    } catch { /* ignore */ }
    finally { setCodeLoading(false); }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleRefresh = useCallback(async () => {
    setLinked(null);
    const linked = await fetchStatus();
    setLinked(linked);
    if (linked) { setCode(null); setExpiresAt(null); }
  }, []);

  const handleUnlink = useCallback(async () => {
    if (!confirmUnlink) { setConfirmUnlink(true); return; }
    setUnlinking(true);
    try {
      await unlinkLine();
      setLinked(false);
      setCode(null);
      setExpiresAt(null);
      setConfirmUnlink(false);
      toast(t('line.bind.toast.unlinked'), 'ok');
    } catch { /* ignore */ }
    finally { setUnlinking(false); }
  }, [confirmUnlink, t, toast]);

  function testLine() {
    toast(t('line.toast.sending'), 'ok');
    fetch('/api/notifications/line/test', { method: 'POST', credentials: 'include' })
      .then(() => toast(t('line.toast.sent'), 'ok'))
      .catch(() => {});
  }

  return (
    <section className="screen space-y-6 max-w-3xl mx-auto">
      <Link href="/" className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center text-xl font-black">L</span>
          {t('line.heading')}
        </h1>
        <p className="text-base text-gray-600">{t('line.sub')}</p>
      </div>

      {/* ── Binding card ──────────────────────────────────────────────────── */}
      <div className="card space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-gray-400" />
            {t('line.bind.title')}
          </h2>

          {/* Status pill */}
          {linked === null ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : linked ? (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              {t('line.bind.linked')}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              <Unlink className="w-4 h-4" />
              {t('line.bind.unlinked')}
            </span>
          )}
        </div>

        {/* ── Linked state ── */}
        {linked === true && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{t('line.bind.linked')}</p>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                className="btn-sm flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
              >
                <RefreshCw className="w-4 h-4" />
                {t('line.bind.refresh')}
              </button>
              {confirmUnlink ? (
                <>
                  <span className="text-sm text-red-600 self-center">
                    {t('line.bind.unlink.confirm')}
                  </span>
                  <button
                    onClick={handleUnlink}
                    disabled={unlinking}
                    className="btn-sm text-red-600 border border-red-200 rounded-lg px-3 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {t('approvals.approve')}
                  </button>
                  <button
                    onClick={() => setConfirmUnlink(false)}
                    className="btn-sm text-gray-600 border border-gray-200 rounded-lg px-3 hover:bg-gray-50 flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    {t('approvals.reject')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmUnlink(true)}
                  className="btn-sm flex items-center gap-1.5 text-red-600 hover:text-red-800"
                >
                  <Link2Off className="w-4 h-4" />
                  {t('line.bind.unlink')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Not linked: 3-step flow ── */}
        {linked === false && (
          <div className="space-y-4">
            {/* Step 1 */}
            <Step n={1} label={t('line.bind.step1')}>
              <a
                href={process.env.NEXT_PUBLIC_LINE_OA_URL ?? 'https://line.me/R/ti/p/@nirvaprocure'}
                target="_blank" rel="noreferrer"
                className="btn-sm inline-flex items-center gap-1.5 rounded-lg bg-[#06C755] hover:bg-[#05B649] text-white px-3 py-1.5 text-sm font-semibold"
              >
                <ExternalLink className="w-4 h-4" />
                {t('line.bind.step1')}
              </a>
            </Step>

            {/* Step 2 */}
            <Step n={2} label={t('line.bind.step2')}>
              {code ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="num text-3xl font-bold tracking-widest bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl select-all">
                    {code}
                  </span>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={handleCopy}
                      className="btn-sm flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 text-sm"
                    >
                      <Copy className="w-4 h-4" />
                      {copied ? t('line.bind.copied') : t('line.bind.copy')}
                    </button>
                    <span className="text-xs text-gray-500">
                      {t('line.bind.expires', { min: String(minsLeft) })}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGetCode}
                  disabled={codeLoading}
                  className="btn-sm inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-500 text-brand-700 px-3 py-1.5 hover:bg-brand-50 disabled:opacity-50 font-semibold"
                >
                  {codeLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                  {t('line.bind.get_code')}
                </button>
              )}
            </Step>

            {/* Step 3 */}
            <Step n={3} label={t('line.bind.step3')}>
              <p className="text-sm text-gray-600 italic">
                {t('line.bind.step3')}
              </p>
            </Step>

            {/* Refresh status after sending code */}
            {code && (
              <button
                onClick={handleRefresh}
                className="btn-sm flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900"
              >
                <RefreshCw className="w-4 h-4" />
                {t('line.bind.refresh')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Rich menu card ───────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Grid3x3 className="w-5 h-5 text-gray-400" />
            {t('line.richmenu.title')}
          </h2>
          {richMenuId === undefined && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
          {richMenuId !== undefined && richMenuId && (
            <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full font-mono truncate max-w-[200px]">
              {richMenuId}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">{t('line.richmenu.sub')}</p>

        {/* Canvas preview (hidden — used only for image generation) */}
        <canvas ref={rmCanvasRef} width={2500} height={843} className="hidden" />

        {/* Visible mini-preview */}
        <RichMenuPreview />

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleSetupRichMenu}
            disabled={rmBusy}
            className="btn-sm flex items-center gap-1.5 rounded-xl bg-[#06C755] hover:bg-[#05B649] text-white px-4 py-2 font-semibold disabled:opacity-50"
          >
            {rmBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid3x3 className="w-4 h-4" />}
            {richMenuId ? t('line.richmenu.update') : t('line.richmenu.setup')}
          </button>
          {richMenuId && (
            <button
              onClick={handleDeleteRichMenu}
              disabled={rmBusy}
              className="btn-sm flex items-center gap-1.5 rounded-xl border border-red-200 text-red-600 px-4 py-2 hover:bg-red-50 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              {t('line.richmenu.remove')}
            </button>
          )}
        </div>
      </div>

      {/* ── Phone preview ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl p-6 sm:p-8">
        <div className="mx-auto max-w-sm bg-gray-50 rounded-[28px] shadow-lift overflow-hidden border-8 border-gray-800">
          <div className="bg-[#06C755] text-white px-4 py-3 flex items-center gap-3">
            <ChevronLeft className="w-5 h-5" />
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">N</div>
            <div className="flex-1 leading-tight">
              <div className="font-semibold">NIRVAPROCURE</div>
              <div className="text-xs opacity-80">Official Account</div>
            </div>
            <Phone className="w-5 h-5" />
            <Menu className="w-5 h-5" />
          </div>
          <div className="p-4 space-y-3 min-h-[400px] bg-[#7E91A5]">
            <div className="text-center text-white/80 text-xs">{t('line.demo.today')} 10:22</div>
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0">N</div>
              <div className="bg-white rounded-2xl overflow-hidden shadow-soft max-w-[280px]">
                <div className="px-4 py-3 bg-brand-600 text-white">
                  <div className="text-xs opacity-90 mb-0.5">{t('line.demo.eyebrow')}</div>
                  <div className="font-bold leading-tight">{t('line.demo.title')}</div>
                </div>
                <div className="p-4 space-y-2.5 text-sm">
                  <Row label={t('line.demo.number')} value={<span className="num">PR-2026-0042</span>} />
                  <Row label={t('line.demo.requester')} value={t('line.demo.requester.name')} />
                  <Row label={t('line.demo.dept')} value={t('line.demo.dept.value')} />
                  <div className="flex justify-between gap-3 pt-2 border-t border-gray-100">
                    <span className="text-gray-500">{t('detail.total')}</span>
                    <span className="num font-bold text-lg">฿ 8,089.20</span>
                  </div>
                </div>
                <div className="border-t border-gray-100 grid grid-cols-2">
                  <button className="btn-sm py-3 text-green-700 font-bold border-r border-gray-100 flex items-center justify-center gap-1.5 hover:bg-green-50">
                    <Check className="w-4 h-4" />{t('approvals.approve')}
                  </button>
                  <button className="btn-sm py-3 text-red-700 font-bold flex items-center justify-center gap-1.5 hover:bg-red-50">
                    <X className="w-4 h-4" />{t('approvals.reject')}
                  </button>
                </div>
                <button className="btn-sm w-full py-3 border-t border-gray-100 text-brand-700 font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-brand-50">
                  {t('line.demo.view_full')}<ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="text-center text-white/80 text-xs pt-2">{t('line.demo.read')} · 10:23</div>
          </div>
        </div>
      </div>

      {/* ── Notification settings ─────────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-400" />
          {t('line.settings.title')}
        </h2>
        <div className="space-y-3">
          <ToggleRow defaultChecked label={t('line.toggle.new')}    sub={t('line.toggle.new.sub')} />
          <ToggleRow defaultChecked label={t('line.toggle.result')} sub={t('line.toggle.result.sub')} />
          <ToggleRow               label={t('line.toggle.daily')}  sub={t('line.toggle.daily.sub')} />
        </div>
        <button onClick={testLine} className="btn-sm w-full rounded-xl bg-[#06C755] hover:bg-[#05B649] text-white font-bold flex items-center justify-center gap-2">
          <Send className="w-5 h-5" />{t('line.test_send')}
        </button>
      </div>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
        {n}
      </div>
      <div className="flex-1 space-y-2">
        <p className="font-semibold text-sm text-gray-800">{label}</p>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ToggleRow({ label, sub, defaultChecked = false }: { label: string; sub: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer">
      <input type="checkbox" defaultChecked={defaultChecked} className="mt-1 w-5 h-5 rounded text-brand-600" />
      <div className="flex-1">
        <div className="font-semibold">{label}</div>
        <div className="text-sm text-gray-600">{sub}</div>
      </div>
    </label>
  );
}

// ── Rich menu canvas helpers ──────────────────────────────────────────────────

const BUTTONS = [
  { emoji: '📥', label: 'รออนุมัติ' },
  { emoji: '📋', label: 'ใบขอของฉัน' },
  { emoji: '➕', label: 'ขอซื้อใหม่' },
  { emoji: '📊', label: 'รายงาน' },
  { emoji: '🔔', label: 'ตั้งค่า LINE' },
  { emoji: '🏠', label: 'หน้าหลัก' },
];

/** Renders the 2×3 rich menu onto a 2500×843 canvas element. */
function drawRichMenu(canvas: HTMLCanvasElement, _t: unknown) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = 2500, H = 843;
  const COLS = 3, ROWS = 2;
  const cw = Math.floor(W / COLS);
  const rh = Math.floor(H / ROWS);

  // Background
  ctx.fillStyle = '#4F46E5';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cw, 0);
    ctx.lineTo(c * cw, H);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, rh);
  ctx.lineTo(W, rh);
  ctx.stroke();

  // Buttons
  BUTTONS.forEach((btn, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx  = col * cw + cw / 2;
    const cy  = row * rh + rh / 2;

    // Emoji
    ctx.font = `${Math.floor(rh * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.emoji, cx, cy - rh * 0.1);

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.floor(rh * 0.14)}px sans-serif`;
    ctx.fillText(btn.label, cx, cy + rh * 0.2);
    ctx.fillStyle = '#4F46E5'; // reset for next iteration bg — not needed
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; // keep white for text
  });
}

/** Scaled-down visual preview of the rich menu (CSS only). */
function RichMenuPreview() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-[#4F46E5] select-none">
      <div className="grid grid-cols-3 divide-x divide-white/30">
        {BUTTONS.slice(0, 3).map((b) => <BtnCell key={b.label} {...b} />)}
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/30 border-t border-white/30">
        {BUTTONS.slice(3).map((b) => <BtnCell key={b.label} {...b} />)}
      </div>
    </div>
  );
}

function BtnCell({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-4">
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-semibold text-white/90">{label}</span>
    </div>
  );
}
