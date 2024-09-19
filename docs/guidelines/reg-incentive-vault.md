## REGIncentiveVault Contract Documentation

### Overview

The `REGIncentiveVault` is an upgradable, pausable smart contract designed to handle incentive deposits, voting, and reward distribution in a decentralized governance system. It allows users to deposit tokens, participate in governance voting, and claim rewards based on their participation and deposited amounts. The contract also supports upgrades and includes access control for specific roles.

### Inheritance

- **`Initializable`**: Enables the contract to be initialized once during deployment.
- **`PausableUpgradeable`**: Provides functionality to pause the contract in emergencies.
- **`AccessControlUpgradeable`**: Implements role-based access control.
- **`UUPSUpgradeable`**: Enables upgradability of the contract through the UUPS pattern.
- **`IREGIncentiveVault`**: Interface that defines the functions of the vault.

### Libraries

- **SafeERC20**: Used for safe interactions with the ERC20 token, preventing unexpected failures in token transfers.

### Roles

- **PAUSER_ROLE**: The address that has permission to pause and unpause the contract.
- **UPGRADER_ROLE**: The address that has permission to upgrade the contract.

### Storage Variables

- **\_regGovernor**: The address of the governance authority.
- **\_regToken**: The ERC20 token used in the vault.
- **\_currentEpoch**: Tracks the current epoch for reward distribution.
- **\_currentTotalDeposit**: The total amount of tokens deposited in the vault.
- **\_userGlobalStates**: A mapping that tracks the total deposit of each user.
- **\_userEpochStates**: A mapping that tracks user deposit and voting data for each epoch.
- **\_epochStates**: A mapping that tracks the state of each epoch, such as bonus tokens and total votes.

### Key Functions

#### 1. `initialize`

```solidity
function initialize(
    address regGovernor,
    address regToken,
    address defaultAdmin,
    address pauser,
    address upgrader
) external initializer;
```

**Purpose**: Initializes the contract with the governance, token, and roles needed to operate. Sets the initial roles for the admin, pauser, and upgrader.

#### 2. `_authorizeUpgrade`

```solidity
function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE);
```

**Purpose**: Authorizes contract upgrades, restricted to addresses with the `UPGRADER_ROLE`.

#### 3. `pause` / `unpause`

```solidity
function pause() external onlyRole(PAUSER_ROLE);
function unpause() external onlyRole(PAUSER_ROLE);
```

**Purpose**: Allows the pauser to pause and unpause the contract. When paused, most operations like deposits and withdrawals are disabled.

#### 4. `setRegGovernor` / `setRegToken`

```solidity
function setRegGovernor(address regGovernor) external onlyRole(DEFAULT_ADMIN_ROLE);
function setRegToken(IERC20 regToken) external onlyRole(DEFAULT_ADMIN_ROLE);
```

**Purpose**: Allows the admin to update the governance address and the token used in the vault.

#### 5. `setNewEpoch`

```solidity
function setNewEpoch(
    uint256 subscriptionStart,
    uint256 subscriptionEnd,
    uint256 lockPeriodEnd,
    address bonusToken,
    uint256 totalBonus
) external onlyRole(DEFAULT_ADMIN_ROLE);
```

**Purpose**: Starts a new epoch, defining the subscription and lock periods as well as the bonus token and its total amount for distribution. The epoch data is stored in `_epochStates`.

#### 6. `deposit` / `depositWithPermit`

```solidity
function deposit(uint256 amount) public whenNotPaused;
function depositWithPermit(
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external whenNotPaused;
```

**Purpose**:

- **`deposit`**: Allows users to deposit tokens into the vault.
- **`depositWithPermit`**: Similar to `deposit`, but also supports ERC20 permits, allowing the user to authorize the deposit without needing a separate approval transaction.

#### 7. `withdraw`

```solidity
function withdraw(uint256 amount) external whenNotPaused;
```

**Purpose**: Allows users to withdraw a specified amount of their deposited tokens, but only after the lock period has ended.

#### 8. `recordVote`

```solidity
function recordVote(
    address user,
    uint256 proposalId
) external onlyGovernance;
```

**Purpose**: Records a user's vote in the current epoch and updates their vote amount and the total vote weights for the epoch. Only callable by the governance.

#### 9. `calculateBonus`

```solidity
function calculateBonus(
    address user
) external view returns (address[] memory, uint256[] memory);
```

**Purpose**: Calculates the user's bonus for the current epoch based on their deposits and votes. Returns the addresses of bonus tokens and the respective bonus amounts.

#### 10. `claimBonus`

```solidity
function claimBonus() public whenNotPaused;
```

**Purpose**: Allows users to claim their bonuses from previous epochs that have ended. This function iterates over all the unclaimed epochs for the user and distributes their bonuses.

#### 11. Internal Helper Functions

- `_validateSubscriptionPeriod`: Ensures that the current timestamp is within the subscription period of the current epoch.
- `_validateTimestampOfEpoch`: Validates the timestamp for a new epoch, ensuring correct order between subscription start, end, and lock period.
- `_validateLockPeriod`: Ensures that the lock period has ended before allowing withdrawals.
- `_claimBonus`: Handles the actual claiming of bonuses for a given user and epoch.

### Events

- **`SetRegGovernor(address regGovernor)`**: Emitted when the governance address is updated.
- **`SetRegToken(address regToken)`**: Emitted when the token address is updated.
- **`SetNewEpoch(...)`**: Emitted when a new epoch is started.
- **`Deposit(address user, uint256 amount, uint256 epoch)`**: Emitted when a user deposits tokens.
- **`Withdraw(address user, uint256 amount, uint256 epoch)`**: Emitted when a user withdraws tokens.
- **`ClaimBonus(address user, uint256 amount, uint256 epoch)`**: Emitted when a user claims their bonus.
- **`RecordVote(address user, uint256 proposalId, uint256 epoch)`**: Emitted when a user's vote is recorded.

### Error Handling

- **`REGIncentiveVaultErrors.OnlyRegGovernorAllowed()`**: Thrown when a function restricted to the governor is called by another address.
- **`REGIncentiveVaultErrors.SubscriptionPeriodNotStarted()`**: Thrown when a user attempts to deposit outside of the subscription period.
- **`REGIncentiveVaultErrors.SubscriptionPeriodEnded()`**: Thrown when a user attempts to deposit after the subscription period has ended.
- **`REGIncentiveVaultErrors.LockPeriodNotEnded()`**: Thrown when a user attempts to withdraw before the lock period has ended.
- **`REGIncentiveVaultErrors.InvalidTimestampForEpoch()`**: Thrown when invalid epoch timestamps are provided.

### Conclusion

The `REGIncentiveVault` contract is a flexible, upgradable vault designed for token deposits, governance voting, and reward distribution. It includes robust access control, supports safe token transfers, and allows for pausing and upgrading, making it well-suited for decentralized incentive systems.
