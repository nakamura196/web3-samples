import { getTranslations } from 'next-intl/server';
import { Link } from '@/samples/minisig/nav';
import { CHAIN_INFO, LINKS } from '@/samples/minisig/constants/site';

export default async function Footer() {
  const t = await getTranslations('minisig.Footer');
  const tCommon = await getTranslations('minisig.Common');
  const year = new Date().getFullYear();

  const linkCls =
    'text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400';

  return (
    <footer className="border-t border-gray-200 bg-gray-100 pb-8 pt-16 dark:border-gray-700 dark:bg-gray-800">
      <div className="container mx-auto px-4">
        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {tCommon('title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">{tCommon('description')}</p>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('quickLinks.title')}
            </h2>
            <ul className="space-y-2">
              <li><Link href="/app" className={linkCls}>{t('quickLinks.minisig')}</Link></li>
              <li><Link href="/api-docs" className={linkCls}>{t('quickLinks.api')}</Link></li>
              <li><Link href="/about" className={linkCls}>{t('quickLinks.about')}</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('resources.title')}
            </h2>
            <ul className="space-y-2">
              <li className="text-gray-600 dark:text-gray-300">
                {CHAIN_INFO.name} · {CHAIN_INFO.chainId}
              </li>
              <li><a href={CHAIN_INFO.explorer} target="_blank" rel="noreferrer" className={linkCls}>{t('resources.explorer')}</a></li>
              <li><a href={CHAIN_INFO.faucet} target="_blank" rel="noreferrer" className={linkCls}>{t('resources.faucet')}</a></li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('links.title')}
            </h2>
            <ul className="space-y-2">
              <li><a href={LINKS.foundry} target="_blank" rel="noreferrer" className={linkCls}>Foundry</a></li>
              <li><a href={LINKS.viem} target="_blank" rel="noreferrer" className={linkCls}>viem</a></li>
              <li><a href={LINKS.opennext} target="_blank" rel="noreferrer" className={linkCls}>OpenNext</a></li>
              <li><a href={LINKS.safe} target="_blank" rel="noreferrer" className={linkCls}>Safe</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8 dark:border-gray-700">
          <p className="text-center text-gray-600 dark:text-gray-300">{t('copyright', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
