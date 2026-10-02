// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Board} from "../src/Board.sol";
import {SoloTicTacToe} from "../src/SoloTicTacToe.sol";

contract SoloTicTacToeTest is Test {
    SoloTicTacToe internal solo;

    address internal player = makeAddr("player");
    address internal stranger = makeAddr("stranger");

    SoloTicTacToe.Difficulty internal constant EASY = SoloTicTacToe.Difficulty.Easy;
    SoloTicTacToe.Difficulty internal constant NORMAL = SoloTicTacToe.Difficulty.Normal;
    SoloTicTacToe.Difficulty internal constant HARD = SoloTicTacToe.Difficulty.Hard;

    function setUp() public {
        solo = new SoloTicTacToe();
        // blockhash(block.number - 1) reverts at block 0.
        vm.roll(100);
    }

    // ------------------------------------------------------------- helpers

    function _newGame(SoloTicTacToe.Difficulty difficulty, bool cpuFirst) internal returns (uint256 gameId) {
        vm.prank(player);
        gameId = solo.newGame(difficulty, cpuFirst);
    }

    function _play(uint256 gameId, uint8 cell) internal {
        vm.prank(player);
        solo.play(gameId, cell);
    }

    function _result(uint256 gameId) internal view returns (SoloTicTacToe.Result) {
        return solo.getGame(gameId).result;
    }

    // -------------------------------------------------------------- basics

    function test_NewGame_PlayerOpensByDefault() public {
        uint256 gameId = _newGame(NORMAL, false);
        SoloTicTacToe.Solo memory g = solo.getGame(gameId);

        assertEq(g.player, player);
        assertEq(g.moves, 0);
        assertEq(g.boardCpu, 0);
        assertFalse(g.cpuFirst);
        assertEq(uint8(g.result), uint8(SoloTicTacToe.Result.InProgress));
    }

    function test_NewGame_HardOpensInTheCentre() public {
        uint256 gameId = _newGame(HARD, true);
        SoloTicTacToe.Solo memory g = solo.getGame(gameId);

        assertEq(g.moves, 1);
        assertEq(g.boardCpu, Board.bit(4));
    }

    function test_Play_CpuAnswersInTheSameTransaction() public {
        uint256 gameId = _newGame(NORMAL, false);
        _play(gameId, 0);

        SoloTicTacToe.Solo memory g = solo.getGame(gameId);
        assertEq(g.moves, 2, "player move plus the reply");
        assertEq(g.boardPlayer, Board.bit(0));
        assertEq(g.boardCpu, Board.bit(4), "normal takes the centre when it is free");
    }

    function test_BoardOf_DistinguishesSides() public {
        uint256 gameId = _newGame(NORMAL, false);
        _play(gameId, 0);

        uint8[9] memory cells = solo.boardOf(gameId);
        assertEq(cells[0], 1, "your cell");
        assertEq(cells[4], 2, "the contract's cell");
        assertEq(cells[1], 0, "empty");
    }

    // ------------------------------------------------------------- reverts

    function test_Play_RejectsAnotherPlayersGame() public {
        uint256 gameId = _newGame(NORMAL, false);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SoloTicTacToe.NotYourGame.selector, stranger, player));
        solo.play(gameId, 0);
    }

    function test_Play_RejectsTakenCell() public {
        uint256 gameId = _newGame(NORMAL, false);
        _play(gameId, 0);

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(SoloTicTacToe.CellTaken.selector, uint8(4)));
        solo.play(gameId, 4);
    }

    function test_Play_RejectsCellOutOfRange() public {
        uint256 gameId = _newGame(NORMAL, false);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(SoloTicTacToe.CellOutOfRange.selector, uint8(9)));
        solo.play(gameId, 9);
    }

    function test_Play_RejectsFinishedGame() public {
        uint256 gameId = _newGame(NORMAL, false);
        // The fork line below finishes the game in four player moves.
        _play(gameId, 0);
        _play(gameId, 8);
        _play(gameId, 6);
        _play(gameId, 7);
        assertEq(uint8(_result(gameId)), uint8(SoloTicTacToe.Result.PlayerWon));

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(SoloTicTacToe.GameOver.selector, gameId));
        solo.play(gameId, 1);
    }

    function test_UnknownGameReverts() public {
        vm.expectRevert(abi.encodeWithSelector(SoloTicTacToe.NoSuchGame.selector, uint256(3)));
        solo.getGame(3);
    }

    // ------------------------------------------------------- shared strategy

    function test_EveryDifficulty_FinishesAWinItCanSee() public view {
        // The contract holds 0 and 1; cell 2 completes the top row.
        uint16 mine = Board.bit(0) | Board.bit(1);
        uint16 theirs = Board.bit(3) | Board.bit(4);

        assertEq(solo.previewCpuMove(mine, theirs, EASY, 0), 2);
        assertEq(solo.previewCpuMove(mine, theirs, NORMAL, 0), 2);
        assertEq(solo.previewCpuMove(mine, theirs, HARD, 0), 2);
    }

    function test_EasyIgnoresAnImminentLoss() public view {
        // The player threatens 2, but Easy only looks at its own winning moves.
        uint16 theirs = Board.bit(0) | Board.bit(1);
        uint16 mine = Board.bit(4);

        // Whatever the seed, Easy stays inside the empty cells and is free to
        // overlook the block — that is exactly what makes it Easy.
        for (uint256 seed = 0; seed < 6; ++seed) {
            uint8 cell = solo.previewCpuMove(mine, theirs, EASY, seed);
            assertTrue(Board.contains(Board.emptyMask(mine, theirs), cell));
        }
    }

    function test_NormalBlocksAnImminentLoss() public view {
        uint16 theirs = Board.bit(0) | Board.bit(1);
        uint16 mine = Board.bit(4);
        assertEq(solo.previewCpuMove(mine, theirs, NORMAL, 0), 2);
    }

    function test_NormalLosesToAFork() public {
        // Two opposite corners plus a third build two threats at once; Normal has
        // no fork awareness, so it can only block one of them.
        uint256 gameId = _newGame(NORMAL, false);
        _play(gameId, 0);
        _play(gameId, 8);
        _play(gameId, 6);
        _play(gameId, 7);

        assertEq(uint8(_result(gameId)), uint8(SoloTicTacToe.Result.PlayerWon));
    }

    function test_HardBlocksTheSameFork() public {
        // The line that beats Normal must not beat Hard.
        uint256 gameId = _newGame(HARD, false);
        _play(gameId, 0);
        _play(gameId, 8);

        // Hard sees the double threat coming and takes a forcing square instead of
        // drifting, so the player never gets a free fork.
        SoloTicTacToe.Solo memory g = solo.getGame(gameId);
        assertEq(uint8(g.result), uint8(SoloTicTacToe.Result.InProgress));
        assertFalse(Board.isWin(g.boardPlayer));
    }

    // ------------------------------------------------------- exhaustive proof

    /// @notice Plays out *every* legal line against Hard, from both sides, and
    ///         asserts the player never completes a line. Tic-tac-toe is small
    ///         enough that "it cannot be beaten" is a claim we can check rather
    ///         than assert in a comment.
    function test_HardNeverLoses() public view {
        // Player opens.
        _explore(0, 0, true);

        // The contract opens.
        uint8 opening = solo.previewCpuMove(0, 0, HARD, 0);
        _explore(Board.bit(opening), 0, true);
    }

    function _explore(uint16 cpu, uint16 human, bool humanToMove) private view {
        uint16 empty = Board.emptyMask(cpu, human);
        if (empty == 0) return; // full board: a draw, which is fine

        if (humanToMove) {
            for (uint8 cell = 0; cell < 9; ++cell) {
                if (!Board.contains(empty, cell)) continue;

                uint16 next = human | Board.bit(cell);
                assertFalse(Board.isWin(next), "the Hard strategy allowed a loss");
                _explore(cpu, next, false);
            }
            return;
        }

        uint8 reply = solo.previewCpuMove(cpu, human, HARD, 0);
        assertTrue(Board.contains(empty, reply), "the strategy picked an occupied cell");

        uint16 nextCpu = cpu | Board.bit(reply);
        if (Board.isWin(nextCpu)) return; // the contract won: terminal
        _explore(nextCpu, human, true);
    }
}
