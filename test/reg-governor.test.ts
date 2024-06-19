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
  VotingPowerStruct,
} from "../typechain-types";

describe("REGGovernor contract", function () {
  async function deployGovernanceFixture() {
    let regGovernor: REGGovernor;
    let regVotingPowerRegistry: REGVotingPowerRegistry;
    let regTreasuryDAO: REGTreasuryDAO;
    let regIncentiveVault: REGIncentiveVault;
    let regTokenMock: REGTokenMock;
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

    const votingDelay = await regGovernor.votingDelay();
    const votingPeriod = await regGovernor.votingPeriod();
    const minDelay = await regTreasuryDAO.getMinDelay();

    return {
      regGovernor,
      regVotingPowerRegistry,
      regTreasuryDAO,
      regTokenMock,
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
    const { regGovernor, admin } = await loadFixture(deployGovernanceFixture);
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

  it("should revert without governance votes: setProposerMode/setIncentiveEnabled/setRegIncentiveVault", async function () {
    const { regGovernor, admin } = await loadFixture(deployGovernanceFixture);

    await expect(regGovernor.connect(admin).setProposerMode(1))
      .to.be.revertedWithCustomError(regGovernor, "GovernorOnlyExecutor")
      .withArgs(admin.address);

    await expect(regGovernor.connect(admin).setIncentiveEnabled(true))
      .to.be.revertedWithCustomError(regGovernor, "GovernorOnlyExecutor")
      .withArgs(admin.address);

    await expect(regGovernor.connect(admin).setRegIncentiveVault(admin.address))
      .to.be.revertedWithCustomError(regGovernor, "GovernorOnlyExecutor")
      .withArgs(admin.address);
  });

  it("should propose with mode ProposerWithRole", async function () {
    const { regTokenMock, regGovernor, admin, proposer, register } =
      await loadFixture(deployGovernanceFixture);

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
    ).to.be.revertedWithCustomError(regGovernor, "InvalidProposerWithRole");

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    await expect(
      regGovernor
        .connect(proposer)
        .propose([regTokenMock.address], [0], [transferCalldata], description)
    ).to.emit(regGovernor, "ProposalCreated");
  });

  it("should propose with mode ProposerWithVotingPower", async function () {
    const {
      regTokenMock,
      regGovernor,
      regVotingPowerRegistry,
      admin,
      proposer,
      register,
      voters,
      votingStruct2,
      votingDelay,
      votingPeriod,
      minDelay,
    } = await loadFixture(deployGovernanceFixture);

    expect(await regGovernor.getProposerMode()).to.equal(0);

    // Propose to change proposer mode to ProposerWithVotingPower
    const transferCalldata = regGovernor.interface.encodeFunctionData(
      "setProposerMode",
      [1]
    );

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct2);

    const description = "Proposal #1: Change mode to ProposerWithVotingPower";

    await expect(
      regGovernor
        .connect(proposer)
        .propose([regGovernor.address], [0], [transferCalldata], description)
    ).to.emit(regGovernor, "ProposalCreated");

    const proposalId = await regGovernor.hashProposal(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    expect(await regGovernor.proposalNeedsQueuing(proposalId)).to.equal(true);

    await time.increase(votingDelay);

    await regGovernor.connect(voters[0]).castVote(proposalId, 1);

    await time.increase(votingPeriod);

    await regGovernor.queue(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await time.increase(minDelay);

    await regGovernor.execute(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    expect(await regGovernor.getProposerMode()).to.equal(1);

    console.log(
      "voting power",
      await regVotingPowerRegistry.getVotes(voters[0].address)
    );

    // voters[1] has no voting power to create proposal
    await expect(
      regGovernor
        .connect(voters[1])
        .propose(
          [regGovernor.address],
          [0],
          [transferCalldata],
          "Proposal #2: Give grant to team"
        )
    ).to.revertedWithCustomError(regGovernor, "InvalidProposerWithVotingPower");

    // voters[1] has voting power to create proposal
    await expect(
      regGovernor
        .connect(voters[0])
        .propose(
          [regGovernor.address],
          [0],
          [transferCalldata],
          "Proposal #2: Give grant to team"
        )
    ).to.emit(regGovernor, "ProposalCreated");
  });

  it("should propose with mode ProposerWithRoleAndVotingPower", async function () {
    const {
      regGovernor,
      regVotingPowerRegistry,
      admin,
      proposer,
      register,
      voters,
      votingStruct1,
      votingDelay,
      votingPeriod,
      minDelay,
    } = await loadFixture(deployGovernanceFixture);

    expect(await regGovernor.getProposerMode()).to.equal(0);

    // Propose to change proposer mode to ProposerWithVotingPower
    const transferCalldata = regGovernor.interface.encodeFunctionData(
      "setProposerMode",
      [2]
    );

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    const description = "Proposal #1: Change mode to ProposerWithVotingPower";

    await expect(
      regGovernor
        .connect(proposer)
        .propose([regGovernor.address], [0], [transferCalldata], description)
    ).to.emit(regGovernor, "ProposalCreated");

    await time.increase(votingDelay);

    const proposalId = await regGovernor.hashProposal(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await regGovernor.connect(voters[0]).castVote(proposalId, 1);

    await time.increase(votingPeriod);

    await regGovernor.queue(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await time.increase(minDelay);

    await regGovernor.execute(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    expect(await regGovernor.getProposerMode()).to.equal(2);

    console.log(
      "voting power",
      await regVotingPowerRegistry.getVotes(voters[0].address)
    );

    // voters[0] has no PROPOSER_ROLE to create proposal
    await expect(
      regGovernor
        .connect(voters[0])
        .propose(
          [regGovernor.address],
          [0],
          [transferCalldata],
          "Proposal #2: Give grant to team"
        )
    ).to.revertedWithCustomError(
      regGovernor,
      "InvalidProposerWithRoleAndVotingPower"
    );

    // Proposer has no voting power to create proposal
    await expect(
      regGovernor
        .connect(proposer)
        .propose(
          [regGovernor.address],
          [0],
          [transferCalldata],
          "Proposal #2: Give grant to team"
        )
    ).to.revertedWithCustomError(
      regGovernor,
      "InvalidProposerWithRoleAndVotingPower"
    );

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), voters[0].address);

    // voters[0] has voting power + PROPOSER_ROLE to create proposal
    await expect(
      regGovernor
        .connect(voters[0])
        .propose(
          [regGovernor.address],
          [0],
          [transferCalldata],
          "Proposal #2: Give grant to team"
        )
    ).to.emit(regGovernor, "ProposalCreated");
  });

  it("should propose with mode ProposerWithRoleOrVotingPower", async function () {
    const {
      regTokenMock,
      regGovernor,
      regVotingPowerRegistry,
      admin,
      proposer,
      register,
      voters,
      votingStruct1,
      votingDelay,
      votingPeriod,
      minDelay,
    } = await loadFixture(deployGovernanceFixture);

    expect(await regGovernor.getProposerMode()).to.equal(0);

    // Propose to change proposer mode to ProposerWithVotingPower
    const transferCalldata = regGovernor.interface.encodeFunctionData(
      "setProposerMode",
      [3]
    );

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    const description = "Proposal #1: Change mode to ProposerWithVotingPower";

    await expect(
      regGovernor
        .connect(proposer)
        .propose([regGovernor.address], [0], [transferCalldata], description)
    ).to.emit(regGovernor, "ProposalCreated");

    await time.increase(votingDelay);

    const proposalId = await regGovernor.hashProposal(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await regGovernor.connect(voters[0]).castVote(proposalId, 1);

    await time.increase(votingPeriod);

    await regGovernor.queue(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await time.increase(minDelay);

    await regGovernor.execute(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    expect(await regGovernor.getProposerMode()).to.equal(3);

    console.log(
      "voting power",
      await regVotingPowerRegistry.getVotes(voters[0].address)
    );

    // voters[0] has no PROPOSER_ROLE or voting power to create proposal
    await expect(
      regGovernor
        .connect(voters[1])
        .propose(
          [regGovernor.address],
          [0],
          [transferCalldata],
          "Proposal #2: Give grant to team"
        )
    ).to.revertedWithCustomError(
      regGovernor,
      "InvalidProposerWithRoleOrVotingPower"
    );

    // voters[0] has voting power to create proposal
    await expect(
      regGovernor
        .connect(voters[0])
        .propose(
          [regGovernor.address],
          [0],
          [transferCalldata],
          "Proposal #2: Give grant to team"
        )
    ).to.emit(regGovernor, "ProposalCreated");

    // proposer has PROPOSER_ROLE to create proposal
    await expect(
      regGovernor
        .connect(voters[0])
        .propose(
          [regGovernor.address],
          [0],
          [transferCalldata],
          "Proposal #3: Give grant to team"
        )
    ).to.emit(regGovernor, "ProposalCreated");
  });

  it("should propose then cancelByAdmin", async function () {
    const { regTokenMock, regGovernor, admin, proposer, register } =
      await loadFixture(deployGovernanceFixture);

    // Propose to transfer 1k tokens to team
    const transferCalldata = regTokenMock.interface.encodeFunctionData(
      "transfer",
      [register.address, ethers.utils.parseEther("1000")]
    );
    const description = "Proposal #1: Give grant to team";

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

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

    await expect(
      regGovernor
        .connect(admin)
        .cancelByAdmin(
          [regTokenMock.address],
          [0],
          [transferCalldata],
          ethers.utils.id(description)
        )
    ).to.revertedWithCustomError(
      regGovernor,
      "AccessControlUnauthorizedAccount"
    );

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.CANCELLER_ROLE(), admin.address);

    await expect(
      regGovernor
        .connect(admin)
        .cancelByAdmin(
          [regTokenMock.address],
          [0],
          [transferCalldata],
          ethers.utils.id(description)
        )
    )
      .to.emit(regGovernor, "ProposalCanceled")
      .withArgs(proposalId);
  });

  it("should setIncentiveEnabled through governance votes", async function () {
    const {
      regGovernor,
      regVotingPowerRegistry,
      admin,
      proposer,
      register,
      voters,
      votingStruct1,
      votingDelay,
      votingPeriod,
      minDelay,
    } = await loadFixture(deployGovernanceFixture);

    expect(await regGovernor.getIncentiveEnabled()).to.equal(false);
    console.log(
      "getIncentiveEnabled before vote",
      await regGovernor.getIncentiveEnabled()
    );

    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    // Propose to change setIncentiveEnabled
    const transferCalldata = regGovernor.interface.encodeFunctionData(
      "setIncentiveEnabled",
      [true]
    );
    const description = "Proposal #1: Enable incentive";

    await expect(
      regGovernor
        .connect(proposer)
        .propose([regGovernor.address], [0], [transferCalldata], description)
    ).to.emit(regGovernor, "ProposalCreated");

    await time.increase(votingDelay);

    const proposalId = await regGovernor.hashProposal(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await regGovernor.connect(voters[0]).castVote(proposalId, 1);

    await time.increase(votingPeriod);

    await regGovernor.queue(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await time.increase(minDelay);

    await regGovernor.execute(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    expect(await regGovernor.getIncentiveEnabled()).to.equal(true);
    console.log(
      "getIncentiveEnabled after vote",
      await regGovernor.getIncentiveEnabled()
    );
  });

  it("should setRegIncentiveVault through governance votes", async function () {
    const {
      regGovernor,
      regVotingPowerRegistry,
      regIncentiveVault,
      admin,
      proposer,
      register,
      voters,
      votingStruct1,
      votingDelay,
      votingPeriod,
      minDelay,
    } = await loadFixture(deployGovernanceFixture);

    expect(await regGovernor.getRegIncentiveVault()).to.equal(ZERO_ADDRESS);
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
    const transferCalldata = regGovernor.interface.encodeFunctionData(
      "setRegIncentiveVault",
      [regIncentiveVault.address]
    );
    const description = "Proposal #1: Set REG incentive vault";

    await expect(
      regGovernor
        .connect(proposer)
        .propose([regGovernor.address], [0], [transferCalldata], description)
    ).to.emit(regGovernor, "ProposalCreated");

    await time.increase(votingDelay);

    const proposalId = await regGovernor.hashProposal(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await regGovernor.connect(voters[0]).castVote(proposalId, 1);

    await time.increase(votingPeriod);

    await regGovernor.queue(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await time.increase(minDelay);

    await regGovernor.execute(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    expect(await regGovernor.getRegIncentiveVault()).to.equal(
      regIncentiveVault.address
    );
    console.log(
      "getIncentiveEnabled after vote",
      await regGovernor.getRegIncentiveVault()
    );
  });

  it("should setProposalThreshold through governance votes", async function () {
    const {
      regGovernor,
      regVotingPowerRegistry,
      admin,
      proposer,
      register,
      voters,
      votingStruct1,
      votingDelay,
      votingPeriod,
      minDelay,
    } = await loadFixture(deployGovernanceFixture);

    console.log(
      "proposalThreshold before vote",
      await regGovernor.proposalThreshold()
    );

    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    // Propose to change setIncentiveEnabled
    const transferCalldata = regGovernor.interface.encodeFunctionData(
      "setProposalThreshold",
      [0]
    );
    console.log("transferCalldata", transferCalldata);
    const description = "Proposal #1: Set proposal threshold to 0";

    await expect(
      regGovernor
        .connect(proposer)
        .propose([regGovernor.address], [0], [transferCalldata], description)
    ).to.emit(regGovernor, "ProposalCreated");

    await time.increase(votingDelay);

    const proposalId = await regGovernor.hashProposal(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );
    console.log("descriptionHash", ethers.utils.id(description));
    console.log("proposalId", proposalId);

    await regGovernor.connect(voters[0]).castVote(proposalId, 1);

    await time.increase(votingPeriod);

    await regGovernor.queue(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    await time.increase(minDelay);

    await regGovernor.execute(
      [regGovernor.address],
      [0],
      [transferCalldata],
      ethers.utils.id(description)
    );

    console.log(
      "proposalThreshold after vote",
      await regGovernor.proposalThreshold()
    );
  });

  it("should propose/castVote/queue/execute proposals", async function () {
    const {
      regTokenMock,
      regGovernor,
      regVotingPowerRegistry,
      regTreasuryDAO,
      admin,
      proposer,
      register,
      voters,
      votingStruct1,
    } = await loadFixture(deployGovernanceFixture);

    // Transfer 10k tokens to TimeLockController
    await regTokenMock
      .connect(admin)
      .transfer(regTreasuryDAO.address, ethers.utils.parseEther("10000"));

    // Register voters
    await regVotingPowerRegistry
      .connect(register)
      .registerVotingPower(votingStruct1);

    // Propose to transfer 1k tokens to team
    const tokenAddress = regTokenMock.address;
    const teamAddress = register.address;
    const grantAmount = ethers.utils.parseEther("1000");
    const transferCalldata = regTokenMock.interface.encodeFunctionData(
      "transfer",
      [teamAddress, grantAmount]
    );
    const description = "Proposal #1: Give grant to team";

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    await regGovernor
      .connect(proposer)
      .propose([tokenAddress], [0], [transferCalldata], description);

    const descriptionHash = ethers.utils.id(description);

    const proposalId = await regGovernor.hashProposal(
      [tokenAddress],
      [0],
      [transferCalldata],
      descriptionHash
    );

    // Increase time to cover voting period
    const proposeTime = await time.latest();
    const votingDelay = await regGovernor.votingDelay();
    const votingPeriod = await regGovernor.votingPeriod();

    await time.increase(votingDelay);

    console.log("proposeTime", proposeTime.toString());
    console.log("votingDelay", votingDelay.toString());
    console.log("votingPeriod", votingPeriod.toString());
    console.log("voting start: ", (await time.latest()).toString());

    // Cast Vote
    await regGovernor.connect(voters[0]).castVote(proposalId, 1);

    console.log("proposalId", proposalId.toString());
    console.log("descriptionHash", descriptionHash.toString());
    console.log(
      "proposalVotes",
      await regGovernor.proposalVotes(proposalId.toString())
    );

    // Increase time to cover voting period
    await time.increase(votingPeriod);
    console.log("voting end: ", (await time.latest()).toString());

    // Queue
    await regGovernor.queue(
      [tokenAddress],
      [0],
      [transferCalldata],
      descriptionHash
    );

    // Increase time to cover voting period
    const minDelay = await regTreasuryDAO.getMinDelay();
    await time.increase(minDelay);
    console.log("minDelay", minDelay.toString());
    console.log("queue end: ", (await time.latest()).toString());

    // Execute
    await regGovernor.execute(
      [tokenAddress],
      [0],
      [transferCalldata],
      descriptionHash
    );
  });

  it("should check supportInterface", async function () {
    const { regGovernor } = await loadFixture(deployGovernanceFixture);

    expect(await regGovernor.supportsInterface("0x01ffc9a7")).to.be.true; // type(IERC165).interfaceId = type(IERC165Upgradeable).interfaceId
    expect(await regGovernor.supportsInterface("0x7965db0b")).to.be.true; // type(IAccessControlUpgradeable).interfaceId
  });

  it("should revert on upgrade by non-upgrader", async function () {
    const { regGovernor, deployer } = await loadFixture(
      deployGovernanceFixture
    );

    await expect(
      regGovernor.connect(deployer).upgradeToAndCall(ZERO_ADDRESS, "0x")
    ).to.be.revertedWithCustomError(
      regGovernor,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should be able to upgrade by upgrader", async function () {
    const { regGovernor, admin } = await loadFixture(deployGovernanceFixture);

    const REGGovernorV2 = await ethers.getContractFactory("REGGovernor");

    const regGovernorV2 = await REGGovernorV2.deploy();

    await regGovernorV2.deployed();

    await expect(
      regGovernor.connect(admin).upgradeToAndCall(regGovernorV2.address, "0x")
    ).to.emit(regGovernor, "Upgraded");
  });
});
