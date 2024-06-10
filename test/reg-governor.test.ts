import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ZERO_ADDRESS } from "../helpers/constants";
import {
  REGGovernor,
  REGVotesRegistry,
  REGTimelockController,
  REGTokenMock,
  VotingPowerStruct,
} from "../typechain-types";

describe("REGGovernor contract", function () {
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

  it("should propose/castVote/queue/execute proposals", async function () {
    // Transfer 10k tokens to TimeLockController
    await regTokenMock
      .connect(admin)
      .transfer(
        regTimelockController.address,
        ethers.utils.parseEther("10000")
      );

    // Register voters
    await regVotesRegistry.connect(register).registerVotingPower(votingStruct2);

    // Propose to transfer 1k tokens to team
    const tokenAddress = regTokenMock.address;
    const teamAddress = register.address;
    const grantAmount = ethers.utils.parseEther("1000");
    const transferCalldata = regTokenMock.interface.encodeFunctionData(
      "transfer",
      [teamAddress, grantAmount]
    );

    await regGovernor
      .connect(admin)
      .grantRole(await regGovernor.PROPOSER_ROLE(), proposer.address);

    await regGovernor
      .connect(proposer)
      .propose(
        [tokenAddress],
        [0],
        [transferCalldata],
        "Proposal #1: Give grant to team"
      );

    const descriptionHash = ethers.utils.id("Proposal #1: Give grant to team");

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
    const minDelay = await regTimelockController.getMinDelay();
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

  it("should revert on upgrade by non-upgrader", async function () {
    await expect(
      regGovernor.connect(deployer).upgradeToAndCall(ZERO_ADDRESS, "0x")
    ).to.be.revertedWithCustomError(
      regGovernor,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should be able to upgrade by upgrader", async function () {
    const REGGovernorV2 = await ethers.getContractFactory("REGGovernor");

    const regGovernorV2 = await REGGovernorV2.deploy();

    await regGovernorV2.deployed();

    await expect(
      regGovernor.connect(admin).upgradeToAndCall(regGovernorV2.address, "0x")
    ).to.emit(regGovernor, "Upgraded");
  });
});

// it("should create and queue a proposal", async function () {
//   const targets = [regVotesRegistry.address];
//   const values = [0];
//   const calldatas = [
//     regVotesRegistry.interface.encodeFunctionData("mint", [
//       voter.address,
//       ethers.utils.parseEther("50"),
//     ]),
//   ];
//   const description = "Proposal #1: Mint tokens to voter";

//   await regGovernor
//     .connect(proposer)
//     .propose(targets, values, calldatas, description);
//   const proposalId = await regGovernor.hashProposal(
//     targets,
//     values,
//     calldatas,
//     ethers.utils.id(description)
//   );

//   await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]); // Increase time to cover voting period
//   await ethers.provider.send("evm_mine", []);
//   await regGovernor
//     .connect(proposer)
//     .queue(targets, values, calldatas, ethers.utils.id(description));
//   expect(await regGovernor.state(proposalId)).to.equal(5); // ProposalQueued
// });

// it("should execute a proposal through TimelockController", async function () {
//   const targets = [regVotesRegistry.address];
//   const values = [0];
//   const calldatas = [
//     regVotesRegistry.interface.encodeFunctionData("mint", [
//       voter.address,
//       ethers.utils.parseEther("50"),
//     ]),
//   ];
//   const description = "Proposal #1: Mint tokens to voter";

//   await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]); // Increase time to cover voting period
//   await ethers.provider.send("evm_mine", []);
//   await regGovernor
//     .connect(proposer)
//     .queue(targets, values, calldatas, ethers.utils.id(description));

//   await ethers.provider.send("evm_increaseTime", [2]); // Timelock delay
//   await ethers.provider.send("evm_mine", []);
//   await regGovernor
//     .connect(proposer)
//     .execute(targets, values, calldatas, ethers.utils.id(description));

//   expect(await regVotesRegistry.balanceOf(voter.address)).to.equal(
//     ethers.utils.parseEther("150")
//   );
// });

// it("should revert on invalid proposal execution attempts", async function () {
//   const targets = [regVotesRegistry.address];
//   const values = [0];
//   const calldatas = [
//     regVotesRegistry.interface.encodeFunctionData("mint", [
//       voter.address,
//       ethers.utils.parseEther("50"),
//     ]),
//   ];
//   const description = "Proposal #2: Mint tokens to voter";

//   await regGovernor
//     .connect(proposer)
//     .propose(targets, values, calldatas, description);
//   const proposalId = await regGovernor.hashProposal(
//     targets,
//     values,
//     calldatas,
//     ethers.utils.id(description)
//   );

//   await expect(
//     regGovernor
//       .connect(proposer)
//       .execute(targets, values, calldatas, ethers.utils.id(description))
//   ).to.be.revertedWith("Governor: proposal not successful");
// });

// it("should support role-based access control for proposal creation", async function () {
//   await expect(
//     regGovernor.connect(voter).propose([], [], [], "Unauthorized Proposal")
//   ).to.be.revertedWith("REGGovernorErrors.ProposerWithoutVotesOrRole");
// });

// it("should allow setting and getting proposer mode", async function () {
//   await regGovernor.connect(deployer).setProposerMode(1); // ProposerWithRole
//   expect(await regGovernor.getProposerMode()).to.equal(1);
// });

// it("should allow setting and getting incentive vault", async function () {
//   await regGovernor.connect(deployer).setRegIncentiveVault(deployer.address);
//   expect(await regGovernor.getRegIncentiveVault()).to.equal(deployer.address);
// });

// it("should record votes in the incentive vault when enabled", async function () {
//   await regGovernor.connect(deployer).setRegIncentiveVault(deployer.address);
//   // Assuming the incentive vault contract is properly set up and integrated, further tests would be conducted here.
// });
