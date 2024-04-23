import { expect } from "chai";
import { ethers } from "hardhat";
import { KIPNode } from "../typechain-types";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { OffchainUtils } from "../sdk/OffchainUtils";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

describe("ERC721 behaviors", function () {
  let kipNode: KIPNode, paymentTokenMock, owner, addr1, addr2, addrs;

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    paymentTokenMock = await ethers.deployContract("PaymentTokenMock");
    await paymentTokenMock.waitForDeployment();

    kipNode = await ethers.deployContract("KIPNode", [
      owner.address,
      (await paymentTokenMock.getAddress()),
    ]);
    await paymentTokenMock.waitForDeployment();
  });

  it("Should ERC721-compliant 0x80ac58cd interface", async function () {
    await expect(kipNode.supportsInterface("0x80ac58cd")).to.be.fulfilled;
  });

  it("Should return the token name", async function () {
    expect(await kipNode.name()).to.equal("KIP License");
  });

  it("Should return the token symbol", async function () {
    expect(await kipNode.symbol()).to.equal("KIPNODE");
  });
});

describe("Owner behaviors", function () {
  let kipNode: KIPNode, paymentTokenMock, owner: Signer, addr1: Signer, addr2, addrs;

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    paymentTokenMock = await ethers.deployContract("PaymentTokenMock");
    await paymentTokenMock.waitForDeployment();

    kipNode = await ethers.deployContract("KIPNode", [
      owner.getAddress(),
      (await paymentTokenMock.getAddress()),
    ]);
    await paymentTokenMock.waitForDeployment();
  });

  it("Should support Ownable", async function () {
    expect(kipNode.getFunction("owner()")).to.be.instanceOf(Function);
    expect(kipNode.getFunction("transferOwnership(address)")).to.be.instanceOf(Function);
  });

  it("Should return the owner set in constructor", async function () {
    expect(await kipNode.owner()).to.equal(await owner.getAddress());
  });

  it("Should fail if non-owner setBaseURI", async function () {
    // Try to set base URI from addr1 (not owner)
    await expect(kipNode.connect(addr1).setBaseURI("http://example.com")).to.be.revertedWithCustomError(kipNode, "OwnableUnauthorizedAccount");
  });

  it("Should success if owner setBaseURI", async function () {
    // Set base URI from owner
    await kipNode.connect(owner).setBaseURI("http://example.com");

    // Check if base URI is set correctly
    expect(await kipNode.baseURI()).to.equal("http://example.com");
  });

  it("Should fail if non-owner setKIPFundAddress", async function () {
    await expect(kipNode.connect(addr1).setKIPFundAddress("0x000000000000000000000000000000000000dEaD")).to.be.revertedWithCustomError(kipNode, "OwnableUnauthorizedAccount");
  });

  it("Should success if owner setKIPFundAddress", async function () {
    await kipNode.connect(owner).setKIPFundAddress("0x000000000000000000000000000000000000dEaD");

    expect(await kipNode.KIPFundAddress()).to.equal("0x000000000000000000000000000000000000dEaD");
  });

  it("Should fail if non-owner setPaymentToken", async function () {
    const newPaymentTokenMock = await ethers.deployContract("PaymentTokenMock");
    await newPaymentTokenMock.waitForDeployment();
    const newPaymentTokenMockAddress = await newPaymentTokenMock.getAddress();

    await expect(kipNode.connect(addr1).setPaymentToken(newPaymentTokenMockAddress)).to.be.revertedWithCustomError(kipNode, "OwnableUnauthorizedAccount");
  });

  it("Should success if owner setPaymentToken with ERC20 address", async function () {
    const newPaymentTokenMock = await ethers.deployContract("PaymentTokenMock");
    await newPaymentTokenMock.waitForDeployment();
    const newPaymentTokenMockAddress = await newPaymentTokenMock.getAddress();

    await kipNode.connect(owner).setPaymentToken(newPaymentTokenMockAddress);
    expect(await kipNode.paymentToken()).to.equal(newPaymentTokenMockAddress);
  });
});

