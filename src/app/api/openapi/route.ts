import { openapi } from '@/samples/minisig/lib/openapi';

/** GET /api/openapi — OpenAPI 3.1 の定義 */
export function GET() {
  return Response.json(openapi, {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
