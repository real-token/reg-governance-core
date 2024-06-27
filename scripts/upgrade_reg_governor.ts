import { ethers, upgrades } from "hardhat";

async function main() {
  const REGGovernor = await ethers.getContractFactory("REGGovernor");

  await upgrades.upgradeProxy(
    process.env.GOVERNOR_ADDRESS as string, // Proxy address
    REGGovernor,
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
