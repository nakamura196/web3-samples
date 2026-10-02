// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Step 2 — the whole game, in the plainest form it can take.
/// @notice Not used by the app. One game per deployment, no money, no clock, no
///         library, no bit tricks. Everything the real contract does beyond this
///         exists for a reason, and the point of this file is to make those
///         reasons visible by their absence.
///
/// Deploy it once and two players share it. To play a second game you deploy it
/// again — which is exactly the limitation that pushes the real contract towards
/// storing an array of games instead.
contract Step2MinimalTicTacToe {
    /// @notice The board, row-major: 0 = empty, 1 = X, 2 = O.
    /// @dev A plain array is the obvious way to write this, and it is what the
    ///      real contract deliberately does *not* do. Nine separate `uint8` values
    ///      occupy their own storage slots' worth of bookkeeping, whereas two
    ///      9-bit masks fit in four bytes and make "did someone win" a single
    ///      bitwise comparison. Readable first, cheap later.
    uint8[9] public board;

    address public playerX; // deployer, moves first
    address public playerO;

    uint8 public moves; // 0..9
    address public winner; // stays zero on a draw
    bool public finished;

    event Played(address indexed player, uint8 cell, uint8 mark);
    event Finished(address winner); // zero address means a draw

    constructor(address opponent) {
        require(opponent != msg.sender, "you cannot play yourself");
        playerX = msg.sender;
        playerO = opponent;
    }

    /// @notice Claim a cell, 0..8, counting left to right and top to bottom.
    function play(uint8 cell) external {
        require(!finished, "the game is over");
        require(cell < 9, "no such cell");
        require(board[cell] == 0, "that cell is taken");

        // Whose turn it is follows from the move count alone — X on even, O on
        // odd — so there is nothing extra to store and nothing to keep in sync.
        address expected = moves % 2 == 0 ? playerX : playerO;
        require(msg.sender == expected, "not your turn");

        uint8 mark = moves % 2 == 0 ? 1 : 2;
        board[cell] = mark;
        moves += 1;

        emit Played(msg.sender, cell, mark);

        if (_hasWon(mark)) {
            finished = true;
            winner = msg.sender;
            emit Finished(msg.sender);
        } else if (moves == 9) {
            finished = true;
            emit Finished(address(0));
        }
    }

    /// @notice The board in one call. Solidity's generated getter for `board`
    ///         returns a single cell at a time, which would mean nine round trips.
    function getBoard() external view returns (uint8[9] memory) {
        return board;
    }

    /// @dev Walks the eight winning lines and checks whether `mark` holds all three.
    function _hasWon(uint8 mark) private view returns (bool) {
        uint8[3][8] memory lines = [
            [uint8(0), 1, 2], // top row
            [uint8(3), 4, 5], // middle row
            [uint8(6), 7, 8], // bottom row
            [uint8(0), 3, 6], // left column
            [uint8(1), 4, 7], // middle column
            [uint8(2), 5, 8], // right column
            [uint8(0), 4, 8], // diagonal
            [uint8(2), 4, 6] // anti-diagonal
        ];

        for (uint256 i = 0; i < 8; ++i) {
            if (board[lines[i][0]] == mark && board[lines[i][1]] == mark && board[lines[i][2]] == mark) {
                return true;
            }
        }
        return false;
    }
}
