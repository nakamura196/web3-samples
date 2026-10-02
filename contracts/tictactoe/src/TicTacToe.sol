// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Board} from "./Board.sol";

/// @title TicTacToe — on-chain tic-tac-toe with per-game stakes and winner-takes-pot payouts.
/// @notice Two players each escrow an equal stake. The winner claims the whole pot minus an
///         optional protocol fee; a draw refunds both. If the player to move stalls past the
///         deadline, the opponent wins by forfeit, so a game can never lock funds forever.
/// @dev    Payouts use the pull pattern: results are credited to `pending` and the recipient
///         calls `withdraw()`. A player whose wallet reverts on receive therefore cannot brick
///         the game for the opponent.
contract TicTacToe {
    // ---------------------------------------------------------------- types

    enum Status {
        None, // slot never written
        Open, // created, waiting for an opponent
        Active, // both players staked, game in progress
        Finished, // decided (win / draw / forfeit)
        Cancelled // no opponent joined; creator refunded
    }

    enum Outcome {
        None,
        Win, // three in a row
        Draw, // board full
        Forfeit // player to move ran out the clock
    }

    struct Game {
        address playerX; // creator, always moves first
        uint96 stake; // per player, in wei
        address playerO; // designated opponent while Open (0 = anyone), joiner once Active
        uint64 deadline; // Open: join window. Active: the mover must play by this time.
        uint32 timeout; // seconds granted for each move
        address winner; // 0 unless Outcome.Win / Outcome.Forfeit
        uint16 boardX; // 9-bit mask, bit i = cell i claimed by X
        uint16 boardO;
        uint8 moves; // 0..9; even means X is to move
        Status status;
        Outcome outcome;
    }

    // ------------------------------------------------------------ constants

    uint32 public constant MIN_TIMEOUT = 1 minutes;
    uint32 public constant MAX_TIMEOUT = 7 days;
    uint16 public constant MAX_FEE_BPS = 500; // 5% ceiling, enforced on every update

    // ---------------------------------------------------------------- state

    address public owner;
    uint16 public feeBps;

    Game[] private games;

    /// @notice Balances awaiting withdrawal (winnings, refunds, accrued fees).
    mapping(address => uint256) public pending;

    // --------------------------------------------------------------- events

    event GameCreated(
        uint256 indexed gameId,
        address indexed playerX,
        address indexed invitedOpponent,
        uint256 stake,
        uint32 timeout,
        uint64 joinDeadline
    );
    event GameJoined(uint256 indexed gameId, address indexed playerO, uint64 moveDeadline);
    event MovePlayed(uint256 indexed gameId, address indexed player, uint8 cell, uint8 moveNumber, uint64 moveDeadline);
    event GameFinished(uint256 indexed gameId, Outcome outcome, address indexed winner, uint256 payout, uint256 fee);
    event GameCancelled(uint256 indexed gameId, address indexed playerX, uint256 refund);
    event Credited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event FeeUpdated(uint16 feeBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --------------------------------------------------------------- errors

    error NotOwner();
    error FeeTooHigh(uint16 feeBps);
    error ZeroAddress();
    error NoSuchGame(uint256 gameId);
    error WrongStatus(uint256 gameId, Status actual, Status expected);
    error TimeoutOutOfRange(uint32 timeout);
    error StakeTooLarge(uint256 stake);
    error CannotPlaySelf();
    error NotInvited(address caller, address invited);
    error WrongStake(uint256 sent, uint256 required);
    error JoinWindowClosed(uint64 deadline);
    error DeadlinePassed(uint64 deadline);
    error DeadlineNotReached(uint64 deadline);
    error NotYourTurn(address caller, address expected);
    error CellOutOfRange(uint8 cell);
    error CellTaken(uint8 cell);
    error NotCreator(address caller, address playerX);
    error NothingToWithdraw();
    error TransferFailed(address to, uint256 amount);

    // ------------------------------------------------------------ modifiers

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(uint16 initialFeeBps) {
        if (initialFeeBps > MAX_FEE_BPS) revert FeeTooHigh(initialFeeBps);
        owner = msg.sender;
        feeBps = initialFeeBps;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeUpdated(initialFeeBps);
    }

    // ----------------------------------------------------------- game flow

    /// @notice Create a game and escrow the creator's stake. The creator plays X and moves first.
    /// @param invitedOpponent Address allowed to join, or the zero address to open it to anyone.
    /// @param timeout Seconds each player gets per move; also the window for an opponent to join.
    /// @return gameId Identifier of the new game.
    function createGame(address invitedOpponent, uint32 timeout) external payable returns (uint256 gameId) {
        if (timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT) revert TimeoutOutOfRange(timeout);
        if (msg.value > type(uint96).max) revert StakeTooLarge(msg.value);
        if (invitedOpponent == msg.sender) revert CannotPlaySelf();

        uint64 joinDeadline = uint64(block.timestamp) + timeout;

        gameId = games.length;
        games.push(
            Game({
                playerX: msg.sender,
                stake: uint96(msg.value),
                playerO: invitedOpponent,
                deadline: joinDeadline,
                timeout: timeout,
                winner: address(0),
                boardX: 0,
                boardO: 0,
                moves: 0,
                status: Status.Open,
                outcome: Outcome.None
            })
        );

        emit GameCreated(gameId, msg.sender, invitedOpponent, msg.value, timeout, joinDeadline);
    }

    /// @notice Match the creator's stake and start the game as O.
    function joinGame(uint256 gameId) external payable {
        Game storage g = _game(gameId);
        if (g.status != Status.Open) revert WrongStatus(gameId, g.status, Status.Open);
        if (block.timestamp > g.deadline) revert JoinWindowClosed(g.deadline);
        if (msg.value != g.stake) revert WrongStake(msg.value, g.stake);
        if (msg.sender == g.playerX) revert CannotPlaySelf();
        if (g.playerO != address(0) && g.playerO != msg.sender) revert NotInvited(msg.sender, g.playerO);

        uint64 moveDeadline = uint64(block.timestamp) + g.timeout;
        g.playerO = msg.sender;
        g.status = Status.Active;
        g.deadline = moveDeadline;

        emit GameJoined(gameId, msg.sender, moveDeadline);
    }

    /// @notice Claim `cell` (0..8, row-major) for the caller and settle the game if it ends.
    function play(uint256 gameId, uint8 cell) external {
        Game storage g = _game(gameId);
        if (g.status != Status.Active) revert WrongStatus(gameId, g.status, Status.Active);
        if (block.timestamp > g.deadline) revert DeadlinePassed(g.deadline);
        if (cell > 8) revert CellOutOfRange(cell);

        bool xToMove = g.moves % 2 == 0;
        address expected = xToMove ? g.playerX : g.playerO;
        if (msg.sender != expected) revert NotYourTurn(msg.sender, expected);

        uint16 bit = Board.bit(cell);
        if ((g.boardX | g.boardO) & bit != 0) revert CellTaken(cell);

        uint16 board;
        if (xToMove) {
            board = g.boardX | bit;
            g.boardX = board;
        } else {
            board = g.boardO | bit;
            g.boardO = board;
        }

        uint8 moveNumber = g.moves + 1;
        g.moves = moveNumber;

        if (Board.isWin(board)) {
            _finish(gameId, g, Outcome.Win, msg.sender);
        } else if (moveNumber == 9) {
            _finish(gameId, g, Outcome.Draw, address(0));
        } else {
            uint64 moveDeadline = uint64(block.timestamp) + g.timeout;
            g.deadline = moveDeadline;
            emit MovePlayed(gameId, msg.sender, cell, moveNumber, moveDeadline);
        }
    }

    /// @notice Award the pot to the waiting player once the mover has run out the clock.
    /// @dev Callable by anyone: the result is fully determined by on-chain state, and letting
    ///      third parties settle keeps stakes recoverable even if the winner goes offline.
    function claimTimeout(uint256 gameId) external {
        Game storage g = _game(gameId);
        if (g.status != Status.Active) revert WrongStatus(gameId, g.status, Status.Active);
        if (block.timestamp <= g.deadline) revert DeadlineNotReached(g.deadline);

        address winner = g.moves % 2 == 0 ? g.playerO : g.playerX;
        _finish(gameId, g, Outcome.Forfeit, winner);
    }

    /// @notice Refund the creator of a game nobody joined.
    /// @dev The creator may cancel at any time while Open — no opponent has funds at risk yet.
    ///      After the join window closes anyone may call it, so the stake is never stranded.
    function cancelGame(uint256 gameId) external {
        Game storage g = _game(gameId);
        if (g.status != Status.Open) revert WrongStatus(gameId, g.status, Status.Open);
        if (msg.sender != g.playerX && block.timestamp <= g.deadline) revert NotCreator(msg.sender, g.playerX);

        uint256 refund = g.stake;
        g.status = Status.Cancelled;

        _credit(g.playerX, refund);
        emit GameCancelled(gameId, g.playerX, refund);
    }

    /// @notice Withdraw winnings, refunds, or accrued fees.
    function withdraw() external returns (uint256 amount) {
        amount = pending[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pending[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);

        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed(msg.sender, amount);
    }

    // -------------------------------------------------------------- admin

    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps);
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // --------------------------------------------------------------- views

    function gameCount() external view returns (uint256) {
        return games.length;
    }

    function getGame(uint256 gameId) external view returns (Game memory) {
        if (gameId >= games.length) revert NoSuchGame(gameId);
        return games[gameId];
    }

    /// @notice Page through games, newest last. Returns fewer than `limit` near the end.
    function getGames(uint256 offset, uint256 limit) external view returns (Game[] memory page) {
        uint256 total = games.length;
        if (offset >= total) return new Game[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        page = new Game[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = games[i];
        }
    }

    /// @notice Board as nine cells, row-major: 0 empty, 1 X, 2 O.
    function boardOf(uint256 gameId) external view returns (uint8[9] memory cells) {
        Game storage g = _game(gameId);
        for (uint8 i = 0; i < 9; ++i) {
            uint16 bit = Board.bit(i);
            if (g.boardX & bit != 0) cells[i] = 1;
            else if (g.boardO & bit != 0) cells[i] = 2;
        }
    }

    /// @notice Who must move next, or the zero address if the game is not in progress.
    function currentPlayer(uint256 gameId) external view returns (address) {
        Game storage g = _game(gameId);
        if (g.status != Status.Active) return address(0);
        return g.moves % 2 == 0 ? g.playerX : g.playerO;
    }

    // ------------------------------------------------------------ internal

    function _game(uint256 gameId) private view returns (Game storage) {
        if (gameId >= games.length) revert NoSuchGame(gameId);
        return games[gameId];
    }

    function _finish(uint256 gameId, Game storage g, Outcome outcome, address winner) private {
        uint256 stake = g.stake;

        g.status = Status.Finished;
        g.outcome = outcome;
        g.winner = winner;
        g.deadline = uint64(block.timestamp);

        uint256 payout;
        uint256 fee;

        if (outcome == Outcome.Draw) {
            // Nobody won, so no fee is taken — each side simply gets its stake back.
            _credit(g.playerX, stake);
            _credit(g.playerO, stake);
            payout = stake;
        } else {
            uint256 pot = stake * 2;
            fee = (pot * feeBps) / 10_000;
            payout = pot - fee;
            _credit(winner, payout);
            if (fee != 0) _credit(owner, fee);
        }

        emit GameFinished(gameId, outcome, winner, payout, fee);
    }

    function _credit(address account, uint256 amount) private {
        if (amount == 0) return;
        pending[account] += amount;
        emit Credited(account, amount);
    }

}
