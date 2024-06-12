// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title REGGovernorErrors library
 * @author RealT
 * @notice Defines the error messages emitted by the REGGovernor contract
 */
library REGGovernorErrors {
    error InvalidProposerMode();
    error InvalidProposerWithRole();
    error InvalidProposerWithVotingPower();
    error InvalidProposerWithRoleAndVotingPower();
    error InvalidProposerWithRoleOrVotingPower();
}
