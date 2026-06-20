'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, CheckCircle2, XCircle, MinusCircle,
  Loader2, FileText, Sparkles, Plus, Trash2,
} from 'lucide-react';
import { gov as govApi, ApiError, type ToRBrief, type ToRDraft, type ToRTemplate } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import { storeMockTorDraft } from '@/lib/tor-mock-store';

const MOCK_TOR_TEMPLATES: ToRTemplate[] = [
  { id: 'tpl-goods',        name: 'จัดซื้อครุภัณฑ์ทั่วไป',     procurement_kind: 'goods',        is_official: true },
  { id: 'tpl-services',     name: 'จ้างเหมาบริการมาตรฐาน',    procurement_kind: 'services',     is_official: true },
  { id: 'tpl-construction', name: 'งานก่อสร้างขนาดเล็ก',       procurement_kind: 'construction', is_official: false },
];

const KIND_LABEL_KEYS: Record<ToRBrief['procurement_kind'], TranslationKey> = {
  goods: 'tor.kind.goods',
  services: 'tor.kind.services',
  construction: 'tor.kind.construction',
};

const CHECKLIST_LABEL_KEYS: Record<string, TranslationKey> = {
  has_scope:             'tor.checklist.scope',
  has_budget:            'tor.checklist.budget',
  has_deliverables:      'tor.checklist.deliverables',
  has_evaluation_method: 'tor.checklist.evaluation',
  has_timeline:          'tor.checklist.timeline',
  has_qualifications:    'tor.checklist.qualifications',
};

function runLiveChecklist(brief: ToRBrief): ToRDraft['compliance_checklist'] {
  return {
    has_scope:              brief.scope.trim().length > 30 ? 'passed' : 'failed',
    has_budget:             brief.budget_minor > 0 ? 'passed' : 'failed',
    has_deliverables:       brief.deliverables.length > 0 ? 'passed' : 'failed',
    has_evaluation_method:  brief.evaluation_method ? 'passed' : 'failed',
    has_timeline:           !!(brief.timeline?.start && brief.timeline?.end) ? 'passed' : 'failed',
    has_qualifications:     brief.procurement_kind === 'construction'
      ? ((brief.qualifications?.length ?? 0) > 0 ? 'passed' : 'failed')
      : 'na',
  };
}

function buildMockTorDraft(title: string, brief: ToRBrief): ToRDraft {
  const checklist = runLiveChecklist(brief);
  return {
    id: `tor-mock-${Date.now()}`,
    title,
    status: 'draft',
    body_markdown: [
      '## ขอบเขตของงาน',
      brief.scope,
      '',
      '## งบประมาณ',
      `${(brief.budget_minor / 100).toLocaleString('th-TH')} ${brief.currency}`,
    ].join('\n'),
    compliance_checklist: checklist,
    created_at: new Date().toISOString(),
  };
}

