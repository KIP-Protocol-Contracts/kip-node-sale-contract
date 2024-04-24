import { expect } from "chai";
import { ethers, network } from "hardhat";
import {
  KIPNode,
  KIPNode__factory,
  Token20,
  Token20__factory,
} from "../typechain-types";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ZeroAddress, ZeroHash, getBytes, parseUnits } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time, takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";

const EmptyPublicConfig: KIPNode.PublicSaleStruct = {
  price: BigInt(0),
  maxPerTier: 0,
  maxPerUser: 0,
  totalMintedAmount: BigInt(0),
  start: BigInt(0),
  end: BigInt(0),
};

const EmptyWhitelistConfig: KIPNode.WhitelistSaleStruct = {
  merkleRoot: ZeroHash,
  maxPerTier: 0,
  totalMintedAmount: BigInt(0),
  start: BigInt(0),
  end: BigInt(0),
};

const provider = ethers.provider;
const days = 24 * 3600;

const getProof = (tree: any, account: string): any => {
  for (const [i, v] of tree.entries()) {
    if (v[0] === account) return tree.getProof(i);
  }
};

async function adjustTime(nextTimestamp: number): Promise<void> {
  await time.increaseTo(nextTimestamp);
}

describe("KIPNode Sale Contract Testing", () => {
  let owner: HardhatEthersSigner, newOwner: HardhatEthersSigner;
  let accounts: HardhatEthersSigner[];

  let kip: KIPNode;
  let usdt: Token20, usdc: Token20;

  const KIPFundAddress = "0x6E3bbb13330102989Ac110163e4C649d0bB88777";
  const AddressZero = ZeroAddress;
  const MAX_TIER = 38;

  //  Generate Sale Event configs
  const currentTime = Math.floor(Date.now() / 1000);
  const publicSaleEvent1: KIPNode.PublicSaleStruct = {
    price: parseUnits("100", 6), //  100 USDT, decimals = 6 (Arbitrum)
    maxPerTier: 1250,
    maxPerUser: 1,
    totalMintedAmount: BigInt(0),
    start: BigInt(currentTime + 7 * days),
    end: BigInt(currentTime + 14 * days),
  };
  const publicSaleEvent2: KIPNode.PublicSaleStruct = {
    price: parseUnits("200", 6), //  200 USDT, decimals = 6 (Arbitrum)
    maxPerTier: 1250,
    maxPerUser: 2,
    totalMintedAmount: BigInt(0),
    start: BigInt(currentTime + 9 * days),
    end: BigInt(currentTime + 21 * days),
  };

  let whitelistSaleEvent1: KIPNode.WhitelistSaleStruct,
    whitelistSaleEvent2: KIPNode.WhitelistSaleStruct;

  let whitelist1: any, whitelist2: any;
  let treeEvent1: any, treeEvent2: any;

  before(async () => {
    [owner, newOwner, ...accounts] = await ethers.getSigners();

    const ERC20 = (await ethers.getContractFactory(
      "Token20",
      owner,
    )) as Token20__factory;
    usdt = await ERC20.deploy("USD Tether", "USDT");
    usdc = await ERC20.deploy("USD Circle", "USDC");

    const KIPNode = (await ethers.getContractFactory(
      "KIPNode",
      owner,
    )) as KIPNode__factory;
    kip = await KIPNode.deploy(owner.address, usdt.getAddress());

    whitelist1 = [
      [accounts[0].address, BigInt(150)],
      [accounts[1].address, BigInt(150)],
    ];

    whitelist2 = [
      [accounts[0].address, BigInt(200)],
      [accounts[2].address, BigInt(200)],
      [accounts[3].address, BigInt(200)],
    ];

    treeEvent1 = StandardMerkleTree.of(whitelist1, ["address", "uint256"]);
    treeEvent2 = StandardMerkleTree.of(whitelist2, ["address", "uint256"]);

    whitelistSaleEvent1 = {
      merkleRoot: treeEvent1.root,
      maxPerTier: 5000,
      totalMintedAmount: BigInt(0),
      start: BigInt(currentTime + 3600),
      end: BigInt(currentTime + 7 * 24 * 3600),
    };
    whitelistSaleEvent2 = {
      merkleRoot: treeEvent2.root,
      maxPerTier: 10000,
      totalMintedAmount: BigInt(0),
      start: BigInt(currentTime + 3600),
      end: BigInt(currentTime + 7 * 24 * 3600),
    };
  });

  it("Should be able to check the initialized settings of KIPNode contract", async () => {
    const baseURI = "https://node-nft.kip.pro/";

    expect(await kip.owner()).deep.equal(owner.address);
    expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());
    expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);
    expect(await kip.MAX_TIER()).deep.equal(MAX_TIER);
    expect(await kip.transferEnabled()).deep.equal(false);
    expect(await kip.baseURI()).deep.equal(baseURI);
  });

  describe("setBaseURI() functional testing", () => {
    it("Should revert when Unauthorized clients try to update base URI", async () => {
      const baseURI = "https://node-nft.kip.pro/";
      const newURI = "https://node-nft.kip.version2.pro/";

      expect(await kip.baseURI()).deep.equal(baseURI);

      await expect(
        kip.connect(accounts[0]).setBaseURI(newURI),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.baseURI()).deep.equal(baseURI);
    });

    it("Should revert when Owner tries to update base URI as an empty string", async () => {
      const baseURI = "https://node-nft.kip.pro/";
      const empty = "";

      expect(await kip.baseURI()).deep.equal(baseURI);

      await expect(
        kip.connect(owner).setBaseURI(empty),
      ).to.be.revertedWithCustomError(kip, `InvalidURI`);

      expect(await kip.baseURI()).deep.equal(baseURI);
    });

    it("Should succeed when Authorized client - Owner - update new base URI", async () => {
      const baseURI = "https://node-nft.kip.pro/";
      const newURI = "https://node-nft.kip.version2.pro/";

      expect(await kip.baseURI()).deep.equal(baseURI);

      await kip.connect(owner).setBaseURI(newURI);

      expect(await kip.baseURI()).deep.equal(newURI);

      //  set back to normal
      await kip.connect(owner).setBaseURI(baseURI);
      expect(await kip.baseURI()).deep.equal(baseURI);
    });

    it("Should revert when former Owner tries to update base URI", async () => {
      const baseURI = "https://node-nft.kip.pro/";
      const newURI = "https://node-nft.kip.version2.pro/";

      //  `owner` transfer its ownership role to `newOwner`
      await kip.connect(owner).transferOwnership(newOwner.address);
      expect(await kip.owner()).deep.equal(newOwner.address);

      expect(await kip.baseURI()).deep.equal(baseURI);

      await expect(
        kip.connect(owner).setBaseURI(newURI),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.baseURI()).deep.equal(baseURI);
    });

    it("Should succeed when Authorized client - New Owner - update new base URI", async () => {
      const baseURI = "https://node-nft.kip.pro/";
      const newURI = "https://node-nft.kip.version2.pro/";

      expect(await kip.baseURI()).deep.equal(baseURI);

      await kip.connect(newOwner).setBaseURI(newURI);

      expect(await kip.baseURI()).deep.equal(newURI);

      //  set back to normal
      await kip.connect(newOwner).transferOwnership(owner.address);
      expect(await kip.owner()).deep.equal(owner.address);
      await kip.connect(owner).setBaseURI(baseURI);
      expect(await kip.baseURI()).deep.equal(baseURI);
    });
  });

  describe("setTransferEnabled() functional testing", () => {
    it("Should revert when Unauthorized client tries to set transferEnabled = true", async () => {
      expect(await kip.transferEnabled()).deep.equal(false);

      await expect(
        kip.connect(accounts[0]).setTransferEnabled(true),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.transferEnabled()).deep.equal(false);
    });

    it("Should succeed when Authorized client - Owner - set transferEnabled = true", async () => {
      expect(await kip.transferEnabled()).deep.equal(false);

      await kip.connect(owner).setTransferEnabled(true);

      expect(await kip.transferEnabled()).deep.equal(true);
    });

    it("Should revert when former Owner tries to set transferEnabled = false", async () => {
      expect(await kip.transferEnabled()).deep.equal(true);

      //  `owner` transfer its ownership role to `newOwner`
      await kip.connect(owner).transferOwnership(newOwner.address);
      expect(await kip.owner()).deep.equal(newOwner.address);

      await expect(
        kip.connect(owner).setTransferEnabled(false),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.transferEnabled()).deep.equal(true);
    });

    it("Should succeed when Authorized client - New Owner - set transferEnabled = false", async () => {
      expect(await kip.transferEnabled()).deep.equal(true);

      await kip.connect(newOwner).setTransferEnabled(false);

      expect(await kip.transferEnabled()).deep.equal(false);

      //  set back to normal
      await kip.connect(newOwner).transferOwnership(owner.address);
      expect(await kip.owner()).deep.equal(owner.address);
    });
  });

  describe("setKIPFundAddress() functional testing", () => {
    it("Should revert when Unauthorized client tries to update KIP Treasury address", async () => {
      expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);

      await expect(
        kip.connect(accounts[0]).setKIPFundAddress(accounts[0].address),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);
    });

    it("Should revert when Authorized client - Owner - update KIP Treasury, but set 0x00", async () => {
      expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);

      await expect(
        kip.connect(owner).setKIPFundAddress(AddressZero),
      ).to.be.revertedWithCustomError(kip, `SetAddressZero`);

      expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);
    });

    it("Should succeed when Authorized client - Owner - update a valid address as KIP Treasury", async () => {
      expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);

      await kip.connect(owner).setKIPFundAddress(owner.address);

      expect(await kip.KIPFundAddress()).deep.equal(owner.address);
    });

    it("Should revert when former Owner tries to update KIP Treasury", async () => {
      expect(await kip.KIPFundAddress()).deep.equal(owner.address);

      //  `owner` transfer its ownership role to `newOwner`
      await kip.connect(owner).transferOwnership(newOwner.address);
      expect(await kip.owner()).deep.equal(newOwner.address);

      await expect(
        kip.connect(owner).setKIPFundAddress(accounts[0].address),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.KIPFundAddress()).deep.equal(owner.address);
    });

    it("Should succeed when Authorized client - New Owner - update a valid address as KIP Treasury", async () => {
      expect(await kip.KIPFundAddress()).deep.equal(owner.address);

      await kip.connect(newOwner).setKIPFundAddress(KIPFundAddress);

      expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);

      //  set back to normal
      await kip.connect(newOwner).transferOwnership(owner.address);
      expect(await kip.owner()).deep.equal(owner.address);
    });
  });

  describe("setPaymentToken() functional testing", () => {
    it("Should revert when Unauthorized client tries to update new payment token", async () => {
      expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());

      await expect(
        kip.connect(accounts[0]).setPaymentToken(usdc.getAddress()),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());
    });

    it("Should revert when Authorized client - Owner - updates a payment token, but set 0x00", async () => {
      expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());

      await expect(
        kip.connect(owner).setPaymentToken(AddressZero),
      ).to.be.revertedWithCustomError(kip, `SetAddressZero`);

      expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());
    });

    it("Should succeed when Authorized client - Owner - update a valid payment token", async () => {
      expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());

      await kip.connect(owner).setPaymentToken(usdc.getAddress());

      expect(await kip.paymentToken()).deep.equal(await usdc.getAddress());
    });

    it("Should revert when former Owner tries to update a payment token", async () => {
      expect(await kip.paymentToken()).deep.equal(await usdc.getAddress());

      //  `owner` transfer its ownership role to `newOwner`
      await kip.connect(owner).transferOwnership(newOwner.address);
      expect(await kip.owner()).deep.equal(newOwner.address);

      await expect(
        kip.connect(owner).setPaymentToken(usdt.getAddress()),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.paymentToken()).deep.equal(await usdc.getAddress());
    });

    it("Should succeed when Authorized client - New Owner - update a valid payment token", async () => {
      expect(await kip.paymentToken()).deep.equal(await usdc.getAddress());

      await kip.connect(newOwner).setPaymentToken(usdt.getAddress());

      expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());

      //  set back to normal
      await kip.connect(newOwner).transferOwnership(owner.address);
      expect(await kip.owner()).deep.equal(owner.address);
    });
  });

  describe("setPublicSaleConfigs() functional testing", () => {
    it("Should revert when Unauthorized client tries to set a public sale event", async () => {
      const tier = 1;
      //  Check storage state before the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }

      await expect(
        kip.connect(accounts[0]).setPublicSaleConfigs(tier, publicSaleEvent1),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      //  Check storage state after the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }
    });

    it("Should revert when Authorized client - Owner - sets a public sale event, but tier = 0", async () => {
      const tier = 0;

      //  Check storage state before the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }

      await expect(
        kip.connect(owner).setPublicSaleConfigs(tier, publicSaleEvent1),
      ).to.be.revertedWithCustomError(kip, `InvalidConfig`);

      //  Check storage state after the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }
    });

    it("Should revert when Authorized client - Owner - sets a public sale event, but tier > MAX_TIER", async () => {
      const tier = MAX_TIER + 1;

      //  Check storage state before the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }

      await expect(
        kip.connect(owner).setPublicSaleConfigs(tier, publicSaleEvent1),
      ).to.be.revertedWithCustomError(kip, `InvalidConfig`);

      //  Check storage state after the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }
    });

    it("Should succeed when Authorized client - Owner - sets a public sale event", async () => {
      const tier = 1;

      //  Check storage state before the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }

      await kip.connect(owner).setPublicSaleConfigs(tier, publicSaleEvent1);

      //  Check storage state after the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(publicSaleEvent1);
      }
    });

    it("Should revert when former Owner tries to set a new public sale event", async () => {
      const tier = 2;

      //  `owner` transfer its ownership role to `newOwner`
      await kip.connect(owner).transferOwnership(newOwner.address);
      expect(await kip.owner()).deep.equal(newOwner.address);

      //  Check storage state before the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }

      await expect(
        kip.connect(owner).setPublicSaleConfigs(tier, publicSaleEvent2),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      //  Check storage state after the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }
    });

    it("Should revert when former Owner tries to overwrite current public sale event's settings", async () => {
      const tier = 1;

      const currentTime = Math.floor(Date.now() / 1000);
      const newConfig: KIPNode.PublicSaleStruct = {
        price: parseUnits("200", 6), //  200 USDT, decimals = 6 (Arbitrum)
        maxPerTier: 2,
        maxPerUser: 1,
        totalMintedAmount: BigInt(0),
        start: BigInt(currentTime + 7 * days),
        end: BigInt(currentTime + 14 * days),
      };

      await expect(
        kip.connect(owner).setPublicSaleConfigs(tier, newConfig),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      //  Check storage state after the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(publicSaleEvent1);
      }
    });

    it("Should succeed when Authorized client - New Owner - sets a new public sale event", async () => {
      const tier = 2;

      //  Check storage state before the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }

      await kip.connect(newOwner).setPublicSaleConfigs(tier, publicSaleEvent2);

      //  Check storage state after the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(publicSaleEvent2);
      }
    });

    it("Should succeed when Authorized client - New Owner - overwrites current public sale event's settings", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const tier = 1;

      const newConfig: KIPNode.PublicSaleStruct = {
        price: parseUnits("300", 6), //  200 USDT, decimals = 6 (Arbitrum)
        maxPerTier: 3,
        maxPerUser: 1,
        totalMintedAmount: BigInt(0),
        start: BigInt(currentTime + 7 * days),
        end: BigInt(currentTime + 14 * days),
      };

      await kip.connect(newOwner).setPublicSaleConfigs(tier, newConfig);

      //  Check storage state after the call
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(newConfig);
      }

      //  set back to normal
      await kip.connect(newOwner).transferOwnership(owner.address);
      expect(await kip.owner()).deep.equal(owner.address);
    });
  });

  describe("setWhitelistSaleConfigs() functional testing", () => {
    it("Should revert when Unauthorized client tries to set awhitelist sale event", async () => {
      const tier = 30;
      //  Check storage state before the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }

      await expect(
        kip
          .connect(accounts[0])
          .setWhitelistSaleConfigs(tier, whitelistSaleEvent1),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      //  Check storage state after the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }
    });

    it("Should revert when Authorized client - Owner - set a whitelist sale event, but tier = 0", async () => {
      const tier = 0;
      //  Check storage state before the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }

      await expect(
        kip.connect(owner).setWhitelistSaleConfigs(tier, whitelistSaleEvent1),
      ).to.be.revertedWithCustomError(kip, `InvalidConfig`);

      //  Check storage state after the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }
    });

    it("Should revert when Authorized client - Owner - set a whitelist sale event, but tier > MAX_TIER", async () => {
      const tier = MAX_TIER + 1;
      //  Check storage state before the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }

      await expect(
        kip.connect(owner).setWhitelistSaleConfigs(tier, whitelistSaleEvent1),
      ).to.be.revertedWithCustomError(kip, `InvalidConfig`);

      //  Check storage state after the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }
    });

    it("Should succeed when Authorized client - Owner - sets a whitelist sale event", async () => {
      const tier = 31;

      //  Check storage state before the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }

      await kip
        .connect(owner)
        .setWhitelistSaleConfigs(tier, whitelistSaleEvent1);

      //  Check storage state after the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(whitelistSaleEvent1);
      }
    });

    it("Should revert when former Owner tries to set a new whitelist sale event", async () => {
      const tier = 32;

      //  `owner` transfer its ownership role to `newOwner`
      await kip.connect(owner).transferOwnership(newOwner.address);
      expect(await kip.owner()).deep.equal(newOwner.address);

      //  Check storage state before the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }

      await expect(
        kip.connect(owner).setWhitelistSaleConfigs(tier, whitelistSaleEvent2),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      //  Check storage state after the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }
    });

    it("Should revert when former Owner tries to overwrite current whitelist sale event's settings", async () => {
      const tier = 31;

      const currentTime = Math.floor(Date.now() / 1000);
      const newWhitelist = [
        [accounts[4].address, BigInt(1000)],
        [accounts[5].address, BigInt(1000)],
        [accounts[6].address, BigInt(1000)],
      ];
      const newConfig: KIPNode.WhitelistSaleStruct = {
        merkleRoot: StandardMerkleTree.of(newWhitelist, ["address", "uint256"])
          .root,
        maxPerTier: 20000,
        totalMintedAmount: BigInt(0),
        start: BigInt(currentTime + 3600),
        end: BigInt(currentTime + 7 * 24 * 3600),
      };

      await expect(
        kip.connect(owner).setWhitelistSaleConfigs(tier, newConfig),
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      //  Check storage state after the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(whitelistSaleEvent1);
      }
    });

    it("Should succeed when Authorized client - New Owner - sets a new whitelist sale event", async () => {
      const tier = 32;

      //  Check storage state before the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyWhitelistConfig);
      }

      await kip
        .connect(newOwner)
        .setWhitelistSaleConfigs(tier, whitelistSaleEvent2);

      //  Check storage state after the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(whitelistSaleEvent2);
      }
    });

    it("Should succeed when Authorized client - New Owner - overwrites current whitelist sale event's settings", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const tier = 31;

      const merkleRoot = StandardMerkleTree.of(whitelist1, [
        "address",
        "uint256",
      ]).root;
      const newConfig: KIPNode.WhitelistSaleStruct = {
        merkleRoot: merkleRoot,
        maxPerTier: 200,
        totalMintedAmount: BigInt(0),
        start: BigInt(currentTime + 3600),
        end: BigInt(currentTime + 7 * 24 * 3600),
      };

      await kip.connect(newOwner).setWhitelistSaleConfigs(tier, newConfig);

      //  Check storage state after the call
      {
        let { merkleRoot, maxPerTier, totalMintedAmount, start, end } =
          await kip.whitelistSaleConfigs(tier);
        let resultObject: KIPNode.WhitelistSaleStruct = {
          merkleRoot,
          maxPerTier,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(newConfig);
      }

      //  set back to normal
      await kip.connect(newOwner).transferOwnership(owner.address);
      expect(await kip.owner()).deep.equal(owner.address);
    });
  });

  describe("whitelistMint() functional testing", () => {
    it("Should revert when whitelisted user tries to mint License, but tier = 0", async () => {
      const tier = 0;
      const to = accounts[0].address;
      const amount = BigInt(10);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `InvalidRequest`);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);
    });

    it("Should revert when whitelisted user tries to mint License, but tier > MAX_TIER", async () => {
      const tier = MAX_TIER + 1;
      const to = accounts[0].address;
      const amount = BigInt(10);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `InvalidRequest`);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);
    });

    it("Should revert when whitelisted user tries to mint License, but receiver = 0x00", async () => {
      const tier = 31;
      const to = ZeroAddress;
      const amount = BigInt(10);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `InvalidRequest`);
    });

    it("Should revert when whitelisted user tries to mint License, but amount = 0", async () => {
      const tier = 31;
      const to = accounts[0].address;
      const amount = BigInt(0);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `InvalidRequest`);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);
    });

    it("Should revert when whitelisted user tries to mint License, but event not yet started", async () => {
      const tier = 31;
      const to = accounts[0].address;
      const amount = BigInt(10);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `SaleEventNotExist`);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);
    });

    it("Should revert when whitelisted user tries to mint License, but event already ended", async () => {
      const tier = 31;
      const to = accounts[0].address;
      const amount = BigInt(10);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      const block = await provider.getBlockNumber();
      const timestamp = (await provider.getBlock(block))?.timestamp as number;
      const expiry = Number((await kip.whitelistSaleConfigs(tier)).end) + 60;

      //  take a snapshot before increasing block.timestamp
      const snapshot = await takeSnapshot();
      if (timestamp < expiry) await adjustTime(expiry);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `SaleEventNotExist`);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      //  set back to normal
      await snapshot.restore();
    });

    it("Should revert when unauthorized user tries to mint License, but proof not valid - Proof from others", async () => {
      const tier = 31;
      const to = accounts[10].address;
      const amount = BigInt(50);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      const block = await provider.getBlockNumber();
      const timestamp = (await provider.getBlock(block))?.timestamp as number;
      const start = Number((await kip.whitelistSaleConfigs(tier)).start) + 60;

      //  Adjust block.timestamp
      if (timestamp < start) await adjustTime(start);

      expect(await kip.balanceOf(accounts[10].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[10])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `InvalidProof`);

      expect(await kip.balanceOf(accounts[10].address)).deep.equal(0);
    });

    it("Should revert when authorized user tries to mint License, but proof not valid - maxAmount incorrected", async () => {
      const tier = 31;
      const to = accounts[0].address;
      const amount = BigInt(50);
      const maxAmount = BigInt(500);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `InvalidProof`);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);
    });

    it("Should revert when authorized user tries to mint License, but proof not valid - Proof generated for a different tier", async () => {
      const tier = 31;
      const to = accounts[0].address;
      const amount = BigInt(50);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent2, accounts[0].address);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `InvalidProof`);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);
    });

    it("Should succeed when authorized user requests to mint Licenses - Partial mint", async () => {
      const tier = 31;
      const to = accounts[0].address;
      const amount = BigInt(50);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(accounts[0].address, tier, true, amount, amount)
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[0].address, //  sender
          accounts[0].address, //  to
          tier,
          1, //  tokenId
          0, // price
          true, //  whitelist
          "",
        )
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[0].address, //  sender
          accounts[0].address, //  to
          tier,
          50, //  tokenId
          0, // price
          true, //  whitelist
          "",
        );

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(amount);
      expect(
        await kip.whitelistUserMinted(tier, accounts[0].address),
      ).deep.equal(amount);
      expect(
        (await kip.whitelistSaleConfigs(tier)).totalMintedAmount,
      ).deep.equal(amount);
    });

    it("Should succeed when authorized user requests to mint Licenses - Mint remaining allocation", async () => {
      const tier = 31;
      const to = accounts[0].address;
      const amount = BigInt(100);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      const balance = await kip.balanceOf(accounts[0].address);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(
          accounts[0].address,
          tier,
          true,
          balance + amount, // minted amount (user)
          balance + amount, // total minted amount (tier)
        )
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[0].address, //  sender
          accounts[0].address, //  to
          tier,
          51, //  tokenId
          0, // price
          true, //  whitelist
          "",
        )
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[0].address, //  sender
          accounts[0].address, //  to
          tier,
          150, //  tokenId
          0, // price
          true, //  whitelist
          "",
        );

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(
        balance + amount,
      );
      expect(
        await kip.whitelistUserMinted(tier, accounts[0].address),
      ).deep.equal(balance + amount);
      expect(
        (await kip.whitelistSaleConfigs(tier)).totalMintedAmount,
      ).deep.equal(balance + amount);
    });

    it("Should revert when authorized user tries to mint License, but exceed max allowance - Max Per User", async () => {
      const tier = 31;
      const to = accounts[0].address;
      const amount = BigInt(50);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[0].address);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(maxAmount);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `ExceedAllowance`);

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(maxAmount);
      expect(
        await kip.whitelistUserMinted(tier, accounts[0].address),
      ).deep.equal(maxAmount);
      expect(
        (await kip.whitelistSaleConfigs(tier)).totalMintedAmount,
      ).deep.equal(maxAmount);
    });

    it("Should succeed when authorized user requests to mint Licenses - First partial minting", async () => {
      const tier = 31;
      const to = accounts[1].address;
      const amount = BigInt(50);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[1].address);

      const totalMintedAmount = (await kip.whitelistSaleConfigs(tier))
        .totalMintedAmount;
      expect(await kip.balanceOf(accounts[1].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[1])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(
          accounts[1].address,
          tier,
          true,
          amount, // minted amount (user)
          totalMintedAmount + amount, // total minted amount (tier)
        )
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[1].address, //  sender
          accounts[1].address, //  to
          tier,
          151, //  tokenId
          0, // price
          true, //  whitelist
          "",
        )
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[1].address, //  sender
          accounts[1].address, //  to
          tier,
          200, //  tokenId
          0, // price
          true, //  whitelist
          "",
        );

      expect(await kip.balanceOf(accounts[1].address)).deep.equal(amount);
      expect(
        await kip.whitelistUserMinted(tier, accounts[1].address),
      ).deep.equal(amount);
      expect(
        (await kip.whitelistSaleConfigs(tier)).totalMintedAmount,
      ).deep.equal(totalMintedAmount + amount);
    });

    it("Should revert when authorized user tries to mint License, but exceed max allowance - Max Per Tier", async () => {
      const tier = 31;
      const to = accounts[1].address;
      const amount = BigInt(50);
      const maxAmount = BigInt(150);
      const merkleProof = getProof(treeEvent1, accounts[1].address);

      const totalMintedAmount = (await kip.whitelistSaleConfigs(tier))
        .totalMintedAmount;
      const balance = await kip.balanceOf(accounts[1].address);

      await expect(
        kip
          .connect(accounts[1])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      ).to.be.revertedWithCustomError(kip, `ExceedAllowance`);

      expect(await kip.balanceOf(accounts[1].address)).deep.equal(balance);
      expect(
        await kip.whitelistUserMinted(tier, accounts[1].address),
      ).deep.equal(balance);
      expect(
        (await kip.whitelistSaleConfigs(tier)).totalMintedAmount,
      ).deep.equal(totalMintedAmount);
    });

    it("Should succeed when authorized user requests to mint Licenses - Full mint", async () => {
      const tier = 32;
      const to = accounts[0].address;
      const amount = BigInt(200);
      const maxAmount = BigInt(200);
      const merkleProof = getProof(treeEvent2, accounts[0].address);

      const balance = await kip.balanceOf(accounts[0].address);

      await expect(
        kip
          .connect(accounts[0])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(accounts[0].address, tier, true, amount, amount)
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[0].address, //  sender
          accounts[0].address, //  to
          tier,
          201, //  tokenId
          0, // price
          true, //  whitelist
          "",
        )
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[0].address, //  sender
          accounts[0].address, //  to
          tier,
          400, //  tokenId
          0, // price
          true, //  whitelist
          "",
        );

      expect(await kip.balanceOf(accounts[0].address)).deep.equal(
        balance + amount,
      );
      expect(
        await kip.whitelistUserMinted(tier, accounts[0].address),
      ).deep.equal(amount);
      expect(
        (await kip.whitelistSaleConfigs(tier)).totalMintedAmount,
      ).deep.equal(amount);
    });

    it("Should succeed when authorized user requests to mint Licenses - Different Receiver", async () => {
      const tier = 32;
      const to = accounts[5].address;
      const amount = BigInt(50);
      const maxAmount = BigInt(200);
      const merkleProof = getProof(treeEvent2, accounts[2].address);

      const totalMintedAmount = (await kip.whitelistSaleConfigs(tier))
        .totalMintedAmount;
      expect(await kip.balanceOf(accounts[2].address)).deep.equal(0);
      expect(await kip.balanceOf(accounts[5].address)).deep.equal(0);

      await expect(
        kip
          .connect(accounts[2])
          .whitelistMint(tier, to, amount, maxAmount, merkleProof),
      )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(
          accounts[2].address,
          tier,
          true,
          amount, //  minted amount (user)
          totalMintedAmount + amount, // total minted amount (tier)
        )
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[2].address, //  sender
          accounts[5].address, //  to
          tier,
          401, //  tokenId
          0, // price
          true, //  whitelist
          "",
        )
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[2].address, //  sender
          accounts[5].address, //  to
          tier,
          450, //  tokenId
          0, // price
          true, //  whitelist
          "",
        );

      expect(await kip.balanceOf(accounts[2].address)).deep.equal(0);
      expect(await kip.balanceOf(accounts[5].address)).deep.equal(amount);
      expect(
        await kip.whitelistUserMinted(tier, accounts[2].address),
      ).deep.equal(amount);
      expect(
        await kip.whitelistUserMinted(tier, accounts[5].address),
      ).deep.equal(0);
      expect(
        (await kip.whitelistSaleConfigs(tier)).totalMintedAmount,
      ).deep.equal(totalMintedAmount + amount);
    });
  });

  describe("publicMint() functional testing", () => {
    it("Should revert when user tries to mint the License, but tier = 0", async () => {
      const tier = 0;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";

      await usdt
        .connect(accounts[6])
        .mint(accounts[6].address, parseUnits("1000", 6));

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `InvalidRequest`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );
    });

    it("Should revert when user tries to mint the License, but tier > MAX_TIER", async () => {
      const tier = MAX_TIER + 1;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `InvalidRequest`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );
    });

    it("Should revert when user tries to mint the License, but amount = 0", async () => {
      const tier = 1;
      const to = accounts[6].address;
      const amount = BigInt(0);
      const code = "";

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `InvalidRequest`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );
    });

    it("Should revert when user tries to mint the License, but receiver = 0x00", async () => {
      const tier = 1;
      const to = AddressZero;
      const amount = BigInt(1);
      const code = "";

      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `InvalidRequest`);

      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );
    });

    it("Should revert when user tries to mint the License, but public sale not yet started", async () => {
      const tier = 1;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `SaleEventNotExist`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );
    });

    it("Should revert when user tries to mint the License, but public sale already ended", async () => {
      const tier = 1;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";

      const block = await provider.getBlockNumber();
      const timestamp = (await provider.getBlock(block))?.timestamp as number;
      const expiry = Number((await kip.publicSaleConfigs(tier)).end) + 60;

      //  take a snapshot before increasing block.timestamp
      const snapshot = await takeSnapshot();
      if (timestamp < expiry) await adjustTime(expiry);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `SaleEventNotExist`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      //  set back to normal
      await snapshot.restore();
    });

    it("Should revert when user tries to mint the License, but public sale not configured", async () => {
      const tier = 3;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";

      //  public sale event (tier = 3) not configured
      {
        let { price, maxPerTier, maxPerUser, totalMintedAmount, start, end } =
          await kip.publicSaleConfigs(tier);
        let resultObject: KIPNode.PublicSaleStruct = {
          price,
          maxPerTier,
          maxPerUser,
          totalMintedAmount,
          start,
          end,
        };
        expect(resultObject).to.deep.equal(EmptyPublicConfig);
      }

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `SaleEventNotExist`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );
    });

    it("Should revert when user tries to mint the License, but price is set zero", async () => {
      const tier = 1;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";

      const block = await provider.getBlockNumber();
      const timestamp = (await provider.getBlock(block))?.timestamp as number;
      const start = Number((await kip.publicSaleConfigs(tier)).start) + 60;

      //  take a snapshot before increasing block.timestamp
      const snapshot = await takeSnapshot();
      if (timestamp < start) await adjustTime(start);

      //  set price = 0
      const currentTime = Math.floor(Date.now() / 1000);
      const newConfig: KIPNode.PublicSaleStruct = {
        price: BigInt(0),
        maxPerTier: 2,
        maxPerUser: 1,
        totalMintedAmount: BigInt(0),
        start: BigInt(currentTime + 7 * days),
        end: BigInt(currentTime + 14 * days),
      };
      await kip.connect(owner).setPublicSaleConfigs(tier, newConfig);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `PriceNotConfigured`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      //  set back to normal
      await snapshot.restore();
    });

    it("Should revert when user tries to mint the License, but not approve allowance", async () => {
      const tier = 1;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";

      const block = await provider.getBlockNumber();
      const timestamp = (await provider.getBlock(block))?.timestamp as number;
      const start = Number((await kip.publicSaleConfigs(tier)).start) + 60;

      //  adjust block.timestamp
      if (timestamp < start) await adjustTime(start);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(usdt, `ERC20InsufficientAllowance`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );
    });

    it("Should revert when user tries to mint the License, but insufficient balance", async () => {
      const tier = 1;
      const to = accounts[7].address;
      const amount = BigInt(1);
      const code = "";

      await usdt
        .connect(accounts[7])
        .approve(kip.getAddress(), parseUnits("10000", 6));

      expect(await kip.balanceOf(accounts[7].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      await expect(
        kip.connect(accounts[7]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(usdt, `ERC20InsufficientBalance`);

      expect(await kip.balanceOf(accounts[7].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );
    });

    it("Should succeed when user mints the License - 1st User - Public Sale Event", async () => {
      const tier = 1;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";
      const { price } = await kip.publicSaleConfigs(tier);

      await usdt
        .connect(accounts[6])
        .approve(kip.getAddress(), parseUnits("10000", 6));

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      const tx = kip.connect(accounts[6]).publicMint(tier, to, amount, code);
      await expect(tx).to.changeTokenBalances(
        usdt,
        [accounts[6].address, KIPFundAddress],
        [-price, price],
      );
      await expect(tx)
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[6].address, //  sender
          accounts[6].address, //  receiver
          tier,
          451, // tokenId
          price,
          false,
          code,
        )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(accounts[6].address, tier, false, amount, amount);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(1);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        1,
      );
    });

    it("Should revert when user tries to mint the License, but exceed allowance - Max Per User", async () => {
      const tier = 1;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(1);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        1,
      );

      await expect(
        kip.connect(accounts[6]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `ExceedAllowance`);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(1);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        1,
      );
    });

    it("Should succeed when user mints the License - 2nd User - Public Sale Event", async () => {
      const tier = 1;
      const to = accounts[7].address;
      const amount = BigInt(1);
      const code = "";
      const { price } = await kip.publicSaleConfigs(tier);

      await usdt
        .connect(accounts[7])
        .mint(accounts[7].address, parseUnits("10000", 6));

      await usdt
        .connect(accounts[7])
        .approve(kip.getAddress(), parseUnits("10000", 6));

      const totalMintedAmount = (await kip.publicSaleConfigs(tier))
        .totalMintedAmount;
      expect(await kip.balanceOf(accounts[7].address)).deep.equal(0);

      const tx = kip.connect(accounts[7]).publicMint(tier, to, amount, code);
      await expect(tx).to.changeTokenBalances(
        usdt,
        [accounts[7].address, KIPFundAddress],
        [-price, price],
      );
      await expect(tx)
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[7].address, //  sender
          accounts[7].address, //  receiver
          tier,
          452, // tokenId
          price,
          false,
          code,
        )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(
          accounts[7].address,
          tier,
          false,
          amount,
          totalMintedAmount + amount,
        );

      expect(await kip.balanceOf(accounts[7].address)).deep.equal(amount);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        totalMintedAmount + amount,
      );
    });

    it("Should succeed when user mints the License - 3rd User mints to 1st User - Public Sale Event", async () => {
      const tier = 1;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";
      const { price } = await kip.publicSaleConfigs(tier);

      await usdt
        .connect(accounts[8])
        .mint(accounts[8].address, parseUnits("10000", 6));

      await usdt
        .connect(accounts[8])
        .approve(kip.getAddress(), parseUnits("10000", 6));

      const totalMintedAmount = (await kip.publicSaleConfigs(tier))
        .totalMintedAmount;
      const balanceFirstUser = await kip.balanceOf(accounts[6].address);
      expect(await kip.balanceOf(accounts[8].address)).deep.equal(0);
      expect(balanceFirstUser).deep.equal(1);

      const tx = kip.connect(accounts[8]).publicMint(tier, to, amount, code);
      await expect(tx).to.changeTokenBalances(
        usdt,
        [accounts[8].address, KIPFundAddress],
        [-price, price],
      );
      await expect(tx)
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[8].address, //  sender
          accounts[6].address, //  receiver
          tier,
          453, // tokenId
          price,
          false,
          code,
        )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(
          accounts[8].address,
          tier,
          false,
          amount,
          totalMintedAmount + amount,
        );

      expect(await kip.balanceOf(accounts[8].address)).deep.equal(0);
      expect(await kip.balanceOf(accounts[6].address)).deep.equal(
        balanceFirstUser + amount,
      );
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        totalMintedAmount + amount,
      );
    });

    it("Should revert when user tries to mint the License, but exceed allowance - Max Per Tier", async () => {
      const tier = 1;
      const to = accounts[9].address;
      const amount = BigInt(1);
      const code = "";

      await usdt
        .connect(accounts[9])
        .mint(accounts[9].address, parseUnits("10000", 6));
      await usdt
        .connect(accounts[9])
        .approve(kip.getAddress(), parseUnits("10000", 6));

      const { maxPerTier } = await kip.publicSaleConfigs(tier);
      const totalMintedAmount = (await kip.publicSaleConfigs(tier))
        .totalMintedAmount;
      expect(await kip.balanceOf(accounts[9].address)).deep.equal(0);
      expect(totalMintedAmount).deep.equal(maxPerTier);

      await expect(
        kip.connect(accounts[9]).publicMint(tier, to, amount, code),
      ).to.be.revertedWithCustomError(kip, `ExceedAllowance`);

      expect(await kip.balanceOf(accounts[9].address)).deep.equal(0);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        totalMintedAmount,
      );
    });

    it("Should succeed when user mints the License - 1st User - Second Public Sale Event", async () => {
      const tier = 2;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";
      const { price } = await kip.publicSaleConfigs(tier);

      //  Public Sale Event 1: account[6] reached max allowance (maxPerUser)
      const balance = await kip.balanceOf(accounts[6].address);
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        0,
      );

      const block = await provider.getBlockNumber();
      const timestamp = (await provider.getBlock(block))?.timestamp as number;
      const start = Number((await kip.publicSaleConfigs(tier)).start) + 60;

      //  adjust block.timestamp
      if (timestamp < start) await adjustTime(start);

      const tx = kip.connect(accounts[6]).publicMint(tier, to, amount, code);
      await expect(tx).to.changeTokenBalances(
        usdt,
        [accounts[6].address, KIPFundAddress],
        [-price, price],
      );
      await expect(tx)
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[6].address, //  sender
          accounts[6].address, //  receiver
          tier,
          454, // tokenId
          price,
          false,
          code,
        )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(accounts[6].address, tier, false, amount, amount);

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(
        balance + amount,
      );
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        amount,
      );
    });

    it("Should succeed when user mints the License - 1st User - Second Public Sale Event", async () => {
      const tier = 2;
      const to = accounts[6].address;
      const amount = BigInt(1);
      const code = "";
      const { price } = await kip.publicSaleConfigs(tier);

      //  Public Sale Event 1: account[6] reached max allowance (maxPerUser)
      //  Public Sale Event 2: maxPerUser = 2
      const balance = await kip.balanceOf(accounts[6].address);
      const mintedPerTier = await kip.publicUserMinted(
        tier,
        accounts[6].address,
      );
      const totalMintedAmount = (await kip.publicSaleConfigs(tier))
        .totalMintedAmount;

      const tx = kip.connect(accounts[6]).publicMint(tier, to, amount, code);
      await expect(tx).to.changeTokenBalances(
        usdt,
        [accounts[6].address, KIPFundAddress],
        [-price, price],
      );
      await expect(tx)
        .to.emit(kip, "TokenMinted")
        .withArgs(
          accounts[6].address, //  sender
          accounts[6].address, //  receiver
          tier,
          455, // tokenId
          price,
          false,
          code,
        )
        .to.emit(kip, "MintCountUpdated")
        .withArgs(
          accounts[6].address, //  sender
          tier,
          false,
          mintedPerTier + amount, // minted amount (user)
          totalMintedAmount + amount, //  total minted amount (tier)
        );

      expect(await kip.balanceOf(accounts[6].address)).deep.equal(
        balance + amount,
      );
      expect((await kip.publicSaleConfigs(tier)).totalMintedAmount).deep.equal(
        totalMintedAmount + amount,
      );
    });
  });
});
