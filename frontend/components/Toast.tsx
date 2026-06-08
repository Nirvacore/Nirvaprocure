'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/provider';

type ToastKind = 'ok' | 'warn' | 'err';

interface ToastBase {
  id: number;
  msg: string;
  kind: ToastKind;
}
interface UndoToast extends ToastBase {
  undo: () => void;
  undoLabel: string;
}
type Toast = ToastBase | UndoToast;

interface ToastCtx {
  toast: (msg: string, kind?: ToastKind) => void;
  toastUndo: (msg: string, undo: () => void, undoLabel?: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside <ToastProvider>');
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { t } = useT();

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => dismiss(id), 2400);
  }, [dismiss]);

  const toastUndo = useCallback((msg: string, undo: () => void, undoLabel?: string) => {
    const id = Date.now() + Math.random();
    const label = undoLabel ?? t('common.undo');
    setToasts((t) => [...t, { id, msg, kind: 'ok', undo, undoLabel: label }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss, t]);

  return (
    <Ctx.Provider value={{ toast, toastUndo }}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center">
        {toasts.map((t) => (
          <ToastBubble key={t.id} t={t} onUndo={() => { (t as UndoToast).undo(); dismiss(t.id); }} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastBubble({ t, onUndo }: { t: Toast; onUndo: () => void }) {
  const palette = t.kind === 'warn' ? 'bg-amber-500 text-white'
    : t.kind === 'err'  ? 'bg-red-600 text-white'
    : 'bg-gray-900 text-white';
  return (
    <div className={`pointer-events-auto mb-3 px-5 py-3 rounded-xl ${palette} shadow-lift flex items-center gap-4 max-w-md animate-[fadeIn_200ms_ease-out]`}>
      <span className="font-medium">{t.msg}</span>
      {'undo' in t && (
        <button onClick={onUndo} className="min-h-[44px] px-4 rounded-lg bg-white text-gray-900 font-bold">
          {(t as UndoToast).undoLabel}
        </button>
      )}
    </div>
  );
}
