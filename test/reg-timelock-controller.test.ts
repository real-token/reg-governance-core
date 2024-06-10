import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ZERO_ADDRESS } from "../helpers/constants";
import {
  REGGovernor,
  REGVotesRegistry,
  REGTimelockController,
  REGTokenMock,
} from "../typechain-types";

describe("REGTimelockController contract", function () {
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
  });

  it("should initialize the right proposer and executor", async function () {
    expect(
      await regTimelockController.hasRole(
        await regTimelockController.PROPOSER_ROLE(),
        proposer.address
      )
    ).to.be.true;
    expect(
      await regTimelockController.hasRole(
        await regTimelockController.EXECUTOR_ROLE(),
        executor.address
      )
    ).to.be.true;
  });

  it("should revert on re-calling initialize", async function () {
    await expect(
      regTimelockController
        .connect(admin)
        .initialize(0, [proposer.address], [executor.address], admin.address)
    ).to.be.revertedWithCustomError(
      regTimelockController,
      "InvalidInitialization"
    );
  });

  it("should revert on upgrade by non-upgrader", async function () {
    await expect(
      regTimelockController
        .connect(deployer)
        .upgradeToAndCall(ZERO_ADDRESS, "0x")
    ).to.be.revertedWithCustomError(
      regTimelockController,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should be able to upgrade by upgrader", async function () {
    const REGTimelockControllerV2 = await ethers.getContractFactory(
      "REGTimelockController"
    );

    const regTimelockControllerV2 = await REGTimelockControllerV2.deploy();

    await regTimelockControllerV2.deployed();

    await expect(
      regTimelockController
        .connect(admin)
        .upgradeToAndCall(regTimelockControllerV2.address, "0x")
    ).to.emit(regTimelockController, "Upgraded");
  });
});
