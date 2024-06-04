import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-deploy";
import "hardhat-dependency-compiler";
import "hardhat-contract-sizer";
import networks from "./hardhat.networks";
import * as dotenv from "dotenv";
dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: `shanghai`, // downgrade to `paris` if you encounter 'invalid opcode' error
        },
      },
    ],
  },
  dependencyCompiler: {
    paths: [],
  },
  namedAccounts: {
    deployer: 0,
    admin: 1,
    moderator: 2,
    bridge: 3,
  },
  networks: networks,
  gasReporter: {
    coinmarketcap: process.env.REPORT_GAS,
    gasPrice: 20,
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY as string,
      sepolia: process.env.ETHERSCAN_API_KEY as string,
      gnosis: process.env.GNOSISSCAN_API_KEY as string,
      polygon: process.env.POLYGONSCAN_API_KEY as string,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY as string,
      avalancheFujiTestnet: process.env.AVAXSCAN_API_KEY as string,
    },
  },
};

export default config;
