/**
 * Ocean Protocol v4 を**素の JSON-RPC で**触るための材料。
 *
 * ── なぜ ocean.js を使わないのか ────────────────────────────────
 * `web3/cliox` では Clio-X (Ocean Market のフォーク) をそのまま動かした。
 * それは「他人が作ったスタックが動いた」という確認で、Ocean が中で何をしているかは
 * 分からないままだった。ここでは **自分で組んで送る**。
 * 依存パッケージをゼロに保つのも同じ理由で、ライブラリが隠している所を見たい。
 *
 * ── 住所の出どころ ──────────────────────────────────────────────
 * oceanprotocol/contracts の addresses/address.json (main ブランチ) を
 * 2026-08-25 に取得し、Sepolia の分だけ書き写した。
 * 4 つのアドレスは同日 eth_getCode でバイトコードの存在を確かめている
 * (ERC721Factory 16,900 / Dispenser 6,708 / ERC721Template 21,504 /
 *  ERC20Template[2] 24,017 バイト)。
 *
 * ── 実測した「聞かないと分からない」ところ ─────────────────────
 * 1. **datatoken の上限 (cap) は、テンプレートによって効く・効かないが変わる。**
 *      template 1 (ERC20Template)           … `// _cap = uints_[0];` がコメントアウトされ、
 *                                              代わりに 2^256-1 を代入する → **上限なし**
 *      template 2 (ERC20TemplateEnterprise) … `_cap = uints_[0];` → 渡した値が効く
 *    同じ引数を渡しても結果が違う。「発行上限がある」と言うときに
 *    どちらのテンプレートかを見ずに済ませられない。06-ocean.mjs で両方測っている。
 * 2. **メタデータの hash が二重符号化されている。** ocean-node の checkDdoHash は
 *    sha256(hexlify(utf8(JSON.stringify(ddo)))) を取る。バイト列の sha256 ではなく、
 *    "0x7b22..." という**16 進文字列を ASCII として**食わせた sha256。
 *    ここを素直に書くと indexer に弾かれる。
 * 3. **DID は EIP-55 のアドレスに依存する。** sha256(checksummedAddress + chainId)。
 *    小文字のアドレスで計算すると別の DID になる。だから Keccak-256 が要る
 *    (lib/keccak.mjs)。
 * 4. **暗号化しなければ Ocean のノードは要らない。** flags の bit 1 を立てなければ
 *    data はそのまま UTF-8 の JSON として読まれる (BaseProcessor の else 枝)。
 *    メタデータの公開はチェーンだけで完結する。ノードが要るのは
 *    「ファイルを配る」段から。
 * 5. **既定の datatoken (template 2) は、券を持てない作りになっている。** ← 一番効いた
 *    Ocean Market の既定は templateIndex 2 = ERC20TemplateEnterprise。
 *    このテンプレートの createDispenser は、渡した allowedSwapper を
 *    **引数の名前すら付けずに捨てて** `address(this)` を書き込む。
 *    つまり Dispenser から券を引けるのは datatoken 自身だけで、利用者は引けない。
 *    利用者が呼ぶのは buyFromDispenserAndOrder で、その中で
 *      券を 1 つ出す → 注文を記録する (OrderStarted) → **その場で焼く (burn)**
 *    を 1 つのトランザクションでやる。
 *    残高は必ず 0 に戻る。**券は在庫にならない。**
 *    ここは紙の上では気づけなかった。渡した 0x0 が無視されて
 *    「This address is not allowed to request DT」で落ちて初めて分かった。
 * 6. **data NFT を渡しても、利用者から見た配布は止まらない。**
 *    ERC721Template.transferFrom は全 datatoken に cleanFrom721() を呼んで権限を消すが、
 *    Enterprise の _internalCleanPermissions は消す前に「Dispenser が minter か」を
 *    覚えておき、消した後に minter だけ付け直す。設計として継続性が担保されている。
 *    同時に paymentCollector は 0x0 に戻され、溜まっていた分は元の所有者に払い出される。
 *    「管理を引き継ぐ」ことと「配布を止める」ことが分離されている。
 */
