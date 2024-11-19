import { GraphQLClient } from "graphql-request";
import { REG_GOVERNANCE_GNOSIS } from "./constants";

export const getRegGovernanceClient = (): GraphQLClient => {
  return new GraphQLClient(REG_GOVERNANCE_GNOSIS);
};
