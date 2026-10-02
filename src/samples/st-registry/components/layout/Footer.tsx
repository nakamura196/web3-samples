import { getTranslations } from 'next-intl/server';

export default async function Footer() {
  const t = await getTranslations('st-registry.Footer');
  const tCommon = await getTranslations('st-registry.Common');
  return (
    <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
      <div className="container mx-auto px-4 py-8 text-sm text-gray-600 dark:text-gray-400 flex flex-col gap-2">
        <div className="font-semibold text-gray-900 dark:text-gray-100">{tCommon('title')}</div>
        <p className="max-w-2xl">{t('note')}</p>
        <p className="text-xs">UBC Blockchain Summer Institute 2026 / Day 8 · {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
