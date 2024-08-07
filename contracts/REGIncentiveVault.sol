// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IREGIncentiveVault.sol";
import "./libraries/REGIncentiveVaultErrors.sol";

contract REGIncentiveVault is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IREGIncentiveVault
{
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    address private _regGovernor;

    IERC20 private _regToken;

    uint256 private _currentEpoch;

    uint256 private _currentTotalDeposit;

    // User current deposit
    mapping(address => UserGlobalState) private _userGlobalStates;

    // User address => Epoch number => UserEpochState: use to record user's deposit, vote, and bonus
    mapping(address => mapping(uint256 => UserEpochState))
        private _userEpochStates;

    // Epoch number => EpochState
    mapping(uint256 => EpochState) private _epochStates;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract with the required parameters
     * @param regGovernor is the address of the REG Governor
     * @param regToken is the address of the REG Token
     * @param defaultAdmin is the address of the default admin
     * @param pauser is the address of the pauser
     * @param upgrader is the address of the upgrader
     **/
    function initialize(
        address regGovernor,
        address regToken,
        address defaultAdmin,
        address pauser,
        address upgrader
    ) external initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UPGRADER_ROLE, upgrader);

        _regGovernor = regGovernor;
        emit SetRegGovernor(regGovernor);

        _regToken = IERC20(regToken);
        emit SetRegToken(regToken);
    }

    /**
     * @notice The admin (with upgrader role) uses this function to update the contract
     * @dev This function is always needed in future implementation contract versions, otherwise, the contract will not be upgradeable
     * @param newImplementation is the address of the new implementation contract
     **/
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {
        // Intentionally left blank
    }

    modifier onlyGovernance() {
        if (msg.sender != _regGovernor)
            revert REGIncentiveVaultErrors.OnlyRegGovernorAllowed();
        _;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @inheritdoc IREGIncentiveVault
    function setRegGovernor(
        address regGovernor
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit SetRegGovernor(regGovernor);
        _regGovernor = regGovernor;
    }

    /// @inheritdoc IREGIncentiveVault
    function setRegToken(
        IERC20 regToken
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit SetRegToken(address(regToken));
        _regToken = regToken;
    }

    /// @inheritdoc IREGIncentiveVault
    function setNewEpoch(
        uint256 subscriptionStart,
        uint256 subscriptionEnd,
        uint256 lockPeriodEnd,
        address bonusToken,
        uint256 totalBonus
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _validateTimestampOfEpoch(
            subscriptionStart,
            subscriptionEnd,
            lockPeriodEnd
        );

        // Cache the current epoch
        uint256 currentEpoch = _currentEpoch + 1;

        // Initialize new EpochState
        EpochState storage epoch = _epochStates[currentEpoch];
        epoch.subscriptionStart = subscriptionStart;
        epoch.subscriptionEnd = subscriptionEnd;
        epoch.lockPeriodEnd = lockPeriodEnd;
        epoch.bonusToken = bonusToken;
        epoch.totalBonus = totalBonus;

        emit SetNewEpoch(
            subscriptionStart,
            subscriptionEnd,
            lockPeriodEnd,
            bonusToken,
            totalBonus,
            currentEpoch
        );

        // Increment the current epoch
        _currentEpoch += 1;
    }

    /// @inheritdoc IREGIncentiveVault
    function deposit(uint256 amount) public whenNotPaused {
        _validateSubscriptionPeriod();

        // Cache the current epoch
        uint256 currentEpoch = _currentEpoch;

        emit Deposit(msg.sender, amount, currentEpoch);

        // Update UserGlobalState
        _userGlobalStates[msg.sender].currentDeposit += amount;
        _currentTotalDeposit += amount;

        _regToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc IREGIncentiveVault
    function depositWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused {
        IERC20Permit(address(_regToken)).permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );
        deposit(amount);
    }

    /// @inheritdoc IREGIncentiveVault
    function withdraw(uint256 amount) external whenNotPaused {
        // Check if the lock period has ended
        _validateLockPeriod();

        // Update current deposit and transfer the deposit token back to the user
        uint256 currentDeposit = _userGlobalStates[msg.sender].currentDeposit;

        uint256 amountToWithdraw = amount > currentDeposit
            ? currentDeposit
            : amount;

        _userGlobalStates[msg.sender].currentDeposit =
            currentDeposit -
            amountToWithdraw;

        _currentTotalDeposit -= amountToWithdraw;

        emit Withdraw(msg.sender, amountToWithdraw, _currentEpoch);

        _regToken.safeTransfer(msg.sender, amountToWithdraw);

        // Claim bonus for user
        claimBonus();
    }

    /// @inheritdoc IREGIncentiveVault
    function recordVote(
        address user,
        uint256 proposalId
    ) external onlyGovernance {
        EpochState storage epochState = _epochStates[_currentEpoch];
        // Check if the timestamp is within the lock period
        // Do not use revert to avoid reverting the whole castVote transaction
        if (
            block.timestamp > epochState.subscriptionEnd &&
            block.timestamp <= epochState.lockPeriodEnd
        ) {
            // Update UserEpochState
            UserEpochState storage userState = _userEpochStates[user][
                _currentEpoch
            ];
            // Update depositAmount in UserEpochState if it has changed and update voteAmount
            uint256 currentDeposit = _userGlobalStates[user].currentDeposit;
            if (userState.depositAmount != currentDeposit) {
                userState.depositAmount = currentDeposit;
            }
            userState.voteAmount += 1;

            // Update EpochState
            epochState.totalVotes += 1;
            epochState.totalWeights += currentDeposit;

            emit RecordVote(user, proposalId, _currentEpoch);
        } else {
            emit RecordVoteNotActive(user, proposalId, _currentEpoch);
        }
    }

    /// @inheritdoc IREGIncentiveVault
    function calculateBonus(
        address user
    ) external view returns (address[] memory, uint256[] memory) {
        // Cache the current epoch
        uint256 currentEpoch = _currentEpoch;

        // Check if the current epoch is active or not
        uint256 maxEpochToClaim = block.timestamp >
            _epochStates[currentEpoch].lockPeriodEnd
            ? currentEpoch
            : currentEpoch - 1;

        // Each epoch bonusAmount and bonusToken
        address[] memory bonusTokens = new address[](currentEpoch);
        uint256[] memory bonusAmounts = new uint256[](currentEpoch);
        EpochState memory epochState;
        UserEpochState memory userState;
        uint256 userBonus;

        for (uint256 i = 1; i <= maxEpochToClaim; ) {
            epochState = _epochStates[i];
            userState = _userEpochStates[user][i];

            // Check totalWeights is not 0
            if (epochState.totalWeights == 0) {
                userBonus = 0;
            } else {
                userBonus =
                    (userState.depositAmount *
                        userState.voteAmount *
                        epochState.totalBonus) /
                    epochState.totalWeights;
            }

            bonusTokens[i - 1] = epochState.bonusToken;
            bonusAmounts[i - 1] = userBonus;
            unchecked {
                ++i;
            }
        }

        return (bonusTokens, bonusAmounts);
    }

    /// @inheritdoc IREGIncentiveVault
    function claimBonus() public whenNotPaused {
        // Claim bonus for all epochs from lastClaimedEpoch + 1 to currentEpoch
        uint256 lastClaimedEpoch = _userGlobalStates[msg.sender]
            .lastClaimedEpoch;
        // Cache the current epoch
        uint256 currentEpoch = _currentEpoch;

        // Check if the current epoch is active or not
        uint256 maxEpochToClaim = block.timestamp >
            _epochStates[currentEpoch].lockPeriodEnd
            ? currentEpoch
            : currentEpoch - 1;

        _userGlobalStates[msg.sender].lastClaimedEpoch = maxEpochToClaim;

        for (uint256 i = lastClaimedEpoch + 1; i <= maxEpochToClaim; ) {
            _claimBonus(msg.sender, i);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Claims the user's bonus for the epoch.
     * @param user The address of the user.
     * @param epoch The epoch number.
     */
    function _claimBonus(address user, uint256 epoch) private {
        UserEpochState storage userState = _userEpochStates[user][epoch];

        uint userBonus;

        // If user has not claimed bonus, claim it, otherwise do nothing to avoid revert
        if (!userState.claimed) {
            EpochState memory epochState = _epochStates[epoch];

            IERC20 bonusToken = IERC20(epochState.bonusToken);

            // Check totalWeights is not 0
            if (epochState.totalWeights == 0) {
                userBonus = 0;
            } else {
                userBonus =
                    (userState.depositAmount *
                        userState.voteAmount *
                        epochState.totalBonus) /
                    epochState.totalWeights;
            }

            userState.claimed = true;

            emit ClaimBonus(user, userBonus, epoch);

            if (userBonus > 0) {
                bonusToken.safeTransfer(user, userBonus);
            }
        }
    }

    /**
     * @notice Validate the current timestamp is within the subscription period.
     */
    function _validateSubscriptionPeriod() private view {
        // Cache the current epoch
        EpochState memory epochState = _epochStates[_currentEpoch];

        // Check if the timestamp is within the subscription period
        if (block.timestamp < epochState.subscriptionStart)
            revert REGIncentiveVaultErrors.SubscriptionPeriodNotStarted();
        if (block.timestamp > epochState.subscriptionEnd)
            revert REGIncentiveVaultErrors.SubscriptionPeriodEnded();
    }

    /**
     * @notice Validate the timestamp of the epoch.
     * @param subscriptionStart The start time of the subscription period.
     * @param subscriptionEnd The end time of the subscription period.
     * @param lockPeriodEnd The end time of the lock period.
     */
    function _validateTimestampOfEpoch(
        uint256 subscriptionStart,
        uint256 subscriptionEnd,
        uint256 lockPeriodEnd
    ) private view {
        if (
            _epochStates[_currentEpoch].lockPeriodEnd > block.timestamp || // Check if the current epoch lock period has ended
            block.timestamp > subscriptionStart ||
            subscriptionStart > subscriptionEnd ||
            subscriptionEnd > lockPeriodEnd
        ) revert REGIncentiveVaultErrors.InvalidTimestampForEpoch();
    }

    /**
     * @notice Validate the current timestamp is not within the lock period.
     */
    function _validateLockPeriod() private view {
        // Cache the current epoch
        EpochState memory epochState = _epochStates[_currentEpoch];

        if (
            block.timestamp > epochState.subscriptionEnd &&
            block.timestamp <= epochState.lockPeriodEnd
        ) revert REGIncentiveVaultErrors.LockPeriodNotEnded();
    }

    /// @inheritdoc IREGIncentiveVault
    function getRegGovernor() external view returns (address) {
        return _regGovernor;
    }

    /// @inheritdoc IREGIncentiveVault
    function getRegToken() external view returns (IERC20) {
        return _regToken;
    }

    /// @inheritdoc IREGIncentiveVault
    function getCurrentTotalDeposit() external view returns (uint256) {
        return _currentTotalDeposit;
    }

    /// @inheritdoc IREGIncentiveVault
    function getCurrentEpoch() external view returns (uint256) {
        return _currentEpoch;
    }

    /// @inheritdoc IREGIncentiveVault
    function getCurrentEpochState() external view returns (EpochState memory) {
        return _epochStates[_currentEpoch];
    }

    /// @inheritdoc IREGIncentiveVault
    function getEpochState(
        uint256 epoch
    ) external view returns (EpochState memory) {
        return _epochStates[epoch];
    }

    /// @inheritdoc IREGIncentiveVault
    function getUserEpochState(
        address user,
        uint256 epoch
    ) external view returns (UserEpochState memory) {
        return _userEpochStates[user][epoch];
    }

    /// @inheritdoc IREGIncentiveVault
    function getUserGlobalState(
        address user
    ) external view returns (UserGlobalState memory) {
        return _userGlobalStates[user];
    }
}
