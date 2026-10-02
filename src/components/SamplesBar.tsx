import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/** 部屋の上に置く細い帯。サンプル集のトップへ戻る入口 */
export default function SamplesBar() {
  const t = useTranslations('Portal');
  return (
    <div className="bg-gray-900 text-gray-300 text-xs px-3 sm:px-6 py-1.5">
      <Link href="/" className="hover:text-white transition-colors">
        ← {t('back')}
      </Link>
    </div>
  );
}
