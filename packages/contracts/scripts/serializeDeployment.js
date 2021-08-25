const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const USAGE = "USAGE: serializeDeployment.js NETWORK_OUTPUT.json"

const deployment = {
  "bootstrapPeriod": 1209600,
  "totalStabilityPoolLQTYReward": "32000000",
  "liquidityMiningLQTYRewardRate": "0.257201646090534979",
  "_priceFeedIsTestnet": false,
  "_uniTokenIsMock": false,
  "_isDev": false,
  "addresses": {}
};

// this is actually PNG
const uniToken = {43113: '0x83080D4b5fC60e22dFFA8d14AD3BB41Dde48F199', 43114: '0x60781C2586D68229fde47564546784ab3fACA982'};

async function main() {
    const outputFile = process.argv[2];
    if (!outputFile) {
        throw new Error(USAGE);
    }

    const params = JSON.parse(fs.readFileSync(outputFile))
    //console.log(params)
    const depFile = path.resolve(`${__dirname}/../../lib-ethers/deployments/default/${params.metadata.network.name}.json`);
    deployment.chainId = params.metadata.network.chainId;
    deployment.startBlock = params.metadata.startBlock;
    deployment.deploymentDate = params.metadata.deploymentDate;
    for (const k of Object.keys(params)) {
        if (k === 'metadata' || k[0] === k[0].toUpperCase() || k === 'tellorCaller') {
            continue;
        }
        deployment.addresses[k] = params[k].address;
    }
    
    deployment.addresses['uniToken'] = uniToken[deployment.chainId];

    // the version is the git commit
    const version = execSync('git rev-parse HEAD').toString().trimRight();
    deployment.version = version;
    fs.writeFileSync(depFile, JSON.stringify(deployment, null, 4));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

