// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PropertyRegistry} from "../src/PropertyRegistry.sol";
import {SecurityToken, JpyStable} from "../src/Token.sol";
import {DvPSettlement, CollateralVault} from "../src/Settlement.sol";
import {ConfidentialRent} from "../src/ConfidentialRent.sol";
import {Vocabulary} from "../src/Vocabulary.sol";

/// 銘柄A(根拠つき)と銘柄B(根拠なし)を用意した状態で配備する。
///
/// **銘柄名は架空。** 面積・鑑定評価額・稼働率は、公開されている
/// ケネディクス物流3件の目論見書(2025年5月)の数値に基づく。
/// ただし賃料は目論見書で「非開示」とされているため、ここでは仮の値を置いている。
/// 実在の物件名を付けると、創作した賃料が実データと取り違えられる。
/// 画面はこの2つを並べて、同じ100%が違う結末になることを見せる。
contract Deploy is Script {

    /// 配備してから名前を付ける。Sapphire ではコンストラクタに string を渡せないため。
    function _st(string memory, bytes32 pid) internal returns (SecurityToken s) {
        s = new SecurityToken();
        s.setProperty(pid);
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        PropertyRegistry reg = new PropertyRegistry();
        JpyStable jpy = new JpyStable();
        DvPSettlement dvp = new DvPSettlement();
        CollateralVault vault = new CollateralVault(reg, jpy);

        bytes32 A = "PROP_A";
        bytes32 B = "PROP_B";
        uint64 recent = uint64(block.timestamp - 30 days);

        // 語彙をチェーンに載せる。項目は定数ではなくデータとして持つ。
        Vocabulary.install(reg);

        // 銘柄A: 目論見書の書き方。根拠と基準時点がある
        reg.record(A, Vocabulary.OCCUPANCY, 10_000, Vocabulary.BY_AREA, recent);
        reg.record(A, Vocabulary.GROSS_FLOOR_AREA, 2_014_841, Vocabulary.REGISTRY, recent);
        reg.record(A, Vocabulary.APPRAISAL_VALUE, 8_600_000_000, bytes32(0), recent);
        reg.record(A, Vocabulary.LAND_AREA, 2_057_005, Vocabulary.REGISTRY, recent);
        // 収益単位数。下位区分(テナント数)の宣言が必須
        reg.record(A, Vocabulary.REVENUE_UNITS, 2, bytes32(0), recent, bytes32(0), Vocabulary.TENANTS);

        // 銘柄B: 運用サイトの書き方。稼働率の分母が宣言されていない
        //   語彙にない根拠は record() が受け付けないため、稼働率は登録できない。
        //   「根拠なしでも数値だけ載る」状態を再現するには、宣言を外した項目が要る。
        reg.defineField("occupancyUndeclared", false, true, false, false, 2);
        reg.record(B, "occupancyUndeclared", 10_000, bytes32(0), recent);
        reg.record(B, Vocabulary.APPRAISAL_VALUE, 8_600_000_000, bytes32(0), recent);

        // 目論見書で「非開示」とされる賃料。秘匿EVMの上でだけ、隠したまま使える。
        ConfidentialRent rent = new ConfidentialRent();
        rent.setRent(A, 500_000_000);   // 仮の値。実物は目論見書で「非開示」
        rent.setRent(B, 500_000_000);   // 同上

        SecurityToken stA = _st("", A);
        SecurityToken stB = _st("", B);

        address me = vm.addr(pk);
        stA.setEligible(me, true);
        stA.mint(me, 100);
        stB.setEligible(me, true);
        stB.mint(me, 100);
        jpy.mint(me, 100_000_000);

        // 訪問者が買主として DvP を試せるようにする。
        // 売主(curator)は事前に承認し、訪問者は自分を適格者として登録できる。
        stA.setOpenEligibility(true);
        stB.setOpenEligibility(true);
        stA.approve(address(dvp), type(uint256).max);
        stB.approve(address(dvp), type(uint256).max);

        vm.stopBroadcast();

        console.log("PropertyRegistry", address(reg));
        console.log("JpyStable       ", address(jpy));
        console.log("DvPSettlement   ", address(dvp));
        console.log("CollateralVault ", address(vault));
        console.log("SecurityToken A ", address(stA));
        console.log("SecurityToken B ", address(stB));
        console.log("ConfidentialRent", address(rent));
    }
}
