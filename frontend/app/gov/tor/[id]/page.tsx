'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Scale } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

/** Stub detail page — full TOR viewer ships in a later phase. */
export default function TorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();

  return (
    <section className="screen space-y-6 max-w-3xl mx-auto">
      <Link href="/gov/tor" className="btn-sm inline-flex items-center gap-2 text-ink-soft hover:text-ink -ml-2 px-2 rounded-lg">
        <ArrowLeft className="w-5 h-5" />
        <span>{t('tor.list.back')}</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Scale className="w-6 h-6 text-brand-600" />
          {t('tor.detail.stub')}
        </h1>
        <p className="text-ink-soft mt-2 num">{id}</p>
      </div>

      <div className="card text-ink-soft">
        {t('tor.detail.coming')}
      </div>
    </section>
  );
}
