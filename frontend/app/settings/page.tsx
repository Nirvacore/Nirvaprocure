'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BadgeDollarSign, GitBranch, Users, Building2, Filter, Pencil, Plus, X,
  User, ArrowDown, Clock, Lightbulb, Search, UserPlus, UserCheck, MoreVertical, Webhook,
} from 'lucide-react';
import { mockWorkflows, type Workflow } from '@/lib/mock-data';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import {
  people as peopleApi,
  workflows as workflowsApi,
  type PeopleUser, type PeopleDepartment, type WorkflowWire,
} from '@/lib/api';
import { mockUsers, mockDepartments, type UserRow, type Department } from '@/lib/mock-data';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
import { WorkflowEditor } from '@/components/WorkflowEditor';
import { WebhooksPanel } from '@/components/WebhooksPanel';
import { AffiliatePanel } from '@/components/AffiliatePanel';
import { useT } from '@/lib/i18n/provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

type Tab = 'workflows' | 'users' | 'departments' | 'webhooks' | 'affiliate';

const TABS: { key: Tab; tKey: TranslationKey; icon: typeof GitBranch }[] = [
  { key: 'workflows',   tKey: 'settings.tab.workflows',  icon: GitBranch },
  { key: 'users',       tKey: 'settings.tab.users',      icon: Users },
  { key: 'departments', tKey: 'settings.tab.depts',      icon: Building2 },
  { key: 'webhooks',    tKey: 'settings.tab.webhooks',   icon: Webhook },
  { key: 'affiliate',   tKey: 'settings.tab.affiliate',  icon: BadgeDollarSign },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('workflows');
  const { t } = useT();

  return (
    <section className="screen space-y-6 max-w-4xl mx-auto">
      <Link href="/" className="btn-sm inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('common.back')}</span>
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-1">{t('settings.heading')}</h1>
        <p className="text-base text-gray-600">{t('settings.sub')}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tabDef) => {
          const Icon = tabDef.icon;
          const active = tab === tabDef.key;
          return (
            <button
              key={tabDef.key}
              onClick={() => setTab(tabDef.key)}
              className={`min-h-btn-sm px-5 font-semibold whitespace-nowrap border-b-2 ${
                active ? 'text-brand-700 border-brand-600' : 'text-gray-600 border-transparent'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                {t(tabDef.tKey)}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'workflows'   && <Workflows />}
      {tab === 'users'       && <UsersTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'webhooks'    && <WebhooksPanel />}
      {tab === 'affiliate'   && <AffiliatePanel />}
    </section>
  );
}

function Workflows() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing]       = useState<WorkflowWire | null>(null);
  const { t } = useT();

  // Adapter: API rows → the existing card shape so we don't have to rewrite
  // the WorkflowCard UI to match the wire format. We carry the raw wire
  // row alongside so opening the editor doesn't need a re-fetch.
  const toCardShape = (wf: WorkflowWire): Workflow & { _wire: WorkflowWire } => ({
    id: wf.id,
    name: wf.name,
    active: wf.is_active,
    rule: ruleSummary(wf.match_rules, t),
    steps: wf.steps.map((s) => ({
      kind:  s.approver_kind === 'role' ? 'role' : 'user',
      label: s.approver_kind === 'manager_of_requester'
        ? t('settings.workflows.manager')
        : s.approver_ref,
      sla:   s.sla_hours ?? undefined,
    })),
    _wire: wf,
  });

  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      async () => (await workflowsApi.list()).map(toCardShape),
      mockWorkflows.map((wf) => ({ ...wf, _wire: undefined as unknown as WorkflowWire })),
    ),
  );

  function openEditor(wf?: WorkflowWire) {
    setEditing(wf ?? null);
    setEditorOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-brand-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-brand-900">{t('settings.workflows.hint')}</div>
      </div>
      {error && <ErrorBanner message={error.message} onRetry={refresh} />}
      {loading && !data && <Loading />}
      {(data ?? []).map((wf, idx) => (
        <WorkflowCard
          key={wf.id}
          wf={wf}
          index={idx}
          onEdit={() => (wf as { _wire?: WorkflowWire })._wire && openEditor((wf as { _wire?: WorkflowWire })._wire!)}
        />
      ))}
      <button
        onClick={() => openEditor()}
        className="w-full rounded-2xl border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-600 hover:text-brand-700 font-bold flex items-center justify-center gap-2 py-5"
      >
        <Plus className="w-5 h-5" />
        {t('settings.workflows.add')}
      </button>

      <WorkflowEditor
        open={editorOpen}
        workflow={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => refresh()}
      />
    </div>
  );
}

/**
 * Render the JSONB match_rules into a one-liner the buyer can read.
 * Current rules are amount-only (min/max), but the function fans out so we
 * can add department / category / vendor predicates later without changing
 * the card UI.
 */
function ruleSummary(rules: Record<string, unknown>, t: (k: TranslationKey, v?: Record<string, string | number>) => string): string {
  const min = Number(rules.min_amount_minor ?? 0);
  const max = rules.max_amount_minor != null ? Number(rules.max_amount_minor) : null;
  if (min === 0 && max == null) return t('settings.workflows.rule.all');
  if (max == null)              return t('settings.workflows.rule.min',   { min: (min / 100).toLocaleString() });
  return t('settings.workflows.rule.range', { min: (min / 100).toLocaleString(), max: (max / 100).toLocaleString() });
}

function WorkflowCard({ wf, index, onEdit }: { wf: Workflow; index: number; onEdit?: () => void }) {
  const { t } = useT();
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="num text-xs text-gray-500">{t('settings.workflows.rule_n', { n: index + 1 })}</span>
            {wf.active
              ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{t('settings.workflows.active')}</span>
              : <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{t('settings.workflows.inactive')}</span>
            }
          </div>
          <h3 className="text-lg font-bold mb-1 leading-snug">{wf.name}</h3>
          <p className="text-sm text-gray-600 flex items-center gap-1.5">
            <Filter className="w-4 h-4" />
            {t('settings.workflows.condition')}: <strong className="text-gray-800 font-semibold">{wf.rule}</strong>
          </p>
        </div>
        <button
          onClick={onEdit}
          disabled={!onEdit}
          className="btn-sm rounded-lg bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <Pencil className="w-4 h-4" />
          {t('common.edit')}
        </button>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <div className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">{t('settings.workflows.steps')}</div>
        <ol className="space-y-2">
          {wf.steps.map((s, i) => {
            const KindIcon = s.kind === 'user' ? User : Users;
            return (
              <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                <div className="num w-8 h-8 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <KindIcon className="w-3.5 h-3.5" />
                      {s.kind === 'user' ? t('settings.workflows.user') : t('settings.workflows.role')}
                    </span>
                    {s.sla && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t('settings.workflows.sla', { h: s.sla })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {i < wf.steps.length - 1 && <ArrowDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                <button className="btn-sm w-9 h-9 rounded-lg hover:bg-white text-gray-400 hover:text-gray-700 flex items-center justify-center" aria-label={t('settings.workflows.remove_step')}>
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
          <li>
            <button className="btn-sm w-full rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-600 hover:text-brand-700 font-medium flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              {t('settings.workflows.add_step')}
            </button>
          </li>
        </ol>
      </div>
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState('');
  const { t } = useT();
  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      () => peopleApi.listUsers(search.trim() || undefined),
      // Fallback shape: same as the API row, with department/role nulled
      // out so it renders cleanly.
      mockUsers.map<PeopleUser>((u) => ({
        id: u.email, email: u.email, full_name: u.name,
        is_active: u.active, department: u.dept, role: u.role,
      })),
    ),
    [search],
  );

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-gray-50 rounded-xl px-3 min-h-[44px]">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('settings.users.search')}
            className="flex-1 bg-transparent border-none outline-none focus:outline-none !min-h-0 h-11"
          />
        </div>
        <button className="btn-sm rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          {t('settings.users.add')}
        </button>
      </div>
      {error && <div className="p-5"><ErrorBanner message={error.message} onRetry={refresh} /></div>}
      {loading && !data && <Loading />}
      {data && (
        <div className="divide-y divide-gray-100">
          {data.map((u) => <UserRowItem key={u.id} u={u} onChanged={refresh} />)}
        </div>
      )}
    </div>
  );
}

function UserRowItem({ u, onChanged }: { u: PeopleUser; onChanged: () => void }) {
  const { t } = useT();
  async function toggleActive() {
    try {
      await peopleApi.setActive(u.id, !u.is_active);
      onChanged();
    } catch { /* surface via global error boundary */ }
  }
  return (
    <div className="p-4 sm:p-5 flex items-center gap-4 hover:bg-gray-50 transition">
      <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center flex-shrink-0">
        {u.full_name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold flex items-center gap-2 flex-wrap">
          {u.full_name}
          {!u.is_active && (
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{t('settings.users.inactive')}</span>
          )}
        </div>
        <div className="text-sm text-gray-500 truncate">{u.email}</div>
      </div>
      <div className="hidden sm:block text-sm">
        <div className="font-semibold">{u.role ?? '—'}</div>
        <div className="text-gray-500">{u.department ?? '—'}</div>
      </div>
      <button
        onClick={toggleActive}
        className="btn-sm rounded-lg hover:bg-gray-100 text-gray-500 px-3 text-sm font-medium"
      >
        {u.is_active ? t('settings.users.disable') : t('settings.users.enable')}
      </button>
    </div>
  );
}

function DepartmentsTab() {
  const { t } = useT();
  const { data, loading, error, refresh } = useResource(
    () => withMockFallback(
      () => peopleApi.listDepartments(),
      mockDepartments.map<PeopleDepartment>((d) => ({
        id: d.cost_center, name: d.name, cost_center: d.cost_center, members: d.members,
      })),
    ),
  );

  if (error)            return <ErrorBanner message={error.message} onRetry={refresh} />;
  if (loading && !data) return <Loading />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {(data ?? []).map((d) => <DeptCard key={d.id} d={d} />)}
      <button className="bg-white rounded-2xl p-5 border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-600 hover:text-brand-700 font-bold flex items-center justify-center gap-2 min-h-[140px]">
        <Plus className="w-5 h-5" />
        {t('settings.depts.add')}
      </button>
    </div>
  );
}

function DeptCard({ d }: { d: PeopleDepartment }) {
  const { t } = useT();
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xl font-bold mb-0.5">{d.name}</div>
          <div className="num text-xs text-gray-500">{d.cost_center ?? '—'}</div>
        </div>
        <button className="btn-sm w-10 h-10 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center" aria-label={t('common.edit')}>
          <Pencil className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Users className="w-4 h-4 text-gray-400" />
          <strong className="num text-gray-900 font-semibold">{d.members}</strong> {t('settings.depts.members')}
        </div>
      </div>
    </div>
  );
}
