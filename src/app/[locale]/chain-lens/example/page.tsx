import { routing } from '@/samples/chain-lens/nav';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import PageLayout from '@/samples/chain-lens/components/layout/PageLayout';
import ExampleContent from '@/samples/chain-lens/components/page/example/ExampleContent';
import { getPageMetadata } from '@/samples/chain-lens/constants/metadata';
import { hasLocale } from 'next-intl';
import type { Metadata } from 'next';

// SSR対応
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: activeLocale, namespace: 'chain-lens.Example' });
  return getPageMetadata(activeLocale, {
    title: t('title'),
    description: t('description'),
  });
}

export default async function ExamplePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  
  const t = await getTranslations('chain-lens.Example');
  const breadcrumbItems = [{ title: t('title') }];

  return (
    <PageLayout 
      breadcrumbItems={breadcrumbItems} 
      title={t('title')}
      description={t('description')}
    >
      <ExampleContent />
    </PageLayout>
  );
}