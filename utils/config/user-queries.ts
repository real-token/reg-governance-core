import { gql } from "graphql-request";

export const GET_REG_GOVERNANCE_VOTERS_QUERY = gql`
  query GetVotersOfProposal($proposalId: String!) {
    voteCasts(where: { proposalId: $proposalId }, first: 1000) {
      voter
    }
  }
`;

export interface Voter {
  voter: string;
}
export interface GetVotersOfProposalResponse {
  voteCasts: Voter[];
}
