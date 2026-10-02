'use client';

import { useSyncExternalStore } from 'react';

// Nothing to subscribe to: the value flips once, when React hydrates.
const noSubscribe = () => () => {};

/**
 * False while rendering on the server, true afterwards. Wallet state only exists
 * in the browser, so any UI that depends on it must render its neutral form first
 * or React will report a hydration mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true, // client
    () => false // server
  );
}
