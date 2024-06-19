// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IREGGovernor.sol";
import "./interfaces/IREGIncentiveVault.sol";
import "./libraries/REGGovernorErrors.sol";
import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorTimelockControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract REGGovernor is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    GovernorTimelockControlUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IREGGovernor
{
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

    ProposerMode private _proposerMode;

    bool private _incentiveEnabled;

    IREGIncentiveVault private _regIncentiveVault;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IVotes _token,
        TimelockControllerUpgradeable _timelock,
        address defaultAdmin
    ) public initializer {
        __Governor_init("REGGovernor");
        __GovernorSettings_init(15 minutes, 1 hours, 200e18);
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(4);
        __GovernorTimelockControl_init(_timelock);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, defaultAdmin);
    }

    /**
     * @notice The admin (with upgrader role) uses this function to update the contract
     * @dev This function is always needed in future implementation contract versions, otherwise, the contract will not be upgradeable
     * @param newImplementation is the address of the new implementation contract
     **/
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {
        // Intentionally left blank
    }

    /// @inheritdoc IREGGovernor
    function setProposerMode(
        ProposerMode proposerMode
    ) external override onlyGovernance {
        emit SetProposerMode(proposerMode);
        _proposerMode = ProposerMode(proposerMode);
    }

    /// @inheritdoc IREGGovernor
    function setIncentiveEnabled(bool status) external override onlyGovernance {
        emit SetIncentiveEnabled(status);
        _incentiveEnabled = status;
    }

    /// @inheritdoc IREGGovernor
    function setRegIncentiveVault(
        IREGIncentiveVault regIncentiveVault
    ) external override onlyGovernance {
        emit SetRegIncentiveVault(regIncentiveVault);
        _regIncentiveVault = IREGIncentiveVault(regIncentiveVault);
    }

    /// @inheritdoc IREGGovernor
    function getProposerMode() external view override returns (ProposerMode) {
        return _proposerMode;
    }

    /// @inheritdoc IREGGovernor
    function getIncentiveEnabled() external view override returns (bool) {
        return _incentiveEnabled;
    }

    /// @inheritdoc IREGGovernor
    function getRegIncentiveVault()
        external
        view
        override
        returns (IREGIncentiveVault)
    {
        return _regIncentiveVault;
    }

    /// @inheritdoc IREGGovernor
    function cancelByAdmin(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) external override onlyRole(CANCELLER_ROLE) returns (uint256) {
        return _cancel(targets, values, calldatas, descriptionHash);
    }

    /**
     * @dev Verify if the proposer has the required votes and role to propose according to the proposer mode.
     **/
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override returns (uint256) {
        address proposer = _msgSender();

        // check description restriction
        if (!_isValidDescriptionForProposer(proposer, description)) {
            revert GovernorRestrictedProposer(proposer);
        }

        bool proposerHasVotes = getVotes(proposer, clock() - 1) >=
            proposalThreshold();
        bool proposerHasRole = hasRole(PROPOSER_ROLE, proposer);

        if (_proposerMode == ProposerMode.ProposerWithRole) {
            if (!proposerHasRole)
                revert REGGovernorErrors.InvalidProposerWithRole();
        } else if (_proposerMode == ProposerMode.ProposerWithVotingPower) {
            if (!proposerHasVotes)
                revert REGGovernorErrors.InvalidProposerWithVotingPower();
        } else if (
            _proposerMode == ProposerMode.ProposerWithRoleAndVotingPower
        ) {
            if (!proposerHasVotes || !proposerHasRole)
                revert REGGovernorErrors
                    .InvalidProposerWithRoleAndVotingPower();
        } else if (
            _proposerMode == ProposerMode.ProposerWithRoleOrVotingPower
        ) {
            if (!proposerHasVotes && !proposerHasRole)
                revert REGGovernorErrors.InvalidProposerWithRoleOrVotingPower();
        } else {
            revert REGGovernorErrors.InvalidProposerMode();
        }

        return
            super._propose(targets, values, calldatas, description, proposer);
    }

    /**
     * @dev If the incentive is enabled, record the vote in the incentive vault.
     **/
    function _castVote(
        uint256 proposalId,
        address account,
        uint8 support,
        string memory reason,
        bytes memory params
    ) internal override returns (uint256) {
        if (_incentiveEnabled) {
            _regIncentiveVault.recordVote(account, proposalId);
        }

        return super._castVote(proposalId, account, support, reason, params);
    }

    function votingDelay()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(
        uint256 blockNumber
    )
        public
        view
        override(GovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function state(
        uint256 proposalId
    )
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(
        uint256 proposalId
    )
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (uint48)
    {
        return
            super._queueOperations(
                proposalId,
                targets,
                values,
                calldatas,
                descriptionHash
            );
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
    {
        super._executeOperations(
            proposalId,
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlUpgradeable, GovernorUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
