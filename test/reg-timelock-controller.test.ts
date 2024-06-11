import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ZERO_ADDRESS } from "../helpers/constants";
import {
  REGGovernor,
  REGVotingPowerRegistry,
  REGTreasuryDAO,
  REGTokenMock,
} from "../typechain-types";

describe("REGTreasuryDAO contract", function () {
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

  before(async () => {
    [deployer, admin, proposer, executor, register, ...voters] =
      await ethers.getSigners();
    console.log("deployer", deployer.address);
    console.log("admin", admin.address);
    console.log("proposer", proposer.address);
    console.log("executor", executor.address);
    console.log("register", register.address);

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
  });

  it("should initialize the right proposer and executor", async function () {
    expect(
      await regTreasuryDAO.hasRole(
        await regTreasuryDAO.PROPOSER_ROLE(),
        proposer.address
      )
    ).to.be.true;
    expect(
      await regTreasuryDAO.hasRole(
        await regTreasuryDAO.EXECUTOR_ROLE(),
        executor.address
      )
    ).to.be.true;
  });

  it("should revert on re-calling initialize", async function () {
    await expect(
      regTreasuryDAO
        .connect(admin)
        .initialize(0, [proposer.address], [executor.address], admin.address)
    ).to.be.revertedWithCustomError(regTreasuryDAO, "InvalidInitialization");
  });

  it("should revert on upgrade by non-upgrader", async function () {
    await expect(
      regTreasuryDAO.connect(deployer).upgradeToAndCall(ZERO_ADDRESS, "0x")
    ).to.be.revertedWithCustomError(
      regTreasuryDAO,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should be able to upgrade by upgrader", async function () {
    const REGTreasuryDAOV2 = await ethers.getContractFactory("REGTreasuryDAO");

    const regTreasuryDAOV2 = await REGTreasuryDAOV2.deploy();

    await regTreasuryDAOV2.deployed();

    await expect(
      regTreasuryDAO
        .connect(admin)
        .upgradeToAndCall(regTreasuryDAOV2.address, "0x")
    ).to.emit(regTreasuryDAO, "Upgraded");
  });
});
