import fs from "fs";
import { ethers } from "hardhat";
import {
  PROPOSAL_ID_2,
  PROPOSAL_ID_3,
  PROPOSAL_ID_4,
} from "../utils/config/constants";
import { sleep } from "../helpers/helpers";

const NUMBER_VOTERS_PER_BATCH = 350;

const proposal2Voters = JSON.parse(
  fs.readFileSync("./utils/data/proposal-2-voters.json", "utf-8")
);
const proposal3Voters = JSON.parse(
  fs.readFileSync("./utils/data/proposal-3-voters.json", "utf-8")
);
const proposal4Voters = JSON.parse(
  fs.readFileSync("./utils/data/proposal-4-voters.json", "utf-8")
);

export async function registerVotersInBatches(
  proposalId: string,
  voters: string[]
) {
  // Contract address
  const contractAddress = process.env.REG_INCENTIVE_VAULT_ADDRESS as string;

  const contractABI = [
    "function setNewEpoch(uint256 subscriptionStart,uint256 subscriptionEnd,uint256 lockPeriodEnd,address bonusToken,uint256 totalBonus) external",
    "function recordVoteBatchByAdmin(address[] calldata users,uint256 proposalId) external",
  ];

  const signer = await ethers.provider.getSigner();
  console.log("Using wallet: ", await signer.getAddress());

  const contract = new ethers.Contract(contractAddress, contractABI, signer);

  const batches = Math.ceil(voters.length / NUMBER_VOTERS_PER_BATCH);
  console.log(
    "Start registering voters in batches for proposalId: ",
    proposalId
  );

  for (let i = 0; i < batches; i++) {
    try {
      const start = i * NUMBER_VOTERS_PER_BATCH;
      const end = (i + 1) * NUMBER_VOTERS_PER_BATCH;
      const batch = voters.slice(start, end);
      console.log("proposalId:", proposalId);
      console.log(`Registering batch ${i} with ${batch.length} voters`);

      await contract.recordVoteBatchByAdmin(batch, proposalId);

      console.log("Batch registered successfully for proposalId: ", proposalId);

      // Wait for 15s before registering the next batch
      await sleep(15000);
    } catch (error) {
      console.log("Error: ", error);
    }
  }
}

export async function registerVotersForAllProposals() {
  console.log("Registering voters for proposal 2");
  await registerVotersInBatches(PROPOSAL_ID_2, proposal2Voters);

  // Wait for 30s before registering the next proposal
  await sleep(30000);
  console.log("Registering voters for proposal 3");
  await registerVotersInBatches(PROPOSAL_ID_3, proposal3Voters);

  // Wait for 30s before registering the next proposal
  await sleep(30000);
  console.log("Registering voters for proposal 4");
  await registerVotersInBatches(PROPOSAL_ID_4, proposal4Voters);
}

registerVotersForAllProposals();
