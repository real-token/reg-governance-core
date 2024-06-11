# Contracts

## Governor:

| Function                                                                                               | Access control            |
| ------------------------------------------------------------------------------------------------------ | ------------------------- |
| propose                                                                                                | ProposerMode (role+power) |
| cancel                                                                                                 | The Proposer              |
| queue                                                                                                  | All users                 |
| execute                                                                                                | All users                 |
| castVote/castVoteBySig/castVoteWithReason/castVoteWithReasonAndParams/castVoteWithReasonAndParamsBySig | All users                 |
| relay (recover ETH par example)                                                                        | onlyGovernance            |
| setProposalThreshold                                                                                   | onlyGovernance            |
| setVotingDelay                                                                                         | onlyGovernance            |
| setVotingPeriod                                                                                        | onlyGovernance            |
| updateQuorumNumerator                                                                                  | onlyGovernance            |
| updateTimelock                                                                                         | onlyGovernance            |
| setProposerMode                                                                                        | DEFAULT_ADMIN_ROLE        |
| setIncentiveEnabled/setRegIncentiveVault                                                               | DEFAULT_ADMIN_ROLE        |
| grantRole/revokeRole/renounceRole                                                                      | DEFAULT_ADMIN_ROLE        |

## REGVotesRegistry:

| Function                          | Access control                             |
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

## TimelockController:

| Function                          | Access control                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------ |
| schedule/scheduleBatch            | PROPOSER_ROLE                                                                  |
| execute/executeBatch              | EXECUTOR_ROLE                                                                  |
| cancel                            | CANCELLER_ROLE                                                                 |
| updateDelay                       | through governance vote (schedule + execute)                                   |
| grantRole/revokeRole/renounceRole | if DEFAULT_ADMIN_ROLE = TimelockController, to grantRole => schedule + execute |

# Proposal flows:

- REGVotesRegistry.registerVotingPower()
- REGGovernor.propose()
- REGGovernor.castVote()
- REGGovernor.queue() (=> Timelock.scheduleBatch())
- REGGovernor.execute() (=> Timelock.executeBatch())
  or REGGovernor.cancel() (=> Timelock.cancel())
