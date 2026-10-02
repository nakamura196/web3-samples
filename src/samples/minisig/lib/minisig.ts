import { createPublicClient, fallback, http, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";

/** 既定のデプロイ先。一覧は src/constants/site.ts を参照 */
export const DEFAULT_ADDRESS: Address =
  '0x60D6F9301B8616520cA10128C63040b6C532717F';

export const CHAIN = baseSepolia;

/**
 * 公開 RPC は混雑や送信元 IP でしばしば弾かれる。
 * Cloudflare Workers は多数のテナントで egress を共有するため、とくに当たりやすい。
 * 実際、単一エンドポイントだと 3回に1〜2回は失敗した。
 *
 * そこで複数の公開 RPC を fallback で並べ、各段でリトライする。
 * 本番運用なら、こうせずに API キー付きの有償プロバイダを使うべき。
 */
const RPC_URLS = [
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
  'https://base-sepolia.drpc.org',
  'https://base-sepolia.gateway.tenderly.co',
];

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: fallback(
    RPC_URLS.map((url) =>
      // batch: true で複数の eth_call を 1 回の HTTP にまとめる。
      // Workers の subrequest 数と失敗確率を同時に下げられる。
      http(url, { batch: true, retryCount: 2, retryDelay: 250, timeout: 8_000 })
    ),
    { retryCount: 0 }
  ),
});

export const MINISIG_ABI = [
  {
    type: "function",
    name: "owners",
    inputs: [],
    outputs: [{ type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "threshold",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nonce",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isOwner",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "txHash",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "nonce_", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "execTransaction",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "signatures", type: "bytes" },
    ],
    outputs: [{ type: "bytes" }],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * 署名を「署名者アドレスの昇順」に並べて連結する。
 *
 * MiniSig は重複した署名者を数えないために昇順を要求する。
 * マッピングを持たずに重複排除する定石で、Safe も同じ方式をとる。
 */
export function concatSortedSignatures(
  entries: { signer: Address; signature: Hex }[],
): Hex {
  const sorted = [...entries].sort((a, b) =>
    a.signer.toLowerCase() < b.signer.toLowerCase() ? -1 : 1,
  );
  return ("0x" +
    sorted.map((e) => e.signature.slice(2)).join("")) as Hex;
}

export const explorerTx = (h: string) =>
  `https://sepolia.basescan.org/tx/${h}`;
export const explorerAddr = (a: string) =>
  `https://sepolia.basescan.org/address/${a}`;
