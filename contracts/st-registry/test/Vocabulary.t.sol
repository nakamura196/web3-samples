// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PropertyRegistry} from "../src/PropertyRegistry.sol";
import {Vocabulary} from "../src/Vocabulary.sol";

/// 語彙がチェーン上のデータとして機能しているかを確かめる。
/// 項目を足すのに契約の配備し直しが要らないこと、
/// 根拠の語が項目ごとに限定されていること(典拠コントロール)が要点。
contract VocabularyTest is Test {
    PropertyRegistry reg;
    bytes32 constant P = "PROP_A";

    function setUp() public {
        vm.warp(1_756_000_000);
        reg = new PropertyRegistry();
        Vocabulary.install(reg);
    }

    /// 語彙が載っている
    function test_vocabulary_is_on_chain() public view {
        assertEq(reg.fieldCount(), 12, unicode"12項目が宣言されている");
        (bool defined,,,,, uint8 tier) = reg.spec(Vocabulary.OCCUPANCY);
        assertTrue(defined);
        assertEq(tier, 1, unicode"稼働率は推奨(tier 1)");
    }

    /// 語彙にない項目は登録できない
    function test_rejects_unknown_field() public {
        vm.expectRevert(abi.encodeWithSelector(PropertyRegistry.UnknownField.selector, bytes32("nope")));
        reg.record(P, "nope", 1, bytes32(0), uint64(block.timestamp));
    }

    /// 根拠の語は項目ごとに限定されている。
    /// 「登記簿」は延床面積には使えるが、稼働率には使えない。
    function test_basis_is_scoped_to_the_field() public {
        uint64 now_ = uint64(block.timestamp);

        reg.record(P, Vocabulary.GROSS_FLOOR_AREA, 2_014_841, Vocabulary.REGISTRY, now_);
        assertTrue(reg.isRecorded(P, Vocabulary.GROSS_FLOOR_AREA), unicode"延床面積に登記簿は使える");

        vm.expectRevert(
            abi.encodeWithSelector(
                PropertyRegistry.BasisNotInVocabulary.selector, Vocabulary.OCCUPANCY, Vocabulary.REGISTRY
            )
        );
        reg.record(P, Vocabulary.OCCUPANCY, 10_000, Vocabulary.REGISTRY, now_);
    }

    /// 収益単位数は下位区分の宣言が必須。
    /// 戸数・室数・テナント数を束ねる上位概念で、どの実務にも存在しなかったもの。
    function test_revenue_units_requires_a_subtype() public {
        uint64 now_ = uint64(block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.SubtypeRequired.selector, Vocabulary.REVENUE_UNITS)
        );
        reg.record(P, Vocabulary.REVENUE_UNITS, 138, bytes32(0), now_, bytes32(0), bytes32(0));

        reg.record(P, Vocabulary.REVENUE_UNITS, 138, bytes32(0), now_, bytes32(0), Vocabulary.ROOMS);
        assertEq(reg.get(P, Vocabulary.REVENUE_UNITS).subtype, Vocabulary.ROOMS);
    }

    /// 賃貸可能面積は算入範囲が必須。
    /// 実例:「賃貸可能面積（本物件の屋根を含みません。）」
    function test_leasable_area_requires_scope() public {
        uint64 now_ = uint64(block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.ScopeRequired.selector, Vocabulary.LEASABLE_AREA)
        );
        reg.record(P, Vocabulary.LEASABLE_AREA, 2_026_941, bytes32(0), now_, bytes32(0), bytes32(0));

        reg.record(P, Vocabulary.LEASABLE_AREA, 2_026_941, bytes32(0), now_, "EXCL_ROOF", bytes32(0));
        assertEq(reg.get(P, Vocabulary.LEASABLE_AREA).scope, bytes32("EXCL_ROOF"));
    }

    /// 記録を開放しても、語彙の検証は変わらない。
    /// 「誰が書けるか」と「何を書けるか」は別の話。
    function test_open_recording_still_enforces_the_vocabulary() public {
        reg.setOpenRecording(true);
        address visitor = address(0xBEEF);
        uint64 now_ = uint64(block.timestamp);

        // 語彙どおりなら、誰でも書ける
        vm.prank(visitor);
        reg.record(P, Vocabulary.GROSS_FLOOR_AREA, 1000, Vocabulary.REGISTRY, now_);
        assertTrue(reg.isRecorded(P, Vocabulary.GROSS_FLOOR_AREA));

        // 語彙に反すれば、誰であろうと弾かれる
        vm.prank(visitor);
        vm.expectRevert(
            abi.encodeWithSelector(
                PropertyRegistry.BasisNotInVocabulary.selector, Vocabulary.OCCUPANCY, Vocabulary.REGISTRY
            )
        );
        reg.record(P, Vocabulary.OCCUPANCY, 10_000, Vocabulary.REGISTRY, now_);

        // 語彙の宣言そのものは開放されない
        vm.prank(visitor);
        vm.expectRevert(PropertyRegistry.NotCurator.selector);
        reg.defineField("whatever", false, false, false, false, 0);
    }

    /// 項目を足すのに契約の配備し直しは要らない
    function test_new_field_without_redeploy() public {
        uint256 before = reg.fieldCount();
        reg.defineField("seismicPml", true, true, false, false, 2);
        reg.allowBasis("seismicPml", "PML1");
        reg.record(P, "seismicPml", 730, "PML1", uint64(block.timestamp));

        assertEq(reg.fieldCount(), before + 1);
        assertEq(reg.get(P, "seismicPml").basis, bytes32("PML1"));
    }
}
