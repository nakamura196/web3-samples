// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MiniSig} from "../src/MiniSig.sol";

contract MiniSigTest is Test {
    MiniSig sig;

    // 所有者3人。秘密鍵はテスト用の定数。
    uint256 constant PK_A = 0xA11CE;
    uint256 constant PK_B = 0xB0B;
    uint256 constant PK_C = 0xC0FFEE;
    uint256 constant PK_MALLORY = 0xBAD;

    address a = vm.addr(PK_A);
    address b = vm.addr(PK_B);
    address c = vm.addr(PK_C);
    address mallory = vm.addr(PK_MALLORY);

    address payable recipient = payable(address(0xDEAD));

    function setUp() public {
        address[] memory os = new address[](3);
        os[0] = a;
        os[1] = b;
        os[2] = c;

        sig = new MiniSig(os, 2); // 2 of 3
        vm.deal(address(sig), 10 ether);
    }

    // ------------------------------------------------------------ helpers

    /// 1本の署名を作る
    function _sign(uint256 pk, address to, uint256 value, bytes memory data, uint256 n)
        internal
        view
        returns (bytes memory)
    {
        bytes32 d = sig.digest(to, value, data, n);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, d);
        return abi.encodePacked(r, s, v);
    }

    /// 2本を「署名者アドレスの昇順」に連結する
    function _sign2(uint256 pk1, uint256 pk2, address to, uint256 value, bytes memory data, uint256 n)
        internal
        view
        returns (bytes memory)
    {
        (uint256 lo, uint256 hi) = vm.addr(pk1) < vm.addr(pk2) ? (pk1, pk2) : (pk2, pk1);
        return bytes.concat(_sign(lo, to, value, data, n), _sign(hi, to, value, data, n));
    }

    // -------------------------------------------------------------- tests

    function test_setup() public view {
        assertEq(sig.ownerCount(), 3);
        assertEq(sig.threshold(), 2);
        assertEq(sig.nonce(), 0);
        assertTrue(sig.isOwner(a));
        assertFalse(sig.isOwner(mallory));
        assertEq(address(sig).balance, 10 ether);
    }

    /// 2本の署名で実行できる
    function test_execute_with_two_signatures() public {
        bytes memory sigs = _sign2(PK_A, PK_B, recipient, 1 ether, "", 0);

        sig.execTransaction(recipient, 1 ether, "", sigs);

        assertEq(recipient.balance, 1 ether);
        assertEq(address(sig).balance, 9 ether);
        assertEq(sig.nonce(), 1, "nonce should advance");
    }

    /// 1本では実行できない ← マルチシグの本体
    function test_revert_with_one_signature() public {
        bytes memory one = _sign(PK_A, recipient, 1 ether, "", 0);

        vm.expectRevert(MiniSig.TooFewSignatures.selector);
        sig.execTransaction(recipient, 1 ether, "", one);

        assertEq(recipient.balance, 0);
    }

    /// 同じ署名の使い回しはできない（nonce が進んでいるため）
    function test_revert_replay() public {
        bytes memory sigs = _sign2(PK_A, PK_B, recipient, 1 ether, "", 0);
        sig.execTransaction(recipient, 1 ether, "", sigs);

        // 全く同じ署名をもう一度
        vm.expectRevert();
        sig.execTransaction(recipient, 1 ether, "", sigs);

        assertEq(recipient.balance, 1 ether, "should have moved only once");
    }

    /// 所有者でない者の署名は通らない
    function test_revert_non_owner() public {
        bytes memory sigs = _sign2(PK_A, PK_MALLORY, recipient, 1 ether, "", 0);

        vm.expectRevert();
        sig.execTransaction(recipient, 1 ether, "", sigs);
    }

    /// 同じ人が2回署名しても、2人ぶんにはならない
    function test_revert_duplicate_signer() public {
        bytes memory one = _sign(PK_A, recipient, 1 ether, "", 0);
        bytes memory twice = bytes.concat(one, one);

        vm.expectRevert(MiniSig.SignaturesNotAscending.selector);
        sig.execTransaction(recipient, 1 ether, "", twice);
    }

    /// 署名の並び順が降順だと弾かれる
    function test_revert_wrong_order() public {
        (uint256 lo, uint256 hi) = a < b ? (PK_A, PK_B) : (PK_B, PK_A);
        bytes memory reversed =
            bytes.concat(_sign(hi, recipient, 1 ether, "", 0), _sign(lo, recipient, 1 ether, "", 0));

        vm.expectRevert(MiniSig.SignaturesNotAscending.selector);
        sig.execTransaction(recipient, 1 ether, "", reversed);
    }

    /// 金額を書き換えた取引には、元の署名は使えない
    function test_revert_tampered_value() public {
        bytes memory sigs = _sign2(PK_A, PK_B, recipient, 1 ether, "", 0);

        vm.expectRevert(); // 2 ether で実行しようとする
        sig.execTransaction(recipient, 2 ether, "", sigs);
    }

    /// 別のコントラクトの署名は流用できない（アドレスがハッシュに入っている）
    function test_revert_cross_contract_replay() public {
        address[] memory os = new address[](3);
        os[0] = a;
        os[1] = b;
        os[2] = c;
        MiniSig other = new MiniSig(os, 2);
        vm.deal(address(other), 10 ether);

        // sig 用に作った署名を other に持ち込む
        bytes memory sigs = _sign2(PK_A, PK_B, recipient, 1 ether, "", 0);

        vm.expectRevert();
        other.execTransaction(recipient, 1 ether, "", sigs);
    }

    /// 閾値 0 や所有者数超過は作れない
    function test_revert_bad_threshold() public {
        address[] memory os = new address[](2);
        os[0] = a;
        os[1] = b;

        vm.expectRevert(MiniSig.BadThreshold.selector);
        new MiniSig(os, 0);

        vm.expectRevert(MiniSig.BadThreshold.selector);
        new MiniSig(os, 3);
    }

    /// 所有者の重複は作れない
    function test_revert_duplicate_owner() public {
        address[] memory os = new address[](2);
        os[0] = a;
        os[1] = a;

        vm.expectRevert(MiniSig.DuplicateOwner.selector);
        new MiniSig(os, 1);
    }
}

