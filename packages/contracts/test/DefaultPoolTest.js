const testHelpers = require("../utils/testHelpers.js")
const DefaultPool = artifacts.require("./DefaultPool.sol");
const NonPayable = artifacts.require('NonPayable.sol')

const th = testHelpers.TestHelper
const dec = th.dec

contract('DefaultPool', async accounts => {
  let defaultPool
  let nonPayable

  let [owner] = accounts

  beforeEach('Deploy contracts', async () => {
    defaultPool = await DefaultPool.new()
    nonPayable = await NonPayable.new()
    await defaultPool.setAddresses(owner, owner)
  })

  it('sendETH(): fails if receiver cannot receive ETH', async () => {
    const amount = dec(1, 'ether')

    await web3.eth.sendTransaction({ to: defaultPool.address, from: owner, value: amount })

    await th.assertRevert(defaultPool.sendETH(nonPayable.address, amount, { from: owner }), 'DefaultPool: sending ETH failed')
  })
})

contract('Reset chain state', async accounts => { })
