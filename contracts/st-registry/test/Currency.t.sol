// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SecurityToken, JpyStable} from "../src/Token.sol";
import {DvPSettlement, IPayToken} from "../src/Settlement.sol";

/// 決済通貨を差し替えても、同じ契約がそのまま動くことを確かめる。
/// JPYC(円) / EURAU(ユーロ) / 検証用の模擬コインの違いは、**アドレスの違いでしかない**。
contract CurrencyTest is Test {
    DvPSettlement dvp;
    SecurityToken st;
    address seller = address(0xA11CE);
    address buyer = address(0xB0B);


    /// 配備してから名前を付ける。Sapphire ではコンストラクタに string を渡せないため。
    function _st(string memory, bytes32 pid) internal returns (SecurityToken s) {
        s = new SecurityToken();
        s.setProperty(pid);
    }

    function setUp() public {
        dvp = new DvPSettlement();
        st = _st("Property ST", "PROP_A");
        st.setEligible(seller, true);
        st.setEligible(buyer, true);
        st.mint(seller, 100);
        vm.prank(seller);
        st.approve(address(dvp), type(uint256).max);
    }

    function _settleWith(JpyStable coin, uint256 amount) internal {
        coin.mint(buyer, amount);
        vm.prank(buyer);
        coin.approve(address(dvp), type(uint256).max);
        dvp.settle(st, IPayToken(address(coin)), seller, buyer, 10, amount);
    }

    /// 円建て(JPYC 相当)で決済する
    function test_settles_in_jpy() public {
        JpyStable jpyc = new JpyStable();
        _settleWith(jpyc, 1_000_000);
        assertEq(jpyc.balanceOf(seller), 1_000_000);
        assertEq(st.balanceOf(buyer), 10);
    }

    /// ユーロ建て(EURAU 相当)に差し替えても、契約は書き換えない
    function test_settles_in_eur_without_changing_the_contract() public {
        JpyStable eurau = new JpyStable();   // 同じ ERC-20。違うのはアドレスだけ
        _settleWith(eurau, 6_000);
        assertEq(eurau.balanceOf(seller), 6_000);
        assertEq(st.balanceOf(buyer), 10);
    }

    /// 訪問者が買主として DvP を実行できる。
    /// 売主は事前に承認済み、訪問者は自分を適格者として登録する。
    function test_visitor_can_settle_as_buyer() public {
        JpyStable jpy = new JpyStable();
        st.setOpenEligibility(true);
        st.mint(seller, 50);
        vm.prank(seller);
        st.approve(address(dvp), type(uint256).max);

        address visitor = address(0xCAFE);
        vm.startPrank(visitor);
        st.selfRegister();                       // 適格者になる
        jpy.mint(visitor, 5_000_000);            // 円を用意する
        jpy.approve(address(dvp), type(uint256).max);
        dvp.settle(st, IPayToken(address(jpy)), seller, visitor, 3, 3_000_000);
        vm.stopPrank();

        assertEq(st.balanceOf(visitor), 3, unicode"STが渡っている");
        assertEq(jpy.balanceOf(seller), 3_000_000, unicode"代金が渡っている");
    }

    /// 適格者でなければ、決済ごと巻き戻る
    function test_settle_reverts_for_unregistered_buyer() public {
        JpyStable jpy = new JpyStable();
        st.mint(seller, 50);
        vm.prank(seller);
        st.approve(address(dvp), type(uint256).max);

        address stranger = address(0xDEAD);
        jpy.mint(stranger, 5_000_000);
        vm.startPrank(stranger);
        jpy.approve(address(dvp), type(uint256).max);
        vm.expectRevert();
        dvp.settle(st, IPayToken(address(jpy)), seller, stranger, 3, 3_000_000);
        vm.stopPrank();

        assertEq(st.balanceOf(stranger), 0);
        assertEq(jpy.balanceOf(seller), 0, unicode"代金も動いていない");
    }

    /// 2種類の通貨が同じ画面に共存できる
    function test_two_currencies_coexist() public {
        JpyStable jpyc = new JpyStable();
        JpyStable eurau = new JpyStable();
        _settleWith(jpyc, 1_000_000);
        _settleWith(eurau, 6_000);
        assertEq(st.balanceOf(buyer), 20);
        assertEq(jpyc.balanceOf(seller), 1_000_000);
        assertEq(eurau.balanceOf(seller), 6_000);
    }
}
