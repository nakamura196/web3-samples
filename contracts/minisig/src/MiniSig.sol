// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MiniSig — 最小のマルチシグウォレット
/// @notice 教材用。実運用には Safe を使うこと。
///
/// 仕組みは3つだけ。
///   1. 所有者リストと閾値を持つ
///   2. 「これから実行する取引」を一意なハッシュにする
///   3. そのハッシュへの署名を閾値の数だけ検証し、通れば実行する
///
/// 秘密鍵はどこにも渡らない。署名から署名者を逆算（ecrecover）して照合するだけ。
contract MiniSig {
    // ---------------------------------------------------------------- state

    address[] private _owners;
    mapping(address => bool) public isOwner;

    /// @notice 実行に必要な署名の数。自分自身の決議でのみ変更できる
    uint256 public threshold;

    /// @notice 実行のたびに増える。同じ署名の再利用を防ぐ
    uint256 public nonce;

    // --------------------------------------------------------------- events

    event Executed(bytes32 indexed txHash, uint256 indexed nonce, address to, uint256 value);
    event Received(address indexed from, uint256 value);
    event OwnerAdded(address indexed owner, uint256 threshold);
    event OwnerRemoved(address indexed owner, uint256 threshold);
    event ThresholdChanged(uint256 threshold);

    // --------------------------------------------------------------- errors

    error BadThreshold();
    error ZeroAddress();
    error DuplicateOwner();
    error TooFewSignatures();
    error NotAnOwner(address recovered);
    error SignaturesNotAscending();
    error CallFailed(bytes returndata);
    error OnlySelf();
    error AlreadyOwner();
    error NotFound();

    // ------------------------------------------------------------ modifier

    /// @dev 自分自身からの呼び出しだけを通す。
    ///      つまり execTransaction を経由するしかなく、
    ///      所有者の変更にも閾値ぶんの署名が要る。**外部の管理者は存在しない。**
    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlySelf();
        _;
    }

    // ---------------------------------------------------------- constructor

    constructor(address[] memory owners_, uint256 threshold_) {
        if (threshold_ == 0 || threshold_ > owners_.length) revert BadThreshold();

        for (uint256 i = 0; i < owners_.length; i++) {
            address o = owners_[i];
            if (o == address(0)) revert ZeroAddress();
            if (isOwner[o]) revert DuplicateOwner();
            isOwner[o] = true;
            _owners.push(o);
        }
        threshold = threshold_;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // ----------------------------------------------------------- view utils

    function owners() external view returns (address[] memory) {
        return _owners;
    }

    function ownerCount() external view returns (uint256) {
        return _owners.length;
    }

    /// @notice 署名対象のハッシュ。
    /// @dev chainid と自身のアドレスを混ぜているので、
    ///      別チェーン・別コントラクトへ署名を使い回せない。
    function txHash(address to, uint256 value, bytes memory data, uint256 nonce_)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(block.chainid, address(this), to, value, keccak256(data), nonce_)
        );
    }

    /// @notice 実際に署名する相手（EIP-191 の前置き付き）。
    /// @dev `cast wallet sign <txHash>` が作る署名と一致する。
    function digest(address to, uint256 value, bytes memory data, uint256 nonce_)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", txHash(to, value, data, nonce_))
        );
    }

    // ------------------------------------------------- 自分自身を書き換える

    /// @notice 所有者を追加する。**MiniSig 自身の決議でのみ呼べる。**
    function addOwner(address owner_, uint256 newThreshold) external onlySelf {
        if (owner_ == address(0)) revert ZeroAddress();
        if (isOwner[owner_]) revert AlreadyOwner();

        isOwner[owner_] = true;
        _owners.push(owner_);

        _setThreshold(newThreshold);
        emit OwnerAdded(owner_, newThreshold);
    }

    /// @notice 所有者を外す。**MiniSig 自身の決議でのみ呼べる。**
    function removeOwner(address owner_, uint256 newThreshold) external onlySelf {
        if (!isOwner[owner_]) revert NotFound();

        uint256 n = _owners.length;
        for (uint256 i = 0; i < n; i++) {
            if (_owners[i] == owner_) {
                _owners[i] = _owners[n - 1];
                _owners.pop();
                break;
            }
        }
        isOwner[owner_] = false;

        _setThreshold(newThreshold);
        emit OwnerRemoved(owner_, newThreshold);
    }

    /// @notice 閾値だけを変える。**MiniSig 自身の決議でのみ呼べる。**
    function changeThreshold(uint256 newThreshold) external onlySelf {
        _setThreshold(newThreshold);
        emit ThresholdChanged(newThreshold);
    }

    function _setThreshold(uint256 t) internal {
        // 所有者数を超える閾値や 0 は、金庫を永久にロックする
        if (t == 0 || t > _owners.length) revert BadThreshold();
        threshold = t;
    }

    // -------------------------------------------------------------- execute

    /// @notice 閾値ぶんの署名を添えて取引を実行する。
    /// @param signatures 65バイトの署名を連結したもの。
    ///                   **署名者アドレスの昇順**に並べること（重複排除のため）。
    function execTransaction(address to, uint256 value, bytes calldata data, bytes calldata signatures)
        external
        returns (bytes memory)
    {
        uint256 n = nonce;
        bytes32 h = txHash(to, value, data, n);

        _checkSignatures(h, signatures);

        // 実行より前に増やす。再入されても同じ nonce では通らない。
        nonce = n + 1;

        (bool ok, bytes memory ret) = to.call{value: value}(data);
        if (!ok) revert CallFailed(ret);

        emit Executed(h, n, to, value);
        return ret;
    }

    // ------------------------------------------------------------- internal

    function _checkSignatures(bytes32 h, bytes calldata signatures) internal view {
        uint256 t = threshold;
        if (signatures.length < t * 65) revert TooFewSignatures();

        bytes32 d = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));

        address last = address(0);
        for (uint256 i = 0; i < t; i++) {
            (uint8 v, bytes32 r, bytes32 s) = _split(signatures, i);
            address signer = ecrecover(d, v, r, s);

            if (signer == address(0) || !isOwner[signer]) revert NotAnOwner(signer);

            // 昇順を強制することで、同じ署名者を2回数えられなくなる。
            // マッピングを使わずに重複を排除する定石。
            if (signer <= last) revert SignaturesNotAscending();
            last = signer;
        }
    }

    function _split(bytes calldata sig, uint256 i)
        internal
        pure
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        uint256 off = i * 65;
        assembly {
            let p := add(sig.offset, off)
            r := calldataload(p)
            s := calldataload(add(p, 32))
            v := byte(0, calldataload(add(p, 64)))
        }
    }
}
