// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Step1Storage} from "../../src/learn/Step1Storage.sol";

contract Step1StorageTest is Test {
    Step1Storage internal store;
    address internal alice = makeAddr("alice");

    event MessageChanged(address indexed writer, string message, uint256 writeCount);

    function setUp() public {
        store = new Step1Storage("hello");
    }

    function test_ConstructorSetsInitialState() public view {
        assertEq(store.message(), "hello", "the generated getter for a public variable");
        assertEq(store.writeCount(), 0);
    }

    function test_SetMessageRecordsTheCaller() public {
        vm.prank(alice);
        store.setMessage("on-chain");

        assertEq(store.message(), "on-chain");
        assertEq(store.lastWriter(), alice, "msg.sender needs no auth layer");
        assertEq(store.writeCount(), 1);
    }

    function test_SetMessageEmitsAnEvent() public {
        vm.expectEmit(true, false, false, true);
        emit MessageChanged(alice, "logged", 1);

        vm.prank(alice);
        store.setMessage("logged");
    }

    function test_RejectsEmptyMessage() public {
        vm.expectRevert("message must not be empty");
        store.setMessage("");

        assertEq(store.message(), "hello", "state is untouched after a revert");
    }
}
