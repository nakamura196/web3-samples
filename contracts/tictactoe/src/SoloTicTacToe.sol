// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Board} from "./Board.sol";

/// @title SoloTicTacToe — practice games against an opponent written in Solidity.
/// @notice Free to play: no stakes, no escrow, no deadlines. You pay gas, and the
///         contract answers your move inside the same transaction.
/// @dev Why no stakes? Tic-tac-toe is a solved game — perfect play always draws.
///      Betting against a perfect opponent can only ever break even or lose, so
///      wagering here would be a losing proposition by construction. Stakes live
///      in the player-versus-player contract instead.
contract SoloTicTacToe {
    // ---------------------------------------------------------------- types

    enum Difficulty {
        Easy, // takes a win if offered, otherwise plays at random
        Normal, // wins and blocks, but walks into forks
        Hard // full strategy; cannot be beaten
    }

    enum Result {
        InProgress,
        PlayerWon,
        CpuWon,
        Draw
    }

    struct Solo {
        address player; // 20 bytes
        uint16 boardPlayer; // your cells
        uint16 boardCpu; // the contract's cells
        uint8 moves; // 0..9, counting both sides
        Difficulty difficulty;
        Result result;
        bool cpuFirst; // true when the contract opened the game
    }

    /// @dev Cell preference when several are equally good: centre, corners, then sides.
    ///      A corner is worth more than a side because it sits on three winning lines.
    uint8 private constant PREFERRED_0 = 4;

    // ---------------------------------------------------------------- state

    Solo[] private games;

    // --------------------------------------------------------------- events

    event GameCreated(
        uint256 indexed gameId, address indexed player, Difficulty difficulty, bool cpuFirst, uint8 cpuCell
    );
    event MovePlayed(uint256 indexed gameId, address indexed player, uint8 playerCell, uint8 cpuCell, Result result);
    event GameFinished(uint256 indexed gameId, Result result);

    // --------------------------------------------------------------- errors

    error NoSuchGame(uint256 gameId);
    error GameOver(uint256 gameId);
    error NotYourGame(address caller, address player);
    error CellOutOfRange(uint8 cell);
    error CellTaken(uint8 cell);
    error BoardFull();

    // ----------------------------------------------------------- game flow

    /// @notice Start a practice game.
    /// @param difficulty How hard the contract plays.
    /// @param cpuFirst Let the contract open. On Hard this is worth trying — the
    ///        opening advantage makes the strategy easier to observe.
    function newGame(Difficulty difficulty, bool cpuFirst) external returns (uint256 gameId) {
        gameId = games.length;
        games.push(
            Solo({
                player: msg.sender,
                boardPlayer: 0,
                boardCpu: 0,
                moves: 0,
                difficulty: difficulty,
                result: Result.InProgress,
                cpuFirst: cpuFirst
            })
        );

        uint8 cpuCell = Board.NONE;
        if (cpuFirst) {
            Solo storage g = games[gameId];
            cpuCell = _chooseCpuCell(0, 0, difficulty, _seed(gameId, 0));
            g.boardCpu = Board.bit(cpuCell);
            g.moves = 1;
        }

        emit GameCreated(gameId, msg.sender, difficulty, cpuFirst, cpuCell);
    }

    /// @notice Claim `cell` (0..8, row-major). The contract replies in the same
    ///         transaction unless your move ended the game.
    function play(uint256 gameId, uint8 cell) external {
        Solo storage g = _game(gameId);
        if (g.result != Result.InProgress) revert GameOver(gameId);
        if (g.player != msg.sender) revert NotYourGame(msg.sender, g.player);
        if (cell > 8) revert CellOutOfRange(cell);
        if (!Board.isEmpty(g.boardPlayer, g.boardCpu, cell)) revert CellTaken(cell);

        uint16 boardPlayer = g.boardPlayer | Board.bit(cell);
        g.boardPlayer = boardPlayer;

        uint8 moves = g.moves + 1;
        uint8 cpuCell = Board.NONE;
        Result result = Result.InProgress;

        if (Board.isWin(boardPlayer)) {
            result = Result.PlayerWon;
        } else if (moves == 9) {
            result = Result.Draw;
        } else {
            cpuCell = _chooseCpuCell(g.boardCpu, boardPlayer, g.difficulty, _seed(gameId, moves));
            uint16 boardCpu = g.boardCpu | Board.bit(cpuCell);
            g.boardCpu = boardCpu;
            moves += 1;

            if (Board.isWin(boardCpu)) result = Result.CpuWon;
            else if (moves == 9) result = Result.Draw;
        }

        g.moves = moves;
        g.result = result;

        emit MovePlayed(gameId, msg.sender, cell, cpuCell, result);
        if (result != Result.InProgress) emit GameFinished(gameId, result);
    }

    // --------------------------------------------------------------- views

    function gameCount() external view returns (uint256) {
        return games.length;
    }

    function getGame(uint256 gameId) external view returns (Solo memory) {
        if (gameId >= games.length) revert NoSuchGame(gameId);
        return games[gameId];
    }

    function getGames(uint256 offset, uint256 limit) external view returns (Solo[] memory page) {
        uint256 total = games.length;
        if (offset >= total) return new Solo[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        page = new Solo[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = games[i];
        }
    }

    /// @notice Board as nine cells, row-major: 0 empty, 1 you, 2 the contract.
    function boardOf(uint256 gameId) external view returns (uint8[9] memory cells) {
        Solo storage g = _game(gameId);
        for (uint8 i = 0; i < 9; ++i) {
            if (Board.contains(g.boardPlayer, i)) cells[i] = 1;
            else if (Board.contains(g.boardCpu, i)) cells[i] = 2;
        }
    }

    /// @notice What the contract would answer to the given position. Handy for the
    ///         UI to preview a hint, and for tests to explore the strategy.
    function previewCpuMove(uint16 boardCpu, uint16 boardPlayer, Difficulty difficulty, uint256 seed)
        external
        pure
        returns (uint8)
    {
        return _chooseCpuCell(boardCpu, boardPlayer, difficulty, seed);
    }

    // ------------------------------------------------------------ internal

    function _game(uint256 gameId) private view returns (Solo storage) {
        if (gameId >= games.length) revert NoSuchGame(gameId);
        return games[gameId];
    }

    /// @dev NOT secure randomness. A validator can nudge `blockhash`, and anyone can
    ///      simulate this call before sending it. That is acceptable here only
    ///      because nothing is at stake — it exists to stop Easy from replaying the
    ///      same game every time. Never seed a payout this way. A contract that pays
    ///      out on randomness needs a commit-reveal scheme or an oracle such as
    ///      Chainlink VRF.
    function _seed(uint256 gameId, uint8 moves) private view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), address(this), gameId, moves)));
    }

    // ------------------------------------------------------------ strategy

    /// @dev Picks the contract's reply. `mine` is the contract's mask, `theirs` yours.
    function _chooseCpuCell(uint16 mine, uint16 theirs, Difficulty difficulty, uint256 seed)
        private
        pure
        returns (uint8)
    {
        uint16 empty = Board.emptyMask(mine, theirs);
        if (empty == 0) revert BoardFull();

        // Every difficulty finishes a game it can win this move.
        uint8 cell = _winningCell(mine, empty);
        if (cell != Board.NONE) return cell;

        if (difficulty == Difficulty.Easy) {
            return _randomCell(empty, seed);
        }

        // Stop an immediate loss.
        cell = _winningCell(theirs, empty);
        if (cell != Board.NONE) return cell;

        if (difficulty == Difficulty.Normal) {
            // No fork awareness: this is the gap that makes Normal beatable.
            return _preferredCell(empty);
        }

        return _hardCell(mine, theirs, empty);
    }

    /// @dev The classic perfect strategy. Win and block are already handled above.
    function _hardCell(uint16 mine, uint16 theirs, uint16 empty) private pure returns (uint8) {
        // 1. Create a fork: a move that leaves two winning threats at once, which
        //    the opponent cannot answer with a single reply.
        uint16 myForks = _forkCells(mine, empty);
        if (myForks != 0) return _preferredCell(myForks);

        // 2. Deal with the opponent's forks.
        uint16 theirForks = _forkCells(theirs, empty);
        if (theirForks != 0) {
            // A single fork square can simply be occupied.
            if (_isSingleCell(theirForks)) return _onlyCell(theirForks);

            // With several fork squares, taking one still loses to the others.
            // Instead make a two-in-a-row: the opponent is forced to block, and as
            // long as the square they must block is not itself a fork, the threat
            // disappears. See "Newell and Simon (1972)".
            uint8 forcing = _forcingCell(mine, empty, theirForks);
            if (forcing != Board.NONE) return forcing;
        }

        // 3. Positional fallbacks, strongest square first.
        if (Board.contains(empty, 4)) return 4;

        uint8 opposite = _oppositeCorner(theirs, empty);
        if (opposite != Board.NONE) return opposite;

        return _preferredCell(empty);
    }

    /// @return The cell that completes a line for `mine`, or `Board.NONE`.
    function _winningCell(uint16 mine, uint16 empty) private pure returns (uint8) {
        for (uint8 cell = 0; cell < 9; ++cell) {
            if (!Board.contains(empty, cell)) continue;
            if (Board.isWin(mine | Board.bit(cell))) return cell;
        }
        return Board.NONE;
    }

    /// @return count How many different cells would win for `mine` right now.
    function _threatCount(uint16 mine, uint16 empty) private pure returns (uint8 count) {
        for (uint8 cell = 0; cell < 9; ++cell) {
            if (!Board.contains(empty, cell)) continue;
            if (Board.isWin(mine | Board.bit(cell))) ++count;
        }
    }

    /// @return forks Mask of cells that would give `mine` two simultaneous threats.
    function _forkCells(uint16 mine, uint16 empty) private pure returns (uint16 forks) {
        for (uint8 cell = 0; cell < 9; ++cell) {
            if (!Board.contains(empty, cell)) continue;
            uint16 next = mine | Board.bit(cell);
            uint16 rest = empty & ~Board.bit(cell);
            if (_threatCount(next, rest) >= 2) forks |= Board.bit(cell);
        }
    }

    /// @dev A move creating exactly one threat whose forced reply is not one of
    ///      `theirForks` — so blocking us costs them their fork.
    function _forcingCell(uint16 mine, uint16 empty, uint16 theirForks) private pure returns (uint8) {
        for (uint8 cell = 0; cell < 9; ++cell) {
            if (!Board.contains(empty, cell)) continue;
            uint16 next = mine | Board.bit(cell);
            uint16 rest = empty & ~Board.bit(cell);
            if (_threatCount(next, rest) != 1) continue;

            uint8 reply = _winningCell(next, rest);
            if (!Board.contains(theirForks, reply)) return cell;
        }
        return Board.NONE;
    }

    /// @dev If the opponent holds a corner and the diagonally opposite one is free,
    ///      taking it denies them the long diagonal.
    function _oppositeCorner(uint16 theirs, uint16 empty) private pure returns (uint8) {
        uint8[4] memory corners = [0, 2, 6, 8];
        uint8[4] memory opposites = [8, 6, 2, 0];
        for (uint256 i = 0; i < 4; ++i) {
            if (Board.contains(theirs, corners[i]) && Board.contains(empty, opposites[i])) {
                return opposites[i];
            }
        }
        return Board.NONE;
    }

    /// @dev Centre, then corners, then sides — the standard ordering by how many
    ///      winning lines pass through each square (4, 3 and 2 respectively).
    function _preferredCell(uint16 candidates) private pure returns (uint8) {
        uint8[9] memory order = [4, 0, 2, 6, 8, 1, 3, 5, 7];
        for (uint256 i = 0; i < 9; ++i) {
            if (Board.contains(candidates, order[i])) return order[i];
        }
        revert BoardFull();
    }

    function _randomCell(uint16 empty, uint256 seed) private pure returns (uint8) {
        uint8 count = _popcount(empty);
        uint8 target = uint8(seed % count);
        for (uint8 cell = 0; cell < 9; ++cell) {
            if (!Board.contains(empty, cell)) continue;
            if (target == 0) return cell;
            --target;
        }
        revert BoardFull();
    }

    function _popcount(uint16 mask) private pure returns (uint8 count) {
        for (uint8 i = 0; i < 9; ++i) {
            if (mask & (uint16(1) << i) != 0) ++count;
        }
    }

    function _isSingleCell(uint16 mask) private pure returns (bool) {
        return mask != 0 && mask & (mask - 1) == 0;
    }

    function _onlyCell(uint16 mask) private pure returns (uint8) {
        for (uint8 cell = 0; cell < 9; ++cell) {
            if (Board.contains(mask, cell)) return cell;
        }
        revert BoardFull();
    }
}
