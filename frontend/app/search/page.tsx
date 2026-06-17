'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, FileText, Building2 } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { useResource } from '@/lib/use-resource';
import { withMockFallback } from '@/lib/api-with-fallback';
import { pr as prApi, suppliers as suppliersApi, type PrSummary, type SupplierRow } from '@/lib/api';
import { mockPrs } from '@/lib/mock-data';
import { StatusPill, type PrStatus } from '@/components/StatusPill';
import { Loading } from '@/components/Loading';
import { fmtBaht } from '@/lib/format';

const MOCK_SUPPLIERS: SupplierRow[] = [
  { id: 'sup-1', code: 'SUP-001', name: 'HP Authorized Store Thailand', contact_name: 'คุณวิภา', contact_email: 'sales@hp-th.co.th', contact_phone: '02-111-2222', category: 'IT', tax_id: '0105555000001', is_active: true, risk_tier: 'low', total_pr_count: 12, total_spent_minor: 180000_00, created_at: '2026-01-10' },
  { id: 'sup-2', code: 'SUP-002', name: 'บริษัท แม็คโคร จำกัด', contact_name: 'คุณสมชาย', contact_email: 'b2b@makro.co.th', contact_phone: '02-222-3333', category: 'อาหาร', tax_id: '0105555000002', is_active: true, risk_tier: 'low', total_pr_count: 28, total_spent_minor: 540000_00, created_at: '2026-01-05' },
  { id: 'sup-3', code: 'SUP-003', name: 'ร้านเครื่องเขียนสยาม', contact_name: null, contact_email: null, contact_phone: '02-333-4444', category: 'สำนักงาน', tax_id: null, is_active: true, risk_tier: 'medium', total_pr_count: 5, total_spent_minor: 24000_00, created_at: '2026-02-01' },
];

function toPrSummary(p: typeof mockPrs[number]): PrSummary {
  return {
    id: p.id,
    pr_number: p.pr_number,
    title: p.title,
    status: p.status,
    requester_id: 'user-1',
    department_id: 'dept-1',
    total: { amount_minor: p.total_minor, currency: 'THB' },
    submitted_at: '2026-06-01',
    created_at: p.created_at,
  };
}

const MOCK_PRS = mockPrs.map(toPrSummary);

interface SearchResults {
  prs: PrSummary[];
  suppliers: SupplierRow[];
}

function filterResults(q: string, prs: PrSummary[], suppliers: SupplierRow[]): SearchResults {
  const needle = q.toLowerCase();
  return {
    prs: prs
      .filter(p => p.title.toLowerCase().includes(needle) || p.pr_number.toLowerCase().includes(needle))
      .slice(0, 5),
    suppliers: suppliers
      .filter(s => s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle))
      .slice(0, 5),
  };
}

export default function SearchPage() {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(id);
  }, [query]);

  const { data, loading } = useResource(
    async () => {
      if (debounced.length < 2) return { prs: [], suppliers: [] };
      const [prRes, supplierRows] = await Promise.all([
        withMockFallback(() => prApi.list({ limit: 50 }), { data: MOCK_PRS, next_cursor: null }),
        withMockFallback(() => suppliersApi.list(), MOCK_SUPPLIERS),
      ]);
      return filterResults(debounced, prRes.data, supplierRows);
    },
    [debounced],
  );

  const results = data ?? { prs: [], suppliers: [] };
  const hasSearched = debounced.length >= 2;
  const total = results.prs.length + results.suppliers.length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          className="input pl-12 pr-12 py-3 text-base"
          placeholder={t('search.hint')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label={t('search.hint')}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
            aria-label={t('common.cancel')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading && hasSearched ? (
        <Loading />
      ) : !hasSearched ? (
        <div className="text-center py-16 text-gray-500">
          <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">{t('search.empty')}</p>
          <p className="text-sm mt-1">{t('search.empty_sub')}</p>
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium text-gray-700">{t('search.no_result')}</p>
          <p className="text-sm mt-1 text-gray-400">&ldquo;{debounced}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-8">
          {results.prs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('search.section.prs')}
                <span className="text-gray-400 font-normal">({results.prs.length})</span>
              </h2>
              <div className="space-y-2">
                {results.prs.map(pr => (
                  <Link
                    key={pr.id}
                    href={`/pr/${pr.id}`}
                    className="card hover:border-brand-300 transition-colors flex items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-gray-900">{pr.pr_number}</span>
                        <StatusPill status={pr.status as PrStatus} />
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5 truncate">{pr.title}</p>
                    </div>
                    <span className="num text-sm font-semibold text-gray-800 flex-shrink-0">
                      {fmtBaht(pr.total.amount_minor)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.suppliers.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {t('search.section.suppliers')}
                <span className="text-gray-400 font-normal">({results.suppliers.length})</span>
              </h2>
              <div className="space-y-2">
                {results.suppliers.map(s => (
                  <Link
                    key={s.id}
                    href={`/suppliers/${s.id}`}
                    className="card hover:border-brand-300 transition-colors flex items-center gap-3 py-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{s.code}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
