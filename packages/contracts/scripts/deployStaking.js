//@ts-check
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const hre = require("hardhat");
const { UniswapV2Factory } = require("../mainnetDeployment/ABIs/UniswapV2Factory.js");
const { UniswapV2Pair } = require("../mainnetDeployment/ABIs/UniswapV2Pair.js");
//@ts-ignore
const ethers = hre.ethers;
const MainnetDeploymentHelper = require("../utils/mainnetDeploymentHelpers.js");
const { TestHelper: th, TimeValues: timeVals } = require("../utils/testHelpers.js");
const { dec } = th;

let configParams = {};
let mdh;
let deployment;

async function getGasPrice() {
  //@ts-ignore
  const basefee = await ethers.provider.getGasPrice();
  return ethers.BigNumber.from(basefee).add(ethers.BigNumber.from("20000000000")); // add tip
}

async function deployPool() {
  const deployerWallet = (await ethers.getSigners())[0];
  //@ts-ignore
  const factoryAddr = configParams.externalAddrs.TJ_FACTORY;
  const tjFactory = new ethers.Contract(factoryAddr, UniswapV2Factory.abi, deployerWallet);
  const tsdAddr = deployment["lusdToken"].address;
  const teddyAddr = deployment["lqtyToken"].address;

  let pool3PairAddr = await tjFactory.getPair(tsdAddr, teddyAddr);

  if (pool3PairAddr == th.ZERO_ADDRESS) {
    const gasPrice = await getGasPrice();
    const pairTx = await mdh.sendAndWaitForTransaction(
      tjFactory.createPair(teddyAddr, tsdAddr, { gasPrice })
    );
    deployment["p3Token"] = { address: pool3PairAddr, txHash: pairTx.hash };
    // Check Uniswap Pair LUSD-WETH pair after pair creation (forwards and backwards should have same address)
    pool3PairAddr = await tjFactory.getPair(teddyAddr, tsdAddr);

    assert.notEqual(pool3PairAddr, th.ZERO_ADDRESS);
    const _pool3PairAddr = await tjFactory.getPair(teddyAddr, tsdAddr);

    console.log(`Pool3 pair contract address after Uniswap pair creation: ${_pool3PairAddr}`);
    assert.equal(pool3PairAddr, _pool3PairAddr);
    mdh.saveDeployment(deployment);
  } else {
    console.log(`Pool3 pair contract address after TJ pair creation: ${pool3PairAddr}`);
    if (!deployment["p3Token"]) {
      deployment["p3Token"] = { address: pool3PairAddr };
    }
  }
  return pool3PairAddr;
}

async function deployStaking() {
  //@ts-ignore
  const deployerWallet = (await ethers.getSigners())[0];
  configParams.GAS_PRICE = await getGasPrice();
  mdh = new MainnetDeploymentHelper(configParams, deployerWallet);
  deployment = mdh.loadPreviousDeployment();

  const pool3PairAddr = await deployPool();
  const teddyContract = deployment["lqtyToken"].address;

  const rewardsFactory = await mdh.getFactory("StakingRewards");
  const rewardsParams = [deployerWallet.address, teddyContract, pool3PairAddr];

  const rewards = await mdh.loadOrDeploy(rewardsFactory, "p3Unipool", deployment, rewardsParams);
  console.log(`Rewards contract is ${rewards.address}`);
}

async function main() {
  const configFileName = path.resolve(`./mainnetDeployment/deploymentParams.${hre.network.name}.js`);
  assert(fs.existsSync(configFileName), `Cannot find config params for network ${configFileName}`);

  configParams = require(configFileName);
  await deployStaking();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