import {createHash} from 'node:crypto';
import {selector, eventTopic, toChecksumAddress} from './keccak.mjs';

/** Sepolia (chainId 11155111) の Ocean v4。上のコメントの出どころを参照 */
export const SEPOLIA = {
  chainId: 11155111,
  startBlock: 3722802,
  ERC721Factory: '0xEF62FB495266C72a5212A11Dce8baa79Ec0ABeB1',
  ERC721Template1: '0x9C9eE07b8Ce907D2f9244F8317C1Ed29A3193bAe',
  ERC20Template1: '0x30E4CC2C7A9c6aA2b2Ce93586E3Df24a3A00bcDD',
  ERC20Template2: '0xDEfD0018969cd2d4E648209F876ADe184815f038',
  Dispenser: '0x2720d405ef7cDC8a2E2e5AeBC8883C99611d893C',
  FixedPrice: '0x80E63f73cAc60c1662f27D2DFd2EA834acddBaa8',
  Ocean: '0x1B083D8584dd3e6Ff37d04a6e7e82b5F622f3985',
  OPFCommunityFeeCollector: '0x69B6E54Ad2b3c2801d11d8Ad56ea1d892555b776',
};

// ── 型の文字列。セレクタは keccak で求める (定数で貼らない) ──────────
const NFT_CREATE_DATA = '(string,string,uint256,string,bool,address)';
const ERC_CREATE_DATA = '(uint256,string[],address[],uint256[],bytes[])';
const DISPENSER_DATA = '(address,uint256,uint256,bool,address)';
// providerFee は bytes を含むので可変長。consumeMarketFee は固定長
const PROVIDER_FEE = '(address,address,uint256,uint8,bytes32,bytes32,uint256,bytes)';
const CONSUME_MARKET_FEE = '(address,address,uint256)';
const ORDER_PARAMS = `(address,uint256,${PROVIDER_FEE},${CONSUME_MARKET_FEE})`;

export const TYPES = {
  createNftWithErc20: [NFT_CREATE_DATA, ERC_CREATE_DATA],
  createNftWithErc20WithDispenser: [NFT_CREATE_DATA, ERC_CREATE_DATA, DISPENSER_DATA],
  createERC20: ['uint256', 'string[]', 'address[]', 'uint256[]', 'bytes[]'],
  setMetaData: ['uint8', 'string', 'string', 'bytes', 'bytes', 'bytes32', '(address,uint8,bytes32,bytes32)[]'],
  dispense: ['address', 'uint256', 'address'],
  buyFromDispenserAndOrder: [ORDER_PARAMS, 'address'],
  status: ['address'],
  transferFrom: ['address', 'address', 'uint256'],
  balanceOf: ['address'],
};

/**
 * 引数がまるごと 0 の providerFee。
 *
 * `_checkProviderFee` は fee が 0 でも**必ず署名を検証する**:
 *   require(ecrecover(message, v, r, s) == providerFeeAddress)
 * v が 27/28 でないとき ecrecover は 0x0 を返すので、
 * **providerFeeAddress も 0x0 なら等しくなって通る**。
 * つまり無料の資料なら Ocean のノードに署名をもらわずに注文できる。
 * (有料にした瞬間、ノードの署名が必須になる)
 */
export const NO_PROVIDER_FEE = [
  '0x0000000000000000000000000000000000000000', // providerFeeAddress
  '0x0000000000000000000000000000000000000000', // providerFeeToken
  0n, // providerFeeAmount
  0n, // v ← 27/28 でないので ecrecover は 0x0 を返す
  '0x' + '00'.repeat(32), // r
  '0x' + '00'.repeat(32), // s
  0n, // validUntil
  '0x', // providerData
];

export const NO_CONSUME_MARKET_FEE = [
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000000',
  0n,
];

/** buyFromDispenserAndOrder に渡す OrderParams */
export const orderParams = (consumer, serviceIndex = 0n) =>
  [consumer, serviceIndex, NO_PROVIDER_FEE, NO_CONSUME_MARKET_FEE];

const sig = (name) => `${name}(${TYPES[name].join(',')})`;

