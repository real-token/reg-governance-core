import hre, { ethers, upgrades, run } from "hardhat";
import { REGVotingPowerRegistry } from "../typechain-types";
import { sleep } from "../helpers/helpers";

async function main() {
  const REGVotingPowerRegistry = await ethers.getContractFactory(
    "REGVotingPowerRegistry"
  );

  const provider = new ethers.providers.JsonRpcProvider(
    "http://127.0.0.1:1248", // RPC FRAME
    {
      chainId: hre.network.config.chainId ?? 11155111,
      name: hre.network.name,
    }
  );
  const signer = provider.getSigner();
  const deployer = await signer.getAddress();
  console.log("Using hardware wallet: ", deployer);

  const regVotingPowerRegistry = REGVotingPowerRegistry.connect(signer);

  const createContractTx = (await upgrades.deployProxy(
    regVotingPowerRegistry,
    [
      process.env.VOTING_DEFAULT_ADMIN,
      process.env.VOTING_REGISTER,
      process.env.VOTING_UPGRADER,
    ],
    {
      kind: "uups",
    }
  )) as REGVotingPowerRegistry;

  const regVotingPowerRegistryDeployed = await createContractTx.deployed();

  const implAddress = await upgrades.erc1967.getImplementationAddress(
    regVotingPowerRegistryDeployed.address
  );

  console.log(
    `Proxy address deployed: ${regVotingPowerRegistryDeployed.address}`
  );
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
