// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title 本文の集まり (54 帖 / 25,065 行) を 1 個の root で記録し、1 行だけを証明させる
/// @notice ndl-witness の `VersionAnchor` は資料 1 件につき digest 1 個を記録した。
///         校異源氏物語は 54 帖・25,065 行の集まりなので、同じやり方だと
///         25,065 回アンカーすることになる (実測 27,436 ガス × 25,065 = 約 6.9 億ガス)。
///
///         ここでは RFC 6962 の Merkle ツリーの root を **1 個だけ**載せる。
///         そのうえで「25,065 行のうちこの 1 行は、その版に含まれていた」を
///         **15 個のハッシュ (480 バイト)** で検証できるようにする。
///         本文 5.87 MB を相手に渡す必要がない。
///
/// ── ndl-witness から引き継いだ 3 つの決めごと ────────────────────
/// 1. **誰でも呼べる。** 呼び手を作った側に限ると、記録を作る主体と監査される主体が
///    同じになる。did-prototype (案A) で行き止まりになった構図そのもの。
///    **とくにこのコントラクトでは、それが自分に跳ね返る。**
///    ndl-witness では中村は NDL を外から見る第三者だったが、校異源氏物語では
///    作っている側である。自分が自分の root を記録しても、
///    「後から全部作り直せる」問題は消えない。他人が同じ root を記録したときに
///    はじめて意味が出る。だからここは開けてある。
/// 2. **状態を持たない。** 「最新の root」を変数で持つと、その 1 個を書き換えるだけで
///    過去が消える。最新がどれかは、ログを時系列で読む側が決める。
///    `verifyInclusion` が root を引数で受け取るのはこのため。
///    このコントラクトは、どの root が正しいかを決めない。
/// 3. **正規化の方式を digest と一組で持ち回る。** `spec` がそれで、
///    どう並べてどうハッシュしたかが分からない root は検証できない。
///
/// ── なぜ SHA-256 なのか ─────────────────────────────────────────
/// EVM で安いのは Keccak-256 (`keccak256`) の側だが、SHA-256 にも
/// プリコンパイル (アドレス 0x02、60 + 12/word ガス) がある。
/// オフチェーンを依存パッケージゼロに保つには SHA-256 が要る (Node は
/// Keccak-256 を持たない)。両方を満たせるのが SHA-256 だけだった。
contract CorpusAnchor {
    /// @param corpusId   資料群の識別子。SHA-256("https://w3id.org/kouigenjimonogatari/")
    /// @param root       RFC 6962 の Merkle Tree Hash
    /// @param observer   記録した者。作った側とは限らない
    /// @param capturedAt **その内容を見た時刻**。記録された時刻ではない
    /// @param treeSize   葉の数。RFC 6962 の検証にはこれが要る (木の形が決まる)
    /// @param sourceUri  出典。git の commit を指す URL を想定
    /// @param spec       葉の作り方とツリーの組み方。これが無いと root を再現できない
    event CorpusAnchored(
        bytes32 indexed corpusId,
        bytes32 indexed root,
        address indexed observer,
        uint64 capturedAt,
        uint32 treeSize,
        string sourceUri,
        string spec
    );

    error ZeroId();
    error EmptyTree();
    error EmptyString();
    error FutureCapture();

    /// @notice root を記録する。誰でも呼べる。
    /// @dev capturedAt を引数に取るのは、**見た時刻とブロックの時刻が違う**から。
    ///      未来を申告できないことだけはチェーン側で止められる。
    function anchor(
        bytes32 corpusId,
        bytes32 root,
        uint64 capturedAt,
        uint32 treeSize,
        string calldata sourceUri,
        string calldata spec
    ) external {
        if (corpusId == bytes32(0) || root == bytes32(0)) revert ZeroId();
        if (treeSize == 0) revert EmptyTree();
        if (bytes(sourceUri).length == 0 || bytes(spec).length == 0) revert EmptyString();
        if (capturedAt > block.timestamp) revert FutureCapture();
        emit CorpusAnchored(corpusId, root, msg.sender, capturedAt, treeSize, sourceUri, spec);
    }

    /// @notice 葉のハッシュ。RFC 6962 の MTH({d0}) = SHA-256(0x00 || d0)
    /// @dev 先頭の 0x00 は葉と節を区別するためにある。これが無いと、
    ///      ある節のハッシュを葉として出す攻撃が通る。
    function leafHash(bytes calldata entry) public pure returns (bytes32) {
        return sha256(abi.encodePacked(bytes1(0x00), entry));
    }

    /// @notice 節のハッシュ。SHA-256(0x01 || left || right)
    function nodeHash(bytes32 left, bytes32 right) public pure returns (bytes32) {
        return sha256(abi.encodePacked(bytes1(0x01), left, right));
    }

    /// @notice 包含証明の検証。RFC 6962 セクション 2.1.1 のアルゴリズムそのまま。
    /// @dev lib/merkle.mjs の verify() と**同じ手順**にしてある。
    ///      片方だけ直すと通らなくなるので、変えるときは両方を変える。
    ///      pure なので、外から呼ぶ限りガスは要らない。
    /// @param root     どの版に対して証明するか。ログから読んだ値を渡す
    /// @param entry    葉の中身 (URI + 0x00 + seg の中身)
    /// @param path     兄弟ハッシュの列。葉の側から根の側へ
    /// @param index    葉の位置 (0 起算)
    /// @param treeSize 葉の総数
    function verifyInclusion(
        bytes32 root,
        bytes calldata entry,
        bytes32[] calldata path,
        uint64 index,
        uint64 treeSize
    ) external pure returns (bool) {
        if (treeSize == 0 || index >= treeSize) return false;

        uint64 fn = index;
        uint64 sn = treeSize - 1;
        bytes32 r = leafHash(entry);

        for (uint256 i = 0; i < path.length; i++) {
            if (sn == 0) return false; // 証明が長すぎる
            if (fn & 1 == 1 || fn == sn) {
                r = nodeHash(path[i], r);
                while (fn != 0 && fn & 1 == 0) {
                    fn >>= 1;
                    sn >>= 1;
                }
            } else {
                r = nodeHash(r, path[i]);
            }
            fn >>= 1;
            sn >>= 1;
        }
        return sn == 0 && r == root;
    }
}
