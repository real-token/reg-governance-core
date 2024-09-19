# REG Governance Flows and Specifications

## Overview

This document combines the flow of various functions in the RealToken governance system, including the Governor, VotingPowerRegistry, and TimelockController contracts, along with the detailed specifications of each contract and its components.

---

## 1. Governance Flows

### Governor

| Function                                                                                               | Access Control            |
| ------------------------------------------------------------------------------------------------------ | ------------------------- |
| propose                                                                                                | ProposerMode (role+power) |
| cancel                                                                                                 | The Proposer              |
| queue                                                                                                  | All users                 |
| execute                                                                                                | All users                 |
| castVote/castVoteBySig/castVoteWithReason/castVoteWithReasonAndParams/castVoteWithReasonAndParamsBySig | All users                 |
| relay (recover ETH, for example)                                                                       | onlyGovernance            |
| setProposalThreshold                                                                                   | onlyGovernance            |
| setVotingDelay                                                                                         | onlyGovernance            |
| setVotingPeriod                                                                                        | onlyGovernance            |
| updateQuorumNumerator                                                                                  | onlyGovernance            |
| updateTimelock                                                                                         | onlyGovernance            |
| setProposerMode                                                                                        | DEFAULT_ADMIN_ROLE        |
| setIncentiveEnabled/setRegIncentiveVault                                                               | DEFAULT_ADMIN_ROLE        |
| grantRole/revokeRole/renounceRole                                                                      | DEFAULT_ADMIN_ROLE        |

---

### REGVotingPowerRegistry

| Function                          | Access Control                             |
| --------------------------------- | ------------------------------------------ |
| registerVotingPower               | REGISTER_ROLE                              |
| permit                            | All users (do nothing)                     |
| approve                           | All users (do nothing, return false)       |
| transfer                          | All users (do nothing, return false)       |
| transferFrom                      | All users (do nothing, return false)       |
| delegate                          | All users (revert if account != delegatee) |
| delegateBySig                     | All users (revert if account != delegatee) |
| grantRole/revokeRole/renounceRole | DEFAULT_ADMIN_ROLE                         |
| upgradeToAndCall                  | UPGRADER_ROLE                              |

---

### TimelockController

| Function                          | Access Control                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------ |
| schedule/scheduleBatch            | PROPOSER_ROLE                                                                  |
| execute/executeBatch              | EXECUTOR_ROLE                                                                  |
| cancel                            | CANCELLER_ROLE                                                                 |
| updateDelay                       | through governance vote (schedule + execute)                                   |
| grantRole/revokeRole/renounceRole | if DEFAULT_ADMIN_ROLE = TimelockController, to grantRole => schedule + execute |

---

## 2. Proposal Flows

1. **Register Voting Power**:
   - `REGVotingPowerRegistry.registerVotingPower()`
2. **Submit Proposal**:
   - `REGGovernor.propose()`
3. **Cast Vote**:
   - `REGGovernor.castVote()`
4. **Queue Proposal**:
   - `REGGovernor.queue()` → `Timelock.scheduleBatch()`
5. **Execute Proposal**:
   - `REGGovernor.execute()` → `Timelock.executeBatch()`
6. **Cancel Proposal**:
   - `REGGovernor.cancel()` → `Timelock.cancel()`

---

### REGIncentiveVault

| Variables                        | Change              |
| -------------------------------- | ------------------- |
| \_regGovernor                    | setRegGovernor      |
| \_regToken                       | setRegToken         |
| \_currentEpoch                   | setNewEpoch         |
| \_currentTotalDeposit            | deposit/withdraw    |
| EpochState.subscriptionStart     | setNewEpoch         |
| EpochState.subscriptionEnd       | setNewEpoch         |
| EpochState.lockPeriodEnd         | setNewEpoch         |
| EpochState.bonusToken            | setNewEpoch         |
| EpochState.totalBonus            | setNewEpoch         |
| EpochState.totalVotes            | recordVote          |
| EpochState.totalWeights          | recordVote          |
| UserGlobalState.currentDeposit   | deposit/withdraw    |
| UserGlobalState.lastClaimedEpoch | withdraw/claimBonus |
| UserEpochState.depositAmount     | recordVote          |
| UserEpochState.voteAmount        | recordVote          |
| UserEpochState.claimed           | withdraw/claimBonus |

---

### Integration: REGGovernor with REGIncentiveVault

1. `REGGovernor.propose()`:
   - Propose and optionally enable incentives.
2. `REGGovernor.castVote()`:
   - Voting, with incentive vault potentially recording votes.
3. `REGGovernor.queue()`:
   - Queue proposals.
