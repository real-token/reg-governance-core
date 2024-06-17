//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Interface for REGIncentiveVault
 */

interface IREGIncentiveVault {
    // UserGlobalState are updated for each deposit/withdraw/claim
    struct UserGlobalState {
        uint256 currentDeposit;
        uint256 lastClaimedEpoch;
    }

    // UserEpochState are updated from subscriptionStart to claim
    struct UserEpochState {
        uint256 depositAmount;
        uint256 voteAmount;
        bool claimed;
    }

    // Epoch statte are only updated from subscriptionStart to lockPeriodEnd
    struct EpochState {
        uint256 subscriptionStart;
        uint256 subscriptionEnd;
        uint256 lockPeriodEnd;
        address bonusToken;
        uint256 totalBonus;
        uint256 totalVotes;
        uint256 totalWeights;
    }

    event SetRegGovernor(address indexed regGovernor);

    event SetDepositToken(address indexed depositToken);

    event SetBonusToken(address indexed bonusToken);

    event SetSubscriptionPeriod(
        uint256 indexed subscriptionStart,
        uint256 indexed subscriptionEnd,
        uint256 indexed lockPeriodEnd
    );

    event SetNewEpoch(
        uint256 subscriptionStart,
        uint256 subscriptionEnd,
        uint256 lockPeriodEnd,
        address bonusToken,
        uint256 totalBonus,
        uint256 epoch
    );

    event Deposit(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed epoch
    );

    event Withdraw(address indexed user, uint256 indexed amount);

    event ClaimBonus(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed epoch
    );

    event RecordVote(
        address indexed user,
        uint256 indexed proposalId,
        uint256 indexed epoch
    );

    function recordVote(address voter, uint256 proposalId) external;
}
