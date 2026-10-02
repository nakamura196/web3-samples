import { useTranslations } from 'next-intl';

import { Link } from '@/samples/tictactoe/nav';
import { ToggleLanguage } from '@/samples/tictactoe/components/layout/ToggleLanguage';
import { ToggleTheme } from '@/samples/tictactoe/components/layout/ToggleTheme';

const Header = () => {
  const tCommon = useTranslations('tictactoe.Common');
  const t = useTranslations('tictactoe.Header');

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center transition-opacity hover:opacity-80">
          <span className="text-lg font-bold leading-none text-gray-900 dark:text-gray-100 sm:text-xl">
            {tCommon('title')}
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          <Link
            href="/play"
            className="text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            {t('play')}
          </Link>
          <Link
            href="/play/history"
            className="text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            {t('history')}
          </Link>
          <Link
            href="/play/solo"
            className="text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            {t('solo')}
          </Link>
          <Link
            href="/about"
            className="text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            {t('about')}
          </Link>
        </nav>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4">
        <ToggleTheme />
        <ToggleLanguage />
      </div>
    </header>
  );
};

export default Header;
