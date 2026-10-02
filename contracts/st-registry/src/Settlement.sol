// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SecurityToken, JpyStable} from "./Token.sol";
import {PropertyRegistry} from "./PropertyRegistry.sol";
import {Vocabulary} from "./Vocabulary.sol";

/// @dev 決済通貨は ERC-20 でありさえすればよい。
///      JPYC(円)・EURAU(ユーロ)・検証用の模擬コインを、配備時に選べるようにする。
interface IPayToken {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// @title DvP 同時決済
/// @notice ST の受渡しと SC の支払を、1つのトランザクションで同時に確定する。
///
///   銀行送金では「引き落としたが入金はこれから」という中間状態が必ず残る。
///   同じ台帳の上で1つの取引にまとめると、その中間状態が存在しなくなる。
///   これが「原子性」で、スマートコントラクトが与えるのは
///   その1取引の中に条件を書ける、という部分にすぎない。
contract DvPSettlement {
    event Settled(address indexed seller, address indexed buyer, uint256 stAmount, uint256 jpyAmount);

    /// @notice 全部成功するか、全部失敗するか。途中で止まらない。
    /// @param pay 決済通貨。JPYC でも EURAU でも、ERC-20 なら何でもよい。
    function settle(
        SecurityToken st,
        IPayToken pay,
        address seller,
        address buyer,
        uint256 stAmount,
        uint256 payAmount
    ) external {
        // どちらか一方でも失敗すれば、トランザクション全体が巻き戻る
        st.transferFrom(seller, buyer, stAmount);
        pay.transferFrom(buyer, seller, payAmount);
        emit Settled(seller, buyer, stAmount, payAmount);
    }
}

/// @title ST を担保にした借入
/// @notice ケネディクスらが2026年7月31日に「第二段階で検証する」と公表した機能。
///
///   ここが本題。担保評価を自動でやるには、稼働率を読む必要がある。
///   ところが「稼働率」という語は、銘柄によって分母が違う。
///   面積ベースなのか、戸数ベースなのか、店舗を含むのか。
///   目論見書には書いてあるが、運用サイトでは落ちている。
///
///   分母が宣言されていない数値では、契約は評価を実行できない。
///   つまり「拒否する」以外に正しい振る舞いが無い。
///   決済を自動化するほど、記述の標準化が要る、というのはこの意味である。
contract CollateralVault {
    PropertyRegistry public immutable registry;
    JpyStable public immutable jpy;

    uint256 public constant MAX_LTV_BPS = 5000;      // 掛け目 50%
    uint64 public constant MAX_STALENESS = 180 days; // 基準時点がこれより古い数値は使わない
    uint256 public constant OCCUPANCY_FLOOR_BPS = 8000; // 稼働率 80% 未満は担保に取らない

    error UnusableOccupancyBasis(bytes32 basis);
    error StaleData(uint64 asOf);
    error OccupancyTooLow(uint256 bps);
    error ExceedsLtv();

    event Borrowed(address indexed who, bytes32 indexed propertyId, uint256 amount);

    constructor(PropertyRegistry r, JpyStable j) {
        registry = r;
        jpy = j;
    }

    /// @notice 担保余力を計算する。記述が要件を満たさなければ revert する。
    function borrowingPower(bytes32 propertyId) public view returns (uint256) {
        PropertyRegistry.Measure memory occ = registry.get(propertyId, Vocabulary.OCCUPANCY);

        // 分母が宣言されていなければ、この数値は使えない
        if (occ.basis != Vocabulary.BY_AREA && occ.basis != Vocabulary.BY_UNITS) {
            revert UnusableOccupancyBasis(occ.basis);
        }
        if (block.timestamp > occ.asOf + MAX_STALENESS) revert StaleData(occ.asOf);
        if (occ.value < OCCUPANCY_FLOOR_BPS) revert OccupancyTooLow(occ.value);

        PropertyRegistry.Measure memory val = registry.get(propertyId, Vocabulary.APPRAISAL_VALUE);
        if (block.timestamp > val.asOf + MAX_STALENESS) revert StaleData(val.asOf);

        return (val.value * MAX_LTV_BPS) / 10_000;
    }

    function borrow(SecurityToken st, uint256 amount) external {
        uint256 cap = borrowingPower(st.propertyId());
        if (amount > cap) revert ExceedsLtv();
        jpy.mint(msg.sender, amount);
        emit Borrowed(msg.sender, st.propertyId(), amount);
    }
}
