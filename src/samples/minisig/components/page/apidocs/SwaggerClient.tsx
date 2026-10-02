'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => unknown;
  }
}

/**
 * Swagger UI を自前配信の資産から読み込む。
 *
 * swagger-ui-react は React 19 との相性が悪く、依存も重い。
 * Swagger UI 本体はフレームワーク非依存で単体で動くので、
 * `public/swagger/` に置いた dist を script タグで読むだけにしている。
 * CDN を使っていないので外部への依存も無い。
 */
export default function SwaggerClient({ specUrl }: { specUrl: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/swagger/swagger-ui.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = '/swagger/swagger-ui-bundle.js';
    script.onload = () => {
      window.SwaggerUIBundle?.({
        url: specUrl,
        dom_id: '#swagger-ui',
        deepLinking: true,
        tryItOutEnabled: true,
        defaultModelsExpandDepth: 0,
      });
    };
    script.onerror = () => setFailed(true);
    document.body.appendChild(script);

    return () => {
      css.remove();
      script.remove();
    };
  }, [specUrl]);

  if (failed) {
    return (
      <p className="rounded-lg border border-red-400 px-4 py-3 text-sm text-red-600 dark:text-red-400">
        Swagger UI を読み込めませんでした。<code>{specUrl}</code> は直接開けます。
      </p>
    );
  }

  // Swagger UI 自体はライトテーマ固定なので、白地の器に入れて可読性を保つ
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700">
      <div id="swagger-ui" />
    </div>
  );
}
