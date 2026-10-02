// Shared canonical site URL. Also consumed by app/sitemap.ts so both
// stay in sync. Set NEXT_PUBLIC_SITE_URL to your production origin.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const SITE_CONFIG = {
  name: {
    ja: 'Chain Lens — 取引を読んで学ぶ',
    en: 'Chain Lens — learn by reading transactions',
  },
  description: {
    ja: '実際にブロックチェーンに記録された取引を読み解き、何が公開され、何が暗号化され、何が載っていないのかを確かめる学習ツール。読むだけの範囲ではウォレットも秘密鍵も不要です。',
    en: 'A learning tool for reading real blockchain transactions: what is public, what is encrypted, and what was never written. The read-only parts need no wallet and no private key.',
  },
  url: `${SITE_URL}/chain-lens`,
  ogImage: {
    ja: '/assets/chain-lens/ogp-ja.svg',
    en: '/assets/chain-lens/ogp-en.svg',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@yoursite',
    creator: '@yourcreator',
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
      site: SITE_CONFIG.twitter.site,
      creator: SITE_CONFIG.twitter.creator,
      images: [ogImage],
    },
    alternates: {
      // localePrefix: 'as-needed' → the default locale (ja) is served unprefixed.
      // Per-page canonicals are intentionally left to each page; setting one here
      // would point every route at the site root.
      languages: {
        'ja': SITE_CONFIG.url,
        'en': `${SITE_URL}/en/chain-lens`,
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