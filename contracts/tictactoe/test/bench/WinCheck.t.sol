// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Board} from "../../src/Board.sol";

/// @notice Measures the two ways of asking "did this player win", so the choice
///         in the real contract rests on a number rather than a hunch.
contract WinCheckBench is Test {
    ArrayBoard internal arrayBoard = new ArrayBoard();
    MaskBoard internal maskBoard = new MaskBoard();

    function setUp() public {
        // X holds the top row in both representations.
        arrayBoard.set(0, 1);
        arrayBoard.set(1, 1);
        arrayBoard.set(2, 1);
        arrayBoard.set(3, 2);
        arrayBoard.set(4, 2);

        maskBoard.set(Board.bit(0) | Board.bit(1) | Board.bit(2));
    }

    function test_ArrayWinCheck() public view {
        assertTrue(arrayBoard.hasWon(1));
    }

    function test_MaskWinCheck() public view {
        assertTrue(maskBoard.hasWon());
    }

    function test_ArrayWrite() public {
        arrayBoard.set(5, 1);
    }

    function test_MaskWrite() public {
        maskBoard.set(maskBoard.board() | Board.bit(5));
    }
}

contract ArrayBoard {
    uint8[9] public cells;

    function set(uint8 cell, uint8 mark) external {
        cells[cell] = mark;
    }

    function hasWon(uint8 mark) external view returns (bool) {
        uint8[3][8] memory lines = [
            [uint8(0), 1, 2],
            [uint8(3), 4, 5],
            [uint8(6), 7, 8],
            [uint8(0), 3, 6],
            [uint8(1), 4, 7],
            [uint8(2), 5, 8],
            [uint8(0), 4, 8],
            [uint8(2), 4, 6]
        ];
        for (uint256 i = 0; i < 8; ++i) {
            if (cells[lines[i][0]] == mark && cells[lines[i][1]] == mark && cells[lines[i][2]] == mark) return true;
        }
        return false;
    }
}

contract MaskBoard {
    uint16 public board;

    function set(uint16 next) external {
        board = next;
    }

    function hasWon() external view returns (bool) {
        return Board.isWin(board);
    }
}
