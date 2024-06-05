//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IREGIncentiveVault} from "./IREGIncentiveVault.sol";

/**
 * @title Additional interface for REGGovernor
 */

interface IREGGovernor {
    enum ProposerMode {
        ProposerWithRole,
        ProposerWithVotingPower,
        ProposerWithRoleAndVotingPower
    }

    event ProposerModeUpdated(ProposerMode proposerMode);

    function setProposerMode(ProposerMode proposerMode) external;

    function getProposerMode() external view returns (ProposerMode);

    function setRegIncentiveVault(
        IREGIncentiveVault regIncentiveVault
    ) external;

    function getRegIncentiveVault() external view returns (IREGIncentiveVault);
}
