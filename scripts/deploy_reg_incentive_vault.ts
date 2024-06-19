import { ethers, upgrades, run } from "hardhat";
import { REGIncentiveVault } from "../typechain-types";
import { sleep } from "../helpers/helpers";

async function main() {
  const REGIncentiveVault = await ethers.getContractFactory(
    "REGIncentiveVault"
  );

  const regIncentiveVault = (await upgrades.deployProxy(
    REGIncentiveVault,
    [
      process.env.GOVERNOR_ADDRESS,
      process.env.REG_ADDRESS,
      process.env.INCENTIVE_VAULT_ADMIN,
      process.env.INCENTIVE_VAULT_UPGRADER,
      process.env.INCENTIVE_VAULT_PAUSER,
    ],
    {
      kind: "uups",
    }
  )) as REGIncentiveVault;

  const regIncentiveVaultDeployed = await regIncentiveVault.deployed();

  const implAddress = await upgrades.erc1967.getImplementationAddress(
    regIncentiveVaultDeployed.address
  );

  console.log(`Proxy address deployed: ${regIncentiveVaultDeployed.address}`);
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
