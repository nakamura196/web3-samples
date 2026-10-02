import { getTranslations } from 'next-intl/server';
import { Link } from '@/samples/chain-lens/nav';
import { SAMPLES, EXPLORERS, BOOK_URL } from '@/samples/chain-lens/constants/samples';

export default async function Footer() {
  const t = await getTranslations('chain-lens.Footer');
  const tCommon = await getTranslations('chain-lens.Common');
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-100 dark:bg-gray-800 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* About Column */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {tCommon('title')}
            </h2>
            <div className="text-gray-600 dark:text-gray-300 mb-4">{tCommon('description')}</div>
          </div>

          {/* Quick Links Column */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('quickLinks.title')}
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/inspect"
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {t('quickLinks.inspect')}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {t('quickLinks.about')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('resources.title')}
            </h2>
            <ul className="space-y-2">
              {SAMPLES.map((sample) => (
                <li key={sample.hash}>
                  <Link
                    href={{ pathname: '/inspect', query: { tx: sample.hash } }}
                    className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {t(`resources.${sample.key}`)}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={BOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {t('resources.book')}
                </a>
              </li>
            </ul>
          </div>

          {/* Links Column */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('links.title')}
            </h2>
            <ul className="space-y-2">
              {EXPLORERS.map((e) => (
                <li key={e.name}>
                  <a
                    href={e.tx(SAMPLES[0].hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {e.name}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="https://ethereum.org/developers/docs/accounts/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  ethereum.org
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-center items-center">
            <p className="text-gray-600 dark:text-gray-300">{t('copyright', { year })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
