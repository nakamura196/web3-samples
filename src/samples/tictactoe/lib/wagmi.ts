import { createConfig, http, type Transport } from 'wagmi';
import { anvil, baseSepolia, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

import { SUPPORTED_CHAINS } from '@/samples/tictactoe/lib/chains';

/**
 * A transport for each offered chain, and only those. Registering one for a
 * chain that is not on the list would let wagmi dial it — which for the local
 * node means a deployed page reaching for 127.0.0.1.
 */
const ENDPOINTS: Record<number, string | undefined> = {
  [anvil.id]: 'http://127.0.0.1:8545',
  [baseSepolia.id]: process.env.NEXT_PUBLIC_RPC_URL_84532 || undefined,
  // viem's default Sepolia endpoint rate-limits quickly; this public one has
  // held up better. Override it with your own if you hit limits.
  [sepolia.id]:
    process.env.NEXT_PUBLIC_RPC_URL_11155111 || 'https://ethereum-sepolia-rpc.publicnode.com',
};

const transports: Record<number, Transport> = Object.fromEntries(
  SUPPORTED_CHAINS.map((chain) => [chain.id, http(ENDPOINTS[chain.id])])
);

// A single module-level config: wagmi keeps connection state inside it, so
// re-creating it on every render would drop the wallet connection.
export const config = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors: [injected()],
  // Renders correctly on the server, then rehydrates the wallet state on the client.
  ssr: true,
  transports,
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