describe("Whitelist behaviors", function () {
  let kipNode: KIPNode,
  paymentTokenMock,
  owner: Signer, 
  addr1: Signer, 
  addr2: Signer, 
  addr3: Signer, 
  addrs,
  tier: number = 10,
  merkleTree: StandardMerkleTree<[string, string]>;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

    paymentTokenMock = await ethers.deployContract("PaymentTokenMock");
    await paymentTokenMock.waitForDeployment();

    kipNode = await ethers.deployContract("KIPNode", [
      owner.getAddress(),
      (await paymentTokenMock.getAddress()),
    ]);
    await paymentTokenMock.waitForDeployment();
  });

  it("Should fail if tier = 0", async function () {
    const latestTimestamp = await time.latest()

    merkleTree = OffchainUtils.generateMerkleTree(
      [
        { address: (await addr1.getAddress()), amount: "10" },
        { address: (await addr2.getAddress()), amount: "10" },
        { address: (await addr3.getAddress()), amount: "10" },
      ]
    );

    await expect(kipNode.connect(owner).setWhitelistSaleConfigs(0, {
      merkleRoot: merkleTree.root,
      maxPerTier: 10,
      totalMintedAmount: 0,
      start: latestTimestamp,
      end: latestTimestamp + 1_000_000,
    })).to.be.reverted;

    expect(tier).to.not.equal(0);
  });

  it("Should fail if end lower than lastTimestamp", async function () {
    const latestTimestamp = await time.latest()

    merkleTree = OffchainUtils.generateMerkleTree(
      [
        { address: (await addr1.getAddress()), amount: "10" },
        { address: (await addr2.getAddress()), amount: "10" },
        { address: (await addr3.getAddress()), amount: "10" },
      ]
    );

    const end = latestTimestamp - 1_000
    await expect(kipNode.connect(owner).setWhitelistSaleConfigs(0, {
      merkleRoot: merkleTree.root,
      maxPerTier: 10,
      totalMintedAmount: 0,
      start: latestTimestamp,
      end: end,
    })).to.be.reverted;

    expect(end).to.be.greaterThan(latestTimestamp);
  });

  it('Should allow address in whitelist mint with correct amount', async function () {
    const latestTimestamp = await time.latest()

    merkleTree = OffchainUtils.generateMerkleTree(
      [
        { address: (await addr1.getAddress()), amount: "10" },
        { address: (await addr2.getAddress()), amount: "10" },
        { address: (await addr3.getAddress()), amount: "10" },
      ]
    );

    await kipNode.connect(owner).setWhitelistSaleConfigs(tier, {
      merkleRoot: merkleTree.root,
      maxPerTier: 10,
      totalMintedAmount: 0,
      start: latestTimestamp,
      end: latestTimestamp + 1_000_000,
    });

    await kipNode.connect(addr1).whitelistMint(
      tier,
      (await addr1.getAddress()),
      10,
      10,
      OffchainUtils.getProofFromTree(merkleTree, (await addr1.getAddress()))
    )
  });

  it("Should fails if mint different tier", async function () {
    const latestTimestamp = await time.latest();
    merkleTree = OffchainUtils.generateMerkleTree(
      [
        { address: (await addr1.getAddress()), amount: "10" },
        { address: (await addr2.getAddress()), amount: "10" },
        { address: (await addr3.getAddress()), amount: "10" },
      ]
    );

    await kipNode.connect(owner).setWhitelistSaleConfigs(tier, {
      merkleRoot: merkleTree.root,
      maxPerTier: 10,
      totalMintedAmount: 0,
      start: latestTimestamp,
      end: latestTimestamp + 1_000_000,
    });

    const differentTier = tier + 1;

    await expect(kipNode.connect(addr1).whitelistMint(
      differentTier,
      (await addr1.getAddress()),
      10,
      10,
      OffchainUtils.getProofFromTree(merkleTree, (await addr1.getAddress()))
    )).to.be.revertedWith("Sale: Not yet started or ended");
    
    expect(tier).not.equal(differentTier);
  });
});