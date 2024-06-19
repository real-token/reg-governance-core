import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ZERO_ADDRESS } from "../helpers/constants";
import {
  REGGovernor,
  REGVotingPowerRegistry,
  REGTreasuryDAO,
  REGIncentiveVault,
  REGTokenMock,
  USDCTokenMock,
  VotingPowerStruct,
} from "../typechain-types";

describe("REGIncentiveVault contract", function () {
  async function deployGovernanceFixture() {
    let regGovernor: REGGovernor;
    let regVotingPowerRegistry: REGVotingPowerRegistry;
    let regTreasuryDAO: REGTreasuryDAO;
    let regIncentiveVault: REGIncentiveVault;
    let regTokenMock: REGTokenMock;
    let usdcTokenMock: USDCTokenMock;
    let deployer: any;
    let admin: any;
    let executor: any;
    let proposer: any;
    let register: any;
    let voters: any;
    let votingStruct1: VotingPowerStruct;
    let votingStruct2: VotingPowerStruct;

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

    const REGTokenMock = await ethers.getContractFactory("REGTokenMock");
    regTokenMock = (await REGTokenMock.deploy(admin.address)) as REGTokenMock;
    await regTokenMock.deployed();

    const USDCTokenMock = await ethers.getContractFactory("USDCTokenMock");
    usdcTokenMock = (await USDCTokenMock.deploy(
      admin.address
    )) as USDCTokenMock;
    await usdcTokenMock.deployed();

    const REGIncentiveVaultFactory = await ethers.getContractFactory(
      "REGIncentiveVault"
    );
    regIncentiveVault = (await upgrades.deployProxy(
      REGIncentiveVaultFactory,
      [
        regGovernor.address, // governor
        regTokenMock.address, // REG token
        admin.address, // default admin
        admin.address, // pauser role
        admin.address, // upgrader admin
      ],
      {
        initializer: "initialize",
      }
    )) as REGIncentiveVault;

    await regTreasuryDAO
      .connect(admin)
      .grantRole(await regTreasuryDAO.EXECUTOR_ROLE(), regGovernor.address);
    await regTreasuryDAO
      .connect(admin)
      .grantRole(await regTreasuryDAO.PROPOSER_ROLE(), regGovernor.address);

    votingStruct1 = [[voters[0].address, ethers.utils.parseEther("3000")]];

    votingStruct2 = [
      [proposer.address, ethers.utils.parseEther("3000")],
      [voters[0].address, ethers.utils.parseEther("3000")],
    ];

    // Bonus 10k USDC
    const USDC_BONUS = ethers.utils.parseEther("10000");

    await usdcTokenMock
      .connect(admin)
      .mint(regIncentiveVault.address, USDC_BONUS);

    const VOTER0_TOKENS = ethers.utils.parseEther("1000");
    const VOTER1_TOKENS = ethers.utils.parseEther("3000");
    const VOTER2_TOKENS = ethers.utils.parseEther("5000");

    const votingDelay = await regGovernor.votingDelay();
    const votingPeriod = await regGovernor.votingPeriod();
    const minDelay = await regTreasuryDAO.getMinDelay();

    // Step 1: Pre-set Incentive Vault and enable incentive
    expect(await regGovernor.getIncentiveEnabled()).to.equal(false);
    expect(await regGovernor.getRegIncentiveVault()).to.equal(ZERO_ADDRESS);

    console.log(
      "getIncentiveEnabled before vote",
      await regGovernor.getIncentiveEnabled()
    );
    console.log(
      "getRegIncentiveVault before vote",
      await regGovernor.getRegIncentiveVault()
    );

    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    // Propose to change setIncentiveEnabled
    const transferCalldata1 = regGovernor.interface.encodeFunctionData(
      "setIncentiveEnabled",
      [true]
    );
    // Propose to change setIncentiveEnabled
    const transferCalldata2 = regGovernor.interface.encodeFunctionData(
      "setRegIncentiveVault",
      [regIncentiveVault.address]
    );

    const description =
      "Proposal #1: Enable incentive and Set REG incentive vault";

    await expect(
      regGovernor
        .connect(proposer)
        .propose(
          [regGovernor.address, regGovernor.address],
          [0, 0],
          [transferCalldata1, transferCalldata2],
          description
        )
    ).to.emit(regGovernor, "ProposalCreated");

    await time.increase(votingDelay);

    const proposalId = await regGovernor.hashProposal(
      [regGovernor.address, regGovernor.address],
      [0, 0],
      [transferCalldata1, transferCalldata2],
      ethers.utils.id(description)
    );

    await regGovernor.connect(voters[0]).castVote(proposalId, 1);

    await time.increase(votingPeriod);

    await regGovernor.queue(
      [regGovernor.address, regGovernor.address],
      [0, 0],
      [transferCalldata1, transferCalldata2],
      ethers.utils.id(description)
    );

    await time.increase(minDelay);

    await regGovernor.execute(
      [regGovernor.address, regGovernor.address],
      [0, 0],
      [transferCalldata1, transferCalldata2],
      ethers.utils.id(description)
    );

    expect(await regGovernor.getIncentiveEnabled()).to.equal(true);
    expect(await regGovernor.getRegIncentiveVault()).to.equal(
      regIncentiveVault.address
    );

    console.log(
      "getIncentiveEnabled after vote",
      await regGovernor.getIncentiveEnabled()
    );
    console.log(
      "getIncentiveEnabled after vote",
      await regGovernor.getRegIncentiveVault()
    );

    return {
      regGovernor,
      regVotingPowerRegistry,
      regTreasuryDAO,
      regTokenMock,
      usdcTokenMock,
      regIncentiveVault,
      deployer,
      admin,
      executor,
      proposer,
      register,
      voters,
      votingStruct1,
      votingStruct2,
      votingDelay,
      votingPeriod,
      minDelay,
      USDC_BONUS,
      VOTER0_TOKENS,
      VOTER1_TOKENS,
      VOTER2_TOKENS,
    };
  }

  it("should initialize the right default admin and upgrader role", async function () {
    const { regGovernor, admin } = await loadFixture(deployGovernanceFixture);

    expect(
      await regGovernor.hasRole(
        await regGovernor.DEFAULT_ADMIN_ROLE(),
        admin.address
      )
    ).to.be.true;
    expect(
      await regGovernor.hasRole(
        await regGovernor.UPGRADER_ROLE(),
        admin.address
      )
    ).to.be.true;
  });

  it("should initialize the right parameters", async function () {
    const { regIncentiveVault, regGovernor, regTokenMock, voters } =
      await loadFixture(deployGovernanceFixture);

    expect(await regIncentiveVault.getRegGovernor()).to.equal(
      regGovernor.address
    );

    expect(await regIncentiveVault.getRegToken()).to.equal(
      regTokenMock.address
    );

    expect(await regIncentiveVault.getCurrentEpoch()).to.equal(0);

    expect(await regIncentiveVault.getCurrentTotalDeposit()).to.equal(0);

    // expect(await regIncentiveVault.getUserEpochState(voters[0], 0)).to.equal(0);

    // expect(await regIncentiveVault.getUserGlobalState(voters[0])).to.equal(0);

    // expect(await regIncentiveVault.getEpochState(0)).to.equal(0);

    console.log(
      "getUserEpochState: ",
      await regIncentiveVault.getUserEpochState(voters[0].address, 0)
    );
    console.log(
      "getUserGlobalState: ",
      await regIncentiveVault.getUserGlobalState(voters[0].address)
    );
    console.log("getEpochState: ", await regIncentiveVault.getEpochState(0));

    expect(await regIncentiveVault.paused()).to.equal(false);
  });

  it("should revert on re-calling initialize", async function () {
    const { regGovernor, admin, regVotingPowerRegistry, regTreasuryDAO } =
      await loadFixture(deployGovernanceFixture);
    await expect(
      regGovernor.connect(admin).initialize(
        regVotingPowerRegistry.address, // ERC20Votes
        regTreasuryDAO.address, // TimelockController
        admin.address // default admin
      )
    ).to.be.revertedWithCustomError(regGovernor, "InvalidInitialization");
  });

  it("should be able to pause/unpause the REGIncentiveVault contract", async function () {
    const { regIncentiveVault, admin } = await loadFixture(
      deployGovernanceFixture
    );

    expect(await regIncentiveVault.paused()).to.be.false;
    await regIncentiveVault.connect(admin).pause();
    expect(await regIncentiveVault.paused()).to.be.true;
    await regIncentiveVault.connect(admin).unpause();
    expect(await regIncentiveVault.paused()).to.be.false;
  });

  it("should be able to setRegGovernor/setRegToken in the REGIncentiveVault contract", async function () {
    const { regIncentiveVault, regGovernor, regTokenMock, admin } =
      await loadFixture(deployGovernanceFixture);

    await expect(
      regIncentiveVault.connect(admin).setRegGovernor(regGovernor.address)
    )
      .to.emit(regIncentiveVault, "SetRegGovernor")
      .withArgs(regGovernor.address);

    await expect(
      regIncentiveVault.connect(admin).setRegToken(regTokenMock.address)
    )
      .to.emit(regIncentiveVault, "SetRegToken")
      .withArgs(regTokenMock.address);
  });

  it("should setIncentiveVault then record", async function () {
    const {
      regGovernor,
      regVotingPowerRegistry,
      regIncentiveVault,
      regTokenMock,
      usdcTokenMock,
      admin,
      proposer,
      register,
      voters,
      votingDelay,
      votingPeriod,
      minDelay,
      USDC_BONUS,
      VOTER0_TOKENS,
      VOTER1_TOKENS,
      VOTER2_TOKENS,
    } = await loadFixture(deployGovernanceFixture);

    // Set up the epoch
    const subscriptionStart = (await time.latest()) + 60 * 60 * 24 * 1; // 1 days;
    const subscriptionEnd = subscriptionStart + 60 * 60 * 24 * 2; // 1 days
    const lockPeriodEnd = subscriptionEnd + 60 * 60 * 24 * 7; // 7 days

    await expect(
      regIncentiveVault
        .connect(admin)
        .setNewEpoch(
          subscriptionStart,
          subscriptionEnd,
          lockPeriodEnd,
          usdcTokenMock.address,
          USDC_BONUS
        )
    )
      .to.emit(regIncentiveVault, "SetNewEpoch")
      .withArgs(
        subscriptionStart,
        subscriptionEnd,
        lockPeriodEnd,
        usdcTokenMock.address,
        USDC_BONUS,
        1
      );

    // Mint token to voters
    await regTokenMock.connect(admin).mint(voters[0].address, VOTER0_TOKENS);
    await regTokenMock.connect(admin).mint(voters[1].address, VOTER1_TOKENS);
    await regTokenMock.connect(admin).mint(voters[2].address, VOTER2_TOKENS);

    // Approve
    await regTokenMock
      .connect(voters[0])
      .approve(regIncentiveVault.address, VOTER0_TOKENS);
    await regTokenMock
      .connect(voters[1])
      .approve(regIncentiveVault.address, VOTER1_TOKENS);
    await regTokenMock
      .connect(voters[2])
      .approve(regIncentiveVault.address, VOTER2_TOKENS);

    // Increase time to subscriptionStart
    await time.increase(60 * 60 * 24 * 1); // 1 days

    // Deposit
    await expect(regIncentiveVault.connect(voters[0]).deposit(VOTER0_TOKENS))
      .to.emit(regIncentiveVault, "Deposit")
      .withArgs(voters[0].address, VOTER0_TOKENS, 1);
    await expect(regIncentiveVault.connect(voters[1]).deposit(VOTER1_TOKENS))
      .to.emit(regIncentiveVault, "Deposit")
      .withArgs(voters[1].address, VOTER1_TOKENS, 1);
    await expect(regIncentiveVault.connect(voters[2]).deposit(VOTER2_TOKENS))
      .to.emit(regIncentiveVault, "Deposit")
      .withArgs(voters[2].address, VOTER2_TOKENS, 1);

    console.log(
      "getUserEpochState 0 before lock: ",
      await regIncentiveVault.getUserEpochState(voters[0].address, 1)
    );
    console.log(
      "getUserEpochState 1 before lock: ",
      await regIncentiveVault.getUserEpochState(voters[1].address, 1)
    );

    // Increase time to subscriptionEnd
    await time.increase(60 * 60 * 24 * 2); // 2 days

    // Propose to transfer 1k tokens to team
    const transferCalldata = regTokenMock.interface.encodeFunctionData(
      "transfer",
      [register.address, ethers.utils.parseEther("1000")]
    );
    const description = "Proposal #1: Give grant to team";
    await expect(
      regGovernor
        .connect(proposer)
        .propose([regTokenMock.address], [0], [transferCalldata], description)
    ).to.emit(regGovernor, "ProposalCreated");

    const proposalId = await regGovernor.hashProposal(
      [regTokenMock.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    // Cast vote
    await time.increase(votingDelay);
    await regGovernor.connect(voters[0]).castVote(proposalId, 1);
    await regGovernor.connect(voters[1]).castVote(proposalId, 1);

    // // Queue
    // await time.increase(votingPeriod);
    // await regGovernor.queue(
    //   [regGovernor.address],
    //   [0],
    //   [transferCalldata],
    //   ethers.utils.id(description)
    // );

    // // Execute
    // await time.increase(minDelay);
    // await regGovernor.execute(
    //   [regGovernor.address],
    //   [0],
    //   [transferCalldata],
    //   ethers.utils.id(description)
    // );

    // Calculate reward
    console.log(
      "getUserEpochState 0 after lock: ",
      await regIncentiveVault.getUserEpochState(voters[0].address, 1)
    );
    console.log(
      "getUserEpochState 1 after lock: ",
      await regIncentiveVault.getUserEpochState(voters[1].address, 1)
    );
    console.log(
      "getEpochState after lock: ",
      await regIncentiveVault.getEpochState(1)
    );

    // Increase time to lockPeriodEnd
    // await time.increase(60 * 60 * 24 * 7); // 7 days
    console.log("lockPeriodEnd", lockPeriodEnd);
    console.log("latest", await time.latest());
    console.log(
      "calculateBonus",
      await regIncentiveVault.calculateBonus(voters[0].address)
    );

    console.log(
      "calculateBonus",
      await regIncentiveVault.calculateBonus(voters[1].address)
    );
    console.log(
      "getUserGlobalState",
      await regIncentiveVault.getUserGlobalState(voters[0].address)
    );
    console.log(
      "getUserEpochState",
      await regIncentiveVault.getUserEpochState(voters[0].address, 1)
    );

    // Withdraw
    await time.increase(60 * 60 * 24 * 7); // 7 days
    await expect(regIncentiveVault.connect(voters[0]).withdraw())
      .to.emit(regIncentiveVault, "Withdraw")
      .withArgs(voters[0].address, VOTER0_TOKENS, 1);

    console.log(
      "getUserGlobalState after withdraw:",
      await regIncentiveVault.getUserGlobalState(voters[0].address)
    );
    console.log(
      "getUserEpochState after withdraw:",
      await regIncentiveVault.getUserEpochState(voters[0].address, 1)
    );
    console.log(
      "getEpochState after withdraw:",
      await regIncentiveVault.getEpochState(1)
    );
    console.log(
      "getCurrentTotalDeposit after withdraw:",
      await regIncentiveVault.getCurrentTotalDeposit()
    );

    // Claim bonus
    await expect(regIncentiveVault.connect(voters[1]).claimBonus()).to.emit(
      regIncentiveVault,
      "ClaimBonus"
    );
  });

  it("should revert on upgrade by non-upgrader", async function () {
    const { regIncentiveVault, deployer } = await loadFixture(
      deployGovernanceFixture
    );

    await expect(
      regIncentiveVault.connect(deployer).upgradeToAndCall(ZERO_ADDRESS, "0x")
    ).to.be.revertedWithCustomError(
      regIncentiveVault,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should be able to upgrade by upgrader", async function () {
    const { regIncentiveVault, admin } = await loadFixture(
      deployGovernanceFixture
    );

    const REGIncentiveVaultV2 = await ethers.getContractFactory(
      "REGIncentiveVault"
    );

    const regIncentiveVaultV2 = await REGIncentiveVaultV2.deploy();

    await regIncentiveVaultV2.deployed();

    await expect(
      regIncentiveVault
        .connect(admin)
        .upgradeToAndCall(regIncentiveVaultV2.address, "0x")
    ).to.emit(regIncentiveVault, "Upgraded");
  });
});
