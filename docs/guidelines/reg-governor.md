## REGGovernor Contract Documentation

### Overview

The `REGGovernor` contract is an upgradable governance contract that allows for decentralized decision-making through proposals and voting. It integrates with a timelock controller to ensure proposals go through a time delay before execution, as well as an incentive vault that can be used to reward users for their participation in the governance process.

This contract leverages multiple OpenZeppelin governor extensions, allowing for voting, proposal thresholds, and quorum calculations. It supports a flexible proposer mode system that restricts who can submit proposals based on roles and/or voting power.

### Inheritance

- **`GovernorUpgradeable`**: Core governance logic from OpenZeppelin.
- **`GovernorSettingsUpgradeable`**: Manages voting delay, voting period, and proposal thresholds.
- **`GovernorCountingSimpleUpgradeable`**: Implements simple counting for "For," "Against," and "Abstain" votes.
- **`GovernorVotesUpgradeable`**: Integrates voting power based on a token (IVotes).
- **`GovernorVotesQuorumFractionUpgradeable`**: Handles quorum based on a fraction of the total supply of tokens.
- **`GovernorTimelockControlUpgradeable`**: Adds support for timelock functionality to delay the execution of proposals.
- **`AccessControlUpgradeable`**: Manages roles and access control for different functions.
- **`UUPSUpgradeable`**: Provides the ability to upgrade the contract using the UUPS proxy pattern.

### Roles

- **`UPGRADER_ROLE`**: Allows contract upgrades.
- **`PROPOSER_ROLE`**: Grants permission to propose governance actions.
- **`CANCELLER_ROLE`**: Grants permission to cancel proposals.

### Storage Variables

- **`_proposerMode`**: Defines the mode that restricts how proposals can be made (based on role, voting power, or both).
- **`_incentiveEnabled`**: A boolean indicating if the incentive mechanism is enabled.
- **`_regIncentiveVault`**: A reference to the `IREGIncentiveVault` contract, which is used for recording votes and distributing incentives.

### Key Functions

#### 1. `initialize`

```solidity
function initialize(
    IVotes _token,
    TimelockControllerUpgradeable _timelock,
    address defaultAdmin
) public initializer;
```

**Purpose**: Initializes the contract with the governance token (`_token`), the timelock controller (`_timelock`), and sets up the default admin.

#### 2. `_authorizeUpgrade`

```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE);
```

**Purpose**: Restricts contract upgrades to only addresses with the `UPGRADER_ROLE`.

#### 3. `setProposerMode`

```solidity
function setProposerMode(ProposerMode proposerMode) external override onlyGovernance;
```

**Purpose**: Allows governance to set the mode that controls who can propose governance actions (e.g., based on roles, voting power, or both).

#### 4. `setIncentiveEnabled`

```solidity
function setIncentiveEnabled(bool status) external override onlyGovernance;
```

**Purpose**: Enables or disables the incentive system, which rewards voters for participating.

#### 5. `setRegIncentiveVault`

```solidity
function setRegIncentiveVault(IREGIncentiveVault regIncentiveVault) external override onlyGovernance;
```

**Purpose**: Sets the `IREGIncentiveVault` contract, which is responsible for recording votes and managing incentives.

#### 6. `cancelByAdmin`

```solidity
function cancelByAdmin(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) external override onlyRole(CANCELLER_ROLE) returns (uint256);
```

**Purpose**: Allows an address with the `CANCELLER_ROLE` to cancel a proposal before execution.

#### 7. `propose`

```solidity
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
) public override returns (uint256);
```

**Purpose**: Allows the proposer to create a new proposal, provided they meet the requirements set by the current proposer mode. It checks if the proposer has the required votes or roles (or both) to submit the proposal.

#### 8. `_castVote`

```solidity
function _castVote(
    uint256 proposalId,
    address account,
    uint8 support,
    string memory reason,
    bytes memory params
) internal override returns (uint256);
```

**Purpose**: Casts a vote on a proposal. If incentives are enabled, it records the vote in the incentive vault before casting the vote.

#### 9. `votingDelay` / `votingPeriod`

```solidity
function votingDelay() public view override(GovernorUpgradeable, GovernorSettingsUpgradeable) returns (uint256);
function votingPeriod() public view override(GovernorUpgradeable, GovernorSettingsUpgradeable) returns (uint256);
```

**Purpose**: Retrieves the current voting delay and voting period settings.

#### 10. `quorum`

```solidity
function quorum(uint256 blockNumber) public view override(GovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable) returns (uint256);
```

**Purpose**: Returns the quorum required for a proposal to pass, which is calculated as a fraction of the total token supply.

#### 11. `state`

```solidity
function state(uint256 proposalId) public view override(GovernorUpgradeable, GovernorTimelockControlUpgradeable) returns (ProposalState);
```

**Purpose**: Returns the current state of a proposal (e.g., Pending, Active, Canceled, Succeeded, etc.).

#### 12. `_queueOperations` / `_executeOperations`

```solidity
function _queueOperations(
    uint256 proposalId,
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) internal override(GovernorUpgradeable, GovernorTimelockControlUpgradeable) returns (uint48);

function _executeOperations(
    uint256 proposalId,
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    bytes32 descriptionHash
) internal override(GovernorUpgradeable, GovernorTimelockControlUpgradeable);
```

**Purpose**: Queues and executes the operations for a proposal after it passes, ensuring that they are executed after the required timelock delay.

### Proposal Modes

The `REGGovernor` contract supports multiple proposer modes:

- **`ProposerWithRole`**: Only users with the `PROPOSER_ROLE` can create proposals.
- **`ProposerWithVotingPower`**: Only users with a minimum voting power can create proposals.
- **`ProposerWithRoleAndVotingPower`**: Users need both the `PROPOSER_ROLE` and the required voting power to propose.
- **`ProposerWithRoleOrVotingPower`**: Users need either the `PROPOSER_ROLE` or the required voting power to propose.

### Events

- **`SetProposerMode(ProposerMode mode)`**: Emitted when the proposer mode is updated.
- **`SetIncentiveEnabled(bool status)`**: Emitted when the incentive system is enabled or disabled.
- **`SetRegIncentiveVault(IREGIncentiveVault vault)`**: Emitted when the incentive vault address is set.
- **`ProposalCreatedDescriptionHash(bytes32 descriptionHash)`**: Emitted to store the hash of the proposal description, making it easier to track proposals by their description.

### Error Handling

- **`InvalidProposerWithRole`**: Thrown when a user without the `PROPOSER_ROLE` tries to propose in a mode that requires it.
- **`InvalidProposerWithVotingPower`**: Thrown when a user without the required voting power tries to propose in a mode that requires it.
- **`InvalidProposerWithRoleAndVotingPower`**: Thrown when a user doesn't meet both the role and voting power requirements in a mode that requires both.
- **`InvalidProposerWithRoleOrVotingPower`**: Thrown when a user has neither the role nor the voting power to propose in a mode that requires either.
- **`InvalidProposerMode`**: Thrown when an invalid proposer mode is encountered.

### Conclusion

The `REGGovernor` contract is a highly flexible and upgradable governance contract. It integrates with voting tokens, timelock mechanisms, and incentive systems, making it a powerful tool for decentralized governance in the RealToken ecosystem. The ability to customize who can propose, based on roles and voting power, provides an additional layer of control for governance participants.
