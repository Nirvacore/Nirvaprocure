'use client';
import { useEffect, useState } from 'react';
import { X, Loader2, Plus, ArrowUp, ArrowDown, Trash2, GitBranch } from 'lucide-react';
import { workflows as workflowsApi, type WorkflowWire, type WorkflowStepWire, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useT } from '@/lib/i18n/provider';

interface Props {
  open:        boolean;
  workflow:    WorkflowWire | null;     // null = create new
  onClose:     () => void;
  onSaved:     () => void;
}

/**
 * Visual editor for one workflow (and its steps). Implementation choices:
 *
 *   - Steps live in local state; we only PATCH on Save. Less round-trips,
 *     simpler conflict story. Server's atomic step-replace handles the rest.
 *   - Min/max amount displayed in baht (UI) but stored as satang (wire).
 *   - We don't expose `approver_kind: 'manager_of_requester'` in the UI yet
 *     because the resolver isn't wired in ApprovalsService. Kind defaults
 *     to 'user' with a UUID approver_ref.
 */
export function WorkflowEditor({ open, workflow, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const { t } = useT();
  const [name,    setName]    = useState('');
  const [minBaht, setMinBaht] = useState('');
  const [maxBaht, setMaxBaht] = useState('');
  const [active,  setActive]  = useState(true);
  const [steps,   setSteps]   = useState<WorkflowStepWire[]>([]);
  const [busy,    setBusy]    = useState(false);

  // Reset local state every time we open the modal with a different
  // workflow. Without this we'd carry over the previous edit.
  useEffect(() => {
    if (!open) return;
    setName(workflow?.name ?? '');
    setMinBaht(workflow?.match_rules?.min_amount_minor != null
      ? String(Number(workflow.match_rules.min_amount_minor) / 100) : '');
    setMaxBaht(workflow?.match_rules?.max_amount_minor != null
      ? String(Number(workflow.match_rules.max_amount_minor) / 100) : '');
    setActive(workflow?.is_active ?? true);
    setSteps(workflow?.steps ?? [{ step_no: 1, approver_kind: 'user', approver_ref: '', sla_hours: 24 }]);
  }, [open, workflow]);

  if (!open) return null;

  function moveStep(idx: number, delta: number) {
    const next = [...steps];
    const t    = idx + delta;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    setSteps(next.map((s, i) => ({ ...s, step_no: i + 1 })));
  }
  function addStep() {
    setSteps((s) => [...s, { step_no: s.length + 1, approver_kind: 'user', approver_ref: '', sla_hours: 24 }]);
  }
  function removeStep(idx: number) {
    setSteps((s) => s.filter((_, i) => i !== idx).map((x, i) => ({ ...x, step_no: i + 1 })));
  }
  function patchStep(idx: number, patch: Partial<WorkflowStepWire>) {
    setSteps((s) => s.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  async function save() {
    if (!name.trim()) { toast(t('workflow.err.name'), 'warn'); return; }
    if (steps.length === 0) { toast(t('workflow.err.no_steps'), 'warn'); return; }
    if (steps.some((s) => !s.approver_ref.trim())) {
      toast(t('workflow.err.missing_ref'), 'warn'); return;
    }

    const match_rules: Record<string, unknown> = {};
    if (minBaht.trim()) match_rules.min_amount_minor = Math.round(Number(minBaht) * 100);
    if (maxBaht.trim()) match_rules.max_amount_minor = Math.round(Number(maxBaht) * 100);

    setBusy(true);
    try {
      if (workflow) {
        await workflowsApi.update(workflow.id, { name, match_rules, is_active: active, steps });
        toast(t('workflow.toast.saved'), 'ok');
      } else {
        await workflowsApi.create({ name, match_rules, is_active: active, steps });
        toast(t('workflow.toast.created'), 'ok');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : t('pr.new.toast.save_failed'), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-lift max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 sticky top-0 bg-white">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <GitBranch className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold flex-1">{workflow ? t('workflow.title.edit') : t('workflow.title.create')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="btn-sm w-10 h-10 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block font-semibold mb-2 text-sm">{t('workflow.name.label')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('workflow.name.placeholder')}
              className="w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-2 text-sm">{t('workflow.min.label')}</label>
              <input
                type="number"
                min={0}
                value={minBaht}
                onChange={(e) => setMinBaht(e.target.value)}
                placeholder="0"
                className="num w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2 text-sm">{t('workflow.max.label')}</label>
              <input
                type="number"
                min={0}
                value={maxBaht}
                onChange={(e) => setMaxBaht(e.target.value)}
                placeholder={t('workflow.max.placeholder')}
                className="num w-full px-4 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-5 h-5 rounded text-brand-600" />
            <span className="font-medium">{t('workflow.active.toggle')}</span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm">{t('settings.workflows.steps')}</span>
              <button onClick={addStep} className="btn-sm px-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium flex items-center gap-1">
                <Plus className="w-4 h-4" /> {t('common.add')}
              </button>
            </div>
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 p-3 rounded-xl bg-gray-50">
                  <div className="num w-8 h-8 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={s.approver_kind}
                      onChange={(e) => patchStep(i, { approver_kind: e.target.value as WorkflowStepWire['approver_kind'] })}
                      className="px-3 rounded-lg border-2 border-white bg-white focus:border-brand-500 outline-none text-sm"
                    >
                      <option value="user">{t('settings.workflows.user')}</option>
                      <option value="role">{t('settings.workflows.role')}</option>
                    </select>
                    <input
                      type="text"
                      value={s.approver_ref}
                      onChange={(e) => patchStep(i, { approver_ref: e.target.value })}
                      placeholder={s.approver_kind === 'user' ? t('workflow.ref.user') : t('workflow.ref.role')}
                      className="px-3 rounded-lg border-2 border-white bg-white focus:border-brand-500 outline-none text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={s.sla_hours ?? ''}
                      onChange={(e) => patchStep(i, { sla_hours: e.target.value ? Number(e.target.value) : null })}
                      placeholder={t('workflow.sla.placeholder')}
                      className="num px-3 rounded-lg border-2 border-white bg-white focus:border-brand-500 outline-none text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                      className="btn-sm w-8 h-8 rounded-lg hover:bg-white text-gray-500 disabled:opacity-30 flex items-center justify-center"
                      aria-label={t('common.up')}>
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                      className="btn-sm w-8 h-8 rounded-lg hover:bg-white text-gray-500 disabled:opacity-30 flex items-center justify-center"
                      aria-label={t('common.down')}>
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button onClick={() => removeStep(i)}
                    className="btn-sm w-8 h-8 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center"
                    aria-label={t('common.delete')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
