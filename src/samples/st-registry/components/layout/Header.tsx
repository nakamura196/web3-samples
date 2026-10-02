import { useTranslations } from 'next-intl';

import { Link } from '@/samples/st-registry/nav';
import { ToggleLanguage } from '@/samples/st-registry/components/layout/ToggleLanguage';
import { ToggleTheme } from '@/samples/st-registry/components/layout/ToggleTheme';

const Header = () => {
  const tCommon = useTranslations('st-registry.Common');
  return (
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 sm:px-6 justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        <Link href="/" className="hover:opacity-80 transition-opacity shrink-0 flex items-center">
          <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">
            {tCommon('title')}
          </span>
        </Link>
        <Link
          href="/survey"
          className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"
        >
          {tCommon('survey')}
        </Link>
        <Link
          href="/vocabulary"
          className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"
        >
          {tCommon('vocab')}
        </Link>
        <Link
          href="/onchain"
          className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"
        >
          {tCommon('onchain')}
        </Link>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4">
        <ToggleTheme />
        <ToggleLanguage />
      </div>
    </header>
  );
};

export default Header;
