'use client';
import { useEffect, useState } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { pr as prApi, ApiError } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';
import { useT } from '@/lib/i18n/provider';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string;
}

/**
 * Thread on the PR detail page. Loads existing comments on mount, lets
 * the caller post a new one. Posts are optimistic: we prepend the comment
 * to the list immediately with a temp id, then reconcile when the server
 * returns the canonical row.
 */
export function PrComments({ prId }: { prId: string }) {
  const { user }    = useAuth();
  const { toast }   = useToast();
  const { t, locale } = useT();
  const [items, setItems]   = useState<Comment[] | null>(null);
  const [draft, setDraft]   = useState('');
  const [sending, setSend]  = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await prApi.listComments(prId);
        if (!cancelled) setItems(list);
      } catch (err) {
        if (!cancelled) {
          // Empty list on read failure — we don't want one broken read to
          // block the user from posting a new comment.
          setItems([]);
          if (err instanceof ApiError) setError(err.message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [prId]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    // Optimistic insert: prepend with a temp id so the user sees their
    // message immediately. On failure we remove it and restore the textarea.
    const tempId = `temp-${Date.now()}`;
    const temp: Comment = {
      id: tempId,
      body: text,
      created_at: new Date().toISOString(),
      author_id: user?.id ?? '',
      author_name: user?.full_name ?? user?.email ?? 'You',
    };
    setItems((cur) => (cur ? [...cur, temp] : [temp]));
    setDraft('');
    setSend(true);
    try {
      const saved = await prApi.addComment(prId, text);
      setItems((cur) => (cur ?? []).map((c) => (c.id === tempId ? saved : c)));
    } catch (err) {
      setItems((cur) => (cur ?? []).filter((c) => c.id !== tempId));
      setDraft(text);
      toast(err instanceof ApiError ? err.message : t('comments.failed'), 'err');
    } finally {
      setSend(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Cmd/Ctrl+Enter sends — common chat pattern.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="card">
      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-gray-400" />
        {t('comments.title')}
        {items && <span className="text-sm text-gray-500 num">({items.length})</span>}
      </h3>

      {items === null && (
        <div className="flex items-center justify-center py-6 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('common.loading')}
        </div>
      )}

      {items && items.length === 0 && (
        <p className="text-sm text-gray-500 py-2">{t('comments.empty')}</p>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
          {items.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                {c.author_name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">{c.author_name}</span>
                  <span className="text-xs text-gray-500 num">
                    {new Date(c.created_at).toLocaleString(locale, {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap leading-relaxed">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gray-100 pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={t('comments.placeholder')}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 outline-none resize-none text-sm"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            className="btn-primary btn-sm px-4 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t('common.send')}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-gray-400 mt-2">({t('comments.load_failed')}: {error})</p>}
    </div>
  );
}
