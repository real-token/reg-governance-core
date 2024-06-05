// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IREGVotesRegistry.sol";
import "./libraries/REGVotesRegistryErrors.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract REGVotesRegistry is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    UUPSUpgradeable,
    IREGVotesRegistry
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address defaultAdmin,
        address minter,
        address upgrader
    ) public initializer {
        __ERC20_init("REGVotesRegistry", "REGVotesRegistry");
        __AccessControl_init();
        __ERC20Permit_init("REGVotesRegistry");
        __ERC20Votes_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(UPGRADER_ROLE, upgrader);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    // The following functions are overrides required by Solidity.

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

    function registerVotingPower(
        VotingPower[] calldata votingPower
    ) public onlyRole(MINTER_ROLE) {
        uint256 length = votingPower.length;
        for (uint256 i = 0; i < length; ) {
            VotingPower memory vp = votingPower[i];
            uint256 oldBalance = balanceOf(vp.voter);
            if (vp.votes > oldBalance) {
                _mint(vp.voter, vp.votes - balanceOf(vp.voter));
            } else if (vp.votes < oldBalance) {
                _burn(vp.voter, oldBalance - vp.votes);
            } else {
                // No need to mint or burn
            }
            unchecked {
                ++i;
            }
        }
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
}
