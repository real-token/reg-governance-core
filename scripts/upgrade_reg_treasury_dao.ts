import { ethers, upgrades } from "hardhat";

async function main() {
  const REGTreasuryDAO = await ethers.getContractFactory("REGTreasuryDAO");

  await upgrades.upgradeProxy(
    process.env.TREASURY_DAO_ADDRESS as string, // Proxy address
    REGTreasuryDAO,
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
