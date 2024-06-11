# Specification

Below are specifications of 3 contracts (Governor, VotesRegistry, TimelockController):

## REGGovernor:

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

## REGVotingPowerRegistry (ERC20Votes):

| Requirements                                     | Status                                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| UUPSUpgradeable                                  | OK (upgradeable)                                       |
| AccessControlUpgradeable                         | OK (roles)                                             |
| ERC20VotesUpgradeable                            | OK (IVotes interface)                                  |
| register voting power                            | OK (\_mint if newBalance > oldBalance, else \_burn)    |
| fetch voting power                               | OK (getVotingPower => balanceOf/getVotes/getPastVotes) |
| ERC20VotesUpgradeable                            | OK (IVotes interface)                                  |
| transfer/transferFrom/approve not allowed        | OK (return false)                                      |
| only delegate to self                            | OK (revert if delegate to other address)               |
| auto delegate to self during registerVotingPower | OK                                                     |

## TimelockController:

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

## Configuration considerations:

- How voting power is determined? GovernorVotes + IVotes module (ERC20Votes)
- How many votes are needed for quorum? GovernorVotesQuorumFraction + ERC20Votes => percentage of total supply (usually 4%)
- what options people have when casting a vote and how those votes are counted? GovernorCountingSimple (For, Against, and Abstain)
- what type of token should be used to vote

How to update parameters:

- votingDelay: 15 minutes
- votingPeriod: 1 heure
- proposalThreshold: 200 voting power
- quorumNumerator (usually 4)
- quorumDenominator (default 100, only round percentage like 1%, 2%, 3%, 4%,..., can override)
- IVotes token address???

How to set up roles:

- Proposer (queueing operations => grant to Governor)
- Executor: zero address for everyone or Governor if time sensitive
- Admin: grant/revoke proposer/executor => TimelockController itself + 1 backup (Safe)
