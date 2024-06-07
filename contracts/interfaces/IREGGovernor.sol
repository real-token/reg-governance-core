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

    event SetProposerMode(ProposerMode proposerMode);

    event SetIncentiveEnabled(bool status);

    event SetRegIncentiveVault(IREGIncentiveVault regIncentiveVault);

    function setProposerMode(ProposerMode proposerMode) external;

    function setIncentiveEnabled(bool status) external;

    function setRegIncentiveVault(
        IREGIncentiveVault regIncentiveVault
    ) external;

    function getProposerMode() external view returns (ProposerMode);

    function getIncentiveEnabled() external view returns (bool);

    function getRegIncentiveVault() external view returns (IREGIncentiveVault);
}
