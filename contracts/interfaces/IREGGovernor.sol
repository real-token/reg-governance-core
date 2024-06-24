// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IREGIncentiveVault} from "./IREGIncentiveVault.sol";

/**
 * @title Interface for REGGovernor
 * @notice This interface defines the functions and events for the REGGovernor contract.
 */
interface IREGGovernor {
    /**
     * @notice Enum representing the different proposer modes.
     */
    enum ProposerMode {
        ProposerWithRole,
        ProposerWithVotingPower,
        ProposerWithRoleAndVotingPower,
        ProposerWithRoleOrVotingPower
    }

    /**
     * @notice Emitted when the proposer mode is set.
     * @param proposerMode The new proposer mode.
     */
    event SetProposerMode(ProposerMode proposerMode);

    /**
     * @notice Emitted when the incentive is enabled or disabled.
     * @param status The new status of the incentive.
     */
    event SetIncentiveEnabled(bool status);

    /**
     * @notice Emitted when the REG incentive vault is set.
     * @param regIncentiveVault The address of the new REG incentive vault.
     */
    event SetRegIncentiveVault(IREGIncentiveVault regIncentiveVault);

    event ProposalCreatedDescriptionHash(bytes32 descriptionHash);

    /**
     * @notice Sets the proposer mode.
     * @param proposerMode The new proposer mode.
     */
    function setProposerMode(ProposerMode proposerMode) external;

    /**
     * @notice Enables or disables the incentive.
     * @param status The new status of the incentive.
     */
    function setIncentiveEnabled(bool status) external;

    /**
     * @notice Sets the REG incentive vault.
     * @param regIncentiveVault The address of the new REG incentive vault.
     */
    function setRegIncentiveVault(
        IREGIncentiveVault regIncentiveVault
    ) external;

    /**
     * @notice Returns the current proposer mode.
     * @return The current proposer mode.
     */
    function getProposerMode() external view returns (ProposerMode);

    /**
     * @notice Returns whether the incentive is enabled.
     * @return True if the incentive is enabled, false otherwise.
     */
    function getIncentiveEnabled() external view returns (bool);

    /**
     * @notice Returns the address of the REG incentive vault.
     * @return The address of the REG incentive vault.
     */
    function getRegIncentiveVault() external view returns (IREGIncentiveVault);

    /**
     * @notice Cancels a proposal by the admin.
     * @param targets The addresses of the targets.
     * @param values The values to be sent.
     * @param calldatas The calldata to be executed.
     * @param descriptionHash The hash of the proposal description.
     * @return The ID of the cancelled proposal.
     */
    function cancelByAdmin(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) external returns (uint256);
}
