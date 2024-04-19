import { expect } from "chai";
import { ethers } from "hardhat";
import { KIPNode } from "../typechain-types";
import { Signer } from "ethers";

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

  it.skip("Should have a total supply of 50000 keep it flexiable for now", async function () {
    // @ts-expect-error not implement this function in contract yet
    expect(await kipNode.totalSupply()).to.equal(50000);
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

  it("Only owner can setPaymentToken", async function () {
    const newPaymentTokenMock = await ethers.deployContract("PaymentTokenMock");
    await newPaymentTokenMock.waitForDeployment();
    const newPaymentTokenMockAddress = await newPaymentTokenMock.getAddress();

    await expect(kipNode.connect(addr1).setPaymentToken(newPaymentTokenMockAddress)).to.be.revertedWithCustomError(kipNode, "OwnableUnauthorizedAccount");

    await kipNode.connect(owner).setPaymentToken(newPaymentTokenMockAddress);

    expect(await kipNode.paymentToken()).to.equal(newPaymentTokenMockAddress);
  });
});