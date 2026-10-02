// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {TicTacToe} from "../src/TicTacToe.sol";

/// @dev Rejects plain transfers, to prove a hostile winner cannot brick the game for anyone else.
contract RevertingReceiver {
    TicTacToe private immutable GAME;

    constructor(TicTacToe game_) {
        GAME = game_;
    }

    function join(uint256 gameId, uint256 stake) external payable {
        GAME.joinGame{value: stake}(gameId);
    }

    function play(uint256 gameId, uint8 cell) external {
        GAME.play(gameId, cell);
    }

    function withdraw() external {
        GAME.withdraw();
    }

    receive() external payable {
        revert("nope");
    }
}

contract TicTacToeTest is Test {
    TicTacToe internal game;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice"); // plays X
    address internal bob = makeAddr("bob"); // plays O
    address internal carol = makeAddr("carol");

    uint256 internal constant STAKE = 1 ether;
    uint32 internal constant TIMEOUT = 1 hours;

    function setUp() public {
        vm.prank(owner);
        game = new TicTacToe(0);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    // ------------------------------------------------------------- helpers

    function _open() internal returns (uint256 gameId) {
        vm.prank(alice);
        gameId = game.createGame{value: STAKE}(address(0), TIMEOUT);
    }

    function _joined() internal returns (uint256 gameId) {
        gameId = _open();
        vm.prank(bob);
        game.joinGame{value: STAKE}(gameId);
    }

    /// @dev Plays the given cells alternating X, O starting with X.
    function _playSequence(uint256 gameId, uint8[] memory cells) internal {
        for (uint256 i = 0; i < cells.length; ++i) {
            vm.prank(i % 2 == 0 ? alice : bob);
            game.play(gameId, cells[i]);
        }
    }

    function _cells(uint8[5] memory c) internal pure returns (uint8[] memory out) {
        out = new uint8[](5);
        for (uint256 i = 0; i < 5; ++i) {
            out[i] = c[i];
        }
    }

    function _cells6(uint8[6] memory c) internal pure returns (uint8[] memory out) {
        out = new uint8[](6);
        for (uint256 i = 0; i < 6; ++i) {
            out[i] = c[i];
        }
    }

    function _cells9(uint8[9] memory c) internal pure returns (uint8[] memory out) {
        out = new uint8[](9);
        for (uint256 i = 0; i < 9; ++i) {
            out[i] = c[i];
        }
    }

    // -------------------------------------------------------------- create

    function test_CreateGame_EscrowsStakeAndOpensLobby() public {
        uint256 balanceBefore = alice.balance;

        vm.prank(alice);
        uint256 gameId = game.createGame{value: STAKE}(address(0), TIMEOUT);

        TicTacToe.Game memory g = game.getGame(gameId);
        assertEq(gameId, 0);
        assertEq(game.gameCount(), 1);
        assertEq(g.playerX, alice);
        assertEq(g.playerO, address(0));
        assertEq(g.stake, STAKE);
        assertEq(g.timeout, TIMEOUT);
        assertEq(g.deadline, uint64(block.timestamp) + TIMEOUT);
        assertEq(uint8(g.status), uint8(TicTacToe.Status.Open));
        assertEq(alice.balance, balanceBefore - STAKE);
        assertEq(address(game).balance, STAKE);
    }

    function test_CreateGame_AllowsFreePlay() public {
        vm.prank(alice);
        uint256 gameId = game.createGame(address(0), TIMEOUT);
        assertEq(game.getGame(gameId).stake, 0);

        vm.prank(bob);
        game.joinGame(gameId);
        assertEq(uint8(game.getGame(gameId).status), uint8(TicTacToe.Status.Active));
    }

    function test_CreateGame_RevertsOnTimeoutOutOfRange() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.TimeoutOutOfRange.selector, uint32(30)));
        game.createGame{value: STAKE}(address(0), 30);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.TimeoutOutOfRange.selector, uint32(8 days)));
        game.createGame{value: STAKE}(address(0), 8 days);
    }

    function test_CreateGame_RevertsWhenInvitingSelf() public {
        vm.prank(alice);
        vm.expectRevert(TicTacToe.CannotPlaySelf.selector);
        game.createGame{value: STAKE}(alice, TIMEOUT);
    }

    // ---------------------------------------------------------------- join

    function test_JoinGame_RequiresExactStake() public {
        uint256 gameId = _open();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.WrongStake.selector, STAKE - 1, STAKE));
        game.joinGame{value: STAKE - 1}(gameId);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.WrongStake.selector, STAKE + 1, STAKE));
        game.joinGame{value: STAKE + 1}(gameId);
    }

    function test_JoinGame_RejectsCreator() public {
        uint256 gameId = _open();
        vm.prank(alice);
        vm.expectRevert(TicTacToe.CannotPlaySelf.selector);
        game.joinGame{value: STAKE}(gameId);
    }

    function test_JoinGame_RespectsInvite() public {
        vm.prank(alice);
        uint256 gameId = game.createGame{value: STAKE}(bob, TIMEOUT);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.NotInvited.selector, carol, bob));
        game.joinGame{value: STAKE}(gameId);

        vm.prank(bob);
        game.joinGame{value: STAKE}(gameId);
        assertEq(game.getGame(gameId).playerO, bob);
    }

    function test_JoinGame_RejectsAfterJoinWindow() public {
        uint256 gameId = _open();
        uint64 deadline = game.getGame(gameId).deadline;

        vm.warp(deadline + 1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.JoinWindowClosed.selector, deadline));
        game.joinGame{value: STAKE}(gameId);
    }

    function test_JoinGame_RejectsSecondJoiner() public {
        uint256 gameId = _joined();
        vm.prank(carol);
        vm.expectRevert(
            abi.encodeWithSelector(
                TicTacToe.WrongStatus.selector, gameId, TicTacToe.Status.Active, TicTacToe.Status.Open
            )
        );
        game.joinGame{value: STAKE}(gameId);
    }

    // ---------------------------------------------------------------- play

    function test_Play_RejectsOutOfTurn() public {
        uint256 gameId = _joined();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.NotYourTurn.selector, bob, alice));
        game.play(gameId, 0);
    }

    function test_Play_RejectsSpectator() public {
        uint256 gameId = _joined();
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.NotYourTurn.selector, carol, alice));
        game.play(gameId, 0);
    }

    function test_Play_RejectsTakenCell() public {
        uint256 gameId = _joined();
        vm.prank(alice);
        game.play(gameId, 4);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.CellTaken.selector, uint8(4)));
        game.play(gameId, 4);
    }

    function test_Play_RejectsCellOutOfRange() public {
        uint256 gameId = _joined();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.CellOutOfRange.selector, uint8(9)));
        game.play(gameId, 9);
    }

    function test_Play_RejectsAfterDeadline() public {
        uint256 gameId = _joined();
        uint64 deadline = game.getGame(gameId).deadline;

        vm.warp(deadline + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.DeadlinePassed.selector, deadline));
        game.play(gameId, 0);
    }

    function test_Play_RefreshesDeadlineEachMove() public {
        uint256 gameId = _joined();

        vm.warp(block.timestamp + 10 minutes);
        vm.prank(alice);
        game.play(gameId, 0);

        assertEq(game.getGame(gameId).deadline, uint64(block.timestamp) + TIMEOUT);
        assertEq(game.currentPlayer(gameId), bob);
    }

    function test_BoardOf_TracksMarks() public {
        uint256 gameId = _joined();
        vm.prank(alice);
        game.play(gameId, 0);
        vm.prank(bob);
        game.play(gameId, 4);

        uint8[9] memory cells = game.boardOf(gameId);
        assertEq(cells[0], 1);
        assertEq(cells[4], 2);
        assertEq(cells[8], 0);
    }

    // ------------------------------------------------------------- payouts

    function test_Win_PaysWholePotToWinner() public {
        uint256 gameId = _joined();

        // X takes the top row: 0, 1, 2.
        _playSequence(gameId, _cells([uint8(0), 3, 1, 4, 2]));

        TicTacToe.Game memory g = game.getGame(gameId);
        assertEq(uint8(g.status), uint8(TicTacToe.Status.Finished));
        assertEq(uint8(g.outcome), uint8(TicTacToe.Outcome.Win));
        assertEq(g.winner, alice);

        assertEq(game.pending(alice), STAKE * 2);
        assertEq(game.pending(bob), 0);
        assertEq(game.currentPlayer(gameId), address(0));
    }

    function test_Win_ByPlayerO() public {
        uint256 gameId = _joined();

        // X takes 0, 1, 8 while O completes the middle row 3, 4, 5.
        _playSequence(gameId, _cells6([uint8(0), 3, 1, 4, 8, 5]));

        TicTacToe.Game memory g = game.getGame(gameId);
        assertEq(uint8(g.outcome), uint8(TicTacToe.Outcome.Win));
        assertEq(g.winner, bob);
        assertEq(game.pending(bob), STAKE * 2);
        assertEq(game.pending(alice), 0);
    }

    function test_Draw_RefundsBothStakes() public {
        uint256 gameId = _joined();

        // X: 0 2 3 8 7 | O: 1 4 5 6 — full board, no line.
        _playSequence(gameId, _cells9([uint8(0), 1, 2, 4, 3, 5, 8, 6, 7]));

        TicTacToe.Game memory g = game.getGame(gameId);
        assertEq(uint8(g.outcome), uint8(TicTacToe.Outcome.Draw));
        assertEq(g.winner, address(0));
        assertEq(g.moves, 9);

        assertEq(game.pending(alice), STAKE);
        assertEq(game.pending(bob), STAKE);
    }

    function test_Withdraw_TransfersAndClears() public {
        uint256 gameId = _joined();
        _playSequence(gameId, _cells([uint8(0), 3, 1, 4, 2]));

        uint256 before = alice.balance;
        vm.prank(alice);
        uint256 amount = game.withdraw();

        assertEq(amount, STAKE * 2);
        assertEq(alice.balance, before + STAKE * 2);
        assertEq(game.pending(alice), 0);
        assertEq(address(game).balance, 0);
    }

    function test_Withdraw_RevertsWhenEmpty() public {
        vm.prank(alice);
        vm.expectRevert(TicTacToe.NothingToWithdraw.selector);
        game.withdraw();
    }

    function test_Withdraw_FailingReceiverDoesNotStrandOthers() public {
        RevertingReceiver hostile = new RevertingReceiver(game);
        vm.deal(address(hostile), 10 ether);

        vm.prank(alice);
        uint256 gameId = game.createGame{value: STAKE}(address(0), TIMEOUT);
        hostile.join{value: STAKE}(gameId, STAKE);

        // O (the hostile contract) takes the middle column and wins.
        vm.prank(alice);
        game.play(gameId, 0);
        hostile.play(gameId, 3);
        vm.prank(alice);
        game.play(gameId, 1);
        hostile.play(gameId, 4);
        vm.prank(alice);
        game.play(gameId, 8);
        hostile.play(gameId, 5);

        assertEq(game.getGame(gameId).winner, address(hostile));

        // Its own withdrawal fails, but the settlement already happened on-chain
        // and no other player's funds are affected.
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.TransferFailed.selector, address(hostile), STAKE * 2));
        hostile.withdraw();

        vm.prank(alice);
        uint256 secondGame = game.createGame{value: STAKE}(address(0), TIMEOUT);
        vm.prank(bob);
        game.joinGame{value: STAKE}(secondGame);
        _playSequence(secondGame, _cells([uint8(0), 3, 1, 4, 2]));

        vm.prank(alice);
        game.withdraw();
        assertEq(game.pending(address(hostile)), STAKE * 2);
    }

    // ------------------------------------------------------------- timeout

    function test_ClaimTimeout_AwardsPotToWaitingPlayer() public {
        uint256 gameId = _joined();
        uint64 deadline = game.getGame(gameId).deadline;

        vm.warp(deadline + 1);
        // X was to move and stalled, so O wins by forfeit.
        vm.prank(carol); // anyone may settle
        game.claimTimeout(gameId);

        TicTacToe.Game memory g = game.getGame(gameId);
        assertEq(uint8(g.outcome), uint8(TicTacToe.Outcome.Forfeit));
        assertEq(g.winner, bob);
        assertEq(game.pending(bob), STAKE * 2);
    }

    function test_ClaimTimeout_AwardsToXWhenOStalls() public {
        uint256 gameId = _joined();
        vm.prank(alice);
        game.play(gameId, 0);

        vm.warp(game.getGame(gameId).deadline + 1);
        game.claimTimeout(gameId);

        assertEq(game.getGame(gameId).winner, alice);
        assertEq(game.pending(alice), STAKE * 2);
    }

    function test_ClaimTimeout_RevertsBeforeDeadline() public {
        uint256 gameId = _joined();
        uint64 deadline = game.getGame(gameId).deadline;

        vm.expectRevert(abi.encodeWithSelector(TicTacToe.DeadlineNotReached.selector, deadline));
        game.claimTimeout(gameId);
    }

    // -------------------------------------------------------------- cancel

    function test_CancelGame_RefundsCreator() public {
        uint256 gameId = _open();

        vm.prank(alice);
        game.cancelGame(gameId);

        assertEq(uint8(game.getGame(gameId).status), uint8(TicTacToe.Status.Cancelled));
        assertEq(game.pending(alice), STAKE);
    }

    function test_CancelGame_StrangerMustWaitForJoinWindow() public {
        uint256 gameId = _open();

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.NotCreator.selector, carol, alice));
        game.cancelGame(gameId);

        vm.warp(game.getGame(gameId).deadline + 1);
        vm.prank(carol);
        game.cancelGame(gameId);
        assertEq(game.pending(alice), STAKE);
    }

    function test_CancelGame_RevertsOnceActive() public {
        uint256 gameId = _joined();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                TicTacToe.WrongStatus.selector, gameId, TicTacToe.Status.Active, TicTacToe.Status.Open
            )
        );
        game.cancelGame(gameId);
    }

    // ----------------------------------------------------------------- fee

    function test_Fee_TakenOnlyFromDecisiveGames() public {
        vm.prank(owner);
        game.setFeeBps(250); // 2.5%

        uint256 gameId = _joined();
        _playSequence(gameId, _cells([uint8(0), 3, 1, 4, 2]));

        uint256 pot = STAKE * 2;
        uint256 fee = (pot * 250) / 10_000;
        assertEq(game.pending(alice), pot - fee);
        assertEq(game.pending(owner), fee);
    }

    function test_Fee_NotTakenOnDraw() public {
        vm.prank(owner);
        game.setFeeBps(250);

        uint256 gameId = _joined();
        _playSequence(gameId, _cells9([uint8(0), 1, 2, 4, 3, 5, 8, 6, 7]));

        assertEq(game.pending(alice), STAKE);
        assertEq(game.pending(bob), STAKE);
        assertEq(game.pending(owner), 0);
    }

    function test_Fee_NotTakenOnCancel() public {
        vm.prank(owner);
        game.setFeeBps(500);

        uint256 gameId = _open();
        vm.prank(alice);
        game.cancelGame(gameId);

        assertEq(game.pending(alice), STAKE);
        assertEq(game.pending(owner), 0);
    }

    function test_SetFeeBps_RejectsNonOwnerAndExcessiveFee() public {
        vm.prank(alice);
        vm.expectRevert(TicTacToe.NotOwner.selector);
        game.setFeeBps(100);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.FeeTooHigh.selector, uint16(501)));
        game.setFeeBps(501);
    }

    function test_Constructor_RejectsExcessiveFee() public {
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.FeeTooHigh.selector, uint16(1000)));
        new TicTacToe(1000);
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        game.transferOwnership(alice);
        assertEq(game.owner(), alice);

        vm.prank(owner);
        vm.expectRevert(TicTacToe.NotOwner.selector);
        game.setFeeBps(1);
    }

    // -------------------------------------------------------------- views

    function test_GetGames_Paginates() public {
        for (uint256 i = 0; i < 5; ++i) {
            vm.prank(alice);
            game.createGame{value: STAKE}(address(0), TIMEOUT);
        }

        assertEq(game.getGames(0, 2).length, 2);
        assertEq(game.getGames(3, 10).length, 2);
        assertEq(game.getGames(5, 10).length, 0);
        assertEq(game.getGames(0, 10)[4].playerX, alice);
    }

    function test_UnknownGameReverts() public {
        vm.expectRevert(abi.encodeWithSelector(TicTacToe.NoSuchGame.selector, uint256(7)));
        game.getGame(7);
    }

    // ---------------------------------------------------------------- fuzz

    /// @dev The contract must never hold more than the escrowed stakes of live games.
    function testFuzz_PotConservation(uint96 stake, uint16 feeBps) public {
        stake = uint96(bound(stake, 0, 10 ether));
        feeBps = uint16(bound(feeBps, 0, game.MAX_FEE_BPS()));

        vm.prank(owner);
        game.setFeeBps(feeBps);

        vm.deal(alice, uint256(stake) + 1 ether);
        vm.deal(bob, uint256(stake) + 1 ether);

        vm.prank(alice);
        uint256 gameId = game.createGame{value: stake}(address(0), TIMEOUT);
        vm.prank(bob);
        game.joinGame{value: stake}(gameId);

        _playSequence(gameId, _cells([uint8(0), 3, 1, 4, 2]));

        uint256 pot = uint256(stake) * 2;
        assertEq(game.pending(alice) + game.pending(owner), pot);
        assertEq(address(game).balance, pot);
    }

    /// @dev Whatever cells are attempted, a game never pays out more than the pot.
    function testFuzz_NeverOverpays(uint8 a, uint8 b, uint8 c, uint8 d, uint8 e) public {
        uint256 gameId = _joined();
        uint8[5] memory attempts = [a % 9, b % 9, c % 9, d % 9, e % 9];

        for (uint256 i = 0; i < 5; ++i) {
            TicTacToe.Game memory g = game.getGame(gameId);
            if (g.status != TicTacToe.Status.Active) break;
            vm.prank(g.moves % 2 == 0 ? alice : bob);
            try game.play(gameId, attempts[i]) {} catch {}
        }

        assertLe(game.pending(alice) + game.pending(bob) + game.pending(owner), STAKE * 2);
        assertEq(address(game).balance, STAKE * 2);
    }
}
