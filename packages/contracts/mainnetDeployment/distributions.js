const configParams = require("./deploymentParams.fuji.js")
const MainnetDeploymentHelper = require("../utils/mainnetDeploymentHelpers.js")

async function getFactory(name, wallet) {
  const factory = await ethers.getContractFactory(name, wallet);
  return factory;
};

async function main() {
  const deployerWallet = (await ethers.getSigners())[0]
  // const account2Wallet = (await ethers.getSigners())[1]
  const mdh = new MainnetDeploymentHelper(configParams, deployerWallet)
  const gasPrice = configParams.GAS_PRICE

  const deploymentState = mdh.loadPreviousDeployment();
  const lqtyToken = new ethers.Contract(
    deploymentState['lqtyToken'].address,
    getFactory('LQTYToken', deployerWaller).interface,
        deployerWallet
  );
  

  const investorA = deploymentState['TEST_INVESTOR_A'].address;
  const investorAC = new ethers.Contract(
        investorA,
        lockupContractEthersFactory.interface,
        deployerWallet
  );
  
  

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
