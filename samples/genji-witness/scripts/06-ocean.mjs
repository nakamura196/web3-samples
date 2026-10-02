/**
 * Ocean Protocol の**本物のコントラクト**に対して、校異源氏物語を発行してみる。
 *
 *   前提: ./scripts/ocean-fork.zsh を別の端末で起動しておく
 *         node scripts/01-digest.mjs (root が要る)
 *   使い方: node scripts/06-ocean.mjs
 *
 * ── 何を確かめたいのか ──────────────────────────────────────────
 * `web3/positioning` の発見2 で「所有権 NFT は成り立たない」と結論を出した。
 * それは**紙の上での結論**だった。ここでは実際に発行して、
 * **NFT を渡すと何が動いて何が動かないのか**を測る。
 *
 * Ocean の作りは 2 段になっている。ここが所有権 NFT の話と噛み合う所:
 *
 *   ERC-721 (data NFT)  … 公開者の役。メタデータを書き換える権利、
 *                          datatoken を発行する権利
 *   ERC-20 (datatoken)  … 利用 1 回分の券
 *
 * つまり Ocean は**資料そのものを NFT にしていない**。
 * NFT なのは「公開者である」という役で、売り物は「使う券」。
 * 「作品を所有する」形より筋が通っている。
 *
 * ただし CC0 の本文に無料の Dispenser を付けると、券はいくらでも湧く。
 * **その状態で何が希少なのか**を、数字で見るのがこのスクリプトの目的。
 *
 * ── フォークである意味 ──────────────────────────────────────────
 * Sepolia をフォークしているので、相手は自分が書いた模造品ではなく
 * **Ocean が Sepolia に配置した本物のバイトコード**。それでいて送った結果は
 * 手元の anvil に閉じる。公開チェーンには何も残らない。
 */
import {SEPOLIA, SIG, TYPES, TOPIC, CAP, buildDdo, ddoHash, generateDid, publishArgs,
  ercCreateData, orderParams} from '../lib/ocean.mjs';
