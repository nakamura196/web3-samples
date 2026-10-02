// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Step 1 — what a contract actually is.
/// @notice Not used by the app. This file exists to be read.
///
/// Read this as: a single object that was created once, lives at a fixed address
/// forever, and carries its own private database. You never construct another
/// instance of it, and you never restart it. Every call arrives from outside as a
/// transaction, and every change it makes is permanent.
contract Step1Storage {
    // ---- storage -----------------------------------------------------------
    //
    // These three live in the contract's own permanent storage. There is no
    // separate database: this *is* the database. A value written here survives
    // forever, and every node in the network holds a copy.
    //
    // `public` does something surprising: the compiler generates a free read-only
    // getter for each one. After deploying, `message()` is callable from outside
    // even though no such function is written below.

    string public message;
    address public lastWriter;
    uint256 public writeCount;

    // ---- events ------------------------------------------------------------
    //
    // An event is a log line. It is far cheaper than storage, but contracts can
    // never read it back — it exists purely so that off-chain code (your Next.js
    // app, an indexer, a block explorer) can notice that something happened.
    //
    // `indexed` makes a field filterable: "show me every write by this address".

    event MessageChanged(address indexed writer, string message, uint256 writeCount);

    // ---- constructor -------------------------------------------------------
    //
    // Runs exactly once, at deployment, and then its code is discarded. This is
    // the only moment the contract can be initialised.

    constructor(string memory initialMessage) {
        message = initialMessage;
        lastWriter = msg.sender;
    }

    // ---- writing -----------------------------------------------------------
    //
    // `external` means "callable from outside, not from inside this contract".
    // There is no `req`, no session, no cookie. Instead the EVM hands you
    // `msg.sender`: the address that signed this transaction. It is authenticated
    // by the signature itself, so it cannot be forged — that single fact replaces
    // most of what a web2 auth layer does.
    //
    // Because this function changes storage, calling it costs gas and takes a
    // block to confirm. It cannot return a value to the caller: by the time the
    // transaction is mined, whoever sent it has long since moved on. That is why
    // results are announced through events instead.

    function setMessage(string calldata newMessage) external {
        // `require` aborts and undoes *everything* this transaction did. There is
        // no partial write to clean up: either the whole call succeeded, or the
        // chain looks exactly as it did before.
        require(bytes(newMessage).length > 0, "message must not be empty");

        message = newMessage;
        lastWriter = msg.sender;
        writeCount += 1;

        emit MessageChanged(msg.sender, newMessage, writeCount);
    }

    // ---- reading -----------------------------------------------------------
    //
    // `view` promises not to change anything. Calls to a view function can be
    // answered by any single node from its local copy of the state, so they are
    // free and instant — no transaction, no gas, no waiting. This is the whole
    // reason the read/write split matters so much in Solidity.

    function summary() external view returns (string memory currentMessage, address writer, uint256 count) {
        return (message, lastWriter, writeCount);
    }
}
