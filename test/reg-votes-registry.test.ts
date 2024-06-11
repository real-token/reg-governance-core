import { ZERO_ADDRESS } from "./../helpers/constants";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  REGGovernor,
  REGVotingPowerRegistry,
  REGTreasuryDAO,
  REGTokenMock,
  VotingPowerStruct,
} from "../typechain-types";

describe("REGVotingPowerRegistry contract", function () {
  let regGovernor: REGGovernor;
  let regVotingPowerRegistry: REGVotingPowerRegistry;
  let regTreasuryDAO: REGTreasuryDAO;
  let regTokenMock: REGTokenMock;
  let deployer: any;
  let admin: any;
  let executor: any;
  let proposer: any;
  let register: any;
  let voters: any;
  let votingStruct1: VotingPowerStruct;
  let votingStruct2: VotingPowerStruct;
  const REG_AMOUNT_1 = ethers.utils.parseEther("3000");
  const REG_AMOUNT_2 = ethers.utils.parseEther("5000");

  before(async () => {
    [deployer, admin, proposer, executor, register, ...voters] =
      await ethers.getSigners();

    const REGVotingPowerRegistryFactory = await ethers.getContractFactory(
      "REGVotingPowerRegistry"
    );
    regVotingPowerRegistry = (await upgrades.deployProxy(
      REGVotingPowerRegistryFactory,
      [
        admin.address, // default admin
        register.address, // register role
        admin.address, // upgrader role
      ],
      {
        initializer: "initialize",
      }
    )) as REGVotingPowerRegistry;

    const REGTreasuryDAOFactory = await ethers.getContractFactory(
      "REGTreasuryDAO"
    );
    regTreasuryDAO = (await upgrades.deployProxy(
      REGTreasuryDAOFactory,
      [
        1,
        [proposer.address], // should be granted later to governor contract
        [executor.address], // should be granted later to governor contract
        admin.address, // TimelockController itself + a Safe
      ],
      {
        initializer: "initialize",
      }
    )) as REGTreasuryDAO;

    const REGGovernorFactory = await ethers.getContractFactory("REGGovernor");
    regGovernor = (await upgrades.deployProxy(
      REGGovernorFactory,
      [
        regVotingPowerRegistry.address, // ERC20Votes
        regTreasuryDAO.address, // TimelockController
        admin.address, // default admin
      ],
      {
        initializer: "initialize",
      }
    )) as REGGovernor;

    await regTreasuryDAO
      .connect(admin)
      .grantRole(await regTreasuryDAO.EXECUTOR_ROLE(), regGovernor.address);
    await regTreasuryDAO
      .connect(admin)
      .grantRole(await regTreasuryDAO.PROPOSER_ROLE(), regGovernor.address);

    const REGTokenMock = await ethers.getContractFactory("REGTokenMock");
    regTokenMock = (await REGTokenMock.deploy(admin.address)) as REGTokenMock;
    await regTokenMock.deployed();

    votingStruct1 = [[voters[0].address, REG_AMOUNT_1]];

    votingStruct2 = [[voters[0].address, REG_AMOUNT_2]];
  });

  it("should correctly initialize contract roles and permissions", async function () {
    expect(
      await regVotingPowerRegistry.hasRole(
        await regVotingPowerRegistry.DEFAULT_ADMIN_ROLE(),
        admin.address
      )
    ).to.be.true;
    expect(
      await regVotingPowerRegistry.hasRole(
        await regVotingPowerRegistry.REGISTER_ROLE(),
        register.address
      )
    ).to.be.true;
    expect(
      await regVotingPowerRegistry.hasRole(
        await regVotingPowerRegistry.UPGRADER_ROLE(),
        admin.address
      )
    ).to.be.true;
  });

  it("should revert on re-calling initialize", async function () {
    await expect(
      regVotingPowerRegistry
        .connect(admin)
        .initialize(admin.address, register.address, admin.address)
    ).to.be.revertedWithCustomError(
      regVotingPowerRegistry,
      "InvalidInitialization"
    );
  });

  it("should prevent unauthorized registering of tokens", async function () {
    await expect(
      regVotingPowerRegistry
        .connect(proposer)
        .registerVotingPower(votingStruct1)
    )
      .to.be.revertedWithCustomError(
        regVotingPowerRegistry,
        "AccessControlUnauthorizedAccount"
      )
      .withArgs(proposer.address, await regVotingPowerRegistry.REGISTER_ROLE());
  });

  it("should allow authorized registering of tokens", async function () {
    // Register 3k tokens to voter 0
    await expect(
      regVotingPowerRegistry
        .connect(register)
        .registerVotingPower(votingStruct1)
    )
      .to.emit(regVotingPowerRegistry, "Transfer")
      .withArgs(ZERO_ADDRESS, voters[0].address, REG_AMOUNT_1);

    expect(await regVotingPowerRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );

    // Register 5k tokens to voter 0
    expect(
      await regVotingPowerRegistry
        .connect(register)
        .registerVotingPower(votingStruct2)
    )
      .to.emit(regVotingPowerRegistry, "Transfer")
      .withArgs(
        ZERO_ADDRESS,
        voters[0].address,
        REG_AMOUNT_2.sub(REG_AMOUNT_1)
      );

    expect(await regVotingPowerRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_2
    );

    // Register 3k tokens to voter 0
    expect(
      await regVotingPowerRegistry
        .connect(register)
        .registerVotingPower(votingStruct1)
    )
      .to.emit(regVotingPowerRegistry, "Transfer")
      .withArgs(
        voters[0].address,
        ZERO_ADDRESS,
        REG_AMOUNT_2.sub(REG_AMOUNT_1)
      );
  });

  it("should not allow delegate voting power to other", async function () {
    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);
    console.log(
      "delegatee",
      await regVotingPowerRegistry.delegates(voters[0].address)
    );

    expect(await regVotingPowerRegistry.delegates(voters[0].address)).to.equal(
      voters[0].address
    );

    await expect(
      regVotingPowerRegistry.connect(voters[0]).delegate(voters[1].address)
    ).to.be.revertedWithCustomError(
      regVotingPowerRegistry,
      "DelegateToOtherNotAllowed"
    );

    expect(await regVotingPowerRegistry.delegates(voters[0].address)).to.equal(
      voters[0].address
    );
  });

  it("should allow delegate voting power to self", async function () {
    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    expect(await regVotingPowerRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );
    console.log(
      "votes",
      await regVotingPowerRegistry.getVotes(voters[0].address)
    );

    expect(await regVotingPowerRegistry.getVotes(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );

    await expect(
      regVotingPowerRegistry.connect(voters[0]).delegate(voters[0].address)
    )
      .to.emit(regVotingPowerRegistry, "DelegateChanged")
      .withArgs(voters[0].address, voters[0].address, voters[0].address);

    expect(await regVotingPowerRegistry.delegates(voters[0].address)).to.equal(
      voters[0].address
    );

    expect(await regVotingPowerRegistry.getVotes(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );
  });

  it("should restrict token transfers", async function () {
    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    expect(await regVotingPowerRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );

    await regVotingPowerRegistry
      .connect(voters[0])
      .transfer(voters[1].address, REG_AMOUNT_1);

    expect(await regVotingPowerRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );
    expect(await regVotingPowerRegistry.balanceOf(voters[1].address)).to.equal(
      0
    );
  });

  it("should restrict approve transfers", async function () {
    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    expect(
      await regVotingPowerRegistry.allowance(
        voters[0].address,
        voters[1].address
      )
    ).to.equal(ethers.utils.parseEther("0"));

    await regVotingPowerRegistry
      .connect(voters[0])
      .approve(voters[1].address, REG_AMOUNT_1);

    expect(
      await regVotingPowerRegistry.allowance(
        voters[0].address,
        voters[1].address
      )
    ).to.equal(ethers.utils.parseEther("0"));
  });

  it("should restrict approve transfers", async function () {
    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    expect(
      await regVotingPowerRegistry.allowance(
        voters[0].address,
        voters[1].address
      )
    ).to.equal(ethers.utils.parseEther("0"));

    await regVotingPowerRegistry
      .connect(voters[0])
      .approve(voters[1].address, REG_AMOUNT_1);

    expect(
      await regVotingPowerRegistry.allowance(
        voters[0].address,
        voters[1].address
      )
    ).to.equal(ethers.utils.parseEther("0"));

    await regVotingPowerRegistry
      .connect(voters[1])
      .transferFrom(voters[0].address, voters[2].address, REG_AMOUNT_1);

    expect(await regVotingPowerRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );
    expect(await regVotingPowerRegistry.balanceOf(voters[1].address)).to.equal(
      "0"
    );
    expect(await regVotingPowerRegistry.balanceOf(voters[2].address)).to.equal(
      "0"
    );
  });

  it("should return the right CLOCK_MODE and clock", async function () {
    expect(await regVotingPowerRegistry.CLOCK_MODE()).to.equal(
      "mode=timestamp"
    );

    expect(await regVotingPowerRegistry.clock()).to.equal(await time.latest());

    console.log("clock", await regVotingPowerRegistry.clock());

    console.log("timestamp", await time.latest());
  });

  it("should return the right nonces", async function () {
    expect(await regVotingPowerRegistry.nonces(voters[0].address)).to.equal(0);
  });

  it("should revert on upgrade by non-upgrader", async function () {
    await expect(
      regVotingPowerRegistry
        .connect(deployer)
        .upgradeToAndCall(ZERO_ADDRESS, "0x")
    ).to.be.revertedWithCustomError(
      regVotingPowerRegistry,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should be able to upgrade by upgrader", async function () {
    const REGVotingPowerRegistryV2 = await ethers.getContractFactory(
      "REGVotingPowerRegistry"
    );

    const regVotingPowerRegistryV2 = await REGVotingPowerRegistryV2.deploy();

    await regVotingPowerRegistryV2.deployed();

    await expect(
      regVotingPowerRegistry
        .connect(admin)
        .upgradeToAndCall(regVotingPowerRegistryV2.address, "0x")
    ).to.emit(regVotingPowerRegistry, "Upgraded");
  });
});
