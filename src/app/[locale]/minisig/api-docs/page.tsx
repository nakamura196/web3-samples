import { routing } from '@/samples/minisig/nav';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import PageLayout from '@/samples/minisig/components/layout/PageLayout';
import { getPageMetadata } from '@/samples/minisig/constants/metadata';
import { DEPLOYMENTS } from '@/samples/minisig/constants/site';
import { Link } from '@/samples/minisig/nav';
import { OffChainFigure } from '@/samples/minisig/components/figures';
import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: l, namespace: 'minisig.Api' });
  return getPageMetadata(l, { title: t('title'), description: t('description') });
}

const ENDPOINTS = [
  { m: 'GET', p: '/api/minisig/{address}', k: 'e1' },
  { m: 'GET', p: '/api/minisig/{address}/proposals', k: 'e2' },
  { m: 'POST', p: '/api/minisig/{address}/proposals', k: 'e3' },
  { m: 'GET', p: '/api/minisig/{address}/proposals/{id}', k: 'e4' },
  { m: 'POST', p: '/api/minisig/{address}/proposals/{id}/signatures', k: 'e5' },
  { m: 'GET', p: '/api/minisig/{address}/proposals/{id}/calldata', k: 'e6' },
] as const;

export default async function ApiPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: l, namespace: 'minisig.Api' });

  const primary = DEPLOYMENTS.find((d) => d.primary)!.address;

  const curl = `# ${l === 'ja' ? 'コントラクトの状態' : 'contract state'}
curl -s https://minisig-app.na-kamura-1263.workers.dev/api/minisig/${primary}

# ${l === 'ja' ? '提案を作る' : 'create a proposal'}
curl -s -X POST https://minisig-app.na-kamura-1263.workers.dev/api/minisig/${primary}/proposals \\
  -H 'content-type: application/json' \\
  -d '{"to":"0x...","value":"100000000000000"}'

# ${l === 'ja' ? '署名を追加する（鍵はクライアント側）' : 'add a signature (the key stays client-side)'}
cast wallet sign --private-key <PK> <txHash>
curl -s -X POST .../proposals/<id>/signatures \\
  -H 'content-type: application/json' -d '{"signature":"0x..."}'

# ${l === 'ja' ? '送信用の calldata を受け取り、自分で送る' : 'fetch calldata, then broadcast it yourself'}
curl -s .../proposals/<id>/calldata`;

  return (
    <PageLayout title={t('title')} description={t('description')} breadcrumbItems={[{ title: t('title') }]}>
      <div className="max-w-3xl">
        <p className="mb-6 leading-relaxed text-gray-700 dark:text-gray-300">{t('intro')}</p>

        <OffChainFigure />

        <div className="mb-10 flex flex-wrap gap-3">
          <Link
            href="/api-docs/swagger"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {t('swaggerLink')}
          </Link>
          {/* API ルート（JSON を返す）なので next/link ではなく素の <a> が正しい */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/openapi"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {t('openapiLink')}
          </a>
        </div>

        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">{t('endpoints')}</h2>
        <div className="mb-10 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('method')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('path')}</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{t('desc')}</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.m + e.p} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                        e.m === 'GET'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}
                    >
                      {e.m}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200">{e.p}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t(e.k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">{t('example')}</h2>
        <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          <code>{curl}</code>
        </pre>
      </div>
    </PageLayout>
  );
}