import {toChecksumAddress} from '../lib/keccak.mjs';
import {encodeCall, encodeArgs, wordAt, stringAt, bytesAt, topicToAddress, asBool} from '../lib/abi.mjs';
import {selectChain} from '../lib/chains.mjs';
import {connect, ethCall, sendTx, waitReceipt, gasUsed} from '../lib/rpc.mjs';
import {readCorpusOut, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';
import path from 'node:path';

// anvil の既定アカウント (公開されている値。フォークなのでローカル専用)
const PUBLISHER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // 校異源氏物語を公開している側
const READER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // 使いたい研究者
const LIBRARY = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'; // 引き継ぐ図書館

const n = (v) => Number(v).toLocaleString('en-US');

/** revert するはずの呼び出し。通ってしまったら失敗として扱う */
async function expectRevert(label, fn) {
  try {
    await fn();
    return {label, reverted: false, reason: null};
  } catch (e) {
    return {label, reverted: true, reason: e.message.replace(/^execution reverted:?\s*/i, '').slice(0, 80)};
  }
}

async function main() {
  const chain = selectChain('sepoliaFork');
  let conn;
  try {
    conn = await connect(chain);
  } catch (e) {
    console.error(`${c.ng('Sepolia のフォークに繋がりません。')}\n  ${e.message}\n`);
    console.error('別の端末で ./scripts/ocean-fork.zsh を起動してください。');
    process.exit(1);
  }
  const corpus = readCorpusOut();

  rule('06 Ocean Protocol に載せる — 本物のコントラクトに対して');
  const block = Number(BigInt(await conn.call('eth_blockNumber', [])));
  console.log(`  ${chain.name} (chainId ${chain.chainId}) / block ${n(block)}`);
  console.log(`  ${c.dim('Sepolia をフォークしているので、相手は Ocean の本物のバイトコード')}`);

  // ── 送る前に、相手が本当に居るか確かめる ──────────────────────
  head('Ocean のコントラクトを確かめる');
  for (const [name, addr] of [
    ['ERC721Factory', SEPOLIA.ERC721Factory],
    ['ERC721Template', SEPOLIA.ERC721Template1],
    ['ERC20Template(2)', SEPOLIA.ERC20Template2],
    ['Dispenser', SEPOLIA.Dispenser],
  ]) {
    const code = await conn.call('eth_getCode', [addr, 'latest']);
    const bytes = code.length / 2 - 1;
    if (bytes <= 0) {
      console.error(`  ${c.ng('コードがありません')}  ${name} ${addr}`);
      process.exit(1);
    }
    console.log(`  ${c.ok('ある')}  ${padTo(name, 18)} ${addr}  ${n(bytes)} バイト`);
  }

  // ── 登場人物のアカウントを確かめる ────────────────────────────
  /**
   * ここで**予想していなかった失敗**を踏んだ。記録に値するので残す。
   *
   * anvil の既定アカウント 10 個は、**Sepolia 上では EOA ではない**。
   * 10 個すべてに `0xef0100…` で始まる 23 バイトのコードが入っている。
   * これは EIP-7702 の「委任の指し札」で、後ろの 20 バイトが委任先のアドレス。
   * anvil の既定アカウントは**秘密鍵が公開されている**ので、誰でもこの委任を
   * 刺せる。実際に刺されている (9 個は同じ先、#0 だけ別の先)。
   *
   * 何が起きるか: Ocean の data NFT は _safeMint で配られる。相手にコードが
   * あると OpenZeppelin は onERC721Received を呼びに行き、委任先がそれを
   * 実装していないので **「ERC721: transfer to non ERC721Receiver implementer」で
   * revert する**。フォークでない素の anvil では起きない。
   *
   * つまり「公開されている鍵は公開チェーン上で他人に書き換えられている」。
   * 資金を盗まれる話としては既知だが、**フォークして実験する側にも影響する**
   * ことは踏むまで気づかなかった。
   *
   * 手当て: フォークなので anvil_setCode でコードを消してから始める。
   * 消すのは自分の手元のフォークだけで、Sepolia は何も変わらない。
   */
  head('登場人物のアカウントを確かめる');
  const delegations = [];
  for (const [role, addr] of [['公開者', PUBLISHER], ['研究者', READER], ['図書館', LIBRARY]]) {
    const code = await conn.call('eth_getCode', [addr, 'latest']);
    if (code && code !== '0x') {
      const isDelegation = code.startsWith('0xef0100');
      const target = isDelegation ? '0x' + code.slice(8) : null;
      delegations.push({role, address: addr, code, delegatedTo: target});
      console.log(`  ${c.warn('EOA でない')}  ${padTo(role, 8)} ${addr}`);
      console.log(`      ${c.dim(isDelegation ? `EIP-7702 の委任が刺されている → ${target}` : `コード ${code.length / 2 - 1} バイト`)}`);
      await conn.call('anvil_setCode', [addr, '0x']);
      const after = await conn.call('eth_getCode', [addr, 'latest']);
      console.log(`      ${after === '0x' ? c.ok('フォークの中で消した') : c.ng('消せていない')}  ${c.dim('Sepolia 側は何も変わらない')}`);
    } else {
      console.log(`  ${c.ok('EOA')}       ${padTo(role, 8)} ${addr}`);
    }
  }
  if (delegations.length) {
    console.log(`  ${c.dim('秘密鍵が公開されているアカウントなので、誰でも委任を刺せる。')}`);
    console.log(`  ${c.dim('消さないと _safeMint が onERC721Received を呼びに行って revert する。')}`);
  }

  // ── 発行 ────────────────────────────────────────────────────
  head('data NFT + datatoken + Dispenser を 1 回で作る');
  const args = publishArgs({
    name: '校異源氏物語 TEI',
    symbol: 'KOUIGENJI',
    tokenURI: 'https://kouigenjimonogatari.github.io/',
    owner: PUBLISHER,
    dtName: 'Kouigenji Access',
    dtSymbol: 'KGACCESS',
    dispenser: SEPOLIA.Dispenser,
    feeCollector: SEPOLIA.OPFCommunityFeeCollector,
  });
  const createTx = await sendTx(conn, {
    from: PUBLISHER,
    to: SEPOLIA.ERC721Factory,
    data: encodeCall(SIG.createNftWithErc20WithDispenser, TYPES.createNftWithErc20WithDispenser, args),
  });
  const createRc = await waitReceipt(conn, createTx);

  const logOf = (topic, addr) => createRc.logs.find(
    (l) => l.topics[0] === topic && (!addr || l.address.toLowerCase() === addr.toLowerCase()));

  const nftLog = logOf(TOPIC.NFTCreated);
  const dtLog = logOf(TOPIC.TokenCreated, null);
  const dispLog = logOf(TOPIC.DispenserCreated);
  if (!nftLog || !dtLog || !dispLog) {
    console.error(c.ng('  期待したイベントが出ていません。Ocean 側の作りが変わった可能性があります。'));
    console.error(`  出たイベント: ${createRc.logs.map((l) => l.topics[0].slice(0, 10)).join(' ')}`);
    process.exit(1);
  }

  // NFTCreated の indexed でない引数: newTokenAddress / tokenName / symbol / tokenURI / transferable / creator
  const nft = toChecksumAddress('0x' + wordAt(nftLog.data, 0).slice(26));
  const nftName = stringAt(nftLog.data, 1);
  const transferable = asBool(wordAt(nftLog.data, 4));
  // TokenCreated: topics[1] が datatoken。data は name / symbol / cap / creator
  const datatoken = toChecksumAddress(topicToAddress(dtLog.topics[1]));
  const dtCap = BigInt(wordAt(dtLog.data, 2));

  console.log(`  data NFT   ${nft}  ${c.dim(`"${nftName}" / 移転できる: ${transferable ? 'はい' : 'いいえ'}`)}`);
  console.log(`  datatoken  ${datatoken}`);
  console.log(`  Dispenser  ${c.dim(`maxTokens ${BigInt(wordAt(dispLog.data, 0)) / 10n ** 18n} / 無料`)}`);
  console.log(`  ${n(gasUsed(createRc))} ガス / tx ${createTx.slice(0, 18)}…`);

  // ── DID ─────────────────────────────────────────────────────
  head('DID を求める');
  const did = generateDid(nft, chain.chainId);
  console.log(`  ${c.b(did)}`);
  console.log(`  ${c.dim(`sha256("${nft}" + "${chain.chainId}")`)}`);
  console.log(`  ${c.dim('EIP-55 のアドレスに依存するので Keccak-256 が要る (lib/keccak.mjs)')}`);

  // ── メタデータ (DDO) ────────────────────────────────────────
  head('メタデータをチェーンに書く');
  const capturedAt = Math.floor(Number(BigInt((await conn.call('eth_getBlockByNumber', ['latest', false])).timestamp)));
  const iso = new Date(capturedAt * 1000).toISOString();
  const chapterTree = corpus.trees.chapter;
  const itemTree = corpus.trees.item;

  const ddo = buildDdo({
    nftAddress: nft, chainId: chain.chainId, datatokenAddress: datatoken, created: iso,
    metadata: {
      name: '校異源氏物語 (TEI/XML)',
      description: [
        '池田亀鑑『校異源氏物語』(1942) を底本とする源氏物語の校異データ。',
        `TEI/XML ${corpus.chapters.length} 帖、${n(itemTree.treeSize)} 行 (<seg>)。`,
        '',
        `帖ツリーの root: ${chapterTree.root}`,
        `行ツリーの root: ${itemTree.root}`,
        `どちらも RFC 6962 (${chapterTree.spec})。`,
        `素材の commit: ${corpus.source.commit}`,
        '',
        '1 行だけの包含証明を 645 バイトで作れる。root はこの DDO の外 (CorpusAnchor) に刻んである。',
      ].join('\n'),
      author: 'Satoru Nakamura / 中村 覚',
      license: 'CC0-1.0',
      tags: ['tei', 'genji', 'japanese-classics', 'digital-humanities', 'merkle', 'rfc6962'],
      additionalInformation: {
        // ここが 04/05 までの成果を Ocean に持ち込む所。
        // 「Ocean に載っている」だけでは版を固定できないので、root を一緒に載せる。
        sourceUri: corpus.source.sourceUri,
        sourceCommit: corpus.source.commit,
        merkleSpec: chapterTree.spec,
        chapterRoot: chapterTree.root,
        chapterTreeSize: chapterTree.treeSize,
        itemRoot: itemTree.root,
        itemTreeSize: itemTree.treeSize,
        totalBytes: corpus.totalBytes,
      },
    },
  });

  const json = JSON.stringify(ddo);
  const data = '0x' + Buffer.from(json, 'utf8').toString('hex');
  const hash = ddoHash(json);
  // flags = 0x00。bit1 を立てないので **暗号化しない** = Ocean のノードが要らない。
  // ocean-node の indexer は flag & 2 == 0 のとき data をそのまま UTF-8 の JSON として読む。
  const metaTx = await sendTx(conn, {
    from: PUBLISHER, to: nft,
    data: encodeCall(SIG.setMetaData, TYPES.setMetaData, [
      0n, // state 0 = active
      'https://kouigenjimonogatari.github.io/', // decryptorUrl (暗号化しないので使われない)
      PUBLISHER,
      '0x00', // flags
      data,
      hash,
      [], // 検証者の署名は付けない
    ]),
  });
  const metaRc = await waitReceipt(conn, metaTx);
  const metaLog = metaRc.logs.find((l) => l.topics[0] === TOPIC.MetadataCreated);
  const onchainFlags = bytesAt(metaLog.data, 2);
  const onchainData = bytesAt(metaLog.data, 3);
  const onchainHash = wordAt(metaLog.data, 4);

  console.log(`  DDO ${n(json.length)} バイトをそのままチェーンに置いた (${n(gasUsed(metaRc))} ガス)`);
  console.log(`  flags ${'0x' + onchainFlags.toString('hex')} → ${c.dim('暗号化しない。読む側にノードが要らない')}`);

  // indexer と同じ検査を、こちらでもやる
  const roundTrip = JSON.stringify(JSON.parse(onchainData.toString('utf8')));
  const checks = [
    ['チェーンから読んだ data が同じ JSON になる', roundTrip === json],
    ['hash が indexer の計算と一致する', onchainHash.toLowerCase() === hash.toLowerCase()],
    ['DDO の中の root が 01-digest と同じ', JSON.parse(roundTrip).metadata.additionalInformation.itemRoot === itemTree.root],
  ];
  for (const [label, ok] of checks) console.log(`  ${ok ? c.ok('ok') : c.ng('NG')}  ${label}`);
  if (checks.some(([, ok]) => !ok)) process.exit(1);

  // ── 券を取ろうとしてみる ────────────────────────────────────
  head('Dispenser から直接券を取れるか');
  const balanceOf = async (who) => BigInt(await ethCall(conn, datatoken,
    encodeCall(SIG.balanceOf, TYPES.balanceOf, [who])));

  // status() で Dispenser の設定を読む。**渡した値がそのまま入っていない**
  const st = await ethCall(conn, SEPOLIA.Dispenser, encodeCall(SIG.status, TYPES.status, [datatoken]));
  const allowedSwapper = toChecksumAddress('0x' + wordAt(st, 6).slice(26));
  const swapperIsDatatoken = allowedSwapper.toLowerCase() === datatoken.toLowerCase();
  console.log(`  allowedSwapper = ${allowedSwapper}`);
  console.log(`  ${swapperIsDatatoken ? c.warn('渡したのは 0x0 (誰でも可) だが、datatoken 自身が入っている') : '渡した値が入っている'}`);
  console.log(`  ${c.dim('template 2 (Enterprise) の createDispenser が引数を捨てて address(this) を書く')}`);

  const direct = await expectRevert('研究者が Dispenser.dispense を直接呼ぶ', () => conn.call('eth_call', [{
    from: READER, to: SEPOLIA.Dispenser,
    data: encodeCall(SIG.dispense, TYPES.dispense, [datatoken, 10n ** 18n, READER]),
  }, 'latest']));
  console.log(`  ${direct.reverted ? c.ok('revert した') : c.ng('通ってしまった')}  ${direct.label}`);
  if (direct.reason) console.log(`  ${c.dim(`理由: ${direct.reason}`)}`);

  // ── 正しい道: 出す → 注文する → 焼く を 1 回で ────────────────
  head('券を出して注文して焼く — buyFromDispenserAndOrder');
  console.log(`  ${c.dim('providerFee をすべて 0 にする。ecrecover が 0x0 を返し、')}`);
  console.log(`  ${c.dim('providerFeeAddress も 0x0 なので署名の検査を通る = Ocean のノードが要らない')}`);
  const orders = [];
  for (let i = 1; i <= 3; i++) {
    const tx = await sendTx(conn, {
      from: READER, to: datatoken,
      data: encodeCall(SIG.buyFromDispenserAndOrder, TYPES.buyFromDispenserAndOrder,
        [orderParams(READER, 0n), SEPOLIA.Dispenser]),
    });
    const rc = await waitReceipt(conn, tx);
    const started = rc.logs.filter((l) => l.topics[0] === TOPIC.OrderStarted).length;
    const burns = rc.logs.filter((l) => l.topics[0] === TOPIC.Transfer
      && topicToAddress(l.topics[2]) === '0x0000000000000000000000000000000000000000').length;
    const bal = await balanceOf(READER);
    orders.push({gas: gasUsed(rc), started, burns, balanceAfter: bal.toString()});
    console.log(`  ${i} 回目  OrderStarted ${started} 件 / 焼却 ${burns} 件 / 注文後の残高 ${c.b(String(bal))}  (${n(gasUsed(rc))} ガス)`);
  }
  const heldAfterOrders = await balanceOf(READER);
  console.log(`  ${heldAfterOrders === 0n ? c.ok('残高は 0 に戻る') : c.ng('残高が残っている')}  ${c.dim('券は在庫にならない。残るのは「使った」という記録だけ')}`);

  // ── 上限は本当に効くのか。テンプレートを変えて比べる ──────────────
  head('発行上限 (cap) はテンプレートによって効かない');
  const UNLIMITED = (1n << 256n) - 1n;
  const supply = BigInt(await ethCall(conn, datatoken, SIG.totalSupply));
  const cap2 = BigInt(await ethCall(conn, datatoken, SIG.cap));

  // 同じ NFT に template 1 の datatoken をもう 1 つ作り、同じ cap を渡して読み直す
  const dt1Tx = await sendTx(conn, {
    from: PUBLISHER, to: nft,
    data: encodeCall(SIG.createERC20, TYPES.createERC20,
      ercCreateData({templateIndex: 1, dtName: 'Kouigenji Access (t1)', dtSymbol: 'KGACC1',
        owner: PUBLISHER, feeCollector: SEPOLIA.OPFCommunityFeeCollector})),
  });
  const dt1Rc = await waitReceipt(conn, dt1Tx);
  const dt1Log = dt1Rc.logs.find((l) => l.topics[0] === TOPIC.TokenCreated);
  const datatoken1 = toChecksumAddress(topicToAddress(dt1Log.topics[1]));
  const cap1 = BigInt(await ethCall(conn, datatoken1, SIG.cap));

  const show = (v) => (v === UNLIMITED ? c.warn('2^256-1 (実質無制限)') : c.ok(`${v / 10n ** 18n} 回分`));
  console.log(`  どちらにも同じ cap (${CAP / 10n ** 18n} 回分) を渡している`);
  console.log(`  ${padTo('template 2 (Enterprise / 既定)', 34)}${show(cap2)}`);
  console.log(`  ${padTo('template 1 (ERC20Template)', 34)}${show(cap1)}`);
  console.log(`  ${c.dim('template 1 の _initialize は `// _cap = uints_[0];` をコメントアウトし、')}`);
  console.log(`  ${c.dim('代わりに 2^256-1 を代入する。引数は受け取るのに使われない。')}`);
  console.log(`  totalSupply ${supply}  ${c.dim('(注文のたびに焼くので積み上がらない)')}`);

  // ── NFT を渡すと何が動くのか ────────────────────────────────
  head('data NFT を図書館に渡す — 何が動いて何が動かないか');
  const ownerAt = async () => toChecksumAddress('0x' +
    (await ethCall(conn, nft, SIG.ownerOf + encodeArgs(['uint256'], [1n]))).slice(26));
  // getPermissions は Roles {manager, deployERC20, updateMetadata, store}
  const perms = async (who) => {
    const r = await ethCall(conn, nft, encodeCall(SIG.getPermissions, ['address'], [who]));
    return Object.fromEntries(['manager', 'deployERC20', 'updateMetadata', 'store']
      .map((k, i) => [k, asBool(wordAt(r, i))]));
  };
  const canOrder = () => expectRevert('研究者が注文する', () => conn.call('eth_call', [{
    from: READER, to: datatoken,
    data: encodeCall(SIG.buyFromDispenserAndOrder, TYPES.buyFromDispenserAndOrder,
      [orderParams(READER, 0n), SEPOLIA.Dispenser]),
  }, 'latest']));

  const beforeOwner = await ownerAt();
  const pubBefore = await perms(PUBLISHER);
  const libBefore = await perms(LIBRARY);
  const orderBefore = await canOrder();

  const xferTx = await sendTx(conn, {
    from: PUBLISHER, to: nft,
    data: encodeCall(SIG.transferFrom, TYPES.transferFrom, [PUBLISHER, LIBRARY, 1n]),
  });
  const xferRc = await waitReceipt(conn, xferTx);

  const afterOwner = await ownerAt();
  const pubAfter = await perms(PUBLISHER);
  const libAfter = await perms(LIBRARY);
  const orderAfter = await canOrder();

  // 元の公開者はもうメタデータを書き換えられない、はず
  const revert = await expectRevert('元の公開者が setMetaData を呼ぶ', () => conn.call('eth_call', [{
    from: PUBLISHER, to: nft,
    data: encodeCall(SIG.setMetaData, TYPES.setMetaData, [0n, 'x', PUBLISHER, '0x00', '0x74657374', hash, []]),
  }, 'latest']));

  // 既に記録された注文は消えない。ログを数え直して確かめる。
  // fromBlock は**フォークした所**から。0 から引くと anvil が上流に問い合わせて
  // 「exceed maximum block range: 50000」で落ちる (Sepolia の 1,150 万ブロックぶん)。
  const pastOrders = await conn.call('eth_getLogs', [{
    fromBlock: '0x' + BigInt(block).toString(16), toBlock: 'latest',
    address: datatoken, topics: [TOPIC.OrderStarted],
  }]);

  console.log(`  所有者  ${beforeOwner.slice(0, 10)}… → ${afterOwner.slice(0, 10)}…  (${n(gasUsed(xferRc))} ガス)`);
  console.log('');
  const yn = (v) => (v ? 'あり' : 'なし');
  console.log(`  ${padTo('', 32)}${padTo('渡す前', 10)}渡した後`);
  const rows = [
    ['公開者のメタデータ書き換え権', pubBefore.updateMetadata, pubAfter.updateMetadata, false],
    ['公開者の datatoken 発行権', pubBefore.deployERC20, pubAfter.deployERC20, false],
    ['図書館のメタデータ書き換え権', libBefore.updateMetadata, libAfter.updateMetadata, true],
    ['図書館の datatoken 発行権', libBefore.deployERC20, libAfter.deployERC20, true],
  ];
  for (const [label, before, after, want] of rows) {
    const mark = after === want ? c.ok(yn(after)) : c.ng(yn(after));
    console.log(`  ${padTo(label, 32)}${padTo(yn(before), 10)}${mark}`);
  }
  console.log('');
  console.log(`  ${revert.reverted ? c.ok('revert した') : c.ng('通ってしまった')}  ${revert.label}`);
  if (revert.reason) console.log(`  ${c.dim(`理由: ${revert.reason}`)}`);
  console.log('');
  console.log(`  研究者が注文できるか  渡す前: ${orderBefore.reverted ? c.ng('できない') : c.ok('できる')}` +
    `  →  渡した後: ${orderAfter.reverted ? c.warn('できない') : c.ok('できる')}`);
  if (orderAfter.reverted) console.log(`  ${c.dim(`理由: ${orderAfter.reason}`)}`);
  /**
   * ここは Ocean が**意図して**そう作っている所。ERC721Template の transferFrom は
   * 全部の datatoken に cleanFrom721() を呼んで権限を消しに行くが、
   * ERC20TemplateEnterprise の _internalCleanPermissions は消す前に
   * 「Dispenser が minter だったか」を覚えておき、消した後で minter だけ付け直す。
   * つまり **管理者が代わっても配布は止まらない**。
   * 図書館に引き継いでも利用者に影響が出ないのは、この作りのおかげ。
   * 一方 paymentCollector は 0x0 に戻され、溜まっていた分は元の所有者に払い出される。
   */
  console.log(`  ${c.dim('Ocean は権限を消す前に Dispenser の minter だけ覚えて付け直す。')}`);
  console.log(`  ${c.dim('管理者が代わっても配布は止まらない (paymentCollector だけ 0x0 に戻る)。')}`);
  console.log(`  ${c.ok('残る')}  既に記録された注文 (OrderStarted) ${pastOrders.length} 件は消えない`);

  // ── まとめ ──────────────────────────────────────────────────
  rule('NFT は何を動かしたのか');
  const moved = [
    ['メタデータを書き換える権利', '図書館だけが DDO を差し替えられるようになった'],
    ['datatoken を発行する権利', '新しい券の作り方を決めるのは図書館'],
    ['DID が指す先の管理者', `${did.slice(0, 20)}… の宛先は変わらないまま、責任者が変わった`],
  ];
  if (orderAfter.reverted && !orderBefore.reverted) {
    moved.push(['配布そのものの継続性', '所有者が変わった瞬間、研究者は注文できなくなった']);
  }
  const notMoved = [
    ['TEI 本文そのもの', 'GitHub にある。CC0 なので誰でも複製できる'],
    ['利用者から見た使い勝手', '注文はそのまま通る。Dispenser の minter だけ意図的に残される'],
    ['既に記録された注文', `OrderStarted ${pastOrders.length} 件は消えない。券そのものは元から在庫にならない`],
    ['底本の権利', '池田亀鑑 1942。公有。誰の持ち物でもない'],
    ['校異の学術的な帰属', '誰がマークアップしたかは NFT の所有者と関係ない'],
    ['root の正しさ', '手元で計算し直せる。チェーンも Ocean も要らない'],
  ];
  head('動いたもの');
  for (const [x, why] of moved) console.log(`  ${c.warn('→')}  ${padTo(x, 26)} ${c.dim(why)}`);
  head('動かなかったもの');
  for (const [x, why] of notMoved) console.log(`  ${c.dim('×')}  ${padTo(x, 26)} ${c.dim(why)}`);

  head('では何が売り物になるのか');
  console.log(`  この構成では ${c.b('何も売り物になっていない')}。本文は CC0 で、券は無料で誰でも取れる。`);
  console.log(`  ${c.dim('Ocean に載せたことで生まれた希少性はゼロ。これは失敗ではなく、')}`);
  console.log(`  ${c.dim('CC0 の資料に対しては正しい設定。値段をつけたら公有の本文を囲うことになる。')}`);
  console.log('');
  console.log(`  ${c.b('ただし、券は最初から「持てるもの」ではなかった。')}`);
  console.log(`  ${c.dim('既定テンプレート (Enterprise) は 出す→注文を記録する→焼く を 1 tx でやる。')}`);
  console.log(`  ${c.dim('残高は常に 0。売買できる「持ち物」は存在せず、残るのは使ったという記録だけ。')}`);
  console.log(`  ${c.dim('つまり Ocean が数えているのは所有ではなく利用の回数。')}`);
  console.log('');
  console.log(`  増えたものは 3 つ。`);
  console.log(`    1. ${n(json.length)} バイトのメタデータが、消せない形で残った (root 込み)`);
  console.log(`    2. DID という**引ける名前**がついた (${did.slice(0, 24)}…)`);
  console.log(`    3. 誰が何回この資料を使ったかの記録 (${pastOrders.length} 件)`);
  console.log(`  ${c.dim('1 と 2 はカタログ、3 は利用統計。どれも「売る」とは関係ない。')}`);

  const outFile = path.join(OUT, 'ocean.json');
  writeJson(outFile, {
    generatedAt: iso,
    chain: {key: chain.key, chainId: chain.chainId, name: chain.name, forkedBlock: block,
      note: 'Sepolia のフォーク。公開チェーンには何も送っていない'},
    oceanAddresses: SEPOLIA,
    published: {did, dataNft: nft, datatoken, dispenser: SEPOLIA.Dispenser,
      transferable, datatokenCap: cap2.toString()},
    capByTemplate: {
      passed: CAP.toString(),
      template2: {address: datatoken, cap: cap2.toString(), honoured: cap2 === CAP},
      template1: {address: datatoken1, cap: cap1.toString(), honoured: cap1 === CAP,
        note: '`// _cap = uints_[0];` がコメントアウトされ 2^256-1 が入る'},
    },
    ddo: {bytes: json.length, hash, flags: '0x00', encrypted: false, document: ddo},
    gas: {createNftWithErc20WithDispenser: gasUsed(createRc), setMetaData: gasUsed(metaRc),
      buyFromDispenserAndOrder: orders.map((o) => o.gas), transferFrom: gasUsed(xferRc)},
    template: {
      index: 2, name: 'ERC20TemplateEnterprise',
      allowedSwapper, allowedSwapperIsDatatoken: swapperIsDatatoken,
      directDispenseReverted: direct.reverted, directDispenseReason: direct.reason,
      note: 'createDispenser が渡した allowedSwapper を捨てて address(this) を書く',
    },
    orders: {
      count: orders.length, detail: orders,
      readerBalanceAfterAll: heldAfterOrders.toString(),
      onchainOrderStartedLogs: pastOrders.length,
      note: '出す→注文を記録する→焼く を 1 tx で行う。残高は必ず 0 に戻る = 券は在庫にならない',
    },
    transferTest: {
      before: {owner: beforeOwner, publisherPermissions: pubBefore, libraryPermissions: libBefore,
        readerCanOrder: !orderBefore.reverted},
      after: {owner: afterOwner, publisherPermissions: pubAfter, libraryPermissions: libAfter,
        readerCanOrder: !orderAfter.reverted, readerOrderRevertReason: orderAfter.reason,
        publisherSetMetaDataReverted: revert.reverted, revertReason: revert.reason},
    },
    scarcity: {
      dispenserFree: true,
      accessTokenHoldable: heldAfterOrders !== 0n,
      capUnlimited: cap2 === UNLIMITED,
      totalSupply: supply.toString(),
      conclusion: 'CC0 + 無料 Dispenser では希少性が生まれない。これは正しい設定。'
        + '券は所有物ではなく利用の記録なので、そもそも売買の対象にならない',
    },
    notPublished: 'Ocean Market には出していない (フォークなので出せない)。実物に出すかは別の判断',
  });
  console.log(`\n${rel(outFile)} に書きました。`);
}

main().catch((e) => {
  console.error(`\n${c.ng('失敗:')} ${e.message}`);
  process.exit(1);
});
