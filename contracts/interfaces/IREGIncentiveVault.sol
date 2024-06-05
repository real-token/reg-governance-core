//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Interface for REGIncentiveVault
 */

interface IREGIncentiveVault {
    function recordVote(address voter, uint256 proposalId) external;
}
