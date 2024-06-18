// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

    function initialize(
        address regGovernor,
        address regToken,
        address defaultAdmin,
        address pauser,
        address upgrader
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UPGRADER_ROLE, upgrader);

        _regGovernor = regGovernor;
        _regToken = IERC20(regToken);
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

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setRegGovernor(
        address regGovernor
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit SetRegGovernor(regGovernor);
        _regGovernor = regGovernor;
    }

    function setRegToken(
        IERC20 regToken
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit SetRegToken(address(regToken));
        _regToken = regToken;
    }

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

    function deposit(uint256 amount) external whenNotPaused {
        _validateSubscriptionPeriod();

        // Cache the current epoch
        uint256 currentEpoch = _currentEpoch;

        emit Deposit(msg.sender, amount, currentEpoch);

        // Update UserGlobalState
        _userGlobalStates[msg.sender].currentDeposit += amount;
        _currentTotalDeposit += amount;

        _regToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw() external whenNotPaused {
        // Check if the lock period has ended
        _validateLockPeriod();

        // Cache the current epoch
        uint256 currentEpoch = _currentEpoch;

        // Update current deposit and transfer the deposit token back to the user
        uint256 currentDeposit = _userGlobalStates[msg.sender].currentDeposit;
        _userGlobalStates[msg.sender].currentDeposit = 0;
        _currentTotalDeposit -= currentDeposit;
        emit Withdraw(msg.sender, currentDeposit);
        _regToken.safeTransfer(msg.sender, currentDeposit);

        // Claim bonus and update UserEpochState
        uint256 lastClaimedEpoch = _userGlobalStates[msg.sender]
            .lastClaimedEpoch;
        _userGlobalStates[msg.sender].lastClaimedEpoch = currentEpoch;

        // Claim bonus for all epochs from lastClaimedEpoch + 1 to currentEpoch
        // TODO check if the current epoch is active or not
        for (uint256 i = lastClaimedEpoch + 1; i <= currentEpoch; ) {
            _claimBonus(msg.sender, i);
            unchecked {
                ++i;
            }
        }
    }

    function recordVote(
        address _user,
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
            UserEpochState storage user = _userEpochStates[_user][
                _currentEpoch
            ];
            // Update depositAmount in UserEpochState if it has changed and update voteAmount
            uint256 currentDeposit = _userGlobalStates[_user].currentDeposit;
            if (user.depositAmount != currentDeposit) {
                user.depositAmount = currentDeposit;
            }
            user.voteAmount += 1;

            // Update EpochState
            epochState.totalVotes += 1;
            epochState.totalWeights += currentDeposit;

            emit RecordVote(_user, proposalId, _currentEpoch);
        } else {
            emit RecordVoteNotActive(_user, proposalId, _currentEpoch);
        }
    }

    function calculateBonus(
        address user
    ) external view returns (address[] memory, uint256[] memory) {
        // Cache the current epoch
        uint256 currentEpoch = _currentEpoch;

        // Each epoch bonusAmount and bonusToken
        address[] memory bonusTokens = new address[](currentEpoch);
        uint256[] memory bonusAmounts = new uint256[](currentEpoch);
        EpochState memory epochState;
        UserEpochState memory userState;
        uint256 userBonus;

        // TODO check if the current epoch is active or not
        for (uint256 i = 1; i <= currentEpoch; i++) {
            epochState = _epochStates[i];
            userState = _userEpochStates[user][i];

            userBonus =
                (userState.depositAmount *
                    userState.voteAmount *
                    epochState.totalBonus) /
                epochState.totalWeights;

            bonusTokens[i - 1] = epochState.bonusToken;
            bonusAmounts[i - 1] = userBonus;
        }

        return (bonusTokens, bonusAmounts);
    }

    function claimBonus() external whenNotPaused {
        // Claim bonus for all epochs from lastClaimedEpoch + 1 to currentEpoch
        uint256 lastClaimedEpoch = _userGlobalStates[msg.sender]
            .lastClaimedEpoch;
        // Cache the current epoch
        uint256 currentEpoch = _currentEpoch;

        // TODO check if the current epoch is active or not
        for (uint256 i = lastClaimedEpoch + 1; i <= currentEpoch; i++) {
            _claimBonus(msg.sender, i);
        }

        _userGlobalStates[msg.sender].lastClaimedEpoch = _currentEpoch;
    }

    function _claimBonus(address user, uint256 epoch) private {
        UserEpochState storage userState = _userEpochStates[user][epoch];

        // If user has not claimed bonus, claim it, otherwise do nothing to avoid revert
        if (!userState.claimed) {
            EpochState memory epochState = _epochStates[epoch];

            IERC20 bonusToken = IERC20(epochState.bonusToken);

            uint256 userBonus = (userState.depositAmount *
                userState.voteAmount *
                epochState.totalBonus) / epochState.totalWeights;

            userState.claimed = true;

            emit ClaimBonus(user, userBonus, epoch);

            if (userBonus > 0) {
                bonusToken.safeTransfer(user, userBonus);
            }
        }
    }

    function _validateSubscriptionPeriod() private view {
        // Cache the current epoch
        EpochState memory epochState = _epochStates[_currentEpoch];

        // Check if the timestamp is within the subscription period
        if (block.timestamp < epochState.subscriptionStart)
            revert REGIncentiveVaultErrors.SubscriptionPeriodNotStarted();
        if (block.timestamp > epochState.subscriptionEnd)
            revert REGIncentiveVaultErrors.SubscriptionPeriodEnded();
    }

    function _validateTimestampOfEpoch(
        uint256 subscriptionStart,
        uint256 subscriptionEnd,
        uint256 lockPeriodEnd
    ) private view {
        if (
            block.timestamp > subscriptionStart ||
            subscriptionStart > subscriptionEnd ||
            subscriptionEnd > lockPeriodEnd
        ) revert REGIncentiveVaultErrors.InvalidTimestampForEpoch();
    }

    function _validateLockPeriod() private view {
        // Cache the current epoch
        EpochState memory epochState = _epochStates[_currentEpoch];

        if (
            block.timestamp > epochState.subscriptionEnd &&
            block.timestamp <= epochState.lockPeriodEnd
        ) revert REGIncentiveVaultErrors.LockPeriodNotEnded();
    }

    modifier onlyGovernance() {
        if (msg.sender != _regGovernor)
            revert REGIncentiveVaultErrors.OnlyRegGovernorAllowed();
        _;
    }

    function getRegGovernor() external view returns (address) {
        return _regGovernor;
    }

    function getRegToken() external view returns (IERC20) {
        return _regToken;
    }

    function getCurrentEpoch() external view returns (uint256) {
        return _currentEpoch;
    }

    function getCurrentTotalDeposit() external view returns (uint256) {
        return _currentTotalDeposit;
    }

    function getUserEpochState(
        address user,
        uint256 epoch
    ) external view returns (UserEpochState memory) {
        return _userEpochStates[user][epoch];
    }

    function getUserGlobalState(
        address user
    ) external view returns (UserGlobalState memory) {
        return _userGlobalStates[user];
    }

    function getEpochState(
        uint256 epoch
    ) external view returns (EpochState memory) {
        return _epochStates[epoch];
    }
}
