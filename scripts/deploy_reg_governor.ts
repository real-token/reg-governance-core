import { ethers, upgrades, run } from "hardhat";
import { REGGovernor } from "../typechain-types";
import { sleep } from "../helpers/helpers";

async function main() {
  const REGGovernor = await ethers.getContractFactory("REGGovernor");

  const regGovernor = (await upgrades.deployProxy(
    REGGovernor,
    [
      process.env.GOVERNOR_TOKEN,
      process.env.GOVERNOR_TIMELOCK,
      process.env.GOVERNOR_DEFAULT_ADMIN,
    ],
    {
      kind: "uups",
    }
  )) as REGGovernor;

  const regGovernorDeployed = await regGovernor.deployed();

  const implAddress = await upgrades.erc1967.getImplementationAddress(
    regGovernorDeployed.address
  );

  console.log(`Proxy address deployed: ${regGovernorDeployed.address}`);
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
