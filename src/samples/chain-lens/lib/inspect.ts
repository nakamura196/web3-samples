// 取引を1本読み、「何が書かれたか」を仕分ける。
//
// 【方針】書き込みは一切しない。公開 RPC に問い合わせるだけなので、
// ウォレットも鍵もテスト通貨も要らない。学習者が壊せるものが無い状態を保つ。
//
// 【なぜ自前で解析するか】Etherscan でもログは見られる。ここで足しているのは
//   (1) 保管領域に書いた場合との費用比較（反実仮想）
//   (2) data: URI のその場デコード
//   (3) 平文 / 暗号化 / 不在 の仕分け
// の3つ。既存の explorer がやらない部分だけを持つ。

import {
  createPublicClient,
  http,
  fallback,
  decodeEventLog,
  decodeFunctionData,
  formatEther,
  formatGwei,
  parseAbi,
  sha256,
  stringToBytes,
  getAddress,
  type Hex,
} from 'viem';
import { sepolia } from 'viem/chains';
import { roleOf, CREATED_HERE, type RoleKey } from '@/samples/chain-lens/constants/roles';

// 学習に必要なイベントだけを手で並べる。@oceanprotocol/contracts を丸ごと
// 依存に入れると重いうえ、何を見ているかが読み手に伝わらない。
export const KNOWN_EVENTS = parseAbi([
  // ERC-721 標準
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  // Ocean: NFT / トークン / 蛇口の生成
  'event NFTCreated(address newTokenAddress, address indexed templateAddress, string tokenName, address indexed admin, string symbol, string tokenURI, bool transferable, address indexed creator)',
  'event TokenCreated(address indexed newTokenAddress, address indexed templateAddress, string name, string symbol, uint256 cap, address creator)',
  'event InstanceDeployed(address instance)',
  'event DispenserCreated(address indexed datatokenAddress, address indexed owner, uint256 maxTokens, uint256 maxBalance, address allowedSwapper)',
  'event NewDispenser(address dispenserContract)',
  // Ocean: メタデータ
  'event MetadataCreated(address indexed createdBy, uint8 state, string decryptorUrl, bytes flags, bytes data, bytes32 metaDataHash, uint256 timestamp, uint256 blockNumber)',
  'event MetadataUpdated(address indexed updatedBy, uint8 state, string decryptorUrl, bytes flags, bytes data, bytes32 metaDataHash, uint256 timestamp, uint256 blockNumber)',
  'event TokenURIUpdate(address indexed updatedBy, string tokenURI, uint256 tokenID, uint256 timestamp, uint256 blockNumber)',
  // Ocean: 権限
  'event AddedManager(address indexed user, address indexed signer, uint256 timestamp, uint256 blockNumber)',
  'event AddedMinter(address indexed user, address indexed signer, uint256 timestamp, uint256 blockNumber)',
  'event AddedToCreateERC20List(address indexed user, address indexed signer, uint256 timestamp, uint256 blockNumber)',
  'event RemovedFromCreateERC20List(address indexed user, address indexed signer, uint256 timestamp, uint256 blockNumber)',
]);

// 送られた calldata を読むための関数定義。
// 【なぜ要るか】「送ったデータ 1,252 バイト」とだけ出しても、それが平文なのか
// 暗号化されているのか分からない。実際 ① は全部平文（NFT の名前や記号がそのまま
// 入っている）で、③ は大半が暗号化された DDO。同じ「送ったデータ」でも性質が逆。
export const KNOWN_FUNCTIONS = parseAbi([
  'struct NftCreateData { string name; string symbol; uint256 templateIndex; string tokenURI; bool transferable; address owner; }',
  'struct ErcCreateData { uint256 templateIndex; string[] strings; address[] addresses; uint256[] uints; bytes[] bytess; }',
  'struct DispenserData { address dispenserAddress; uint256 maxTokens; uint256 maxBalance; bool withMint; address allowedSwapper; }',
  'function createNftWithErc20WithDispenser(NftCreateData _NftCreateData, ErcCreateData _ErcCreateData, DispenserData _DispenserData)',
  'struct MetadataProof { address validatorAddress; uint8 v; bytes32 r; bytes32 s; }',
  'struct MetaDataAndTokenURI { uint8 metaDataState; string metaDataDecryptorUrl; string metaDataDecryptorAddress; bytes flags; bytes data; bytes32 metaDataHash; uint256 tokenId; string tokenURI; MetadataProof[] metadataProofs; }',
  'function setMetaDataAndTokenURI(MetaDataAndTokenURI _metaDataAndTokenURI)',
]);

