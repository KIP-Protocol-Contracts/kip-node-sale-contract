import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  networks: {
    arb: {
      url: process.env.ARBITRUM_MAINNET_PROVIDER || "",
      accounts:
        process.env.MAINNET_DEPLOYER !== undefined
          ? [process.env.MAINNET_DEPLOYER]
          : [],
      timeout: 900000,
      chainId: 42161,
    },
    bsc: {
      url: process.env.BSC_MAINNET_PROVIDER || "",
      accounts:
        process.env.MAINNET_DEPLOYER !== undefined
          ? [process.env.MAINNET_DEPLOYER]
          : [],
      timeout: 900000,
      chainId: 56,
    },
    matic: {
      url: process.env.POLYGON_PROVIDER || "",
      accounts:
        process.env.MAINNET_DEPLOYER !== undefined
          ? [process.env.MAINNET_DEPLOYER]
          : [],
      timeout: 1200000, //   20 mins
      chainId: 137,
    },
    arb_test: {
      url: process.env.ARBITRUM_TESTNET_PROVIDER || "",
      accounts:
        process.env.TESTNET_DEPLOYER !== undefined
          ? [process.env.TESTNET_DEPLOYER]
          : [],
      timeout: 900000,
      chainId: 421614,
    },
    bsc_test: {
      url: process.env.BSC_TESTNET_PROVIDER || "",
      accounts:
        process.env.TESTNET_DEPLOYER !== undefined
          ? [process.env.TESTNET_DEPLOYER]
          : [],
      timeout: 20000,
      chainId: 97,
    },
    mumbai: {
      url: process.env.MUMBAI_PROVIDER || "",
      accounts:
        process.env.MAINNET_DEPLOYER !== undefined
          ? [process.env.MAINNET_DEPLOYER]
          : [],
      timeout: 1200000, //   20 mins
      chainId: 80001,
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.8.20",
      },
    ],
  },

  gasReporter: {
    enabled: true,
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./build/cache",
    artifacts: "./build/artifacts",
  },

  etherscan: {
    apiKey: process.env.ARBITRUM_API_KEY,
    customChains: [
      {
        network: "Arbitrum Testnet",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
    ],
  },
};

export default config;
