'use client';

import { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { config } from '@/samples/tictactoe/lib/wagmi';

/**
 * wagmi needs React context, so it has to live in a client component. Children
 * are passed through as a prop, which lets the pages below stay server components.
 */
export default function Web3Provider({ children }: { children: React.ReactNode }) {
  // Created once per browser session — a new QueryClient on every render would
  // throw away every cached contract read.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Chain state changes on its own, so a short stale time keeps the
            // board close to reality without hammering the RPC endpoint.
            staleTime: 2_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
