import { expect } from "chai";
import { ethers } from "hardhat";
import {
  KIPNode,
  KIPNode__factory,
  Token20,
  Token20__factory,
} from "../typechain-types";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ZeroAddress, ZeroHash, parseUnits } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

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

describe("KIPNode Sale Contract Testing", () => {
  let owner: HardhatEthersSigner, newOwner: HardhatEthersSigner;
  let accounts: HardhatEthersSigner[];

  let kip: KIPNode;
  let usdt: Token20, usdc: Token20;

  const KIPFundAddress = "0x6E3bbb13330102989Ac110163e4C649d0bB88777";
  const AddressZero = ZeroAddress;

  //  Generate Sale Event configs
  const currentTime = Math.floor(Date.now() / 1000);
  const publicSaleEvent1: KIPNode.PublicSaleStruct = {
    price: parseUnits("100", 6), //  100 USDT, decimals = 6 (Arbitrum)
    maxPerTier: 1250,
    maxPerUser: 1,
    totalMintedAmount: BigInt(0),
    start: BigInt(currentTime + 3600),
    end: BigInt(currentTime + 7 * 24 * 3600),
  };
  const publicSaleEvent2: KIPNode.PublicSaleStruct = {
    price: parseUnits("200", 6), //  200 USDT, decimals = 6 (Arbitrum)
    maxPerTier: 1250,
    maxPerUser: 2,
    totalMintedAmount: BigInt(0),
    start: BigInt(currentTime + 3600),
    end: BigInt(currentTime + 7 * 24 * 3600),
  };

  let whitelistSaleEvent1: KIPNode.WhitelistSaleStruct,
    whitelistSaleEvent2: KIPNode.WhitelistSaleStruct;

  let whitelist1: any, whitelist2: any;

  before(async () => {
    [owner, newOwner, ...accounts] = await ethers.getSigners();

    const ERC20 = (await ethers.getContractFactory(
      "Token20",
      owner
    )) as Token20__factory;
    usdt = await ERC20.deploy("USD Tether", "USDT");
    usdc = await ERC20.deploy("USD Circle", "USDC");

    const KIPNode = (await ethers.getContractFactory(
      "KIPNode",
      owner
    )) as KIPNode__factory;
    kip = await KIPNode.deploy(owner.address, usdt.getAddress());

    whitelist1 = [
      [accounts[0].address, BigInt(150)],
      [accounts[1].address, BigInt(150)],
    ];

    whitelist2 = [
      [accounts[2].address, BigInt(500)],
      [accounts[3].address, BigInt(500)],
    ];

    whitelistSaleEvent1 = {
      merkleRoot: StandardMerkleTree.of(whitelist1, ["address", "uint256"])
        .root,
      maxPerTier: 5000,
      totalMintedAmount: BigInt(0),
      start: BigInt(currentTime + 3600),
      end: BigInt(currentTime + 7 * 24 * 3600),
    };
    whitelistSaleEvent2 = {
      merkleRoot: StandardMerkleTree.of(whitelist2, ["address", "uint256"])
        .root,
      maxPerTier: 10000,
      totalMintedAmount: BigInt(0),
      start: BigInt(currentTime + 3600),
      end: BigInt(currentTime + 7 * 24 * 3600),
    };
  });

  it("Should be able to check the initialized settings of KIPNode contract", async () => {
    const maxTier = 38;
    const baseURI = "https://node-nft.kip.pro/";

    expect(await kip.owner()).deep.equal(owner.address);
    expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());
    expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);
    expect(await kip.MAX_TIER()).deep.equal(maxTier);
    expect(await kip.transferEnabled()).deep.equal(false);
    expect(await kip.baseURI()).deep.equal(baseURI);
  });

  describe("setBaseURI() functional testing", () => {
    it("Should revert when Unauthorized clients try to update base URI", async () => {
      const baseURI = "https://node-nft.kip.pro/";
      const newURI = "https://node-nft.kip.version2.pro/";

      expect(await kip.baseURI()).deep.equal(baseURI);

      await expect(
        kip.connect(accounts[0]).setBaseURI(newURI)
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.baseURI()).deep.equal(baseURI);
    });

    it("Should revert when Owner tries to update base URI as an empty string", async () => {
      const baseURI = "https://node-nft.kip.pro/";
      const empty = "";

      expect(await kip.baseURI()).deep.equal(baseURI);

      await expect(
        kip.connect(owner).setBaseURI(empty)
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
        kip.connect(owner).setBaseURI(newURI)
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
        kip.connect(accounts[0]).setTransferEnabled(true)
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
        kip.connect(owner).setTransferEnabled(false)
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
        kip.connect(accounts[0]).setKIPFundAddress(accounts[0].address)
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);
    });

    it("Should revert when Authorized client - Owner - update KIP Treasury, but set 0x00", async () => {
      expect(await kip.KIPFundAddress()).deep.equal(KIPFundAddress);

      await expect(
        kip.connect(owner).setKIPFundAddress(AddressZero)
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
        kip.connect(owner).setKIPFundAddress(accounts[0].address)
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
        kip.connect(accounts[0]).setPaymentToken(usdc.getAddress())
      ).to.be.revertedWithCustomError(kip, `OwnableUnauthorizedAccount`);

      expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());
    });

    it("Should revert when Authorized client - Owner - updates a payment token, but set 0x00", async () => {
      expect(await kip.paymentToken()).deep.equal(await usdt.getAddress());

      await expect(
        kip.connect(owner).setPaymentToken(AddressZero)
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
        kip.connect(owner).setPaymentToken(usdt.getAddress())
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
        kip.connect(accounts[0]).setPublicSaleConfigs(tier, publicSaleEvent1)
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
        kip.connect(owner).setPublicSaleConfigs(tier, publicSaleEvent1)
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
      const tier = 39;

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
        kip.connect(owner).setPublicSaleConfigs(tier, publicSaleEvent1)
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
        kip.connect(owner).setPublicSaleConfigs(tier, publicSaleEvent2)
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
        maxPerTier: 1250,
        maxPerUser: 2,
        totalMintedAmount: BigInt(0),
        start: BigInt(currentTime + 3600),
        end: BigInt(currentTime + 7 * 24 * 3600),
      };

      await expect(
        kip.connect(owner).setPublicSaleConfigs(tier, newConfig)
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
        maxPerTier: 1250,
        maxPerUser: 3,
        totalMintedAmount: BigInt(0),
        start: BigInt(currentTime + 3600),
        end: BigInt(currentTime + 7 * 24 * 3600),
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
          .setWhitelistSaleConfigs(tier, whitelistSaleEvent1)
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
        kip.connect(owner).setWhitelistSaleConfigs(tier, whitelistSaleEvent1)
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
      const tier = 39;
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
        kip.connect(owner).setWhitelistSaleConfigs(tier, whitelistSaleEvent1)
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
        kip.connect(owner).setWhitelistSaleConfigs(tier, whitelistSaleEvent2)
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
        kip.connect(owner).setWhitelistSaleConfigs(tier, newConfig)
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
        maxPerTier: 15000,
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
});
