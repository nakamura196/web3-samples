// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Step2MinimalTicTacToe} from "../../src/learn/Step2MinimalTicTacToe.sol";

/// @notice Read alongside src/learn/Step2MinimalTicTacToe.sol. Run one test with
///         traces to watch a call go through:
///           forge test --match-test test_XWinsTheTopRow -vvvv
contract Step2MinimalTicTacToeTest is Test {
    Step2MinimalTicTacToe internal game;

    address internal alice = makeAddr("alice"); // deploys, so plays X
    address internal bob = makeAddr("bob"); // plays O

    function setUp() public {
        // `vm.prank` makes the *next* call come from this address. That is how a
        // test impersonates a wallet: msg.sender becomes alice, so alice is X.
        vm.prank(alice);
        game = new Step2MinimalTicTacToe(bob);
    }

    function test_DeployerIsX() public view {
        assertEq(game.playerX(), alice);
        assertEq(game.playerO(), bob);
        assertEq(game.moves(), 0);
        assertFalse(game.finished());
    }

    function test_XWinsTheTopRow() public {
        vm.prank(alice);
        game.play(0);
        vm.prank(bob);
        game.play(3);
        vm.prank(alice);
        game.play(1);
        vm.prank(bob);
        game.play(4);
        vm.prank(alice);
        game.play(2);

        assertTrue(game.finished());
        assertEq(game.winner(), alice);

        uint8[9] memory board = game.getBoard();
        assertEq(board[0], 1);
        assertEq(board[3], 2);
    }

    function test_FullBoardIsADraw() public {
        // X: 0 2 3 8 7   O: 1 4 5 6
        uint8[9] memory order = [0, 1, 2, 4, 3, 5, 8, 6, 7];
        for (uint256 i = 0; i < 9; ++i) {
            vm.prank(i % 2 == 0 ? alice : bob);
            game.play(order[i]);
        }

        assertTrue(game.finished());
        assertEq(game.winner(), address(0), "a draw leaves the winner unset");
        assertEq(game.moves(), 9);
    }

    function test_RejectsPlayingOutOfTurn() public {
        vm.prank(bob);
        vm.expectRevert("not your turn");
        game.play(0);
    }

    function test_RejectsATakenCell() public {
        vm.prank(alice);
        game.play(4);

        vm.prank(bob);
        vm.expectRevert("that cell is taken");
        game.play(4);
    }

    function test_RevertUndoesEverything() public {
        vm.prank(alice);
        game.play(0);

        vm.prank(bob);
        vm.expectRevert("no such cell");
        game.play(99);

        // The failed call left no trace: the move counter did not advance.
        assertEq(game.moves(), 1);
    }
}