/// 自分自身を書き換える部分のテスト
contract MiniSigGovernanceTest is Test {
    MiniSig sig;

    uint256 constant PK_A = 0xA11CE;
    uint256 constant PK_B = 0xB0B;
    uint256 constant PK_C = 0xC0FFEE;
    uint256 constant PK_D = 0xD00D;

    address a = vm.addr(PK_A);
    address b = vm.addr(PK_B);
    address c = vm.addr(PK_C);
    address d = vm.addr(PK_D);

    function setUp() public {
        address[] memory os = new address[](3);
        os[0] = a; os[1] = b; os[2] = c;
        sig = new MiniSig(os, 2);
        vm.deal(address(sig), 1 ether);
    }

    function _sign(uint256 pk, address to, uint256 value, bytes memory data, uint256 n)
        internal view returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, sig.digest(to, value, data, n));
        return abi.encodePacked(r, s, v);
    }

    function _sign2(uint256 p1, uint256 p2, address to, uint256 value, bytes memory data, uint256 n)
        internal view returns (bytes memory)
    {
        (uint256 lo, uint256 hi) = vm.addr(p1) < vm.addr(p2) ? (p1, p2) : (p2, p1);
        return bytes.concat(_sign(lo, to, value, data, n), _sign(hi, to, value, data, n));
    }

    /// 外から直接は呼べない ← 自己統治の要
    function test_revert_addOwner_from_outside() public {
        vm.expectRevert(MiniSig.OnlySelf.selector);
        sig.addOwner(d, 2);

        vm.prank(a); // 所有者であっても直接は呼べない
        vm.expectRevert(MiniSig.OnlySelf.selector);
        sig.addOwner(d, 2);
    }

    /// 2/3 の決議で4人目を追加できる
    function test_addOwner_via_resolution() public {
        bytes memory data = abi.encodeCall(MiniSig.addOwner, (d, 3));
        bytes memory sigs = _sign2(PK_A, PK_B, address(sig), 0, data, 0);

        sig.execTransaction(address(sig), 0, data, sigs);

        assertTrue(sig.isOwner(d), "d should be an owner");
        assertEq(sig.ownerCount(), 4);
        assertEq(sig.threshold(), 3, "threshold raised to 3");
    }

    /// 追加された所有者の署名が、実際に有効になる
    function test_new_owner_can_sign() public {
        bytes memory add = abi.encodeCall(MiniSig.addOwner, (d, 2));
        sig.execTransaction(address(sig), 0, add, _sign2(PK_A, PK_B, address(sig), 0, add, 0));

        // 新入り d と c の2人で送金する（a も b も関与しない）
        address payable dest = payable(address(0xBEEF));
        bytes memory sigs = _sign2(PK_C, PK_D, dest, 0.1 ether, "", 1);
        sig.execTransaction(dest, 0.1 ether, "", sigs);

        assertEq(dest.balance, 0.1 ether);
    }

    /// 所有者を外せる
    function test_removeOwner_via_resolution() public {
        bytes memory data = abi.encodeCall(MiniSig.removeOwner, (c, 2));
        sig.execTransaction(address(sig), 0, data, _sign2(PK_A, PK_B, address(sig), 0, data, 0));

        assertFalse(sig.isOwner(c));
        assertEq(sig.ownerCount(), 2);
    }

    /// 所有者数を超える閾値は設定できない（金庫の永久ロックを防ぐ）
    function test_revert_threshold_above_owner_count() public {
        bytes memory data = abi.encodeCall(MiniSig.changeThreshold, (5));
        // 署名は expectRevert より前に作る。
        // _sign2 は内部で sig.digest() を呼ぶので、後ろに置くと
        // expectRevert がその view 呼び出しに食われる。
        bytes memory sigs = _sign2(PK_A, PK_B, address(sig), 0, data, 0);

        vm.expectRevert();
        sig.execTransaction(address(sig), 0, data, sigs);
        assertEq(sig.threshold(), 2, "unchanged");
    }

    /// 同じ人を二重に所有者にはできない
    function test_revert_duplicate_owner_add() public {
        bytes memory data = abi.encodeCall(MiniSig.addOwner, (a, 2));
        bytes memory sigs = _sign2(PK_A, PK_B, address(sig), 0, data, 0);

        vm.expectRevert();
        sig.execTransaction(address(sig), 0, data, sigs);
        assertEq(sig.ownerCount(), 3, "unchanged");
    }
}
