// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title 非開示の賃料を使った担保判定
/// @notice 目論見書には、こう書かれている項目がある。
///
///   「賃料及び共益費 ── 非開示（固定賃料＋変動賃料型）」
///   「賃借人から開示の同意が得られていないため、一部の項目について非開示としています」
///
///   賃料は開示できない。しかし担保評価には賃料が要る。
///   そこで「賃料そのものは出さず、基準を満たすかどうかだけ返す」ことを考える。
///
/// @dev **この契約は、ふつうの EVM の上では目的を果たさない。**
///      _rent を private にしても、ストレージは誰でも読める。
///      Oasis Sapphire のような秘匿 EVM ではストレージが暗号化されるため、
///      同じコードが初めて意図どおりに動く。その差を示すために置いてある。
contract ConfidentialRent {
    address public immutable curator;

    /// @dev private にしてある。それでも外から読めることを demo_leak.zsh で示す。
    mapping(bytes32 => uint256) private _annualRent;

    error NotCurator();

    constructor() { curator = msg.sender; }

    function setRent(bytes32 propertyId, uint256 annualRent) external {
        if (msg.sender != curator) revert NotCurator();
        _annualRent[propertyId] = annualRent;
    }

    /// @notice 賃料は返さない。基準を満たすかどうかだけを返す。
    /// @param loan 借入希望額
    /// @param minCoverageBps 賃料が借入額の何倍必要か(bps)。10000 = 1.0倍
    function meetsCoverage(bytes32 propertyId, uint256 loan, uint256 minCoverageBps)
        external view returns (bool)
    {
        uint256 rent = _annualRent[propertyId];
        if (loan == 0) return true;
        return (rent * 10_000) / loan >= minCoverageBps;
    }
}
