import type { Chain } from 'viem';
import { anvil, baseSepolia, sepolia } from 'wagmi/chains';

// Next.js inlines `process.env.NEXT_PUBLIC_*` only at literal property accesses,
// so each chain is spelled out rather than built from a template string.
const CONFIGURED_ADDRESSES: Record<number, string | undefined> = {
  [anvil.id]: process.env.NEXT_PUBLIC_TICTACTOE_ADDRESS_31337,
  [baseSepolia.id]: process.env.NEXT_PUBLIC_TICTACTOE_ADDRESS_84532,
  [sepolia.id]: process.env.NEXT_PUBLIC_TICTACTOE_ADDRESS_11155111,
};

// The practice contract is deployed separately: it holds no funds and shares no
// state with the staking one.
const SOLO_ADDRESSES: Record<number, string | undefined> = {
  [anvil.id]: process.env.NEXT_PUBLIC_SOLO_ADDRESS_31337,
  [baseSepolia.id]: process.env.NEXT_PUBLIC_SOLO_ADDRESS_84532,
  [sepolia.id]: process.env.NEXT_PUBLIC_SOLO_ADDRESS_11155111,
};

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function validate(configured: string | undefined): `0x${string}` | undefined {
  if (!configured || !ADDRESS_PATTERN.test(configured)) return undefined;
  return configured as `0x${string}`;
}

/**
 * Testnets only, on purpose — mainnet is absent so a wallet pointed at the wrong
 * network cannot put real funds into a game.
 *
 * Beyond that, a chain is offered only when a contract address is configured for
 * it. Listing a chain with nothing deployed on it just lets people switch to a
 * dead end, and for the local Anvil chain it is actively harmful: wagmi falls
 * back to `chains[0]` whenever no wallet is connected, so a deployed page would
 * start issuing requests to http://127.0.0.1:8545, which Chrome interrupts with
 * a "this site wants to access other apps on your device" permission prompt.
 *
 * Order matters for the same reason — the first entry is what an unconnected
 * visitor talks to.
 */
const CANDIDATE_CHAINS = [sepolia, baseSepolia, anvil] as const;

const CONFIGURED_CHAINS = CANDIDATE_CHAINS.filter(
  (chain) => validate(CONFIGURED_ADDRESSES[chain.id]) !== undefined
);

// createConfig demands a non-empty tuple, and a build with nothing deployed
// anywhere still has to compile. Sepolia is the harmless stand-in.
export const SUPPORTED_CHAINS: readonly [Chain, ...Chain[]] =
  CONFIGURED_CHAINS.length > 0 ? (CONFIGURED_CHAINS as unknown as [Chain, ...Chain[]]) : [sepolia];

export type SupportedChainId = 84532 | 11155111 | 31337;

/** The staking (player-versus-player) contract for `chainId`. */
export function contractAddress(chainId: number | undefined): `0x${string}` | undefined {
  if (chainId === undefined) return undefined;
  return validate(CONFIGURED_ADDRESSES[chainId]);
}

/** The practice (versus-contract) contract for `chainId`. */
export function soloAddress(chainId: number | undefined): `0x${string}` | undefined {
  if (chainId === undefined) return undefined;
  return validate(SOLO_ADDRESSES[chainId]);
}

export function isSupportedChain(chainId: number | undefined): boolean {
  return SUPPORTED_CHAINS.some((chain) => chain.id === chainId);
}

export function chainLabel(chainId: number | undefined): string {
  return SUPPORTED_CHAINS.find((chain) => chain.id === chainId)?.name ?? `Chain ${chainId}`;
}

/** Chains that actually have a contract address configured. */
export function deployedChains() {
  return SUPPORTED_CHAINS.filter((chain) => contractAddress(chain.id) !== undefined);
}
