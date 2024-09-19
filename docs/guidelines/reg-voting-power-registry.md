# REGVotingPowerRegistry Contract Documentation

## Overview

The `REGVotingPowerRegistry` is an upgradable contract that manages the voting power of users in the REG ecosystem. This contract allows authorized entities to register and update users' voting power and ensures that the voting power is tracked and managed correctly. The contract leverages OpenZeppelin libraries for upgradability, access control, and voting functionality, making it secure and flexible.

The `REGVotingPowerRegistry` token is non-transferable, meaning it can only be minted, burned, or delegated to the user's own address.

## Key Features

- **Voting Power Registration**: Authorized addresses can register or update the voting power of users.
- **Non-Transferable Token**: The tokens representing voting power are non-transferable to ensure that users cannot trade or sell their voting rights.
- **Self-Delegation Only**: Users cannot delegate their voting power to others; they can only delegate to themselves.
- **Upgradability**: The contract uses the UUPS proxy pattern to allow future upgrades.
- **Access Control**: Role-based access control ensures that only authorized entities can modify voting power.

## Inheritance

- **ERC20Upgradeable**: Implements the ERC-20 token standard in an upgradable format.
- **AccessControlUpgradeable**: Manages role-based access control for certain functions.
- **ERC20PermitUpgradeable**: Adds support for off-chain approvals using signatures (EIP-2612).
- **ERC20VotesUpgradeable**: Adds functionality for tracking voting power and delegation.
- **UUPSUpgradeable**: Enables upgradability using the UUPS proxy pattern.
- **IREGVotingPowerRegistry**: Defines the interface for the voting power registry.

## Roles

- **REGISTER_ROLE**: This role allows an entity to register and update voting power for users.
- **UPGRADER_ROLE**: This role allows an entity to upgrade the contract to a new implementation.

## Contract Functions

### 1. `initialize`

```solidity
function initialize(
    address defaultAdmin,
    address register,
    address upgrader
) public initializer;
```

**Purpose**: Initializes the contract with the following roles:

- **defaultAdmin**: The address with the `DEFAULT_ADMIN_ROLE`.
- **register**: The address with the `REGISTER_ROLE`, which can register voting power.
- **upgrader**: The address with the `UPGRADER_ROLE`, which can upgrade the contract.

### 2. `_authorizeUpgrade`

```solidity
function _authorizeUpgrade(
    address newImplementation
) internal override onlyRole(UPGRADER_ROLE);
```

**Purpose**: Authorizes the upgrade of the contract to a new implementation. Only addresses with the `UPGRADER_ROLE` can execute this function.

**Parameters**:

- `newImplementation`: The address of the new implementation contract.

### 3. `registerVotingPower`

```solidity
function registerVotingPower(
    VotingPower[] calldata votingPower
) external override onlyRole(REGISTER_ROLE);
```

**Purpose**: Registers or updates the voting power for multiple users. It checks the current balance of each voter and adjusts the balance by minting or burning tokens.

**Parameters**:

- `votingPower`: An array of `VotingPower` structs containing the voter's address and their corresponding voting power.

### 4. `clock`

```solidity
function clock() public view override returns (uint48);
```

**Purpose**: Returns the current timestamp as the clock mode for the voting system.

### 5. `CLOCK_MODE`

```solidity
function CLOCK_MODE() public pure override returns (string memory);
```

**Purpose**: Returns the clock mode as a string ("mode=timestamp").

### 6. `transfer`

```solidity
function transfer(
    address recipient,
    uint256 amount
) public override returns (bool);
```

**Purpose**: Disabled in this contract. Always returns `false` because the token is non-transferable.

### 7. `transferFrom`

```solidity
function transferFrom(
    address sender,
    address recipient,
    uint256 amount
) public override returns (bool);
```

**Purpose**: Disabled in this contract. Always returns `false` because the token is non-transferable.

### 8. `approve`

```solidity
function approve(
    address spender,
    uint256 amount
) public override returns (bool);
```

**Purpose**: Disabled in this contract. Always returns `false` because the token is non-transferable.

### 9. `_delegate`

```solidity
function _delegate(
    address account,
    address delegatee
) internal virtual override;
```

**Purpose**: Ensures that users can only delegate voting power to themselves. If a user tries to delegate to another address, the function reverts with the error `DelegateToOtherNotAllowed`.

**Parameters**:

- `account`: The address of the user delegating their voting power.
- `delegatee`: The address to which the user is delegating their voting power.

### 10. `nonces`

```solidity
function nonces(address owner) public view override(ERC20PermitUpgradeable, NoncesUpgradeable) returns (uint256);
```

**Purpose**: Returns the nonce for an account, which is used for permit (off-chain approval) functionality.

## Events

- **RegisterVotingPower**: Emitted when the voting power for a user is registered or updated.

```solidity
event RegisterVotingPower(address indexed voter, uint256 votes);
```

## Data Structures

### 1. `VotingPower` Struct

This struct represents the voting power of a user.

```solidity
struct VotingPower {
    address voter;
    uint256 votes;
}
```

- **voter**: The address of the voter.
- **votes**: The amount of voting power assigned to the voter.

## Security Considerations

- **Non-Transferable Tokens**: The tokens representing voting power are non-transferable to prevent the trading or selling of voting rights.
- **Restricted Delegation**: Users can only delegate voting power to themselves to prevent the concentration of voting power in the hands of a few addresses.
- **Upgradability**: The contract can be upgraded via UUPS, so it’s crucial that the `UPGRADER_ROLE` is assigned to trusted entities.
- **Role-Based Control**: Only addresses with the `REGISTER_ROLE` can register or update voting power, preventing unauthorized users from manipulating voting weights.

## Conclusion

The `REGVotingPowerRegistry` contract is a specialized, upgradable contract that manages users' voting power in the REG ecosystem. By restricting token transfers, delegations, and using role-based access control, the contract ensures that voting power is handled securely and efficiently.
