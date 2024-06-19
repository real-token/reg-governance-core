//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Interface for REGVotingPowerRegistry
 */

interface IREGVotingPowerRegistry {
    struct VotingPower {
        address voter;
        uint256 votes;
    }

    event RegisterVotingPower(address indexed voter, uint256 indexed votes);

    function registerVotingPower(VotingPower[] calldata votingPower) external;
}
