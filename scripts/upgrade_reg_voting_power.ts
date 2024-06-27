import { ethers, upgrades } from "hardhat";

async function main() {
  const REGVotingPowerRegistry = await ethers.getContractFactory(
    "REGVotingPowerRegistry"
  );

  await upgrades.upgradeProxy(
    process.env.VOTING_POWER_REGISTRY_ADDRESS as string, // Proxy address
    REGVotingPowerRegistry,
    { timeout: 0 }
  );

  console.log("The contract is upgraded");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
