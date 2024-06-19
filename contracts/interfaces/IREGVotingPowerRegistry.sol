// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Interface for REGVotingPowerRegistry
 * @notice This interface defines the functions for managing voting power in the REG system.
 */
interface IREGVotingPowerRegistry {
    /**
     * @notice Struct to store the the voter and their voting power
     * @param voter The user (voter) address.
     * @param votes The voting power of the user.
     */
    struct VotingPower {
        address voter;
        uint256 votes;
    }

    /**
     * @notice Emitted when the voting power is updated.
     * @param voter The address of the voter.
     * @param votes The new voting power of the user.
     */
    event RegisterVotingPower(address indexed voter, uint256 indexed votes);

    /**
     * @notice Registers the voting power of an array of users.
     * @param votingPower The arrays of users and new voting powers.
     */
    function registerVotingPower(VotingPower[] calldata votingPower) external;
}
