## REGGovernor: Activating a New Incentive Period

When creating a proposal to activate a new incentive period, the action within the proposal is to call the `setNewEpoch` function in the `REGIncentiveVault` contract:

```solidity
function setNewEpoch(
    uint256 subscriptionStart,
    uint256 subscriptionEnd,
    uint256 lockPeriodEnd,
    address bonusToken,
    uint256 totalBonus
) external onlyRole(DEFAULT_ADMIN_ROLE);
```

![Activate New Incentive](../assets/activate-new-incentive.png "Incentive")

### Parameters:

- **subscriptionStart**: The timestamp when the subscription period begins.
- **subscriptionEnd**: The timestamp when the subscription period ends.
- **lockPeriodEnd**: The timestamp when the lock period ends.
- **bonusToken**: The address of the bonus token.
- **totalBonus**: The total amount of the bonus token in wei (18 decimals for WXDAI, 6 decimals for USDC).

### Conditions to Consider:

Ensure that the following condition is met:

```
Calling function timestamp < subscriptionStart < subscriptionEnd < lockPeriodEnd
```

### Delays in the REGGovernor Contract:

The `REGGovernor` contract imposes different delays on proposal actions, which vary between networks:

| Delay Type          | Sepolia            | Gnosis  |
| ------------------- | ------------------ | ------- |
| Proposal delay      | 15 minutes         | 1 day   |
| Voting period delay | 3 hours            | 7 days  |
| Queue delay         | 10 minutes         | 2 days  |
| **Total delay**     | 3 hours 25 minutes | 10 days |

#### Ensuring Correct Subscription Start:

The `subscriptionStart` timestamp must be greater than the sum of the proposal creation timestamp and the combined delays:

```
subscriptionStart > (timestamp of proposal creation + proposal delay + voting period delay + queue delay)
```

This ensures that the proposal can pass and be executed before the `subscriptionStart` timestamp. For instance, on Sepolia:

- The `subscriptionStart` must be at least 3 hours and 25 minutes after the proposal creation timestamp.
- To account for any manual queue and execution actions, it's recommended to set `subscriptionStart` to a time greater than the proposal creation timestamp plus 4 hours (14,400 seconds).

This gives sufficient time for all actions to be completed before the subscription period starts.

#### Ensuring Correct Subscription End:

The period between `subscriptionStart` and `subscriptionEnd` is when users can deposit their tokens for the new incentive period. Make sure users have enough time to be informed about the incentive period and stake their tokens.

For example:

- On Sepolia for beta testing, this period might range from 1 to 6 hours.
- On Gnosis mainnet, this period might range from 1 day to several days.

#### Ensuring Correct Lock Period End:

The period between `subscriptionEnd` and `lockPeriodEnd` is when the DAO can create multiple proposals, and users can vote on these proposals. Voting during this period is counted towards the incentive users will receive at the end of the period.

Ensure that this period is long enough to accommodate multiple proposals and voting.

For example:

- On Sepolia for beta testing, this period can last from 6 hours to 1 day.
- On Gnosis mainnet, this period can last from 2 weeks to 2 months.

#### Ensuring Correct Total Bonus:

Make sure the `totalBonus` accounts for the token's decimal places.

For example:

- To set a total bonus of 2,000 WXDAI (18 decimals): `totalBonus = 2,000,000,000,000,000,000,000` (2,000 \* 10^18)
- To set a total bonus of 3,000 USDC (6 decimals): `totalBonus = 3,000,000,000` (3,000 \* 10^6)
