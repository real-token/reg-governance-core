import {
  PROPOSAL_ID_2,
  PROPOSAL_ID_3,
  PROPOSAL_ID_4,
} from "./config/constants";
import { getRegGovernanceClient } from "./config/graphql-client";
import {
  GET_REG_GOVERNANCE_VOTERS_QUERY,
  GetVotersOfProposalResponse,
  Voter,
} from "./config/user-queries";
import { writeJson } from "./config/utils";

export async function getVotersOfProposal(
  proposalId: string
): Promise<GetVotersOfProposalResponse> {
  let data: GetVotersOfProposalResponse = { voteCasts: [] };
  try {
    data = await getRegGovernanceClient()?.request(
      GET_REG_GOVERNANCE_VOTERS_QUERY,
      { proposalId }
    );
    return data;
  } catch (error) {
    console.error("Error fetching voters of proposal", error);
  }
  return data;
}

export async function transformVotersOfProposal(
  proposalId: string
): Promise<string[]> {
  const voters = await getVotersOfProposal(proposalId);
  const voterList = voters.voteCasts.map((voter: Voter) => voter.voter);
  return voterList;
}

export async function writeVotersOfProposal(
  proposalId: string,
  fileName: string
) {
  const voterList = await transformVotersOfProposal(proposalId);
  writeJson(`./utils/data/${fileName}.json`, voterList);
  console.log(`Proposal ${proposalId} has ${voterList.length} voters`);
  console.log(voterList);
}

writeVotersOfProposal(PROPOSAL_ID_2, "proposal-2-voters");
writeVotersOfProposal(PROPOSAL_ID_3, "proposal-3-voters");
writeVotersOfProposal(PROPOSAL_ID_4, "proposal-4-voters");
