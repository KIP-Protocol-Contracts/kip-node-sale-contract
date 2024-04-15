import { expect } from "chai";
import { ethers } from "hardhat";

describe("ERC721 behaviors", function () {
  let kipNode, paymentTokenMock, owner, addr1, addr2, addrs;
  
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
  
  it("Should return the token name", async function () {
    expect(await kipNode.name()).to.equal("KIP License");
  });

  it("Should return the token symbol", async function () {
    expect(await kipNode.symbol()).to.equal("KIPNODE");
  });

  it("Should have a total supply of 50000", async function () {
    expect(await kipNode.totalSupply()).to.equal(50000);
  });

  // it("Should not allow minting more than 50000 tokens", async function () {
  //   // Mint 50000 tokens to the owner
  //   for (let i = 0; i < 50000; i++) {
  //     await kipNode.mint(owner.address);
  //   }

  //   // Try to mint one more token
  //   await expect(kipNode.mint(owner.address)).to.be.revertedWith("Maximum supply reached");
  // });
});

describe("Owner behaviors", function () {
  let kipNode, paymentTokenMock, owner, addr1, addr2, addrs;

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

  it("Should return the owner set in constructor", async function () {
    expect(await kipNode.owner()).to.equal(owner.address);
  });

  it("Only owner can setBaseURI", async function () {
    // Try to set base URI from addr1 (not owner)
    await expect(kipNode.connect(addr1).setBaseURI("http://example.com")).to.be.revertedWithCustomError(kipNode, "OwnableUnauthorizedAccount");
    // Set base URI from owner
    await kipNode.connect(owner).setBaseURI("http://example.com");

    // Check if base URI is set correctly
    expect(await kipNode.baseURI()).to.equal("http://example.com");
  });  
});