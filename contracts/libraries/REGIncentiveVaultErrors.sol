// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title REGIncentiveVaultErrors library
 * @author RealT
 * @notice Defines the error messages emitted by the REGIncentiveVault contract
 */
library REGIncentiveVaultErrors {
    error RecordVoteNotAllowed();
    error SubscriptionPeriodNotStarted();
    error SubscriptionPeriodEnded();
    error LockPeriodNotEnded();
    error OutOfLockPeriod();
    error InvalidTimestampForEpoch();
    error UserAlreadyClaimedBonus(address user, uint256 epoch);
    error OnlyRegGovernorAllowed();
}
