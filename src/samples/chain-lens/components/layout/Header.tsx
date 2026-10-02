import { useTranslations } from 'next-intl';

import { Link } from '@/samples/chain-lens/nav';
import { ToggleLanguage } from '@/samples/chain-lens/components/layout/ToggleLanguage';
import { ToggleTheme } from '@/samples/chain-lens/components/layout/ToggleTheme';

const Header = () => {
  const tCommon = useTranslations('chain-lens.Common');
  return (
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 sm:px-6 justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        <Link href="/" className="hover:opacity-80 transition-opacity shrink-0 flex items-center min-w-0">
          <span className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-none truncate">
            {tCommon('title')}
          </span>
        </Link>
        <nav className="shrink-0">
          <Link
            href="/inspect"
            className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
          >
            {tCommon('inspect')}
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
