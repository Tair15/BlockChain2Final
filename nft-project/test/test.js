const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DAAToken", function () {
    let daaToken, owner, addr1, addr2;

    beforeEach(async function () {
        const DAAToken = await ethers.getContractFactory("DAAToken");
        daaToken = await DAAToken.deploy();
        await daaToken.deployed();

        [owner, addr1, addr2] = await ethers.getSigners();
    });

    describe("Deployment", function () {
        it("Should set the right admin", async function () {
            expect(await daaToken.admin()).to.equal(owner.address);
        });

        it("Should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await daaToken.balanceOf(owner.address);
            expect(await daaToken.totalSupply()).to.equal(ownerBalance);
        });
    });

    describe("Transactions", function () {
        it("Should transfer tokens between accounts", async function () {
            await daaToken.transfer(addr1.address, 50);
            const addr1Balance = await daaToken.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(50);

            await daaToken.connect(addr1).transfer(addr2.address, 50);
            const addr2Balance = await daaToken.balanceOf(addr2.address);
            expect(addr2Balance).to.equal(50);
        });

        it("Should update transfer details correctly", async function () {
            await daaToken.transfer(addr1.address, 100);

            expect(await daaToken.getTransactionSender()).to.equal(owner.address);
            expect(await daaToken.getTransactionReceiver()).to.equal(addr1.address);
        });

        it("Should emit a TransferInfo event", async function () {
            await expect(daaToken.transfer(addr1.address, 100))
                .to.emit(daaToken, "TransferInfo")
                .withArgs(owner.address, addr1.address, 100, await ethers.provider.getBlock('latest').then(block => block.timestamp));
        });
    });

    // Additional tests can include checking for failure modes, permissions, etc.
});
