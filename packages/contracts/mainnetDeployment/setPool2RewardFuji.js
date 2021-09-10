const { mainnetDeploy } = require('./mainnetDeployment.js')
const configParams = require("./deploymentParams.fuji.js")
const { setReward } = require('./setReward.js')

async function main() {
  await setReward(configParams)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
