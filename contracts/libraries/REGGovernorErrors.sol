// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title REGGovernorErrors library
 * @author RealT
 * @notice Defines the error messages emitted by the REGGovernor contract
 */
library REGGovernorErrors {
    error ProposerWithoutRole();
    error ProposerWithoutVotes();
    error ProposerWithoutVotesOrRole();
    error InvalidProposerMode();
}
