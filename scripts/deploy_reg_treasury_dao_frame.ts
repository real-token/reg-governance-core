import hre, { ethers, upgrades, run } from "hardhat";
import { REGTreasuryDAO } from "../typechain-types";
import { sleep } from "../helpers/helpers";

async function main() {
  const REGTreasuryDAO = await ethers.getContractFactory("REGTreasuryDAO");

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

  const regTreasuryDAO = REGTreasuryDAO.connect(signer);

  const createContractTx = (await upgrades.deployProxy(
    regTreasuryDAO,
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

  const regTreasuryDAODeployed = await createContractTx.deployed();

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
