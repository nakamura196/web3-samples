import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * next-intl のロケール振り分け。
 *
 * テンプレート本体は Next.js 16 の `proxy.ts` を使っているが、
 * **proxy は必ず Node.js ランタイムで動き、@opennextjs/cloudflare が未対応**のため、
 * Cloudflare Workers にデプロイできない（"Node.js middleware is not currently supported"）。
 *   - https://github.com/opennextjs/opennextjs-cloudflare/issues/962
 *   - https://github.com/cloudflare/workers-sdk/issues/13937
 *
 * そこで Edge ランタイムで動く従来の `middleware.ts` に戻している。
 * OpenNext が proxy に対応したら `proxy.ts` へ戻すこと。
 */
export default createMiddleware(routing);

export const config = {
  /*
   * 静的ファイルと API ルートは対象外。
   *
   * 注意: `(?!api|...)` と書くと **`/api-docs` の先頭 `api` にも一致**してしまい、
   * ページがロケール振り分けから外れて 404 になる（実際になった）。
   * 除外したいのは `/api/` 配下だけなので、必ず末尾のスラッシュまで含めること。
   */
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
};