// EVM の単価。数字の出どころを画面にも出したいので定数として持つ。
// 出典: Ethereum Yellow Paper / EIP-2929。
export const GAS = {
  /** 保管領域に 32 バイト書く（ゼロ→非ゼロ）。EIP-2929 の cold 加算 2,100 を含む実効値 */
  SSTORE_SET: 22_100,
  /** ログのデータ 1 バイト */
  LOG_DATA_BYTE: 8,
  /** LOG 命令の基本料 */
  LOG_BASE: 375,
  /** topic 1 個あたり */
  LOG_TOPIC: 375,
} as const;

export type DecodedArg = {
  name: string;
  value: string;
  /** 長い 16 進の塊 = 中身が読めないもの */
  isBlob: boolean;
  byteLength?: number;
};

/** アドレス1つに対する注記。explorer が出さない「これは何者か」を持たせる。 */
export type Actor = {
  address: string;
  /** チェーンにコードがあるか。0 バイトなら鍵を持つアカウント */
  isContract: boolean;
  codeBytes: number;
  /** 分かっている場合の役割（Clio-X の publish の流れの中での位置づけ） */
  role: RoleKey | null;
  /** この publish で新しく作られた契約か */
  createdHere: boolean;
};

export type DecodedLog = {
  index: number;
  address: string;
  name: string | null;
  topic0: string;
  args: DecodedArg[];
  /** ログのデータ部の大きさ */
  dataBytes: number;
};

export type TokenUriDecoded = {
  raw: string;
  kind: 'data-uri' | 'http' | 'ipfs' | 'empty' | 'other';
  json?: unknown;
  note: string;
};

/** 送られた calldata の解析結果 */
export type Calldata = {
  functionName: string | null;
  args: DecodedArg[];
  /** 中に暗号化された塊が含まれていたか */
  hasEncrypted: boolean;
};

/** 暗号化された DDO を、記録された復号先に問い合わせた結果 */
export type DdoLookup = {
  /** NFT アドレスとチェーン ID から機械的に決まる資産の識別子 */
  did: string;
  nftAddress: string;
  /** チェーンに記録された復号担当ノードの URL */
  decryptorUrl: string | null;
  status: 'ok' | 'unreachable' | 'not-indexed' | 'no-url' | 'blocked';
  /** 取得できた場合の DDO（ノードが復号したもの） */
  ddo?: unknown;
  /** 何が起きたかの説明（翻訳キー） */
  reasonKey: string;
};

export type Inspection = {
  hash: string;
  from: string;
  to: string | null;
  blockNumber: string;
  selector: string;
  gasUsed: string;
  gasPriceGwei: string;
  feeEth: string;
  calldataBytes: number;
  logCount: number;
  status: 'success' | 'reverted';
  calldata: Calldata;
  ddo: DdoLookup | null;
  logs: DecodedLog[];
  contracts: string[];
  /** from / to / ログの発信元 をまとめた注記 */
  actors: Record<string, Actor>;
  /** 平文で読めた値 */
  readable: string[];
  /** 載っているが読めない塊 */
  encrypted: { label: string; bytes: number }[];
  /** 反実仮想: 同じ塊を保管領域に書いていたら */
  counterfactual: {
    bytes: number;
    asLogGas: number;
    asStorageGas: number;
    ratio: number;
  } | null;
  tokenUri: TokenUriDecoded | null;
};

// 【なぜ多重化するか】公開 RPC は提供元の判断で特定の送信元を絞ることがある。
// 実際、手元からは取得できる取引が、デプロイ先からは
// "Transaction receipt ... could not be found" になった。
// 1 つに依存すると、学習者の手元では動くのに公開ページでは動かない、という
// 分かりにくい壊れ方をするので、複数を順に試す。
const ENDPOINTS = (process.env.RPC_URL ? [process.env.RPC_URL] : []).concat([
  'https://sepolia.gateway.tenderly.co',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sepolia.org',
  'https://1rpc.io/sepolia',
]);

const client = createPublicClient({
  chain: sepolia,
  transport: fallback(
    ENDPOINTS.map((u) => http(u, { timeout: 12_000, retryCount: 1 })),
    { rank: false }
  ),
});

const isBlobHex = (s: string) => /^0x[0-9a-f]{200,}$/i.test(s);

