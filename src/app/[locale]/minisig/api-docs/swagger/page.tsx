import { routing } from '@/samples/minisig/nav';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import PageLayout from '@/samples/minisig/components/layout/PageLayout';
import { getPageMetadata } from '@/samples/minisig/constants/metadata';
import SwaggerClient from '@/samples/minisig/components/page/apidocs/SwaggerClient';
import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: l, namespace: 'minisig.Api' });
  return getPageMetadata(l, { title: t('swaggerTitle'), description: t('description') });
}

export default async function SwaggerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: l, namespace: 'minisig.Api' });

  return (
    <PageLayout
      title={t('swaggerTitle')}
      description={t('swaggerDesc')}
      breadcrumbItems={[{ title: t('title'), href: '/api-docs' }, { title: 'Swagger UI' }]}
      fluid
    >
      <SwaggerClient specUrl="/api/openapi" />
    </PageLayout>
  );
}
