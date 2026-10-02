import { useTranslations } from 'next-intl';

import { Link } from '@/samples/minisig/nav';
import { ToggleLanguage } from '@/samples/minisig/components/layout/ToggleLanguage';
import { ToggleTheme } from '@/samples/minisig/components/layout/ToggleTheme';

const Header = () => {
  const tCommon = useTranslations('minisig.Common');
  const tNav = useTranslations('minisig.Nav');

  const nav = [
    { href: '/app', label: tNav('minisig') },
    { href: '/api-docs', label: tNav('api') },
    { href: '/about', label: tNav('about') },
  ];

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
      <div className="flex min-w-0 items-center gap-4 sm:gap-6">
        <Link href="/" className="shrink-0 transition-opacity hover:opacity-80">
          <span className="text-lg font-bold leading-none text-gray-900 dark:text-gray-100 sm:text-xl">
            {tCommon('title')}
          </span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm sm:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <ToggleTheme />
        <ToggleLanguage />
      </div>
    </header>
  );
};

export default Header;
