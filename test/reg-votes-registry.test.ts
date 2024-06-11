import { ZERO_ADDRESS } from "./../helpers/constants";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  REGGovernor,
  REGVotesRegistry,
  REGTimelockController,
  REGTokenMock,
  VotingPowerStruct,
} from "../typechain-types";

describe("REGVotesRegistry contract", function () {
  let regGovernor: REGGovernor;
  let regVotesRegistry: REGVotesRegistry;
  let regTimelockController: REGTimelockController;
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

    const REGVotesRegistryFactory = await ethers.getContractFactory(
      "REGVotesRegistry"
    );
    regVotesRegistry = (await upgrades.deployProxy(
      REGVotesRegistryFactory,
      [
        admin.address, // default admin
        register.address, // register role
        admin.address, // upgrader role
      ],
      {
        initializer: "initialize",
      }
    )) as REGVotesRegistry;

    const REGTimelockControllerFactory = await ethers.getContractFactory(
      "REGTimelockController"
    );
    regTimelockController = (await upgrades.deployProxy(
      REGTimelockControllerFactory,
      [
        1,
        [proposer.address], // should be granted later to governor contract
        [executor.address], // should be granted later to governor contract
        admin.address, // TimelockController itself + a Safe
      ],
      {
        initializer: "initialize",
      }
    )) as REGTimelockController;

    const REGGovernorFactory = await ethers.getContractFactory("REGGovernor");
    regGovernor = (await upgrades.deployProxy(
      REGGovernorFactory,
      [
        regVotesRegistry.address, // ERC20Votes
        regTimelockController.address, // TimelockController
        admin.address, // default admin
      ],
      {
        initializer: "initialize",
      }
    )) as REGGovernor;

    await regTimelockController
      .connect(admin)
      .grantRole(
        await regTimelockController.EXECUTOR_ROLE(),
        regGovernor.address
      );
    await regTimelockController
      .connect(admin)
      .grantRole(
        await regTimelockController.PROPOSER_ROLE(),
        regGovernor.address
      );

    const REGTokenMock = await ethers.getContractFactory("REGTokenMock");
    regTokenMock = (await REGTokenMock.deploy(admin.address)) as REGTokenMock;
    await regTokenMock.deployed();

    votingStruct1 = [[voters[0].address, REG_AMOUNT_1]];

    votingStruct2 = [[voters[0].address, REG_AMOUNT_2]];
  });

  it("should correctly initialize contract roles and permissions", async function () {
    expect(
      await regVotesRegistry.hasRole(
        await regVotesRegistry.DEFAULT_ADMIN_ROLE(),
        admin.address
      )
    ).to.be.true;
    expect(
      await regVotesRegistry.hasRole(
        await regVotesRegistry.REGISTER_ROLE(),
        register.address
      )
    ).to.be.true;
    expect(
      await regVotesRegistry.hasRole(
        await regVotesRegistry.UPGRADER_ROLE(),
        admin.address
      )
    ).to.be.true;
  });

  it("should revert on re-calling initialize", async function () {
    await expect(
      regVotesRegistry
        .connect(admin)
        .initialize(admin.address, register.address, admin.address)
    ).to.be.revertedWithCustomError(regVotesRegistry, "InvalidInitialization");
  });

  it("should prevent unauthorized registering of tokens", async function () {
    await expect(
      regVotesRegistry.connect(proposer).registerVotingPower(votingStruct1)
    )
      .to.be.revertedWithCustomError(
        regVotesRegistry,
        "AccessControlUnauthorizedAccount"
      )
      .withArgs(proposer.address, await regVotesRegistry.REGISTER_ROLE());
  });

  it("should allow authorized registering of tokens", async function () {
    // Register 3k tokens to voter 0
    await expect(
      regVotesRegistry.connect(register).registerVotingPower(votingStruct1)
    )
      .to.emit(regVotesRegistry, "Transfer")
      .withArgs(ZERO_ADDRESS, voters[0].address, REG_AMOUNT_1);

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );

    // Register 5k tokens to voter 0
    expect(
      await regVotesRegistry
        .connect(register)
        .registerVotingPower(votingStruct2)
    )
      .to.emit(regVotesRegistry, "Transfer")
      .withArgs(
        ZERO_ADDRESS,
        voters[0].address,
        REG_AMOUNT_2.sub(REG_AMOUNT_1)
      );

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_2
    );

    // Register 3k tokens to voter 0
    expect(
      await regVotesRegistry
        .connect(register)
        .registerVotingPower(votingStruct1)
    )
      .to.emit(regVotesRegistry, "Transfer")
      .withArgs(
        voters[0].address,
        ZERO_ADDRESS,
        REG_AMOUNT_2.sub(REG_AMOUNT_1)
      );
  });

  it("should not allow delegate voting power to other", async function () {
    await regVotesRegistry.connect(register).registerVotingPower(votingStruct1);
    console.log(
      "delegatee",
      await regVotesRegistry.delegates(voters[0].address)
    );

    expect(await regVotesRegistry.delegates(voters[0].address)).to.equal(
      voters[0].address
    );

    await expect(
      regVotesRegistry.connect(voters[0]).delegate(voters[1].address)
    ).to.be.revertedWithCustomError(
      regVotesRegistry,
      "DelegateToOtherNotAllowed"
    );

    expect(await regVotesRegistry.delegates(voters[0].address)).to.equal(
      voters[0].address
    );
  });

  it("should allow delegate voting power to self", async function () {
    await regVotesRegistry.connect(register).registerVotingPower(votingStruct1);

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );
    console.log("votes", await regVotesRegistry.getVotes(voters[0].address));

    expect(await regVotesRegistry.getVotes(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );

    await expect(
      regVotesRegistry.connect(voters[0]).delegate(voters[0].address)
    )
      .to.emit(regVotesRegistry, "DelegateChanged")
      .withArgs(voters[0].address, voters[0].address, voters[0].address);

    expect(await regVotesRegistry.delegates(voters[0].address)).to.equal(
      voters[0].address
    );

    expect(await regVotesRegistry.getVotes(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );
  });

  it("should restrict token transfers", async function () {
    await regVotesRegistry.connect(register).registerVotingPower(votingStruct1);

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );

    await regVotesRegistry
      .connect(voters[0])
      .transfer(voters[1].address, REG_AMOUNT_1);

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );
    expect(await regVotesRegistry.balanceOf(voters[1].address)).to.equal(0);
  });

  it("should restrict approve transfers", async function () {
    await regVotesRegistry.connect(register).registerVotingPower(votingStruct1);

    expect(
      await regVotesRegistry.allowance(voters[0].address, voters[1].address)
    ).to.equal(ethers.utils.parseEther("0"));

    await regVotesRegistry
      .connect(voters[0])
      .approve(voters[1].address, REG_AMOUNT_1);

    expect(
      await regVotesRegistry.allowance(voters[0].address, voters[1].address)
    ).to.equal(ethers.utils.parseEther("0"));
  });

  it("should restrict approve transfers", async function () {
    await regVotesRegistry.connect(register).registerVotingPower(votingStruct1);

    expect(
      await regVotesRegistry.allowance(voters[0].address, voters[1].address)
    ).to.equal(ethers.utils.parseEther("0"));

    await regVotesRegistry
      .connect(voters[0])
      .approve(voters[1].address, REG_AMOUNT_1);

    expect(
      await regVotesRegistry.allowance(voters[0].address, voters[1].address)
    ).to.equal(ethers.utils.parseEther("0"));

    await regVotesRegistry
      .connect(voters[1])
      .transferFrom(voters[0].address, voters[2].address, REG_AMOUNT_1);

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      REG_AMOUNT_1
    );
    expect(await regVotesRegistry.balanceOf(voters[1].address)).to.equal("0");
    expect(await regVotesRegistry.balanceOf(voters[2].address)).to.equal("0");
  });

  it("should return the right CLOCK_MODE and clock", async function () {
    expect(await regVotesRegistry.CLOCK_MODE()).to.equal("mode=timestamp");

    expect(await regVotesRegistry.clock()).to.equal(await time.latest());

    console.log("clock", await regVotesRegistry.clock());

    console.log("timestamp", await time.latest());
  });

  it("should return the right nonces", async function () {
    expect(await regVotesRegistry.nonces(voters[0].address)).to.equal(0);
  });

  it("should revert on upgrade by non-upgrader", async function () {
    await expect(
      regVotesRegistry.connect(deployer).upgradeToAndCall(ZERO_ADDRESS, "0x")
    ).to.be.revertedWithCustomError(
      regVotesRegistry,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should be able to upgrade by upgrader", async function () {
    const REGVotesRegistryV2 = await ethers.getContractFactory(
      "REGVotesRegistry"
    );

    const regVotesRegistryV2 = await REGVotesRegistryV2.deploy();

    await regVotesRegistryV2.deployed();

    await expect(
      regVotesRegistry
        .connect(admin)
        .upgradeToAndCall(regVotesRegistryV2.address, "0x")
    ).to.emit(regVotesRegistry, "Upgraded");
  });
});
