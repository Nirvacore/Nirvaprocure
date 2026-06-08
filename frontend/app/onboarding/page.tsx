'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Building2, Users, GitBranch, Upload, CheckCircle2, Loader2, ArrowRight,
} from 'lucide-react';
import { people as peopleApi, workflows as workflowsApi, importCsv as importApi, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';

type Step = 'welcome' | 'department' | 'approver' | 'import' | 'done';

const ORDER: Step[] = ['welcome', 'department', 'approver', 'import', 'done'];

/**
 * Multi-step onboarding flow for a brand-new org. The user lands here after
 * an admin creates their first account; we set up the bare minimum needed
 * to submit and approve a first PR:
 *
 *   1. Welcome screen explains what's about to happen.
 *   2. Create the first department.
 *   3. Choose an approver from existing users (admin can add more later).
 *   4. Optional: paste CSV of items to seed the catalog.
 *
 * Each step's submit fires the relevant API and advances locally. We don't
 * persist progress server-side — the user finishes in one sitting or skips
 * (the skip button forwards to the home page).
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useT();
  const [step, setStep] = useState<Step>('welcome');
  const [busy, setBusy] = useState(false);

  // Collected state — initial deptName is a translated default
  const [deptName, setDeptName]       = useState(() => t('onboarding.dept.default'));
  const [deptCC,   setDeptCC]         = useState('CC-100');
  const [createdDept, setCreatedDept] = useState<{ id: string; name: string } | null>(null);
  const [csv, setCsv]                 = useState('');
  const [csvKind, setCsvKind]         = useState<'items' | 'suppliers'>('items');

  function go(next: Step) { setStep(next); }
  function skip()         { router.replace('/'); }

  async function createDepartment() {
    if (!deptName.trim()) { toast(t('onboarding.err.dept_name'), 'warn'); return; }
    setBusy(true);
    try {
      const d = await peopleApi.createDepartment({ name: deptName, cost_center: deptCC || undefined });
      setCreatedDept({ id: d.id, name: d.name });
      go('approver');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('onboarding.err.dept_create'), 'err');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Quick path for "any PR is approved by user X" — we create a single
   * catch-all workflow with min_amount=0. The settings/workflow UI lets
   * the user split it later by amount tier.
   */
  async function setupBaselineWorkflow(approverUserId: string) {
    setBusy(true);
    try {
      await workflowsApi.create({
        name: t('onboarding.workflow.name'),
        match_rules: { min_amount_minor: 0 },
        is_active: true,
        steps: [{ step_no: 1, approver_kind: 'user', approver_ref: approverUserId, sla_hours: 24 }],
      });
      go('import');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('onboarding.err.wf_create'), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function runCsvImport() {
    if (!csv.trim()) { go('done'); return; }
    setBusy(true);
    try {
      // Naive CSV: first row = headers, rest = values, comma-separated.
      // Production should ship a real CSV parser (papaparse) for quoted
      // fields + escapes; this is good enough for first onboarding.
      const lines = csv.trim().split(/\r?\n/);
      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((row) => {
        const cells = row.split(',').map((c) => c.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
        return obj;
      });
      const result = await importApi.run(csvKind, rows);
      toast(t('onboarding.toast.imported', { count: result.inserted + result.updated }), 'ok');
      go('done');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('onboarding.err.import'), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-indigo-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold">NIRVAPROCURE</div>
              <div className="text-xs text-gray-500">{t('onboarding.subtitle')}</div>
            </div>
          </div>
          <button onClick={skip} className="btn-sm text-sm text-gray-600 hover:text-gray-900 underline">
            {t('onboarding.skip')}
          </button>
        </div>
        {/* Progress bar */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-3 flex gap-1">
          {ORDER.slice(0, -1).map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${
              ORDER.indexOf(step) >= i ? 'bg-brand-600' : 'bg-gray-200'
            }`} />
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        {step === 'welcome'    && <Welcome    onNext={() => go('department')} />}
        {step === 'department' && (
          <Department
            name={deptName} cc={deptCC}
            setName={setDeptName} setCC={setDeptCC}
            busy={busy} onNext={createDepartment}
          />
        )}
        {step === 'approver' && (
          <ApproverPick
            departmentLabel={createdDept?.name ?? deptName}
            busy={busy} onNext={setupBaselineWorkflow}
          />
        )}
        {step === 'import' && (
          <CsvImportStep
            csv={csv} setCsv={setCsv} kind={csvKind} setKind={setCsvKind}
            busy={busy} onSkip={() => go('done')} onNext={runCsvImport}
          />
        )}
        {step === 'done' && <Done onDone={() => router.replace('/')} />}
      </main>
    </div>
  );
}

// -- step components ---------------------------------------------------------

function Welcome({ onNext }: { onNext: () => void }) {
  const { t } = useT();
  return (
    <section className="card text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center">
        <Sparkles className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold">{t('onboarding.welcome.title')}</h1>
      <p className="text-base text-gray-600 max-w-md mx-auto">{t('onboarding.welcome.body')}</p>
      <button onClick={onNext} className="btn-primary px-8 inline-flex">
        {t('onboarding.welcome.cta')}
        <ArrowRight className="w-5 h-5" />
      </button>
    </section>
  );
}

function Department({
  name, cc, setName, setCC, busy, onNext,
}: {
  name: string; cc: string;
  setName: (v: string) => void; setCC: (v: string) => void;
  busy: boolean; onNext: () => void;
}) {
  const { t } = useT();
  return (
    <section className="card space-y-5">
      <header className="flex items-center gap-3">
        <Building2 className="w-6 h-6 text-brand-600" />
        <h2 className="text-xl font-bold">{t('onboarding.dept.title')}</h2>
      </header>
      <div>
        <label className="block font-semibold mb-2 text-sm">{t('onboarding.dept.name.label')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none" />
      </div>
      <div>
        <label className="block font-semibold mb-2 text-sm">{t('onboarding.dept.cc.label')}</label>
        <input value={cc} onChange={(e) => setCC(e.target.value)}
          placeholder="CC-100"
          className="num w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none" />
      </div>
      <button onClick={onNext} disabled={busy} className="btn-primary w-full">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
        {busy ? t('onboarding.dept.creating') : t('onboarding.next')}
      </button>
    </section>
  );
}

function ApproverPick({
  departmentLabel, busy, onNext,
}: { departmentLabel: string; busy: boolean; onNext: (userId: string) => void }) {
  const { t } = useT();
  const [userId, setUserId] = useState('');
  return (
    <section className="card space-y-5">
      <header className="flex items-center gap-3">
        <Users className="w-6 h-6 text-brand-600" />
        <h2 className="text-xl font-bold">{t('onboarding.approver.title')}</h2>
      </header>
      <p className="text-sm text-gray-600">{t('onboarding.approver.intro.prefix')}<strong>{departmentLabel}</strong>{t('onboarding.approver.intro.suffix')}</p>
      <div>
        <label className="block font-semibold mb-2 text-sm">{t('onboarding.approver.label')}</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)}
          placeholder="33333333-3333-3333-3333-333333333302"
          className="num w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none" />
        <p className="text-xs text-gray-500 mt-1">{t('onboarding.approver.help')}</p>
      </div>
      <button onClick={() => onNext(userId.trim())} disabled={busy || !userId.trim()} className="btn-primary w-full">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <GitBranch className="w-5 h-5" />}
        {busy ? t('onboarding.approver.creating') : t('onboarding.approver.cta')}
      </button>
    </section>
  );
}

function CsvImportStep({
  csv, setCsv, kind, setKind, busy, onSkip, onNext,
}: {
  csv: string; setCsv: (v: string) => void;
  kind: 'items' | 'suppliers'; setKind: (k: 'items' | 'suppliers') => void;
  busy: boolean; onSkip: () => void; onNext: () => void;
}) {
  const { t } = useT();
  const example = kind === 'items'
    ? 'sku,name,unit\nHP-65A,HP 65A Black Toner,ea\nLAB-GLOVE-M,Lab gloves M,pair'
    : 'name,tax_id,contact_email\nHP Authorized Store,0107536000007,hp@example.com\nMakro Distribution Center,,';
  return (
    <section className="card space-y-5">
      <header className="flex items-center gap-3">
        <Upload className="w-6 h-6 text-brand-600" />
        <h2 className="text-xl font-bold">{t('onboarding.csv.title')}</h2>
      </header>
      <div className="flex gap-2">
        <button onClick={() => setKind('items')}
          className={`btn-sm rounded-full px-4 text-sm font-medium ${kind === 'items'
            ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
          {t('onboarding.csv.kind.items')}
        </button>
        <button onClick={() => setKind('suppliers')}
          className={`btn-sm rounded-full px-4 text-sm font-medium ${kind === 'suppliers'
            ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
          {t('onboarding.csv.kind.suppliers')}
        </button>
      </div>
      <div>
        <label className="block font-semibold mb-2 text-sm">{t('onboarding.csv.label')}</label>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6}
          placeholder={example}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none font-mono text-sm resize-none" />
        <p className="text-xs text-gray-500 mt-1">{t('onboarding.csv.help')}<br />
          <code className="text-[11px]">{example.split('\n')[0]}</code>
        </p>
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button onClick={onSkip} className="btn-secondary flex-1">{t('onboarding.csv.skip')}</button>
        <button onClick={onNext} disabled={busy} className="btn-primary flex-1">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          {busy ? t('onboarding.csv.importing') : t('onboarding.csv.import')}
        </button>
      </div>
    </section>
  );
}

function Done({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  return (
    <section className="card text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-green-100 text-green-700 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold">{t('onboarding.done.title')}</h1>
      <p className="text-base text-gray-600 max-w-md mx-auto">{t('onboarding.done.body')}</p>
      <button onClick={onDone} className="btn-primary px-8 inline-flex">
        {t('onboarding.done.cta')}
        <ArrowRight className="w-5 h-5" />
      </button>
    </section>
  );
}
