# RealToken Governance concepts

1. Governor

Modifications from OZ Governor contracts:

- Upgradeable, AccessControl
- clock - timestamp mode
- Proposal submission (GovernorSettings/minimum voting power + whitelist proposers)
- Function to select minimum voting power/whitelist or both
- Vote function work/call with Incentive vault ? (How???) Not sure how this works, since castVote take msg.sender
- Function to activate/desactivate castVote from Incentive vault (How???)
- Integrate TimelockController for treasury (multiple TimelockController?)

2. Mock ERC20 Votes

- Specification?
- Same ERC20Votes
- Token non transferrable => Users keep for themself or delegate
- Pas de delegation
- Add registerByAdmin function to register weight to users (\_mint(accounts, amounts))
- Add resetByAdmin function to reset weight of user after each vote (\_burn(accounts, amounts))
- Need to reset all token balances + voting power
- Not possible to have multiple votes at the same time???

3. Incentive vault (lock and vote)

- Specification?
- No need to use ERC4626 Vault since no change in share/token (1 share = 1 token)
- Use ERC20Wrapper to wrap REG
- Add lock mechanism
- Add reward mechanism in withdraw
-

4. TimelockController

- Integrate TimelockController with Governor and the treasury
