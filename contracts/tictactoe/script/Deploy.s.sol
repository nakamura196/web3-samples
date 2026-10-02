// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {SoloTicTacToe} from "../src/SoloTicTacToe.sol";
import {TicTacToe} from "../src/TicTacToe.sol";

/// @notice Deploys both game contracts and prints the env lines the web app needs.
/// @dev Two independent deployments — they share the Board library at compile time
///      but never call each other at runtime.
///
///      Local:
///        forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
///          --broadcast --private-key $PRIVATE_KEY
///
///      Testnet (Base Sepolia):
///        forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL \
///          --broadcast --verify --private-key $PRIVATE_KEY
///
///      FEE_BPS (0..500) sets the protocol cut taken from decisive games. Default 0.
contract Deploy is Script {
    function run() external returns (TicTacToe game, SoloTicTacToe solo) {
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(0)));

        vm.startBroadcast();
        game = new TicTacToe(feeBps);
        solo = new SoloTicTacToe();
        vm.stopBroadcast();

        console2.log("chainId:", block.chainid);
        console2.log("TicTacToe:    ", address(game));
        console2.log("SoloTicTacToe:", address(solo));
        console2.log("feeBps:       ", feeBps);
        console2.log("");
        console2.log("Add to web/.env.local:");
        console2.log(
            string.concat(
                "NEXT_PUBLIC_TICTACTOE_ADDRESS_", vm.toString(block.chainid), "=", vm.toString(address(game))
            )
        );
        console2.log(
            string.concat("NEXT_PUBLIC_SOLO_ADDRESS_", vm.toString(block.chainid), "=", vm.toString(address(solo)))
        );
    }
}
