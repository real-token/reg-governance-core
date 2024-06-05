// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
        __GovernorSettings_init(1 days, 1 weeks, 100e18);
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(4);
        __GovernorTimelockControl_init(_timelock);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // The following functions are overrides required by Solidity.

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
        return supportsInterface(interfaceId);
    }

    function setProposerMode(
        ProposerMode proposerMode
    ) external override onlyGovernance {
        emit ProposerModeUpdated(proposerMode);
        _proposerMode = ProposerMode(proposerMode);
    }

    function getProposerMode() external view override returns (ProposerMode) {
        return _proposerMode;
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override returns (uint256) {
        bool proposerHasVotes = getVotes(msg.sender, block.number - 1) >=
            proposalThreshold();
        bool proposerHasRole = hasRole(PROPOSER_ROLE, msg.sender);

        if (_proposerMode == ProposerMode.ProposerWithRoleAndVotingPower) {
            if (!proposerHasVotes || !proposerHasRole)
                revert REGGovernorErrors.ProposerWithoutVotesOrRole();
        } else if (_proposerMode == ProposerMode.ProposerWithRole) {
            if (!proposerHasRole)
                revert REGGovernorErrors.ProposerWithoutRole();
        } else if (_proposerMode == ProposerMode.ProposerWithVotingPower) {
            if (!proposerHasVotes)
                revert REGGovernorErrors.ProposerWithoutVotes();
        } else {
            revert REGGovernorErrors.InvalidProposerMode();
        }

        return super.propose(targets, values, calldatas, description);
    }

    function setRegIncentiveVault(
        IREGIncentiveVault regIncentiveVault
    ) external override onlyGovernance {
        _regIncentiveVault = IREGIncentiveVault(regIncentiveVault);
    }

    function getRegIncentiveVault()
        external
        view
        override
        returns (IREGIncentiveVault)
    {
        return _regIncentiveVault;
    }

    function _castVote(
        uint256 proposalId,
        address account,
        uint8 support,
        string memory reason,
        bytes memory params
    ) internal override returns (uint256) {
        if (_incentiveEnabled) {
            IREGIncentiveVault(_regIncentiveVault).recordVote(
                account,
                proposalId
            );
        }
        return super._castVote(proposalId, account, support, reason, params);
    }
}
