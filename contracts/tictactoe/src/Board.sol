// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Board — bit-mask helpers for a 3x3 tic-tac-toe board.
/// @notice A board is a 9-bit mask, bit `i` meaning "cell `i` is mine", numbered
///         row-major from the top-left. Each player carries their own mask, so a
///         cell is empty exactly when neither mask has that bit set.
/// @dev All functions are `internal`, so the compiler inlines them and no
///      library deployment or linking is needed.
library Board {
    /// @dev All nine cells occupied.
    uint16 internal constant FULL = 0x1FF;

    /// @dev Sentinel for "no cell chosen"; a real cell is always 0..8.
    uint8 internal constant NONE = 255;

    /// @return The eight winning lines: three rows, three columns, two diagonals.
    function lines() internal pure returns (uint16[8] memory) {
        return [
            uint16(0x007), // 0,1,2
            0x038, // 3,4,5
            0x1C0, // 6,7,8
            0x049, // 0,3,6
            0x092, // 1,4,7
            0x124, // 2,5,8
            0x111, // 0,4,8
            0x054 // 2,4,6
        ];
    }

    function bit(uint8 cell) internal pure returns (uint16) {
        return uint16(1) << cell;
    }

    /// @return True when `board` covers any winning line.
    function isWin(uint16 board) internal pure returns (bool) {
        uint16[8] memory all = lines();
        for (uint256 i = 0; i < 8; ++i) {
            if (board & all[i] == all[i]) return true;
        }
        return false;
    }

    /// @return The cells nobody has taken.
    function emptyMask(uint16 a, uint16 b) internal pure returns (uint16) {
        return FULL & ~(a | b);
    }

    function isEmpty(uint16 a, uint16 b, uint8 cell) internal pure returns (bool) {
        return (a | b) & bit(cell) == 0;
    }

    function contains(uint16 mask, uint8 cell) internal pure returns (bool) {
        return mask & bit(cell) != 0;
    }
}
