// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice The smallest useful contract there is: it remembers one number.
contract Step0Number {
    uint256 public number;

    function setNumber(uint256 newNumber) external {
        number = newNumber;
    }
}
