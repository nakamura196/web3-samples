// Shared canonical site URL. Also consumed by app/sitemap.ts so both
// stay in sync. Set NEXT_PUBLIC_SITE_URL to your production origin.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const SITE_CONFIG = {
  name: {
    ja: 'オンチェーン まるばつ',
    en: 'On-chain Tic-Tac-Toe',
  },
  description: {
    ja: 'スマートコントラクトだけで動くまるばつゲーム。盤面も勝敗判定も賭け金の預かりもチェーン上にあり、サーバもデータベースもありません。テストネット専用です。',
    en: 'A tic-tac-toe game that runs entirely in a smart contract. The board, the win check and the escrowed stakes all live on chain — no server, no database. Testnets only.',
  },
  url: `${SITE_URL}/tictactoe`,
  ogImage: {
    ja: '/assets/tictactoe/ogp-ja.svg',
    en: '/assets/tictactoe/ogp-en.svg',
  },
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
    metadataBase: new URL(SITE_URL),
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
        'en': `${SITE_URL}/en/tictactoe`,
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