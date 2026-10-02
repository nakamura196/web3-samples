import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import SamplesBar from '@/components/SamplesBar';
import Header from '@/samples/chain-lens/components/layout/Header';
import Footer from '@/samples/chain-lens/components/layout/Footer';
import { getMetadata } from '@/samples/chain-lens/constants/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  return getMetadata(activeLocale);
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
    <>
      <SamplesBar />
      <Header />
      {children}
      <Footer />
    </>
  );
}
