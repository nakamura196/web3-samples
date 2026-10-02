// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {PropertyRegistry} from "../src/PropertyRegistry.sol";
import {SecurityToken, JpyStable} from "../src/Token.sol";
import {DvPSettlement, CollateralVault, IPayToken} from "../src/Settlement.sol";
import {Vocabulary} from "../src/Vocabulary.sol";

/// 検証したいこと
///   (1) DvP は本当に「全部か、全部無しか」になっているか
///   (2) 記述が標準化されていないと、担保評価の契約は実行できないか
///
/// (2) が本題。決済を自動化するほど記述の標準化が要る、という主張を
/// 動くコードで確かめる。
contract DvpTest is Test {
    PropertyRegistry reg;
    JpyStable jpy;
    DvPSettlement dvp;
    CollateralVault vault;

    // 銘柄A: 目論見書どおり、稼働率の分母が宣言されている
    bytes32 constant PROP_A = "PROP_A";
    // 銘柄B: 運用サイトと同じ。ただの「稼働率」で分母が無い
    bytes32 constant PROP_B = "PROP_B";
    bytes32 constant UNDECLARED_OCC = "occupancyUndeclared";

    address seller = address(0xA11CE);
    address buyer = address(0xB0B);

    SecurityToken stA;
    SecurityToken stB;


    /// 配備してから名前を付ける。Sapphire ではコンストラクタに string を渡せないため。
    function _st(string memory, bytes32 pid) internal returns (SecurityToken s) {
        s = new SecurityToken();
        s.setProperty(pid);
    }

    function setUp() public {
        vm.warp(1_756_000_000); // 2025-08 ごろ。asOf を過去に置けるように

        reg = new PropertyRegistry();
        jpy = new JpyStable();
        dvp = new DvPSettlement();
        vault = new CollateralVault(reg, jpy);

        stA = _st("KDX Logistics Atsugi ST", PROP_A);
        stB = _st("Undeclared Basis ST", PROP_B);

        uint64 recent = uint64(block.timestamp - 30 days);
        Vocabulary.install(reg);

        // --- 銘柄A: 目論見書の書き方 ---------------------------------
        // 「稼働率（面積ベース）100％」「延床面積（登記簿）20,148.41㎡」
        reg.record(PROP_A, Vocabulary.OCCUPANCY, 10_000, Vocabulary.BY_AREA, recent);
        reg.record(PROP_A, Vocabulary.GROSS_FLOOR_AREA, 2_014_841, Vocabulary.REGISTRY, recent);
        reg.record(PROP_A, Vocabulary.APPRAISAL_VALUE, 8_600_000_000, bytes32(0), recent);

        // --- 銘柄B: 運用サイトの書き方 -------------------------------
        // 「稼働率 100％」。分母がどこにも書かれていない。
        // 語彙にない根拠は record() が弾くので、稼働率としては登録できない。
        // 「根拠なしの数値が載っている」状態は、宣言を外した別項目で再現する。
        reg.defineField(UNDECLARED_OCC, false, true, false, false, 2);
        reg.record(PROP_B, UNDECLARED_OCC, 10_000, bytes32(0), recent);
        reg.record(PROP_B, Vocabulary.APPRAISAL_VALUE, 8_600_000_000, bytes32(0), recent);

        // 売買の準備
        stA.setEligible(seller, true);
        stA.setEligible(buyer, true);
        stA.mint(seller, 100);
        jpy.mint(buyer, 100_000_000);

        vm.prank(seller);
        stA.approve(address(dvp), type(uint256).max);
        vm.prank(buyer);
        jpy.approve(address(dvp), type(uint256).max);
    }

    // ------------------------------------------------------------------
    // (1) 原子性
    // ------------------------------------------------------------------

    /// STの受渡しと代金の支払が、1つの取引で同時に確定する
    function test_DvP_settles_atomically() public {
        dvp.settle(stA, IPayToken(address(jpy)), seller, buyer, 10, 1_000_000);

        assertEq(stA.balanceOf(buyer), 10, unicode"買主にSTが渡っている");
        assertEq(stA.balanceOf(seller), 90);
        assertEq(jpy.balanceOf(seller), 1_000_000, unicode"売主に代金が渡っている");
    }

    /// 代金側が足りなければ、STの移転も含めて全部巻き戻る。
    /// 銀行送金にある「引き落としたが入金はこれから」という中間状態が存在しない。
    function test_DvP_reverts_whole_trade_when_payment_leg_fails() public {
        uint256 tooMuch = 999_999_999_999;

        vm.expectRevert();
        dvp.settle(stA, IPayToken(address(jpy)), seller, buyer, 10, tooMuch);

        assertEq(stA.balanceOf(seller), 100, unicode"STは動いていない");
        assertEq(stA.balanceOf(buyer), 0);
        assertEq(jpy.balanceOf(seller), 0, unicode"代金も動いていない");
    }

    // ------------------------------------------------------------------
    // (2) 本題 — 記述が標準化されていないと、担保評価が実行できない
    // ------------------------------------------------------------------

    /// 銘柄A: 稼働率の分母が「面積ベース」と宣言されている → 借りられる
    function test_collateral_works_when_basis_is_declared() public view {
        uint256 cap = vault.borrowingPower(PROP_A);
        assertEq(cap, 4_300_000_000, unicode"鑑定評価額の50%まで");
    }

    /// 銘柄B: 数値は銘柄Aと全く同じ100%。しかし分母が書かれていない。
    ///
    /// 語彙をチェーンに載せたことで、拒否が2段階になった。
    ///   (1) レジストリが登録を拒否する — 根拠のない稼働率は、そもそも記録できない
    ///   (2) 結果として担保評価も成立しない — 参照すべき項目が存在しない
    /// 以前は (2) だけだった。標準を効かせると、悪い値は入口で止まる。
    function test_registry_refuses_occupancy_without_a_declared_basis() public {
        bytes32 field = Vocabulary.OCCUPANCY;
        uint64 now_ = uint64(block.timestamp);

        vm.expectRevert(abi.encodeWithSelector(PropertyRegistry.BasisRequired.selector, field));
        reg.record(PROP_B, field, 10_000, bytes32(0), now_);
    }

    /// 数値は同じでも、片方は担保評価が成立しない
    function test_collateral_REFUSES_when_basis_is_undeclared() public {
        // 値そのものは両方とも 100%
        assertEq(
            reg.get(PROP_A, Vocabulary.OCCUPANCY).value,
            reg.get(PROP_B, UNDECLARED_OCC).value,
            unicode"稼働率の数値は両方とも100%"
        );

        bytes memory expected = abi.encodeWithSelector(
            PropertyRegistry.NotRecorded.selector, PROP_B, Vocabulary.OCCUPANCY
        );

        vm.expectRevert(expected);
        vault.borrowingPower(PROP_B);
    }

    /// 基準時点が古い数値は使わない。目論見書は発行時の一枚絵であり、
    /// 稼働率はその後動く。継続更新される層が無いと、この判定が通らなくなる。
    function test_collateral_refuses_stale_data() public {
        vm.warp(block.timestamp + 200 days);

        vm.expectRevert();
        vault.borrowingPower(PROP_A);
    }

    /// そもそも根拠を書かずに登録することができない(型で防いでいる)
    function test_registry_rejects_value_without_basis() public {
        // 引数の中で外部呼び出しをすると、expectRevert がそちらに掛かってしまう。
        // 先に取り出しておく。
        bytes32 field = Vocabulary.OCCUPANCY;

        vm.expectRevert(abi.encodeWithSelector(PropertyRegistry.BasisRequired.selector, field));
        reg.record(PROP_A, field, 10_000, bytes32(0), uint64(block.timestamp));
    }

    /// 基準時点なしでも登録できない
    function test_registry_rejects_value_without_asof() public {
        bytes32 field = Vocabulary.OCCUPANCY;
        bytes32 basis = Vocabulary.BY_AREA;

        vm.expectRevert(abi.encodeWithSelector(PropertyRegistry.AsOfRequired.selector, field));
        reg.record(PROP_A, field, 10_000, basis, 0);
    }
}
