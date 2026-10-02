/**
 * チェーン設定。
 *
 * この試作はローカルの anvil だけで完結する。外部 RPC も、鍵も、資金も要らない。
 * ndl-witness の chains.mjs から Amoy とテスト用トークンの設定を落としてある
 * (対価を扱わないので ERC-20 が出てこない)。
 *
 * 公開テストネットに出す段になったら、鍵は .env.local に op:// 参照だけを書き、
 * op run で注入する。**anvil の既定アカウントは公開されている鍵**なので、
 * 公開チェーンでは使えない。
 */

export const CHAINS = {
  local: {
    key: 'local',
    name: 'ローカル (anvil)',
    chainId: 31337,
    testnet: true,
    native: 'ETH',
    envVar: 'LOCAL_RPC_URL',
    publicRpc: ['http://127.0.0.1:8548', 'http://127.0.0.1:8545'],
  },
  /**
   * **本物の Sepolia。** ここから先は公開チェーンで、取り消せない。
   *
   * フォーク (下の sepoliaFork) と **chainId が同じ 11155111** なので、
   * 署名済みのバイト列はどちらでも有効になる。手元のつもりで署名したものが
   * 公開チェーンで通ってしまうということなので、送信の直前に
   * 「どの RPC に送るか」を必ず表示して確かめる。
   *
   * ── 無料の公開 RPC の実測 (2026-08-26) ─────────────────────────
   * 索引を作るために eth_getLogs を使うと、無料枠の制限がそのまま効いてくる。
   *
   *   publicnode  1 回 50,000 ブロックまで。**アドレス指定が必須**
   *               (トピックだけの横断検索は拒否される)。150 回ほどで締め出し
   *   1rpc.io     1 回 **50 ブロック**まで。索引には使えない
   *   drpc.org    無料枠は 10,000 ブロックまで
   *
   * 送信 (eth_sendRawTransaction) だけなら publicnode で足りる。
   * 全体を舐める用途では、鍵付きの RPC か自前ノードが要る。
   */
  sepolia: {
    key: 'sepolia',
    name: 'Sepolia (公開テストネット)',
    chainId: 11155111,
    testnet: true,
    public: true,
    native: 'ETH',
    envVar: 'SEPOLIA_RPC_URL',
    publicRpc: ['https://ethereum-sepolia-rpc.publicnode.com'],
    explorer: 'https://sepolia.etherscan.io',
    faucet: 'https://sepoliafaucet.com',
  },
  /**
   * Sepolia を**フォークした** anvil。chainId は本物と同じ 11155111 になる。
   *
   * Ocean Protocol のコントラクトを試すため。自分で書き直した Ocean ではなく
   * **Sepolia に配置されている本物のバイトコード**に対して送る。
   * jpyc-access で Amoy をフォークして本物の JPYC を触ったのと同じやり方。
   *
   * フォークなので送金も発行も手元で終わる。公開チェーンには何も残らない。
   */
  sepoliaFork: {
    key: 'sepoliaFork',
    name: 'Sepolia フォーク (anvil)',
    chainId: 11155111,
    testnet: true,
    native: 'ETH',
    envVar: 'SEPOLIA_FORK_RPC_URL',
    publicRpc: ['http://127.0.0.1:8549'],
  },
};

/** フォーク元。読み取りだけ。鍵は要らない */
export const SEPOLIA_UPSTREAM = 'https://ethereum-sepolia-rpc.publicnode.com';

export function selectChain(key = process.env.CHAIN ?? 'local') {
  const chain = CHAINS[key];
  if (!chain) throw new Error(`未知のチェーン: ${key} (${Object.keys(CHAINS).join(' / ')})`);
  return chain;
}

export function rpcCandidates(chain) {
  const fromEnv = process.env[chain.envVar];
  return fromEnv ? [fromEnv, ...chain.publicRpc] : [...chain.publicRpc];
}

export const maskRpc = (url) => url.replace(/\/v2\/[^/]+/, '/v2/****').replace(/\/[0-9a-f]{32,}/i, '/****');
