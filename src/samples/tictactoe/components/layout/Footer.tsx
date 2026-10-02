import { getTranslations } from 'next-intl/server';

import { Link } from '@/samples/tictactoe/nav';

const EXTERNAL_LINKS = [
  { label: 'Foundry', href: 'https://getfoundry.sh' },
  { label: 'wagmi', href: 'https://wagmi.sh' },
  { label: 'viem', href: 'https://viem.sh' },
  { label: 'Next.js', href: 'https://nextjs.org' },
];

const linkClass =
  'text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400';

export default async function Footer() {
  const t = await getTranslations('tictactoe.Footer');
  const tCommon = await getTranslations('tictactoe.Common');
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-100 pb-8 pt-16 dark:bg-gray-800">
      <div className="container mx-auto px-4">
        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {tCommon('title')}
            </h2>
            <p className="mb-4 text-gray-600 dark:text-gray-300">{tCommon('description')}</p>
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {t('testnetNotice')}
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('quickLinks.title')}
            </h2>
            <ul className="space-y-2">
              <li>
                <Link href="/play" className={linkClass}>
                  {t('quickLinks.play')}
                </Link>
              </li>
              <li>
                <Link href="/play/history" className={linkClass}>
                  {t('quickLinks.history')}
                </Link>
              </li>
              <li>
                <Link href="/play/solo" className={linkClass}>
                  {t('quickLinks.solo')}
                </Link>
              </li>
              <li>
                <Link href="/about" className={linkClass}>
                  {t('quickLinks.about')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('links.title')}
            </h2>
            <ul className="space-y-2">
              {EXTERNAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8 dark:border-gray-700">
          <div className="flex items-center justify-center">
            <p className="text-gray-600 dark:text-gray-300">{t('copyright', { year })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
