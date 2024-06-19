// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IREGVotingPowerRegistry.sol";
import "./libraries/REGVotingPowerRegistryErrors.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract REGVotingPowerRegistry is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    UUPSUpgradeable,
    IREGVotingPowerRegistry
{
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address defaultAdmin,
        address register,
        address upgrader
    ) public initializer {
        __ERC20_init("REG Voting Power Registry", "REG-VOTING-POWER");
        __AccessControl_init();
        __ERC20Permit_init("REG Voting Power Registry");
        __ERC20Votes_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(REGISTER_ROLE, register);
        _grantRole(UPGRADER_ROLE, upgrader);
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

    /// @inheritdoc IREGVotingPowerRegistry
    function registerVotingPower(
        VotingPower[] calldata votingPower
    ) external override onlyRole(REGISTER_ROLE) {
        uint256 length = votingPower.length;
        for (uint256 i = 0; i < length; ) {
            address voter = votingPower[i].voter;
            uint256 votes = votingPower[i].votes;
            uint256 oldBalance = balanceOf(voter);

            // Set delegatee to voter if it is not already set
            address delegatee = delegates(voter);
            if (delegatee != voter) {
                _delegate(voter, voter);
            }

            // Update the balance of the voter if it has changed
            if (votes > oldBalance) {
                _mint(voter, votes - balanceOf(voter));
            } else if (votes < oldBalance) {
                _burn(voter, oldBalance - votes);
            } else {
                // No need to mint or burn
            }

            emit RegisterVotingPower(voter, votes);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Override clock function to use timestamp as the clock mode.
     **/
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    /**
     * @dev Override CLOCK_MODE function to use timestamp as the clock mode.
     **/
    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._update(from, to, value);
    }

    function nonces(
        address owner
    )
        public
        view
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    /**
     * @dev The token is not transferable.
     **/
    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        return false;
    }

    /**
     * @dev The token is not transferable.
     **/
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        return false;
    }

    /**
     * @dev The token is not transferable.
     **/
    function approve(
        address spender,
        uint256 amount
    ) public override returns (bool) {
        return false;
    }

    /**
     * @dev Users can not delegate.
     **/
    function _delegate(
        address account,
        address delegatee
    ) internal virtual override {
        if (delegatee != account) {
            revert REGVotingPowerRegistryErrors.DelegateToOtherNotAllowed();
        }

        super._delegate(account, delegatee);
    }
}
