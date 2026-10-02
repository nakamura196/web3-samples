import type { Chain } from 'viem';
import { numberToHex } from 'viem';

/** The slice of EIP-1193 we need. */
type Eip1193Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

export function isEip1193Provider(value: unknown): value is Eip1193Provider {
  return typeof (value as Eip1193Provider | undefined)?.request === 'function';
}

/**
 * Ask the wallet to register a network it does not know yet (EIP-3085), then
 * switch to it. `switchChain` alone fails with "unrecognized chain" for anything
 * the wallet has never seen — a local Anvil node, most of the time.
 *
 * MetaMask shows its own confirmation dialog; there is no way to add a network
 * without the user agreeing to it.
 */
export async function addChainToWallet(provider: unknown, chain: Chain): Promise<void> {
  if (!isEip1193Provider(provider)) {
    throw new Error('This wallet does not expose an EIP-1193 provider.');
  }

  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId: numberToHex(chain.id),
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: [...chain.rpcUrls.default.http],
        ...(chain.blockExplorers?.default
          ? { blockExplorerUrls: [chain.blockExplorers.default.url] }
          : {}),
      },
    ],
  });
}
