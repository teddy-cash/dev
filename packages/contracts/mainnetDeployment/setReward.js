const MainnetDeploymentHelper = require("../utils/mainnetDeploymentHelpers.js")
const toBigNum = ethers.BigNumber.from;
const { TimeValues: timeVals } = require("../utils/testHelpers.js")

async function setReward(configParams) {
  const date = new Date()
  console.log(date.toUTCString())
  const deployerWallet = (await ethers.getSigners())[0]
  // const account2Wallet = (await ethers.getSigners())[1]
  const basefee = await ethers.provider.getGasPrice();
  const gasPrice = toBigNum(basefee).add(toBigNum('10000000000')) // add tip
  configParams.GAS_PRICE = gasPrice;
  console.log(`BWB gasPrice is ${configParams.GAS_PRICE}`)

  const mdh = new MainnetDeploymentHelper(configParams, deployerWallet)
  const deploymentState = mdh.loadPreviousDeployment()

  const factory = await ethers.getContractFactory("Pool2Unipool", deployerWallet)
  const tjPool2Unipool = await mdh.loadOrDeploy(factory, 'tjPool2Unipool', deploymentState);
  console.log(`tjPool2Unipool address ${tjPool2Unipool.address}`);

  const pngPool2Unipool = await mdh.loadOrDeploy(factory, 'pngPool2Unipool', deploymentState);
  console.log(`pngPool2Unipool address ${pngPool2Unipool.address}`);
  const pools = {pngPool2Unipool: pngPool2Unipool, tjPool2Unipool: tjPool2Unipool}
  for (const [name, pool] of Object.entries(pools)) {
    const teddy = await mdh.loadOrDeploy(factory, 'lqtyToken', deploymentState);
    const balance = await teddy.balanceOf(pool.address);
    assert.notEqual(balance, 0)
    const isRenounced = await mdh.isOwnershipRenounced(pool);
    if (!isRenounced) {
      const tx = await mdh.sendAndWaitForTransaction(pool.setReward(timeVals.SECONDS_IN_ONE_WEEK * 4, {gasPrice}));
      console.log(`Rewards set for ${name} in ${tx.transactionHash}`);
    } else {
      console.log(`Rewards already set for ${name}`);
    }
  }
}

module.exports = {
  setReward
}
