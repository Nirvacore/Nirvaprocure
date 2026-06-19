'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Building2, CheckCircle2, XCircle, MinusCircle,
  Loader2, FileText, Sparkles, Plus, Trash2,
} from 'lucide-react';
import { gov as govApi, ApiError, type ToRBrief, type ToRDraft } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

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

export default function NewTorPage() {
  const { toast } = useToast();
  const { t } = useT();

  const [kind, setKind] = useState<ToRBrief['procurement_kind']>('goods');
  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState('');
  const [scope, setScope] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>(['']);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [evalMethod, setEvalMethod] = useState<ToRBrief['evaluation_method']>('lowest_price');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ToRDraft | null>(null);

  function setDeliverable(i: number, v: string) {
    setDeliverables((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  }

  async function submit() {
    if (!title.trim() || !scope.trim()) {
      toast(t('tor.err.required'), 'warn');
      return;
    }
    setBusy(true);
    try {
      const result = await govApi.createDraft({
        title,
        brief: {
          procurement_kind: kind,
          budget_minor: Math.round(Number(budget || '0') * 100),
          currency: 'THB',
          scope,
          deliverables: deliverables.map((d) => d.trim()).filter(Boolean),
          timeline: { start: start || undefined, end: end || undefined },
          evaluation_method: evalMethod,
        },
      });
      setDraft(result);
      toast(t('tor.toast.created'), 'ok');
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
        <p className="text-base text-gray-600">{t('tor.sub')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <div className="lg:col-span-2 card space-y-5">
          <div>
            <label className="block font-semibold mb-2">{t('tor.kind.label')} <span className="text-red-600">*</span></label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_LABEL_KEYS) as ToRBrief['procurement_kind'][]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`min-h-btn-sm px-4 rounded-full text-sm font-medium ${
                    kind === k ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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
              className="w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none"
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
                className="num w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">{t('tor.eval.label')}</label>
              <select
                value={evalMethod}
                onChange={(e) => setEvalMethod(e.target.value as ToRBrief['evaluation_method'])}
                className="w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none bg-white"
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
                className="num w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none" />
            </div>
            <div>
              <label className="block font-semibold mb-2">{t('tor.end.label')}</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="num w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-2">{t('tor.scope.label')} <span className="text-red-600">*</span></label>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              rows={5}
              placeholder={t('tor.scope.placeholder')}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none resize-none"
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
                    className="flex-1 px-3 rounded-lg border-2 border-gray-200 focus:border-brand-500 outline-none"
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
            <FileText className="w-5 h-5 text-gray-400" />
            {t('tor.checklist.title')}
          </h2>
          {draft?.compliance_checklist ? (
            <ul className="space-y-2">
              {Object.entries(draft.compliance_checklist).map(([key, status]) => (
                <ChecklistItem key={key} label={CHECKLIST_LABEL_KEYS[key] ? t(CHECKLIST_LABEL_KEYS[key]) : key} status={status} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">{t('tor.checklist.hint')}</p>
          )}
        </div>
      </div>

      {/* AI draft preview */}
      {draft?.body_markdown && (
        <div className="card">
          <h2 className="text-lg font-bold mb-3">{t('tor.draft.title')}</h2>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed">
            {draft.body_markdown}
          </div>
        </div>
      )}
    </section>
  );
}

function ChecklistItem({ label, status }: { label: string; status: 'passed' | 'failed' | 'na' }) {
  const cfg = {
    passed: { icon: CheckCircle2, cls: 'text-green-600',  bg: 'bg-green-50' },
    failed: { icon: XCircle,      cls: 'text-red-600',    bg: 'bg-red-50' },
    na:     { icon: MinusCircle,  cls: 'text-gray-400',   bg: 'bg-gray-50' },
  }[status];
  const Icon = cfg.icon;
  return (
    <li className={`flex items-start gap-3 p-3 rounded-xl ${cfg.bg}`}>
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.cls}`} />
      <span className="text-sm leading-snug">{label}</span>
    </li>
  );
}