export default function NewTorPage() {
  const { toast } = useToast();
  const { t } = useT();
  const router = useRouter();

  const { data: templates } = useResource(
    () => withMockFallback(() => govApi.templates(), MOCK_TOR_TEMPLATES),
  );

  const [templateId, setTemplateId] = useState<string>('');
  const [kind, setKind] = useState<ToRBrief['procurement_kind']>('goods');
  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState('');
  const [scope, setScope] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>(['']);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [evalMethod, setEvalMethod] = useState<ToRBrief['evaluation_method']>('lowest_price');
  const [busy, setBusy] = useState(false);

  const liveBrief = useMemo<ToRBrief>(() => ({
    procurement_kind: kind,
    budget_minor: Math.round(Number(budget || '0') * 100),
    currency: 'THB',
    scope,
    deliverables: deliverables.map((d) => d.trim()).filter(Boolean),
    timeline: { start: start || undefined, end: end || undefined },
    evaluation_method: evalMethod,
  }), [kind, budget, scope, deliverables, start, end, evalMethod]);

  const liveChecklist = useMemo(() => runLiveChecklist(liveBrief), [liveBrief]);
  const showLiveChecklist = title.trim().length > 0 || scope.trim().length > 0;

  function setDeliverable(i: number, v: string) {
    setDeliverables((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  }

  function selectTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates?.find((row) => row.id === id);
    if (tpl) setKind(tpl.procurement_kind);
  }

  async function submit() {
    if (!title.trim() || !scope.trim()) {
      toast(t('tor.err.required'), 'warn');
      return;
    }
    setBusy(true);
    try {
      const result = await withMockFallback(
        () => govApi.createDraft({
          title,
          template_id: templateId || undefined,
          brief: liveBrief,
        }),
        buildMockTorDraft(title, liveBrief),
      );
      if (result.id.startsWith('tor-mock-')) storeMockTorDraft(result);
      toast(t('tor.toast.created'), 'ok');
      router.push(`/gov/tor/${result.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('tor.err.create'), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen space-y-6 max-w-5xl mx-auto">
      <Link href="/gov/tor" className="btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </span>
          {t('tor.heading')}
        </h1>
        <p className="text-base text-ink-soft">{t('tor.sub')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <div className="lg:col-span-2 card space-y-5">
          <div>
            <label htmlFor="tor-template" className="block font-semibold mb-2">{t('tor.template.label')}</label>
            <select
              id="tor-template"
              value={templateId}
              onChange={(e) => selectTemplate(e.target.value)}
              className="w-full px-4 rounded-xl border-2 border-line focus:border-brand-500 outline-none bg-white"
            >
              <option value="">{t('tor.template.none')}</option>
              {(templates ?? []).map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                  {tpl.is_official ? ` (${t('tor.template.official')})` : ''}
                </option>
              ))}
            </select>
            <p className="text-sm text-ink-muted mt-2">{t('tor.template.hint')}</p>
          </div>

          <div>
            <label className="block font-semibold mb-2">{t('tor.kind.label')} <span className="text-red-600">*</span></label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_LABEL_KEYS) as ToRBrief['procurement_kind'][]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`min-h-btn-sm px-4 rounded-full text-sm font-medium ${
                    kind === k ? 'bg-brand-600 text-white' : 'bg-white border border-line text-ink-soft hover:bg-gray-50'
                  }`}
                >
                  {t(KIND_LABEL_KEYS[k])}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-2">{t('tor.title.label')} <span className="text-red-600">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tor.title.placeholder')}
              className="w-full px-4 rounded-xl border-2 border-line focus:border-brand-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-2">{t('tor.budget.label')}</label>
              <input
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="500000"
                className="num w-full px-4 rounded-xl border-2 border-line focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">{t('tor.eval.label')}</label>
              <select
                value={evalMethod}
                onChange={(e) => setEvalMethod(e.target.value as ToRBrief['evaluation_method'])}
                className="w-full px-4 rounded-xl border-2 border-line focus:border-brand-500 outline-none bg-white"
              >
                <option value="lowest_price">{t('tor.eval.lowest')}</option>
                <option value="most_advantageous">{t('tor.eval.advantageous')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-2">{t('tor.start.label')}</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="num w-full px-4 rounded-xl border-2 border-line focus:border-brand-500 outline-none" />
            </div>
            <div>
              <label className="block font-semibold mb-2">{t('tor.end.label')}</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="num w-full px-4 rounded-xl border-2 border-line focus:border-brand-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-2">{t('tor.scope.label')} <span className="text-red-600">*</span></label>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              rows={5}
              placeholder={t('tor.scope.placeholder')}
              className="w-full px-4 py-3 rounded-xl border-2 border-line focus:border-brand-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">{t('tor.deliverables.label')}</label>
            <div className="space-y-2">
              {deliverables.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={d}
                    onChange={(e) => setDeliverable(i, e.target.value)}
                    placeholder={t('tor.deliverables.placeholder', { n: i + 1 })}
                    className="flex-1 px-3 rounded-lg border-2 border-line focus:border-brand-500 outline-none"
                  />
                  {deliverables.length > 1 && (
                    <button
                      onClick={() => setDeliverables((arr) => arr.filter((_, idx) => idx !== i))}
                      className="btn-sm w-11 h-11 rounded-lg bg-white hover:bg-red-50 hover:text-red-600 border border-gray-200 flex items-center justify-center"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setDeliverables((arr) => [...arr, ''])}
                className="btn-sm rounded-lg border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-600 hover:text-brand-700 font-medium px-4 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('pr.new.items.add')}
              </button>
            </div>
          </div>

          <button onClick={submit} disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {busy ? t('tor.busy') : t('tor.cta')}
          </button>
        </div>

        {/* Checklist sidebar */}
        <div className="card h-fit lg:sticky lg:top-24">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-ink-muted" />
            {t('tor.checklist.title')}
          </h2>
          {showLiveChecklist ? (
            <ul className="space-y-2">
              {Object.entries(liveChecklist).map(([key, status]) => (
                <ChecklistItem key={key} label={CHECKLIST_LABEL_KEYS[key] ? t(CHECKLIST_LABEL_KEYS[key]) : key} status={status} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">{t('tor.checklist.hint')}</p>
          )}
        </div>
      </div>
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
      <span className="text-sm leading-snug">{label}</span>
    </li>
  );
}
