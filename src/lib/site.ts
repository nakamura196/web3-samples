// 公開する URL。sitemap と各部屋の metadata が使う。本番は wrangler.jsonc の vars で与える
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
