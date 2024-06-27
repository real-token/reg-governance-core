import { ethers, upgrades } from "hardhat";

async function main() {
  const REGIncentiveVault = await ethers.getContractFactory(
    "REGIncentiveVault"
  );

  await upgrades.upgradeProxy(
    process.env.REG_INCENTIVE_VAULT_ADDRESS as string, // Proxy address
    REGIncentiveVault,
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
