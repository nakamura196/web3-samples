import { anvil, baseSepolia, sepolia } from 'wagmi/chains';

export type Faucet = {
  name: string;
  url: string;
  /** What the faucet demands before it will pay out. */
  requires: 'nothing' | 'account' | 'phone' | 'mainnetBalance' | 'localScript';
};

/**
 * Ordered by how much they ask of you, cheapest first. A visitor with an empty
 * wallet cannot do anything on this site, so the least demanding option should
 * be the one they see first.
 */
export const FAUCETS: Record<number, Faucet[]> = {
  [sepolia.id]: [
    { name: 'pk910 PoW Faucet', url: 'https://sepolia-faucet.pk910.de', requires: 'nothing' },
    {
      name: 'Google Cloud Web3',
      url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
      requires: 'account',
    },
    { name: 'Alchemy', url: 'https://www.alchemy.com/faucets/ethereum-sepolia', requires: 'mainnetBalance' },
  ],
  [baseSepolia.id]: [
    { name: 'Alchemy', url: 'https://www.alchemy.com/faucets/base-sepolia', requires: 'mainnetBalance' },
    { name: 'Coinbase Developer Platform', url: 'https://portal.cdp.coinbase.com/products/faucet', requires: 'phone' },
    // Bridging Sepolia ether across is often easier than finding a Base faucet.
    { name: 'Superbridge (Sepolia → Base Sepolia)', url: 'https://superbridge.app', requires: 'nothing' },
  ],
  [anvil.id]: [
    { name: './scripts/fund.zsh <your address>', url: '', requires: 'localScript' },
  ],
};

export function faucetsFor(chainId: number | undefined): Faucet[] {
  return chainId === undefined ? [] : (FAUCETS[chainId] ?? []);
}
