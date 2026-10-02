'use client';

/**
 * ブラウザ側の状態を読むための小さなフック。
 *
 * どちらも React の外にある状態なので useSyncExternalStore で読む。
 * useEffect の中で setState すると、React 19 の規則
 * (react-hooks/set-state-in-effect) に引っかかるうえ、
 * 実際に描画が二度走って無駄でもある。
 */

import { useSyncExternalStore } from 'react';

/** OS の「動きを減らす」設定。true なら組み立ての演出を省く */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false, // サーバ側では判定できないので、動かす前提で描画する
  );
}

/** URL の #id。用語集へ直リンクで飛んできたときに使う */
export function useHash(): string {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('hashchange', onChange);
      return () => window.removeEventListener('hashchange', onChange);
    },
    () => decodeURIComponent(window.location.hash.replace(/^#/, '')),
    () => '',
  );
}