export const SIG = {
  createNftWithErc20: selector(sig('createNftWithErc20')),
  createNftWithErc20WithDispenser: selector(sig('createNftWithErc20WithDispenser')),
  createERC20: selector(sig('createERC20')),
  setMetaData: selector(sig('setMetaData')),
  dispense: selector(sig('dispense')),
  buyFromDispenserAndOrder: selector(sig('buyFromDispenserAndOrder')),
  status: selector(sig('status')),
  transferFrom: selector(sig('transferFrom')),
  balanceOf: selector(sig('balanceOf')),
  ownerOf: selector('ownerOf(uint256)'),
  name: selector('name()'),
  symbol: selector('symbol()'),
  totalSupply: selector('totalSupply()'),
  getMetaData: selector('getMetaData()'),
  cap: selector('cap()'),
  isERC20Deployer: selector('isERC20Deployer(address)'),
  getPermissions: selector('getPermissions(address)'),
};

export const TOPIC = {
  NFTCreated: eventTopic('NFTCreated(address,address,string,address,string,string,bool,address)'),
  TokenCreated: eventTopic('TokenCreated(address,address,string,string,uint256,address)'),
  MetadataCreated: eventTopic('MetadataCreated(address,uint8,string,bytes,bytes,bytes32,uint256,uint256)'),
  // 2 回目以降の setMetaData はこちらが出る。読む側は両方を見て新しいほうを取る
  MetadataUpdated: eventTopic('MetadataUpdated(address,uint8,string,bytes,bytes,bytes32,uint256,uint256)'),
  DispenserCreated: eventTopic('DispenserCreated(address,address,uint256,uint256,address)'),
  TokensDispensed: eventTopic('TokensDispensed(address,address,uint256)'),
  OrderStarted: eventTopic('OrderStarted(address,address,uint256,uint256,uint256,address,uint256)'),
  Transfer: eventTopic('Transfer(address,address,uint256)'),
};

/**
 * Ocean の DID。**ocean.js の generateDid をそのまま写した**:
 *   did:op:<sha256(EIP-55 のアドレス + chainId の 10 進表記)>
 * アドレスを小文字で渡すと別の値になるので toChecksumAddress を通す。
 */
export function generateDid(nftAddress, chainId) {
  const h = createHash('sha256').update(toChecksumAddress(nftAddress) + String(chainId)).digest('hex');
  return `did:op:${h}`;
}

/**
 * DDO を書き込むときの hash。ocean-node の checkDdoHash と同じ手順:
 *   sha256( "0x" + utf8(JSON.stringify(ddo)) の 16 進表記 )
 * **16 進の文字列を文字として**食わせるのがミソ。バイト列を食わせると通らない。
 */
export function ddoHash(json) {
  const hexString = '0x' + Buffer.from(json, 'utf8').toString('hex');
  return '0x' + createHash('sha256').update(hexString).digest('hex');
}

/**
 * DDO (Ocean の資料記述) を組む。
 * `files` を暗号化しないので serviceEndpoint は飾りになる。
 * ここで確かめたいのは「メタデータがチェーンに載って、DID が引けるか」までで、
 * ダウンロードの経路は別の話。
 */
export function buildDdo({nftAddress, chainId, datatokenAddress, created, metadata, service}) {
  return {
    '@context': ['https://w3id.org/did/v1'],
    id: generateDid(nftAddress, chainId),
    version: '4.1.0',
    chainId,
    nftAddress: toChecksumAddress(nftAddress),
    metadata: {
      created,
      updated: created,
      type: 'dataset',
      ...metadata,
    },
    services: [{
      id: 'genji-tei',
      type: 'access',
      files: '',
      datatokenAddress: toChecksumAddress(datatokenAddress),
      serviceEndpoint: 'https://kouigenjimonogatari.github.io/',
      timeout: 0,
      ...service,
    }],
  };
}

const ZERO = '0x0000000000000000000000000000000000000000';

/**
 * datatoken の発行上限に渡す値。100 回分 (1 回 = 1e18)。
 * 「わざと有限にしてみる」ための値。template 2 なら効き、template 1 なら黙って無視される。
 */