4. `REGGovernor.execute()`:
   - Execute proposals.
5. Incentive handling:
   - `setIncentiveEnabled` and `setRegIncentiveVault` functions in `REGGovernor`.
6. **Epochs in REGIncentiveVault**:
   - Epoch management via `setNewEpoch(subscriptionStart, subscriptionEnd, lockPeriodEnd, bonusToken, totalBonus)`.

---

## 3. Specifications

### REGGovernor Specifications

| Requirements                                                                                    | Status                                                     |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| UUPSUpgradeable                                                                                 | OK (upgradeable)                                           |
| AccessControlUpgradeable                                                                        | OK (roles)                                                 |
| GovernorSettingsUpgradeable                                                                     | OK (setVotingDelay, setVotingPeriod, setProposalThreshold) |
| GovernorCountingSimpleUpgradeable                                                               | OK (For, Against, Abstain)                                 |
| GovernorVotesUpgradeable                                                                        | OK (IVotes-getVotes, getPastVotes)                         |
| GovernorVotesQuorumFractionUpgradeable                                                          | OK (updateQuorumNumerator)                                 |
| GovernorTimelockControlUpgradeable                                                              | OK (bind to a TimelockController)                          |
| Proposal restriction (addToWhitelist/removeFromWhitelist/setWhitelistEnabled/setValidationMode) | OK (setProposerMode/grantRole/revokeRole/PROPOSER_ROLE)    |
| Setting incentive (setIncentiveEnabled/setRegIncentiveVault)                                    | OK (setIncentiveEnabled/setRegIncentiveVault)              |
| Record vote to REGIncentiveVault                                                                | OK (recordVote)                                            |
| Able to change REG token address???                                                             | OK (Need to go through un upgrade of Governor contract)    |

---

### REGVotingPowerRegistry (ERC20Votes) Specifications

| Requirements                                     | Status                                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| UUPSUpgradeable                                  | OK (upgradeable)                                       |
| AccessControlUpgradeable                         | OK (roles)                                             |
| ERC20VotesUpgradeable                            | OK (IVotes interface)                                  |
| Register voting power                            | OK (\_mint if newBalance > oldBalance, else \_burn)    |
| Fetch voting power                               | OK (getVotingPower => balanceOf/getVotes/getPastVotes) |
| ERC20VotesUpgradeable                            | OK (IVotes interface)                                  |
| Transfer/transferFrom/approve not allowed        | OK (return false)                                      |
| Only delegate to self                            | OK (revert if delegate to other address)               |
| Auto delegate to self during registerVotingPower | OK                                                     |

---

### TimelockController Specifications

| Requirements                                                          | Status                               |
| --------------------------------------------------------------------- | ------------------------------------ |
| UUPSUpgradeable                                                       | OK (upgradeable)                     |
| AccessControlUpgradeable                                              | OK (roles)                           |
| Governance integration for treasury                                   | OK (for all actions)                 |
| Possible to have multiple TimelockController for the same Governor    | No                                   |
| Configure Roles of TimelockController                                 | OK (grantRole/revokeRole)            |
| updateDelay                                                           | OK (propose/castVote/queue/execute)  |
| PROPOSER_ROLE (queue operations)                                      | OK (Governor)                        |
| EXECUTOR_ROLE (execute operations)                                    | OK (Governor)                        |
| CANCELLER_ROLE (cancel operations by proposer before the vote starts) | OK (Governor)                        |
| DEFAULT_ADMIN_ROLE (grant/revoke roles)                               | TBD (TimelockController + a Safe???) |

---

## 4. Configuration Considerations

- **Voting Power Determination**: Using `GovernorVotes` with the `IVotes` module (ERC20Votes).
- **Quorum Calculation**: Using `GovernorVotesQuorumFraction` to calculate quorum as a percentage of the total supply (typically 4%).
- **Vote Casting Options**: Utilizing `GovernorCountingSimple` for "For", "Against", and "Abstain" voting options.
- **Token for Voting**: The voting token must be set through the `IVotes` interface (ERC20Votes).

---

## 5. Parameter Updates

- **Voting Delay**: 15 minutes.
- **Voting Period**: 1 hour.
- **Proposal Threshold**: 200 voting power.
- **Quorum Numerator**: Typically 4.
- **Quorum Denominator**: Default is 100; can be overridden to change the percentage.
- **IVotes Token Address**: TBD based on contract.

---

## 6. Role Setup

- **Proposer**: Queues operations and is granted to the Governor.
- **Executor**: Can be zero address (for all users) or set to Governor for time-sensitive actions.
- **Admin**: Grants and revokes proposer/executor roles. Controlled by TimelockController and backed up by a Safe.
