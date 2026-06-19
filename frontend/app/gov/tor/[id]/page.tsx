'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Scale, FileText, CheckCircle2, XCircle, MinusCircle,
} from 'lucide-react';
import { gov as govApi, type ToRDraft } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

const CHECKLIST_LABEL_KEYS: Record<string, TranslationKey> = {
  has_scope:             'tor.checklist.scope',
  has_budget:            'tor.checklist.budget',
  has_deliverables:      'tor.checklist.deliverables',
  has_evaluation_method: 'tor.checklist.evaluation',
  has_timeline:          'tor.checklist.timeline',
  has_qualifications:    'tor.checklist.qualifications',
};

const STATUS_LABEL_KEYS: Record<ToRDraft['status'], TranslationKey> = {
  draft:     'tor.status.draft',
  review:    'tor.status.review',
  approved:  'tor.status.approved',
  archived:  'tor.status.archived',
};

const STATUS_STYLE: Record<ToRDraft['status'], { bg: string; text: string }> = {
  draft:     { bg: 'bg-gray-100',   text: 'text-ink-soft' },
  review:    { bg: 'bg-amber-100',  text: 'text-amber-800' },
  approved:  { bg: 'bg-green-100',  text: 'text-green-800' },
  archived:  { bg: 'bg-brand-100',  text: 'text-brand-700' },
};

const MOCK_TOR_DRAFTS: Record<string, ToRDraft> = {
  'tor-1': {
    id: 'tor-1',
    title: 'จัดซื้อเครื่องคอมพิวเตอร์ จำนวน 20 เครื่อง',
    status: 'draft',
    body_markdown: [
      '## ๑. ความเป็นมา',
      'หน่วยงานมีความจำเป็นต้องจัดซื้อเครื่องคอมพิวเตอร์เพื่อทดแทนอุปกรณ์เดิม',
      '',
      '## ๒. วัตถุประสงค์',
      'เพื่อสนับสนุนการปฏิบัติงานของเจ้าหน้าที่',
    ].join('\n'),
    compliance_checklist: {
      has_scope: 'passed',
      has_budget: 'passed',
      has_deliverables: 'passed',
      has_evaluation_method: 'passed',
      has_timeline: 'failed',
      has_qualifications: 'na',
    },
    created_at: '2026-06-10T09:00:00Z',
  },
  'tor-2': {
    id: 'tor-2',
    title: 'จ้างเหมาบำรุงรักษาระบบเครือข่าย',
    status: 'approved',
    body_markdown: '## ขอบเขตของงาน\nบำรุงรักษาระบบเครือข่ายภายในหน่วยงานเป็นระยะเวลา 12 เดือน',
    compliance_checklist: {
      has_scope: 'passed',
      has_budget: 'passed',
      has_deliverables: 'passed',
      has_evaluation_method: 'passed',
      has_timeline: 'passed',
      has_qualifications: 'na',
    },
    created_at: '2026-06-05T14:30:00Z',
  },
  'tor-3': {
    id: 'tor-3',
    title: 'ก่อสร้างอาคารคลังสินค้า',
    status: 'archived',
    body_markdown: '## ขอบเขตของงาน\nก่อสร้างอาคารคลังสินค้าขนาด 500 ตร.ม.',
    compliance_checklist: {
      has_scope: 'passed',
      has_budget: 'passed',
      has_deliverables: 'passed',
      has_evaluation_method: 'passed',
      has_timeline: 'passed',
      has_qualifications: 'passed',
    },
    created_at: '2026-05-28T11:00:00Z',
  },
};

function mockTorDraft(id: string): ToRDraft {
  return MOCK_TOR_DRAFTS[id] ?? {
    id,
    title: `ToR ${id}`,
    status: 'draft',
    body_markdown: null,
    compliance_checklist: {},
    created_at: new Date().toISOString(),
  };
}

export default function TorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useT();

  const { data: draft, loading, error, refresh } = useResource(
    () => withMockFallback(() => govApi.getDraft(id), mockTorDraft(id)),
    [id],
  );

  const statusStyle = draft ? STATUS_STYLE[draft.status] : null;
  const fmtDate = draft
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draft.created_at))
    : '';

  return (
    <section className="screen space-y-6 max-w-4xl mx-auto">
      <Link href="/gov/tor" className="btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('tor.list.back')}</span>
      </Link>

      {error && <ErrorBanner message={error?.message} onRetry={refresh} />}
      {loading && !draft && <Loading />}

      {draft && (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3 text-ink">
                <Scale className="w-6 h-6 text-brand-600 flex-shrink-0" />
                {draft.title}
              </h1>
              <p className="text-sm text-ink-soft mt-2 num">{fmtDate}</p>
            </div>
            {statusStyle && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                {t(STATUS_LABEL_KEYS[draft.status])}
              </span>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-6">
              {draft.body_markdown ? (
                <div className="card">
                  <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-ink">
                    <FileText className="w-5 h-5 text-ink-muted" />
                    {t('tor.draft.title')}
                  </h2>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-ink leading-relaxed">
                    {draft.body_markdown}
                  </div>
                </div>
              ) : (
                <div className="card text-ink-soft">{t('tor.detail.no_body')}</div>
              )}
            </div>

            <div className="card h-fit lg:sticky lg:top-24">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-ink">
                <FileText className="w-5 h-5 text-ink-muted" />
                {t('tor.checklist.title')}
              </h2>
              {Object.keys(draft.compliance_checklist).length > 0 ? (
                <ul className="space-y-2">
                  {Object.entries(draft.compliance_checklist).map(([key, status]) => (
                    <ChecklistItem
                      key={key}
                      label={CHECKLIST_LABEL_KEYS[key] ? t(CHECKLIST_LABEL_KEYS[key]) : key}
                      status={status}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">{t('tor.checklist.hint')}</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ChecklistItem({ label, status }: { label: string; status: 'passed' | 'failed' | 'na' }) {
  const cfg = {
    passed: { icon: CheckCircle2, cls: 'text-green-600',  bg: 'bg-green-50' },
    failed: { icon: XCircle,      cls: 'text-red-600',    bg: 'bg-red-50' },
    na:     { icon: MinusCircle,  cls: 'text-ink-muted',  bg: 'bg-gray-50' },
  }[status];
  const Icon = cfg.icon;
  return (
    <li className={`flex items-start gap-3 p-3 rounded-xl ${cfg.bg}`}>
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.cls}`} />
      <span className="text-sm leading-snug text-ink">{label}</span>
    </li>
  );
}