function decodeTokenUri(raw: string): TokenUriDecoded {
  if (!raw) return { raw, kind: 'empty', note: 'tokenURI は空です。' };
  if (raw.startsWith('data:')) {
    const b64 = raw.split('base64,')[1];
    let json: unknown;
    try {
      json = JSON.parse(
        b64 ? Buffer.from(b64, 'base64').toString('utf8') : decodeURIComponent(raw.split(',')[1])
      );
    } catch {
      json = undefined;
    }
    return {
      raw,
      kind: 'data-uri',
      json,
      note: '外部を指していません。JSON そのものがチェーン上に埋め込まれています。',
    };
  }
  if (raw.startsWith('ipfs://'))
    return { raw, kind: 'ipfs', note: 'IPFS 上の JSON を指しています。' };
  if (/^https?:\/\//.test(raw))
    return {
      raw,
      kind: 'http',
      note: '外部サーバの JSON を指しています。そのサーバが消えると内容は失われます。',
    };
  return { raw, kind: 'other', note: '既知の形式ではありません。' };
}

export async function inspectTransaction(hash: string): Promise<Inspection> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error('取引ハッシュの形式が正しくありません（0x + 64桁の16進）。');
  }
  const [tx, rc] = await Promise.all([
    client.getTransaction({ hash: hash as Hex }),
    client.getTransactionReceipt({ hash: hash as Hex }),
  ]);

  const logs: DecodedLog[] = [];
  const readable: string[] = [];
  const encrypted: { label: string; bytes: number }[] = [];
  const contracts = new Set<string>();
  let tokenUri: TokenUriDecoded | null = null;
  let biggestBlob = 0;
  let biggestBlobTopics = 1;

  rc.logs.forEach((lg, index) => {
    contracts.add(lg.address);
    const dataBytes = (lg.data.length - 2) / 2;
    let name: string | null = null;
    const args: DecodedArg[] = [];
    try {
      const d = decodeEventLog({ abi: KNOWN_EVENTS, data: lg.data, topics: lg.topics });
      name = d.eventName;
      const a = (d.args ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(a)) {
        const value = String(v);
        const blob = isBlobHex(value);
        const byteLength = blob ? (value.length - 2) / 2 : undefined;
        args.push({ name: k, value, isBlob: blob, byteLength });
        if (blob) {
          encrypted.push({ label: `${name}.${k}`, bytes: byteLength! });
          if (byteLength! > biggestBlob) {
            biggestBlob = byteLength!;
            biggestBlobTopics = lg.topics.length;
          }
        } else if (value.length < 200 && !['timestamp', 'blockNumber'].includes(k)) {
          readable.push(`${name}.${k} = ${value}`);
        }
        if (k === 'tokenURI' && value) tokenUri = decodeTokenUri(value);
      }
    } catch {
      // 既知のイベント一覧に無いもの。学習上は「解析できないものもある」と見せる。
    }
    logs.push({ index, address: lg.address, name, topic0: lg.topics[0] ?? '', args, dataBytes });
  });

  // 送られた calldata を読む。ここが平文か暗号化かで、公開の度合いが変わる。
  const calldata: Calldata = { functionName: null, args: [], hasEncrypted: false };
  try {
    const f = decodeFunctionData({ abi: KNOWN_FUNCTIONS, data: tx.input });
    calldata.functionName = f.functionName;
    const flatten = (v: unknown, prefix = ''): void => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k, vv] of Object.entries(v as Record<string, unknown>))
          flatten(vv, prefix ? `${prefix}.${k}` : k);
        return;
      }
      const value = Array.isArray(v) ? JSON.stringify(v) : String(v);
      const blob = isBlobHex(value);
      const byteLength = blob ? (value.length - 2) / 2 : undefined;
      calldata.args.push({ name: prefix || 'arg', value, isBlob: blob, byteLength });
      if (blob) {
        calldata.hasEncrypted = true;
        encrypted.push({ label: `calldata.${prefix}`, bytes: byteLength! });
      } else if (value && value !== '0' && value.length < 200) {
        readable.push(`calldata.${prefix} = ${value.slice(0, 60)}`);
      }
    };
    for (const a of f.args ?? []) flatten(a);
  } catch {
    // 既知の関数一覧に無い呼び出し。学習上は「読めないものもある」と見せる。
  }

  // 出てきたアドレスすべてについて「人か、プログラムか」をチェーンに聞く。
  // 見た目では区別できないので、これは推測ではなく実測でしか埋まらない。
  // 発信元だけでなく、イベントの引数に現れるアドレス（newTokenAddress など）も含める。
  // 「この 0x… は何なのか」に答えるのがこのツールの主目的なので、出てくる全部を対象にする。
  const fromArgs = logs.flatMap((l) =>
    l.args.filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a.value)).map((a) => a.value)
  );
  const addressList = [
    ...new Set(
      [tx.from, tx.to, ...rc.logs.map((l) => l.address), ...fromArgs].filter(Boolean) as string[]
    ),
  ].filter((a) => a !== '0x0000000000000000000000000000000000000000');
  const codes = await Promise.all(
    addressList.map((a) => client.getBytecode({ address: a as Hex }).catch(() => undefined))
  );
  const actors: Record<string, Actor> = {};
  addressList.forEach((a, i) => {
    const code = codes[i];
    const codeBytes = code && code !== '0x' ? (code.length - 2) / 2 : 0;
    const role = roleOf(a);
    actors[a.toLowerCase()] = {
      address: a,
      isContract: codeBytes > 0,
      codeBytes,
      role,
      createdHere: !!role && CREATED_HERE.includes(role),
    };
  });

  const counterfactual = biggestBlob
    ? {
        bytes: biggestBlob,
        asLogGas:
          GAS.LOG_BASE + GAS.LOG_TOPIC * biggestBlobTopics + GAS.LOG_DATA_BYTE * biggestBlob,
        asStorageGas: Math.ceil(biggestBlob / 32) * GAS.SSTORE_SET,
        ratio: 0,
      }
    : null;
  if (counterfactual) {
    counterfactual.ratio =
      Math.round((counterfactual.asStorageGas / counterfactual.asLogGas) * 10) / 10;
  }

  // ── 資産の識別子（DID）を導出し、記録された復号先に DDO を問い合わせる。
  // ここがこのツールの要点のひとつ。チェーンには暗号化された塊しか無いので、
  // 中身を見るには「記録された URL のノードが動いていること」が条件になる。
  let ddo: DdoLookup | null = null;
  const metaLog = logs.find((l) => l.name === 'MetadataCreated' || l.name === 'MetadataUpdated');
  const nftCreated = logs.find((l) => l.name === 'NFTCreated');
  const nftAddress =
    metaLog?.address ?? nftCreated?.args.find((a) => a.name === 'newTokenAddress')?.value ?? null;
  if (nftAddress) {
    // did:op: + sha256(チェックサム表記のアドレス + チェーンID)
    const did =
      'did:op:' +
      sha256(stringToBytes(getAddress(nftAddress) + String(sepolia.id))).slice(2);
    const decryptorUrl =
      metaLog?.args.find((a) => a.name === 'decryptorUrl')?.value ?? null;
    ddo = { did, nftAddress, decryptorUrl, status: 'no-url', reasonKey: 'ddo.noUrl' };

    if (decryptorUrl) {
      // 学習ツールを公開する以上、チェーン上の任意の URL をそのまま叩かせない。
      // 社内網や localhost に向けさせない（SSRF 対策）。
      const priv = /^(https?:\/\/)?(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i;
      if (priv.test(decryptorUrl)) {
        ddo.status = 'blocked';
        ddo.reasonKey = 'ddo.blocked';
      } else {
        try {
          const res = await fetch(
            `${decryptorUrl.replace(/\/$/, '')}/api/aquarius/assets/ddo/${did}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (res.ok) {
            ddo.ddo = await res.json();
            ddo.status = 'ok';
            ddo.reasonKey = 'ddo.ok';
          } else {
            ddo.status = 'not-indexed';
            ddo.reasonKey = 'ddo.notIndexed';
          }
        } catch {
          ddo.status = 'unreachable';
          ddo.reasonKey = 'ddo.unreachable';
        }
      }
    }
  }

  return {
    hash,
    from: tx.from,
    to: tx.to ?? null,
    blockNumber: rc.blockNumber.toString(),
    selector: tx.input.slice(0, 10),
    gasUsed: rc.gasUsed.toString(),
    gasPriceGwei: formatGwei(rc.effectiveGasPrice),
    feeEth: formatEther(rc.gasUsed * rc.effectiveGasPrice),
    calldataBytes: (tx.input.length - 2) / 2,
    logCount: rc.logs.length,
    status: rc.status === 'success' ? 'success' : 'reverted',
    logs,
    calldata,
    ddo,
    contracts: [...contracts],
    actors,
    readable: [...new Set(readable)],
    encrypted,
    counterfactual,
    tokenUri,
  };
}
