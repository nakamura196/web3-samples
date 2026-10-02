// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CorpusAnchor} from "../src/CorpusAnchor.sol";

/// @dev 検証値は **オフチェーン側 (lib/merkle.mjs) が出した値**を貼ってある。
///      lib/merkle.mjs 自身は scripts/00-selftest.mjs で RFC 6962 の公表値と
///      突き合わせてあるので、ここが通れば「オフチェーンとオンチェーンが
///      同じ木を見ている」ことになる。片方だけ直すと落ちる。
///
///      作り直すとき:
///        node -e 'import("./lib/merkle.mjs").then(({leafHash,root,proof})=>{
///          const es=[..."01234"].map(i=>Buffer.from("e"+i));const ls=es.map(leafHash);
///          console.log(root(ls).toString("hex"), proof(0,ls).map(b=>b.toString("hex")));})'
contract CorpusAnchorTest is Test {
    CorpusAnchor anchor;

    event CorpusAnchored(
        bytes32 indexed corpusId,
        bytes32 indexed root,
        address indexed observer,
        uint64 capturedAt,
        uint32 treeSize,
        string sourceUri,
        string spec
    );

    bytes32 constant CORPUS_ID = keccak256("kouigenjimonogatari"); // 中身は問わない
    string constant SOURCE = "https://github.com/kouigenjimonogatari/kouigenjimonogatari.github.io/tree/abc123";
    string constant SPEC = "rfc6962-sha256/uri-nul-seg-inner-xml";

    // 葉 5 個 (e0..e4) の木
    bytes32 constant ROOT5 = 0xe14e43627e473070de926fe026cc670820e60288089abd1f95f83f42fe81f7ab;
    // 葉 3 個 (e0..e2) の木 — 2 の冪でない場合
    bytes32 constant ROOT3 = 0x64b249c4e0606e3d9742c49bfd57cd1e3eb170f5ccefa26ea045ca193d64a75f;
    // 葉 8 個 (e0..e7) の木
    bytes32 constant ROOT8 = 0x2c56d14626d0985b97bcaeff29d37232fe7a1c69e65055ba13d4e12c0ad34cf7;
    // 葉 1 個 (e0) の木 — root = 葉のハッシュそのもの
    bytes32 constant ROOT1 = 0x956ae51bd3e285ccb826298dd523dd08824ce5579749994f2e0021737b9dd4b8;

    function setUp() public {
        anchor = new CorpusAnchor();
        vm.warp(1_800_000_000);
    }

    // ── 記録 ─────────────────────────────────────────────────────
    function test_anchor_emits() public {
        vm.expectEmit(true, true, true, true);
        emit CorpusAnchored(CORPUS_ID, ROOT5, address(this), 1_799_999_000, 5, SOURCE, SPEC);
        anchor.anchor(CORPUS_ID, ROOT5, 1_799_999_000, 5, SOURCE, SPEC);
    }

    /// @dev 誰でも呼べることが要件。第三者が独立に記録を足せなければ証人にならない
    function test_anchor_anyoneCanCall() public {
        address stranger = address(0xBEEF);
        vm.prank(stranger);
        vm.expectEmit(true, true, true, true);
        emit CorpusAnchored(CORPUS_ID, ROOT5, stranger, 1_799_999_000, 5, SOURCE, SPEC);
        anchor.anchor(CORPUS_ID, ROOT5, 1_799_999_000, 5, SOURCE, SPEC);
    }

    /// @dev 同じ root を何度でも記録できる。観測者が複数いることが分かる形
    function test_anchor_sameRootTwice() public {
        anchor.anchor(CORPUS_ID, ROOT5, 1_799_999_000, 5, SOURCE, SPEC);
        vm.prank(address(0xBEEF));
        anchor.anchor(CORPUS_ID, ROOT5, 1_799_999_500, 5, SOURCE, SPEC);
    }

    function test_anchor_rejectsZeroCorpusId() public {
        vm.expectRevert(CorpusAnchor.ZeroId.selector);
        anchor.anchor(bytes32(0), ROOT5, 1_799_999_000, 5, SOURCE, SPEC);
    }

    function test_anchor_rejectsZeroRoot() public {
        vm.expectRevert(CorpusAnchor.ZeroId.selector);
        anchor.anchor(CORPUS_ID, bytes32(0), 1_799_999_000, 5, SOURCE, SPEC);
    }

    /// @dev treeSize が無いと木の形が決まらず、root を再現できない
    function test_anchor_rejectsZeroTreeSize() public {
        vm.expectRevert(CorpusAnchor.EmptyTree.selector);
        anchor.anchor(CORPUS_ID, ROOT5, 1_799_999_000, 0, SOURCE, SPEC);
    }

    /// @dev spec が無いと、どう並べてハッシュしたか分からず検証できない
    function test_anchor_rejectsEmptySpec() public {
        vm.expectRevert(CorpusAnchor.EmptyString.selector);
        anchor.anchor(CORPUS_ID, ROOT5, 1_799_999_000, 5, SOURCE, "");
    }

    function test_anchor_rejectsEmptySource() public {
        vm.expectRevert(CorpusAnchor.EmptyString.selector);
        anchor.anchor(CORPUS_ID, ROOT5, 1_799_999_000, 5, "", SPEC);
    }

    function test_anchor_rejectsFutureCapture() public {
        vm.expectRevert(CorpusAnchor.FutureCapture.selector);
        anchor.anchor(CORPUS_ID, ROOT5, uint64(block.timestamp + 1), 5, SOURCE, SPEC);
    }

    // ── 葉と節のハッシュ ─────────────────────────────────────────
    function test_leafHash_isDomainSeparated() public view {
        assertEq(anchor.leafHash(bytes("e0")), sha256(abi.encodePacked(bytes1(0x00), bytes("e0"))));
    }

    function test_nodeHash_isDomainSeparated() public view {
        bytes32 l = anchor.leafHash(bytes("e0"));
        bytes32 r = anchor.leafHash(bytes("e1"));
        assertEq(anchor.nodeHash(l, r), sha256(abi.encodePacked(bytes1(0x01), l, r)));
    }

    /// @dev 節のハッシュを葉として出しても root には届かない (second-preimage)
    function test_leafAndNodeCannotBeConfused() public view {
        bytes32 l = anchor.leafHash(bytes("e0"));
        assertTrue(anchor.leafHash(abi.encodePacked(l, l)) != anchor.nodeHash(l, l));
    }

    // ── 包含証明 ─────────────────────────────────────────────────
    function test_verify_singleLeafTree() public view {
        bytes32[] memory path = new bytes32[](0);
        assertTrue(anchor.verifyInclusion(ROOT1, bytes("e0"), path, 0, 1));
    }

    function test_verify_fiveLeaves_first() public view {
        bytes32[] memory path = new bytes32[](3);
        path[0] = 0xd38b823b070424fc9303ff6f20f4ddeef6dc32aa02c75d9c8c3ae46062c78f6b;
        path[1] = 0x93a9e19543c6159880b77481786c0b601b301cc0333dd6804c16d228c9010a35;
        path[2] = 0x8e1f887cfc7c7a5e43f202daf67d99ae8f8fd4b33a6b251bcf9f5d83476303ea;
        assertTrue(anchor.verifyInclusion(ROOT5, bytes("e0"), path, 0, 5));
    }

    function test_verify_fiveLeaves_middle() public view {
        bytes32[] memory path = new bytes32[](3);
        path[0] = 0xd5bdb58a19173a6a0111df3f1f62dbaa00e44221e0f09b47489812a010cd5314;
        path[1] = 0x718fa0369d7475099bc6cb4327e3823a4972285f92bd49971a583c9f08ffb68d;
        path[2] = 0x8e1f887cfc7c7a5e43f202daf67d99ae8f8fd4b33a6b251bcf9f5d83476303ea;
        assertTrue(anchor.verifyInclusion(ROOT5, bytes("e2"), path, 2, 5));
    }

    /// @dev 葉の数が 2 の冪でないときに証明の長さが揃わない。ここが一番間違えるところ
    function test_verify_fiveLeaves_lastHasShorterPath() public view {
        bytes32[] memory path = new bytes32[](1);
        path[0] = 0x95669b376bc4e3544da09825e59ae202a35ac0fc5e5809a2ca63d81e89d17d6c;
        assertTrue(anchor.verifyInclusion(ROOT5, bytes("e4"), path, 4, 5));
    }

    function test_verify_threeLeaves_last() public view {
        bytes32[] memory path = new bytes32[](1);
        path[0] = 0x718fa0369d7475099bc6cb4327e3823a4972285f92bd49971a583c9f08ffb68d;
        assertTrue(anchor.verifyInclusion(ROOT3, bytes("e2"), path, 2, 3));
    }

    function test_verify_eightLeaves_last() public view {
        bytes32[] memory path = new bytes32[](3);
        path[0] = 0xa63dce614f2a0fe1b392fd837ff1a6802bfcd0755eff57cdaf30b3eebaee8c3d;
        path[1] = 0xebab446f54e22e53f32830d82708c8b51cd0a03aa62704b1f99c200f2ac88772;
        path[2] = 0x95669b376bc4e3544da09825e59ae202a35ac0fc5e5809a2ca63d81e89d17d6c;
        assertTrue(anchor.verifyInclusion(ROOT8, bytes("e7"), path, 7, 8));
    }

    // ── 偽の証明は通ってはいけない ───────────────────────────────
    function test_verify_rejectsTamperedEntry() public view {
        bytes32[] memory path = new bytes32[](3);
        path[0] = 0xd38b823b070424fc9303ff6f20f4ddeef6dc32aa02c75d9c8c3ae46062c78f6b;
        path[1] = 0x93a9e19543c6159880b77481786c0b601b301cc0333dd6804c16d228c9010a35;
        path[2] = 0x8e1f887cfc7c7a5e43f202daf67d99ae8f8fd4b33a6b251bcf9f5d83476303ea;
        assertFalse(anchor.verifyInclusion(ROOT5, bytes("e0!"), path, 0, 5));
    }

    /// @dev 本文は本物でも、別の行番号のものだと言ってはいけない
    function test_verify_rejectsWrongIndex() public view {
        bytes32[] memory path = new bytes32[](3);
        path[0] = 0xd38b823b070424fc9303ff6f20f4ddeef6dc32aa02c75d9c8c3ae46062c78f6b;
        path[1] = 0x93a9e19543c6159880b77481786c0b601b301cc0333dd6804c16d228c9010a35;
        path[2] = 0x8e1f887cfc7c7a5e43f202daf67d99ae8f8fd4b33a6b251bcf9f5d83476303ea;
        assertFalse(anchor.verifyInclusion(ROOT5, bytes("e0"), path, 1, 5));
    }

    /// @dev 葉の数を偽ると、たいていは木の形が変わって通らない
    function test_verify_rejectsWrongTreeSize() public view {
        bytes32[] memory path = new bytes32[](1);
        path[0] = 0x95669b376bc4e3544da09825e59ae202a35ac0fc5e5809a2ca63d81e89d17d6c;
        // 本物は (index 4, treeSize 5)。treeSize を 8 と偽ると証明の長さが足りず落ちる
        assertFalse(anchor.verifyInclusion(ROOT5, bytes("e4"), path, 4, 8));
    }

    /// @dev **ここは通ってしまう。** 包含証明は treeSize を縛らない。
    ///
    ///      いちばん左の葉 (index 0) の証明は「すべて右側の兄弟」だけで出来ている。
    ///      検証の手順は fn (葉の位置) の偶奇だけを見て左右を決めるので、
    ///      index 0 では fn が最後まで 0 のまま、treeSize が 5 でも 8 でも
    ///      **同じ計算になる**。だから treeSize を偽っても root に届く。
    ///
    ///      つまり証明が縛るのは (root, index, 中身) の 3 つで、葉の総数は縛らない。
    ///      葉の総数は**アンカーのイベントに載っている値を信じる**しかない。
    ///      CorpusAnchor が treeSize を必須の引数にしているのはこのためで、
    ///      検証する側は証明から treeSize を推定してはいけない。
    function test_verify_treeSizeIsNotBoundByProof_leftmostLeaf() public view {
        bytes32[] memory path = new bytes32[](3);
        path[0] = 0xd38b823b070424fc9303ff6f20f4ddeef6dc32aa02c75d9c8c3ae46062c78f6b;
        path[1] = 0x93a9e19543c6159880b77481786c0b601b301cc0333dd6804c16d228c9010a35;
        path[2] = 0x8e1f887cfc7c7a5e43f202daf67d99ae8f8fd4b33a6b251bcf9f5d83476303ea;
        assertTrue(anchor.verifyInclusion(ROOT5, bytes("e0"), path, 0, 5)); // 本物
        assertTrue(anchor.verifyInclusion(ROOT5, bytes("e0"), path, 0, 8)); // 偽っても通る
    }

    function test_verify_rejectsWrongRoot() public view {
        bytes32[] memory path = new bytes32[](1);
        path[0] = 0x95669b376bc4e3544da09825e59ae202a35ac0fc5e5809a2ca63d81e89d17d6c;
        assertFalse(anchor.verifyInclusion(ROOT8, bytes("e4"), path, 4, 5));
    }

    /// @dev 証明を長くして root に辿り着かせる細工を止める
    function test_verify_rejectsOverlongPath() public view {
        bytes32[] memory path = new bytes32[](3);
        path[0] = 0x95669b376bc4e3544da09825e59ae202a35ac0fc5e5809a2ca63d81e89d17d6c;
        path[1] = bytes32(uint256(1));
        path[2] = bytes32(uint256(2));
        assertFalse(anchor.verifyInclusion(ROOT5, bytes("e4"), path, 4, 5));
    }

    function test_verify_rejectsIndexOutOfRange() public view {
        bytes32[] memory path = new bytes32[](0);
        assertFalse(anchor.verifyInclusion(ROOT1, bytes("e0"), path, 1, 1));
    }

    function test_verify_rejectsZeroTreeSize() public view {
        bytes32[] memory path = new bytes32[](0);
        assertFalse(anchor.verifyInclusion(ROOT1, bytes("e0"), path, 0, 0));
    }

    /// @dev 実際の葉 (URI + 0x00 + 本文) の長さでも通ること。
    ///      葉 1 個の木なので root = 葉のハッシュで自明に確かめられる
    function test_verify_realisticEntryShape() public view {
        bytes memory entry =
            abi.encodePacked("https://w3id.org/kouigenjimonogatari/api/items/0005-01.json", bytes1(0x00), unicode"いつれの御時にか女御更衣あまたさふらひ給けるなかにいとやむことなきゝは");
        bytes32[] memory path = new bytes32[](0);
        assertTrue(anchor.verifyInclusion(anchor.leafHash(entry), entry, path, 0, 1));
    }
}