export const CAP = 100n * 10n ** 18n;

/**
 * ErcCreateData を組む。createNftWithErc20* と createERC20 で同じ形を使う。
 *   strings    = [name, symbol]
 *   addresses  = [minter, paymentCollector, publishMarketFeeAddress, publishMarketFeeToken]
 *   uints      = [cap, publishMarketFeeAmount]
 *   bytess     = []
 */
export const ercCreateData = ({templateIndex, dtName, dtSymbol, owner, feeCollector, cap = CAP}) =>
  [BigInt(templateIndex), [dtName, dtSymbol], [owner, owner, feeCollector ?? owner, ZERO], [cap, 0n], []];

/** ERC721Factory.createNftWithErc20WithDispenser に渡す 3 つの構造体 */
export function publishArgs({name, symbol, tokenURI, owner, dtName, dtSymbol, dispenser, feeCollector}) {
  return [
    // NftCreateData: transferable = true (ERC-721 を動かせるかを後で試すため)
    [name, symbol, 1n, tokenURI, true, owner],
    // template 2 = Ocean Market の既定 (Enterprise)
    ercCreateData({templateIndex: 2, dtName, dtSymbol, owner, feeCollector}),
    // DispenserData: 無料で 1 個ずつ配る。withMint = true で在庫を持たずに済む
    [dispenser, 10n ** 18n, 10n ** 18n, true, ZERO],
  ];
}

/**
 * TEI ヘッダから DDO の帰属欄を作る。**手で書かない。**
 *
 * ── 同意の無い氏名をチェーンに載せない ──────────────────────────
 * **これが最優先の制約である。**
 *
 * TEI ヘッダには 5 名が記載されている (翻刻 3 名 / TEI 化 1 名 / 助言 1 名)。
 * 資料の帰属としてはこの 5 名が正しい。しかし **チェーンへの記録は取り消せない**。
 * 本人の同意なく他人の氏名を永久に公開する形にしてはいけない。
 *
 * そこで既定では **チェーンに載せた本人だけ** を author にする。
 * これは「この資料を 1 人で作った」という主張ではなく、
 * 「この記録を公開したのはこの人だ」という意味である。
 * 資料そのものの帰属は TEI ヘッダと本家サイトを見てもらう。DDO にその案内を入れる。
 *
 * 同意が取れたら `includeContributors: true` にすれば TEI から自動で入る。
 * 団体名を名乗ることになった場合も、TEI の <authority> に入れれば追従する。
 * **手で書かない**ので、TEI との食い違いが起きない。
 *
 * ── 底本の年を足さない ──────────────────────────────────────────
 * 以前は「池田亀鑑『校異源氏物語』(1942)」と書いていたが、**TEI に年の記載は無い**。
 * 無い情報を足していた。ここでは TEI にあるものだけを出す。
 */
