import { ethers, upgrades, run } from "hardhat";
import { REGTreasuryDAO } from "../typechain-types";
import { sleep } from "../helpers/helpers";

async function main() {
  const REGTreasuryDAO = await ethers.getContractFactory("REGTreasuryDAO");

  const regTreasuryDAO = (await upgrades.deployProxy(
    REGTreasuryDAO,
    [
      process.env.TIMELOCK_MIN_DELAY, // minDelay = 30 minutes
      [], // no initial proposers
      [], // no initial executors
      process.env.TIMELOCK_DEFAULT_ADMIN,
    ],
    {
      kind: "uups",
    }
  )) as REGTreasuryDAO;

  const regTreasuryDAODeployed = await regTreasuryDAO.deployed();

  const implAddress = await upgrades.erc1967.getImplementationAddress(
    regTreasuryDAODeployed.address
  );

  console.log(`Proxy address deployed: ${regTreasuryDAODeployed.address}`);
  console.log(`Implementation address deployed: ${implAddress}`);

  await sleep(20000); // wait for 20s to have the contract propagated before verifying

  try {
    await run("verify:verify", {
      address: implAddress,
      constructorArguments: [],
    });
  } catch (err) {
    console.log(err);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
