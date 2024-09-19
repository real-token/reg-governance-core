# REG Governance Concepts

## 1. Governor

### Modifications from OpenZeppelin (OZ) Governor Contracts (REGGovernor):

- **Upgradeable & Access Control**: The Governor contract is upgradeable and uses role-based access control to manage governance actions.
- **Clock - Timestamp Mode**: The Governor uses timestamp-based clocking for proposal and voting periods.
- **Proposal Submission**:
  - The Governor contract integrates GovernorSettings for setting the minimum voting power for proposal submission.
  - Proposal submission can be limited to whitelisted proposers or a minimum voting power requirement.
  - The contract allows flexibility to toggle between using a whitelist, minimum voting power, or both for proposal submission.
- **Vote Function Integration with Incentive Vault**:
  - It is unclear how the vote function interacts with the Incentive Vault since the `castVote` function traditionally takes `msg.sender`. A mechanism to allow voting through the Incentive Vault needs to be considered.
  - There should be an activation/deactivation function to toggle whether `castVote` is linked to the Incentive Vault.
- **TimelockController for Treasury**:
  - The Governor integrates with a TimelockController to manage treasury functions.
  - It might be possible to use multiple TimelockControllers for different treasury-related actions.

## 2. Mock ERC20 Votes (REGVotingPowerRegistry)

### Key Features:

- **Specification**: The mock contract is based on the `ERC20Votes` standard.
- **Non-Transferable Token**: The token used for voting is non-transferable, meaning that users must either retain their tokens or delegate voting power to themselves.
- **No Delegation**: The token cannot be delegated to others. It enforces a self-delegation rule.
- **Admin Functions**:
  - `registerByAdmin`: Allows an admin to assign voting power to users by minting tokens to their addresses.
  - `resetByAdmin`: Allows an admin to reset the voting power of users by burning their tokens after each vote.
- **Resetting Token Balances and Voting Power**: After each vote, the entire balance of voting tokens is reset.
- **Multiple Concurrent Votes**: The contract may not allow multiple votes to be held concurrently, as balances are reset after each vote.

## 3. Incentive Vault (REGIncentiveVault- Lock and Vote)

### Key Features:

- **Specification**: This vault incentivizes voting by locking tokens.
- **ERC20Wrapper for REG**: The vault uses an `ERC20Wrapper` to wrap the native REG token and lock it in the vault.
- **Lock Mechanism**: Users can lock their REG tokens in the vault to participate in governance and potentially increase their voting power.
- **Reward Mechanism**: Upon withdrawal, users receive a reward based on their participation in voting.
- **ERC4626 Vault Not Required**: Since the vault does not change the share/token ratio (1 share = 1 token), there is no need to use the ERC4626 standard for the vault.

## 4. TimelockController (REGTreasuryDAO)

### Integration with Governor and Treasury:

- The TimelockController ensures that proposals approved by governance are subject to a time delay before execution. This allows token holders to react to proposals before they are executed.
- The treasury can also be managed through the TimelockController, ensuring that sensitive actions involving funds have a delay before execution.
- Multiple TimelockControllers might be integrated to manage different types of actions or funds within the treasury.

---

## Core Governance Concepts

1. **Vote Delegation**: The governance system allows users to delegate their voting power to others or themselves (depending on the contract rules).

2. **Minimum Quorum**: A minimum number of votes required to approve a proposal, ensuring that decisions are made with sufficient participation.

3. **Whitelist Proposers**: Only specific, whitelisted addresses or addresses with a minimum amount of voting power can submit proposals to the governance system.

4. **Specialized Committees**: Certain committees may be given specialized governance roles or veto powers over particular types of proposals.

5. **Continuous Voting**: A system where voting on proposals happens continuously, allowing for flexibility and rapid decision-making.

6. **Augmented Voting Power via Token Lock**: Users can lock tokens to boost their voting power, incentivizing long-term commitment to the protocol.

7. **Off-Chain Voting for Signaling/Polling**: Off-chain votes can be used to gather community sentiment before making on-chain decisions.

8. **On-Chain Actions from Off-Chain Voting via Oracles**: Oracle services may be used to translate the results of off-chain votes into on-chain actions.

9. **Upgradeable Smart Contracts**: The governance system is built with upgradability in mind, allowing the smart contracts to be updated and improved over time without requiring migration.

10. **Time Delays on Sensitive Actions**: Sensitive governance actions, such as fund transfers or changes to the protocol, are subject to time delays to ensure that there is ample time to react to potentially harmful decisions.

11. **Emergency Actions via Multisign (Pause/Shutdown)**: The governance system has mechanisms for emergency actions, such as pausing or shutting down parts of the protocol. These actions require multisignature approval.

12. **Legal Entities (Foundation) Providing Support for the DAO**: Legal entities may be established to provide formal support for the DAO, ensuring that the DAO operates within legal frameworks and has access to traditional business resources.

13. **Tools for DAO Treasury Management**: The governance system integrates tools to manage the DAO treasury, including fund allocation, investment strategies, and financial reporting.

14. **Token Issuance to Cover Protocol Expenses**: The DAO may issue tokens to cover protocol expenses, ensuring that governance actions are adequately funded.

15. **Incentive Voting**: Users are incentivized to participate in voting through rewards, which may include token distributions or enhanced voting power.

16. **Incentive Off-Chain Engagement (Forum Participation)**: To encourage engagement with governance decisions, users may be rewarded for participating in off-chain forums or discussions that influence on-chain proposals.
