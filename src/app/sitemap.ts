import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SAMPLES } from '@/samples';
import { SITE_URL } from '@/lib/site';

// 既定の言語 (ja) は接頭辞なし、それ以外は /en/... (localePrefix: 'as-needed')
const url = (locale: string, path: string) =>
  `${SITE_URL}${locale === routing.defaultLocale ? '' : `/${locale}`}${path}` || SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', ...SAMPLES.flatMap(({ slug, pages }) => pages.map((p) => `/${slug}${p}`))];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: url(locale, path),
      lastModified: new Date(),
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, url(l, path)])),
      },
    })),
  );
}
