// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev 検証用の最小トークン。ERC-20 の必要な部分だけ。
abstract contract MiniToken {
    string public name;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(string memory n) { name = n; }

    function _mint(address to, uint256 v) internal {
        balanceOf[to] += v;
        totalSupply += v;
    }

    function approve(address s, uint256 v) external returns (bool) {
        allowance[msg.sender][s] = v;
        return true;
    }

    function transferFrom(address f, address t, uint256 v) public virtual returns (bool) {
        uint256 a = allowance[f][msg.sender];
        if (a < v) revert InsufficientAllowance();
        allowance[f][msg.sender] = a - v;
        _transfer(f, t, v);
        return true;
    }

    function _transfer(address f, address t, uint256 v) internal {
        if (balanceOf[f] < v) revert InsufficientBalance();
        unchecked { balanceOf[f] -= v; }
        balanceOf[t] += v;
    }
}

/// @notice 円建てステーブルコイン(検証用の模擬)。実物は資金移動業者等しか発行できない。
contract JpyStable is MiniToken {
    constructor() MiniToken("Mock JPY Stable") {}
    function mint(address to, uint256 v) external { _mint(to, v); }
}

/// @notice 不動産セキュリティトークン。裏付け物件を記述レジストリの ID で指す。
/// @dev 実務では譲渡制限(適格投資家のみ等)が付く。ここでは許可リストで最小限を再現。
///
/// **Oasis Sapphire での落とし穴 (2026-08-26 実測)**
///   コンストラクタに `string` を渡すと、配備トランザクションが status 0 で失敗する。
///   `bytes32`・mapping への書き込み・引数なしは成功する。Sapphire は calldata を
///   暗号化するため、可変長引数の扱いで forge と噛み合わないものと思われる。
///   そこで名前はコンストラクタで受けず、配備後に describe() で設定する。
contract SecurityToken is MiniToken {
    bytes32 public propertyId;
    address public immutable issuer;
    mapping(address => bool) public eligible;

    /// @notice 誰でも自分を適格者にできるようにする。試用のための配備でのみ true。
    /// @dev 実務では適格投資家の確認が要る。ここで示したいのは決済の原子性なので、
    ///      入口の審査は省いてある。省いてよい理由と省けない理由は別の話。
    bool public openEligibility;

    error NotEligible(address who);
    error NotIssuer();

    constructor() MiniToken("") {
        issuer = msg.sender;
        eligible[msg.sender] = true;
    }

    /// @notice 裏付け物件を設定する。配備とは分けてある(理由は上のコメント)。
    /// @dev 名前(string)はチェーンに置かない。Sapphire では書き込みも読み出しも
    ///      安定しなかった。表示名は画面側が持つ。
    function setProperty(bytes32 pid) external {
        if (msg.sender != issuer) revert NotIssuer();
        propertyId = pid;
    }

    function setEligible(address who, bool ok) external {
        if (msg.sender != issuer) revert NotIssuer();
        eligible[who] = ok;
    }

    function setOpenEligibility(bool open) external {
        if (msg.sender != issuer) revert NotIssuer();
        openEligibility = open;
    }

    /// @notice 自分を適格者として登録する(試用配備のみ)。
    function selfRegister() external {
        if (!openEligibility) revert NotIssuer();
        eligible[msg.sender] = true;
    }

    function mint(address to, uint256 v) external {
        if (msg.sender != issuer) revert NotIssuer();
        if (!eligible[to]) revert NotEligible(to);
        _mint(to, v);
    }

    function transferFrom(address f, address t, uint256 v) public override returns (bool) {
        if (!eligible[t]) revert NotEligible(t);   // 譲渡制限
        return super.transferFrom(f, t, v);
    }
}
