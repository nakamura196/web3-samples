// Shared canonical site URL. Also consumed by app/sitemap.ts so both
// stay in sync. Set NEXT_PUBLIC_SITE_URL to your production origin.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const SITE_CONFIG = {
  name: {
    ja: 'MiniSig',
    en: 'MiniSig',
  },
  description: {
    ja: 'マルチシグウォレットを一から作り、Base Sepolia 上で動かす教材サイト',
    en: 'A multisig wallet built from scratch, running on Base Sepolia',
  },
  url: `${SITE_URL}/minisig`,
  ogImage: {
    ja: '/assets/minisig/ogp-ja.svg',
    en: '/assets/minisig/ogp-en.svg',
  },
  // NOTE: 実在の X アカウントが決まったら site / creator を足す
  twitter: {
    card: 'summary_large_image',
  },
} as const;

export const getMetadata = (locale: 'ja' | 'en') => {
  const title = SITE_CONFIG.name[locale];
  const description = SITE_CONFIG.description[locale];
  const ogImage = SITE_CONFIG.ogImage[locale];

  return {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    metadataBase: new URL(SITE_CONFIG.url),
    openGraph: {
      title,
      description,
      url: SITE_CONFIG.url,
      siteName: title,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: SITE_CONFIG.twitter.card,
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      // localePrefix: 'as-needed' → the default locale (ja) is served unprefixed.
      // Per-page canonicals are intentionally left to each page; setting one here
      // would point every route at the site root.
      languages: {
        'ja': SITE_CONFIG.url,
        'en': `${SITE_URL}/en/minisig`,
        'x-default': SITE_CONFIG.url,
      },
    },
  };
};

export const getPageMetadata = (
  locale: 'ja' | 'en',
  page: {
    title: string;
    description?: string;
    ogImage?: string;
  }
) => {
  const siteTitle = SITE_CONFIG.name[locale];
  const defaultDescription = SITE_CONFIG.description[locale];
  const defaultOgImage = SITE_CONFIG.ogImage[locale];

  return {
    title: `${page.title} | ${siteTitle}`,
    description: page.description || defaultDescription,
    openGraph: {
      title: `${page.title} | ${siteTitle}`,
      description: page.description || defaultDescription,
      images: [
        {
          url: page.ogImage || defaultOgImage,
          width: 1200,
          height: 630,
          alt: page.title,
        },
      ],
    },
    twitter: {
      card: SITE_CONFIG.twitter.card,
      title: `${page.title} | ${siteTitle}`,
      description: page.description || defaultDescription,
      images: [page.ogImage || defaultOgImage],
    },
  };
};