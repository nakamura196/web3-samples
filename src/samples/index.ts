/**
 * サンプルの一覧。トップページ・sitemap・上部の帯がここを見る。
 * 部屋を足すときは、ここに 1 行と src/app/[locale]/<slug>/ を足す。
 */
export const SAMPLES = [
  { slug: 'minisig', pages: ['', '/app', '/api-docs', '/about'] },
  { slug: 'st-registry', pages: ['', '/survey', '/vocabulary', '/onchain'] },
  { slug: 'chain-lens', pages: ['', '/inspect', '/example', '/about'] },
  { slug: 'tictactoe', pages: ['', '/play', '/play/solo', '/play/history', '/about'] },
] as const;

export type SampleSlug = (typeof SAMPLES)[number]['slug'];
