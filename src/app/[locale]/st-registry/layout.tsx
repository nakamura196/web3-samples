import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import SamplesBar from '@/components/SamplesBar';
import Header from '@/samples/st-registry/components/layout/Header';
import Footer from '@/samples/st-registry/components/layout/Footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: activeLocale, namespace: 'st-registry.HomePage' });
  return { title: t('title'), description: t('lead') };
}

/** 部屋の枠。元のアプリの layout からヘッダーとフッターを引き継ぐ */
export default function SampleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // 部屋の中のページも静的に作るため（next-intl は layout ごとに言語の指定が要る）
  setRequestLocale(use(params).locale);
  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col">
      <SamplesBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
