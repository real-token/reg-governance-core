import hre, { ethers, upgrades } from "hardhat";

async function main() {
  const REGIncentiveVault = await ethers.getContractFactory(
    "REGIncentiveVault"
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

  const regIncentiveVault = REGIncentiveVault.connect(signer);
  console.log(
    "conecting the contract...",
    process.env.REG_INCENTIVE_VAULT_ADDRESS as string,
    hre.network.config.chainId ?? null
  );
  try {
    await upgrades.upgradeProxy(
      process.env.REG_INCENTIVE_VAULT_ADDRESS as string, // Proxy address
      regIncentiveVault,
      { timeout: 0 }
    );
    console.log("The contract is upgraded");
  } catch (error) {
    console.log("Error upgrading the contract: ", error);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
