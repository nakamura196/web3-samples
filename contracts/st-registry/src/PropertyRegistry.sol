// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title 物件記述レジストリ
/// @notice 不動産STの裏付け物件を、機械可読な形で記述する。
///
/// 設計の根拠(2026-08-26〜27 の調査より):
///   目論見書は数値に根拠と基準時点を添えている。
///     例 延床面積（登記簿） / 延床面積（検査済証） / 稼働率（面積ベース）
///   ところが運用サイトではそれが落ち、ただの「延床面積」「稼働率」になる。
///   数値だけでは銘柄をまたいで比較できず、担保評価も自動化できない。
///
/// 語彙をコードに書かない
///   項目を定数として契約に埋め込むと、項目を1つ足すたびに配備し直すことになる。
///   **記述の標準は、コードではなくデータであるべき。**
///   そこでこの契約は語彙そのものをチェーン上に持つ。
///     defineField()  どの項目に、どの限定(根拠・基準時点・算入範囲・下位区分)が
///                    要るかを宣言する
///     allowBasis()   その項目に使ってよい根拠の語を登録する(典拠コントロール)
///     record()       宣言に照らして検証し、満たさなければ受け付けない
///
///   語彙の中身は src/data/vocabulary.json。届出書68件(アセットマネージャー7社)の
///   実測から構成したもので、設計ではなく観測。
contract PropertyRegistry {
    /// @dev 測定値。値だけでは意味を持たない。
    struct Measure {
        uint256 value;      // 数値(小数はスケールして整数で持つ)
        bytes32 basis;      // 根拠。REGISTRY(登記簿) INSPECTION(検査済証) BY_AREA(面積ベース) など
        uint64 asOf;        // 基準時点(unix秒)
        bytes32 scope;      // 算入範囲。例「屋根を含まない」
        bytes32 subtype;    // 下位区分。収益単位数における DWELLINGS / ROOMS / TENANTS など
        uint16 vocabVersion;// **どの版の規則で検証されたか**
        address attestedBy; // **誰が申告したか**(署名がなければ送信者)
        bool set;
    }

    /// @dev record() の引数。項目が増えたのでまとめる(stack too deep を避ける)。
    struct Input {
        bytes32 propertyId;
        bytes32 field;
        uint256 value;
        bytes32 basis;
        uint64 asOf;
        bytes32 scope;
        bytes32 subtype;
    }

    /// @dev 項目ごとの宣言。これが語彙の実体。
    struct Spec {
        bool defined;
        bool needsBasis;
        bool needsAsOf;
        bool needsScope;
        bool needsSubtype;
        uint8 tier;      // 0=中核 1=推奨 2=拡張
    }

    address public immutable curator;

    /// @notice 誰でも record() できるようにする。試用のための配備でのみ true にする。
    /// @dev 語彙の検証は変わらない。「誰が書けるか」と「何を書けるか」は別の話で、
    ///      この試作が示したいのは後者。前者を開けても主張は損なわれない。
    bool public openRecording;

    mapping(bytes32 => Spec) public spec;                             // 項目 => 宣言
    mapping(bytes32 => mapping(bytes32 => bool)) public basisAllowed; // 項目 => 根拠 => 可
    mapping(bytes32 => mapping(bytes32 => Measure)) private _m;       // 物件 => 項目 => 測定値
    bytes32[] private _fields;

    /// @notice 語彙の版。規則を変えたら上げる。
    /// @dev **既に記録された値を遡って無効にしない。** v0.1 の規則で検証された値は
    ///      v0.1 の値として残る。記述はその時々の規則の下で作られる、という
    ///      アーカイブの原則をそのまま持ち込んでいる。後から規則を変えて
    ///      過去の記述を否定すると、何が正しかったのかが分からなくなる。
    uint16 public vocabVersion = 1;

    /// @dev 項目がどの版で宣言されたか
    mapping(bytes32 => uint16) public fieldSince;

    // ── EIP-712。申告者の署名を検証する ──────────────────────────
    bytes32 private constant TYPEHASH = keccak256(
        "Measure(bytes32 propertyId,bytes32 field,uint256 value,bytes32 basis,uint64 asOf,bytes32 scope,bytes32 subtype)"
    );
    bytes32 private immutable _domainSeparator;

    event FieldDefined(bytes32 indexed field, uint8 tier);
    event VocabVersionBumped(uint16 from, uint16 to);
    event Attested(bytes32 indexed propertyId, bytes32 indexed field, address indexed by);
    event BasisAllowed(bytes32 indexed field, bytes32 indexed basis);
    event Recorded(bytes32 indexed propertyId, bytes32 indexed field, uint256 value, bytes32 basis, uint64 asOf);

    error NotCurator();
    error UnknownField(bytes32 field);
    error BasisRequired(bytes32 field);
    error BasisNotInVocabulary(bytes32 field, bytes32 basis);
    error AsOfRequired(bytes32 field);
    error ScopeRequired(bytes32 field);
    error SubtypeRequired(bytes32 field);
    error NotRecorded(bytes32 propertyId, bytes32 field);
    error BadSignature();

    modifier onlyCurator() {
        if (msg.sender != curator) revert NotCurator();
        _;
    }

    /// @dev 語彙の宣言は常に curator のみ。記録だけを開放できる。
    modifier canRecord() {
        if (!openRecording && msg.sender != curator) revert NotCurator();
        _;
    }

    function setOpenRecording(bool open) external onlyCurator {
        openRecording = open;
    }

    constructor() {
        curator = msg.sender;
        _domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("PropertyRegistry"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparator;
    }

    /// @notice 語彙の版を上げる。既存の記録は書き換えない。
    function bumpVocabVersion() external onlyCurator {
        uint16 from = vocabVersion;
        vocabVersion = from + 1;
        emit VocabVersionBumped(from, vocabVersion);
    }

    // ── 語彙 ─────────────────────────────────────────────────────

    /// @notice 項目を語彙に加える。何が必須かをここで宣言する。
    function defineField(
        bytes32 field,
        bool needsBasis,
        bool needsAsOf,
        bool needsScope,
        bool needsSubtype,
        uint8 tier
    ) external onlyCurator {
        if (!spec[field].defined) {
            _fields.push(field);
            fieldSince[field] = vocabVersion;
        }
        spec[field] = Spec(true, needsBasis, needsAsOf, needsScope, needsSubtype, tier);
        emit FieldDefined(field, tier);
    }

    /// @notice その項目に使ってよい根拠の語を登録する。
    /// @dev 典拠コントロール。「登記簿」は延床面積には使えるが稼働率には使えない、
    ///      という区別をチェーン上に持つ。
    function allowBasis(bytes32 field, bytes32 basis) external onlyCurator {
        if (!spec[field].defined) revert UnknownField(field);
        basisAllowed[field][basis] = true;
        emit BasisAllowed(field, basis);
    }

    function fieldCount() external view returns (uint256) {
        return _fields.length;
    }

    function fieldAt(uint256 i) external view returns (bytes32) {
        return _fields[i];
    }

    // ── 記録 ─────────────────────────────────────────────────────

    function _validate(Input memory i) internal view {
        Spec memory s = spec[i.field];
        if (!s.defined) revert UnknownField(i.field);
        if (s.needsBasis) {
            if (i.basis == bytes32(0)) revert BasisRequired(i.field);
            if (!basisAllowed[i.field][i.basis]) revert BasisNotInVocabulary(i.field, i.basis);
        }
        if (s.needsAsOf && i.asOf == 0) revert AsOfRequired(i.field);
        if (s.needsScope && i.scope == bytes32(0)) revert ScopeRequired(i.field);
        if (s.needsSubtype && i.subtype == bytes32(0)) revert SubtypeRequired(i.field);
    }

    function _store(Input memory i, address by) internal {
        _m[i.propertyId][i.field] =
            Measure(i.value, i.basis, i.asOf, i.scope, i.subtype, vocabVersion, by, true);
        emit Recorded(i.propertyId, i.field, i.value, i.basis, i.asOf);
        emit Attested(i.propertyId, i.field, by);
    }

    /// @notice 測定値を記録する。宣言を満たさなければ受け付けない。
    function record(
        bytes32 propertyId,
        bytes32 field,
        uint256 value,
        bytes32 basis,
        uint64 asOf,
        bytes32 scope,
        bytes32 subtype
    ) public canRecord {
        Input memory i = Input(propertyId, field, value, basis, asOf, scope, subtype);
        _validate(i);
        _store(i, msg.sender);
    }

    /// @notice 算入範囲と下位区分が要らない項目のための短い形。
    function record(bytes32 propertyId, bytes32 field, uint256 value, bytes32 basis, uint64 asOf)
        external
    {
        record(propertyId, field, value, basis, asOf, bytes32(0), bytes32(0));
    }

    /// @notice 申告者の署名つきで記録する。
    /// @dev **誰が言ったかを記録に残す。** 送信者と申告者を分けられるので、
    ///      アセットマネージャーが署名し、別の誰かが送信する形が取れる。
    ///      記述の来歴として、送信者よりも申告者のほうが意味を持つ。
    function recordSigned(Input calldata i, bytes calldata sig) external {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domainSeparator,
                keccak256(abi.encode(TYPEHASH, i.propertyId, i.field, i.value, i.basis, i.asOf, i.scope, i.subtype))
            )
        );
        address signer = _recover(digest, sig);
        if (signer == address(0)) revert BadSignature();
        if (!openRecording && signer != curator) revert NotCurator();

        _validate(i);
        _store(i, signer);
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }

    /// @notice 値だけでなく、限定もすべて返す。
    function get(bytes32 propertyId, bytes32 field) external view returns (Measure memory) {
        Measure memory m = _m[propertyId][field];
        if (!m.set) revert NotRecorded(propertyId, field);
        return m;
    }

    function isRecorded(bytes32 propertyId, bytes32 field) external view returns (bool) {
        return _m[propertyId][field].set;
    }
}
