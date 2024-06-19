// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Interface for REGIncentiveVault
 * @notice This interface defines the functions and events for the REGIncentiveVault contract.
 */
interface IREGIncentiveVault {
    /**
     * @notice Struct to store the global state of a user.
     * @param currentDeposit The current deposit amount of the user.
     * @param lastClaimedEpoch The last epoch in which the user claimed their bonus.
     */
    struct UserGlobalState {
        uint256 currentDeposit;
        uint256 lastClaimedEpoch;
    }

    /**
     * @notice Struct to store the state of a user for a specific epoch.
     * @param depositAmount The amount deposited by the user in the epoch.
     * @param voteAmount The amount of votes cast by the user in the epoch.
     * @param claimed Whether the user has claimed their bonus for the epoch.
     */
    struct UserEpochState {
        uint256 depositAmount;
        uint256 voteAmount;
        bool claimed;
    }

    /**
     * @notice Struct to store the state of an epoch.
     * @param subscriptionStart The start time of the subscription period.
     * @param subscriptionEnd The end time of the subscription period.
     * @param lockPeriodEnd The end time of the lock period.
     * @param bonusToken The address of the bonus token.
     * @param totalBonus The total bonus available for the epoch.
     * @param totalVotes The total votes cast in the epoch.
     * @param totalWeights The total weights calculated for the epoch.
     */
    struct EpochState {
        uint256 subscriptionStart;
        uint256 subscriptionEnd;
        uint256 lockPeriodEnd;
        address bonusToken;
        uint256 totalBonus;
        uint256 totalVotes;
        uint256 totalWeights;
    }

    /**
     * @notice Emitted when the REG governor is set.
     * @param regGovernor The address of the new REG governor.
     */
    event SetRegGovernor(address indexed regGovernor);

    /**
     * @notice Emitted when the REG token is set.
     * @param regToken The address of the new REG token.
     */
    event SetRegToken(address indexed regToken);

    /**
     * @notice Emitted when a new epoch is set.
     * @param subscriptionStart The start time of the subscription period.
     * @param subscriptionEnd The end time of the subscription period.
     * @param lockPeriodEnd The end time of the lock period.
     * @param bonusToken The address of the bonus token.
     * @param totalBonus The total bonus available for the epoch.
     * @param epoch The epoch number.
     */
    event SetNewEpoch(
        uint256 subscriptionStart,
        uint256 subscriptionEnd,
        uint256 lockPeriodEnd,
        address bonusToken,
        uint256 totalBonus,
        uint256 epoch
    );

    /**
     * @notice Emitted when a user makes a deposit.
     * @param user The address of the user.
     * @param amount The amount deposited.
     * @param epoch The epoch number.
     */
    event Deposit(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed epoch
    );

    /**
     * @notice Emitted when a user withdraws their deposit.
     * @param user The address of the user.
     * @param amount The amount withdrawn.
     * @param epoch The epoch number.
     */
    event Withdraw(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed epoch
    );

    /**
     * @notice Emitted when a user claims their bonus.
     * @param user The address of the user.
     * @param amount The amount of bonus claimed.
     * @param epoch The epoch number.
     */
    event ClaimBonus(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed epoch
    );

    /**
     * @notice Emitted when a user records a vote.
     * @param user The address of the user.
     * @param proposalId The ID of the proposal voted on.
     * @param epoch The epoch number.
     */
    event RecordVote(
        address indexed user,
        uint256 indexed proposalId,
        uint256 indexed epoch
    );

    /**
     * @notice Emitted when a user attempts to record a vote outside of an active epoch.
     * @param user The address of the user.
     * @param proposalId The ID of the proposal voted on.
     * @param epoch The epoch number.
     */
    event RecordVoteNotActive(
        address indexed user,
        uint256 indexed proposalId,
        uint256 indexed epoch
    );

    /**
     * @notice Records a vote for a proposal.
     * @param user The address of the user.
     * @param proposalId The ID of the proposal.
     */
    function recordVote(address user, uint256 proposalId) external;

    /**
     * @notice Sets the REG governor.
     * @param regGovernor The address of the new REG governor.
     */
    function setRegGovernor(address regGovernor) external;

    /**
     * @notice Sets the REG token.
     * @param regToken The address of the new REG token.
     */
    function setRegToken(IERC20 regToken) external;

    /**
     * @notice Sets a new epoch with the given parameters.
     * @param subscriptionStart The start time of the subscription period.
     * @param subscriptionEnd The end time of the subscription period.
     * @param lockPeriodEnd The end time of the lock period.
     * @param bonusToken The address of the bonus token.
     * @param totalBonus The total bonus available for the epoch.
     */
    function setNewEpoch(
        uint256 subscriptionStart,
        uint256 subscriptionEnd,
        uint256 lockPeriodEnd,
        address bonusToken,
        uint256 totalBonus
    ) external;

    /**
     * @notice Deposits a specified amount into the vault.
     * @param amount The amount to deposit.
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Withdraws the user's deposit from the vault.
     */
    function withdraw() external;

    /**
     * @notice Claims the user's bonus for the current epoch.
     */
    function claimBonus() external;

    /**
     * @notice Calculates the bonus for a user.
     * @param user The address of the
     * @param user The address of the user.
     * @return The calculated bonus amount.
     */
    function calculateBonus(
        address user
    ) external view returns (address[] memory, uint256[] memory);

    /**
     * @notice Returns the address of the REG governor.
     * @return The address of the REG governor.
     */
    function getRegGovernor() external view returns (address);

    /**
     * @notice Returns the address of the REG token.
     * @return The address of the REG token.
     */
    function getRegToken() external view returns (IERC20);

    /**
     * @notice Returns the current total deposit amount.
     * @return The current total deposit amount.
     */
    function getCurrentTotalDeposit() external view returns (uint256);

    /**
     * @notice Returns the current epoch number.
     * @return The current epoch number.
     */
    function getCurrentEpoch() external view returns (uint256);

    /**
     * @notice Returns the state of a user for a specific epoch.
     * @param user The address of the user.
     * @param epoch The epoch number.
     * @return The user's state for the specified epoch.
     */
    function getUserEpochState(
        address user,
        uint256 epoch
    ) external view returns (UserEpochState memory);

    /**
     * @notice Returns the global state of a user.
     * @param user The address of the user.
     * @return The user's global state.
     */
    function getUserGlobalState(
        address user
    ) external view returns (UserGlobalState memory);

    /**
     * @notice Returns the state of a specific epoch.
     * @param epoch The epoch number.
     * @return The state of the specified epoch.
     */
    function getEpochState(
        uint256 epoch
    ) external view returns (EpochState memory);

    function getCurrentEpochState() external view returns (EpochState memory);
}
