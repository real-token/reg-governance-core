import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
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

  before(async () => {
    [deployer, admin, proposer, executor, register, ...voters] =
      await ethers.getSigners();
    console.log("deployer", deployer.address);
    console.log("admin", admin.address);
    console.log("proposer", proposer.address);
    console.log("executor", executor.address);
    console.log("register", register.address);

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

    votingStruct1 = [[voters[0].address, ethers.utils.parseEther("3000")]];

    votingStruct2 = [
      [proposer.address, ethers.utils.parseEther("3000")],
      [voters[0].address, ethers.utils.parseEther("3000")],
    ];
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
      regGovernor
        .connect(admin)
        .initialize(
          regVotesRegistry.address,
          regTimelockController.address,
          admin.address
        )
    ).to.be.revertedWithCustomError(regGovernor, "InvalidInitialization");
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
    await regVotesRegistry.connect(register).registerVotingPower(votingStruct1);

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      ethers.utils.parseEther("3000")
    );
  });

  it("should restrict token transfers", async function () {
    await regVotesRegistry.connect(register).registerVotingPower(votingStruct1);

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      ethers.utils.parseEther("3000")
    );

    await regVotesRegistry
      .connect(voters[0])
      .transfer(voters[1].address, ethers.utils.parseEther("3000"));

    expect(await regVotesRegistry.balanceOf(voters[0].address)).to.equal(
      ethers.utils.parseEther("3000")
    );
    expect(await regVotesRegistry.balanceOf(voters[1].address)).to.equal(0);
  });
});
