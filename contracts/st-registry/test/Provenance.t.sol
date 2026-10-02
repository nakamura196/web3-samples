// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PropertyRegistry} from "../src/PropertyRegistry.sol";
import {Vocabulary} from "../src/Vocabulary.sol";

/// 記述の来歴と、語彙の版管理。
///
/// アーカイブの原則をそのまま持ち込んでいる。
///   ・記述は「誰が言ったか」とセットで意味を持つ
///   ・記述はその時々の規則の下で作られる。後から規則を変えて過去を否定しない
contract ProvenanceTest is Test {
    PropertyRegistry reg;
    bytes32 constant P = "PROP_A";
    uint256 amPk = 0xA11CE;   // アセットマネージャーの鍵
    address am;

    function setUp() public {
        vm.warp(1_756_000_000);
        reg = new PropertyRegistry();
        Vocabulary.install(reg);
        reg.setOpenRecording(true);
        am = vm.addr(amPk);
    }

    function _sign(PropertyRegistry.Input memory i) internal view returns (bytes memory) {
        bytes32 typehash = keccak256(
            "Measure(bytes32 propertyId,bytes32 field,uint256 value,bytes32 basis,uint64 asOf,bytes32 scope,bytes32 subtype)"
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                reg.domainSeparator(),
                keccak256(abi.encode(typehash, i.propertyId, i.field, i.value, i.basis, i.asOf, i.scope, i.subtype))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(amPk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// 送信者と申告者を分けられる。記録に残るのは申告者。
    function test_signed_record_keeps_the_attester_not_the_sender() public {
        PropertyRegistry.Input memory i = PropertyRegistry.Input({
            propertyId: P, field: Vocabulary.GROSS_FLOOR_AREA, value: 2_014_841,
            basis: Vocabulary.REGISTRY, asOf: uint64(block.timestamp),
            scope: bytes32(0), subtype: bytes32(0)
        });
        bytes memory sig = _sign(i);

        // 別人が送信する
        vm.prank(address(0xB0B));
        reg.recordSigned(i, sig);

        assertEq(reg.get(P, Vocabulary.GROSS_FLOOR_AREA).attestedBy, am, unicode"申告者が残る");
    }

    /// 署名が値と噛み合わなければ、別人の申告として復元される。
    /// 語彙にない根拠なら、そこで弾かれる。
    function test_tampered_value_changes_the_recovered_signer() public {
        PropertyRegistry.Input memory i = PropertyRegistry.Input({
            propertyId: P, field: Vocabulary.GROSS_FLOOR_AREA, value: 2_014_841,
            basis: Vocabulary.REGISTRY, asOf: uint64(block.timestamp),
            scope: bytes32(0), subtype: bytes32(0)
        });
        bytes memory sig = _sign(i);

        i.value = 9_999_999;             // 値を書き換える
        reg.recordSigned(i, sig);

        address got = reg.get(P, Vocabulary.GROSS_FLOOR_AREA).attestedBy;
        assertTrue(got != am, unicode"書き換えると申告者が別人になる");
    }

    /// 記録には、どの版の規則で検証されたかが残る
    function test_measure_carries_the_vocabulary_version() public {
        reg.record(P, Vocabulary.GROSS_FLOOR_AREA, 2_014_841, Vocabulary.REGISTRY, uint64(block.timestamp));
        assertEq(reg.get(P, Vocabulary.GROSS_FLOOR_AREA).vocabVersion, 1);

        reg.bumpVocabVersion();
        assertEq(reg.vocabVersion(), 2);

        // 版を上げても、既存の記録は v1 のまま。遡って書き換えない。
        assertEq(reg.get(P, Vocabulary.GROSS_FLOOR_AREA).vocabVersion, 1, unicode"過去は v1 のまま");

        // 新しく入れた値は v2
        reg.record(P, Vocabulary.LAND_AREA, 2_057_005, Vocabulary.REGISTRY, uint64(block.timestamp));
        assertEq(reg.get(P, Vocabulary.LAND_AREA).vocabVersion, 2, unicode"新しい記録は v2");
    }

    /// 項目がどの版から存在するかも残る
    function test_field_records_the_version_it_was_added_in() public {
        assertEq(reg.fieldSince(Vocabulary.OCCUPANCY), 1);

        reg.bumpVocabVersion();
        reg.defineField("seismicPml", true, true, false, false, 2);
        assertEq(reg.fieldSince("seismicPml"), 2, unicode"v2 で足した項目");
        assertEq(reg.fieldSince(Vocabulary.OCCUPANCY), 1, unicode"v1 の項目はそのまま");
    }
}
