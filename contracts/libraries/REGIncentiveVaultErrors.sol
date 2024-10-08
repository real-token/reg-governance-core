// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title REGIncentiveVaultErrors library
 * @author RealT
 * @notice Defines the error messages emitted by the REGIncentiveVault contract
 */
library REGIncentiveVaultErrors {
    error SubscriptionPeriodNotStarted();
    error SubscriptionPeriodEnded();
    error LockPeriodNotEnded();
    error InvalidTimestampForEpoch();
    error OnlyRegGovernorAllowed();
}