export function attributionFrom(header, {
  publishedBy = null,
  publishedByName = null,
  declarationUri = null,
  includeContributors = false,
  attributionUri = null,
} = {}) {
  /**
   * **「資料を作った人」と「この記録を公開した人」は別である。**
   *
   * TEI/XML は複数名の成果、チェーンに載せたのは 1 人。この関係は
   * 標準の語彙にちょうど当てはまる用語がある:
   *
   *   schema.org  creator      資料そのものの作成者
   *               sdPublisher  この記録を作って公開した者
   *                            ("the party responsible for generating and
   *                              publishing the current structured data markup")
   *               isBasedOn    元になった資料
   *
   *   PROV-O      prov:wasAttributedTo    TEI → 作成者たち
   *               prov:wasDerivedFrom     この記録 → TEI
   *               prov:wasAssociatedWith  アップロードという行為 → 実行者
   *
   * Ocean の DDO には author しか欄が無い。そこで author は
   * **「この記録を公開した人」** と定義し、資料そのものの帰属は
   * additionalInformation に役割つきで書く。曖昧なまま 1 人の名前を置くと
   * 「1 人で作った」と読まれてしまう。
   *
   * ── 既定では氏名を書かない (2026-08-26) ────────────────────────
   * EDPB のブロックチェーン指針 (02/2025) は、**個人情報をチェーンに置くことを
   * 平文・暗号化・ハッシュのいずれでも認めていない**。ウォレットのアドレスも、
   * 人と結び付けば個人情報である (pseudonymous ≠ anonymous)。
   *
   * そこで author には **アドレスだけ**を書く。「その鍵が誰か」は
   * 自分のサイトに置いた署名つきの宣言 (declarationUri) が担う。
   * 宣言は**消せる**ので、消せばアドレスは再びただのアドレスに戻る。
   * これが指針の言う「チェーンは指すだけ、身元は消せる側に置く」形である。
   *
   * publishedByName を渡すと氏名も入るが、**取り消せない**。
   * 呼び出し側で明示的に opt-in する (`--with-name`) こと。
   */
  const creator = header.authority ?? header.distributor ?? null;
  /**
   * author に入れる値。**既定はアドレスのみ。**
   * publishedByName を渡したときだけ氏名が入る (取り消せないので opt-in)。
   */
  const authorValue = publishedByName
    ? (publishedBy ? `${publishedByName} (${publishedBy})` : publishedByName)
    : publishedBy;
  return {
    // Ocean の author は「この記録を公開した人」として使う
    ...(authorValue ? {author: authorValue} : {}),
    ...(header.license ? {license: header.license.includes('publicdomain/zero')
      ? 'CC0-1.0' : header.license} : {}),
    additionalInformation: {
      /**
       * 役割を明示する。これが無いと author が何を指すか分からない。
       *
       * 説明文 (sdPublisherNote / creatorNote) は**入れない**。
       * 語の意味は schema.org の定義そのもので、URL を 1 本置けば足りる。
       * 55 件 × 2 本の日本語の文を、取り消せない場所に永久に置く理由がない。
       */
      roles: {
        vocabulary: 'https://schema.org/',
        /**
         * **アドレスをもう一度書かない。** metadata.author と同じ値なので、
         * 「author の欄は schema.org の sdPublisher の意味で使っている」
         * とだけ言えば足りる。44 バイトの重複が 55 件ぶん消える。
         */
        authorIs: 'sdPublisher',
        creator,
        ...(declarationUri ? {sdPublisherDeclaration: declarationUri} : {}),
      },
      /** 元になった資料。schema.org の isBasedOn にあたる */
      ...(attributionUri ? {isBasedOn: attributionUri} : {}),
      /**
       * **同意の無い氏名をチェーンに載せない。** 記録は取り消せないので、
       * 本人の同意なく他人の氏名を永久に公開してはいけない。
       * 代わりに「どこを見れば分かるか」を書く。
       * 同意が取れたら includeContributors: true で TEI から自動で入る
       */
      ...(includeContributors
        ? {contributors: header.contributors.map((c) => ({name: c.name, role: c.role}))}
        : {
            /**
             * 氏名は載せない。**人数と「どこを見れば分かるか」だけ。**
             * 以前はここに 3 文の説明を置いていたが、isBasedOn が同じことを
             * 指しており、重複を取り消せない場所に残すことになっていた。
             */
            contributorCount: header.contributors.length,
            contributorsAt: 'TEI respStmt',
          }),
      /**
       * **creator と同じ値なら書かない。** この TEI は authority を持たず、
       * creator = distributor になる。同じ文字列を 2 回置く理由がない。
       */
      ...(header.authority ? {authority: header.authority, distributor: header.distributor} : {}),
      ...(header.publishedAt ? {teiPublishedAt: header.publishedAt} : {}),
      /** 底本。TEI に書いてあるものだけ。年は TEI に無いので入れない */
      source: Object.fromEntries(
        Object.entries(header.source).filter(([, v]) => v != null)),
    },
  };
}

/** 底本の説明文。TEI にあるものだけで組む */
export const sourceLine = (header) => {
  const s = header.source;
  const parts = [];
  if (s.author) parts.push(s.author);
  if (s.title) parts.push(`『${s.title}』`);
  if (s.publisher) parts.push(s.publisher);
  if (s.date) parts.push(s.date);
  return parts.length ? parts.join('') : null;
};
