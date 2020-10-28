const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32


contract('PoolManager', async accounts => {

  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    whale,
    alice, bob, carol, dennis, erin, flyn,
    A, B, C, D, E, F,
    frontEnd_1, frontEnd_2, frontEnd_3,
  ] = accounts;

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let gasPriceInWei

  describe("Stability Pool Mechanisms", async () => {

    before(async () => {

      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      const GTContracts = await deploymentHelper.deployGTContracts()

      priceFeed = contracts.priceFeed
      clvToken = contracts.clvToken
      poolManager = contracts.poolManager
      sortedCDPs = contracts.sortedCDPs
      cdpManager = contracts.cdpManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers

      gtStaking = GTContracts.gtStaking
      growthToken = GTContracts.growthToken
      communityIssuance = GTContracts.communityIssuance
      lockupContractFactory = GTContracts.lockupContractFactory

      await deploymentHelper.connectGTContracts(GTContracts)
      await deploymentHelper.connectCoreContracts(contracts, GTContracts)
      await deploymentHelper.connectGTContractsToCore(GTContracts, contracts)

      // Register 3 front ends
      await th.registerFrontEnds(frontEnds, poolManager)
    })

    // --- provideToSP() ---
    // increases recorded CLV at Stability Pool
    it("provideToSP(): increases the Stability Pool CLV balance", async () => {
      // --- SETUP --- Give Alice 200 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(200, alice, { from: alice })

      // --- TEST ---
      // check CLV balances before
      const alice_CLV_Before = await clvToken.balanceOf(alice)
      const stabilityPool_CLV_Before = await stabilityPool.getCLV({ from: poolManager.address })
      assert.equal(alice_CLV_Before, 200)
      assert.equal(stabilityPool_CLV_Before, 0)

      // provideToSP()
      await poolManager.provideToSP(200, frontEnd_1, { from: alice })

      // check CLV balances after
      const alice_CLV_After = await clvToken.balanceOf(alice)
      const stabilityPool_CLV_After = await stabilityPool.getCLV({ from: poolManager.address })
      assert.equal(alice_CLV_After, 0)
      assert.equal(stabilityPool_CLV_After, 200)
    })

    it("provideToSP(): updates the user's deposit record in PoolManager", async () => {
      // --- SETUP --- give Alice 200 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(200, alice, { from: alice })

      // --- TEST ---
      // check user's deposit record before
      const alice_depositRecord_Before = (await poolManager.deposits(alice))[0]
      assert.equal(alice_depositRecord_Before, 0)

      // provideToSP()
      await poolManager.provideToSP(200, frontEnd_1, { from: alice })

      // check user's deposit record after
      const alice_depositRecord_After = (await poolManager.deposits(alice))[0]
      assert.equal(alice_depositRecord_After, 200)
    })

    it("provideToSP(): reduces the user's CLV balance by the correct amount", async () => {
      // --- SETUP --- Give Alice 200 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(200, alice, { from: alice })

      // --- TEST ---
      // check user's deposit record before
      const alice_CLVBalance_Before = await clvToken.balanceOf(alice)
      assert.equal(alice_CLVBalance_Before, 200)

      // provideToSP()
      await poolManager.provideToSP(200, frontEnd_1, { from: alice })

      // check user's deposit record after
      const alice_CLVBalance_After = await clvToken.balanceOf(alice)
      assert.equal(alice_CLVBalance_After, 0)
    })

    it("provideToSP(): increases totalCLVDeposits by correct amount", async () => {
      // --- SETUP ---

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', frontEnd_1, { from: whale })

      const totalCLVDeposits = await stabilityPool.getCLV()
      assert.equal(totalCLVDeposits, '2000000000000000000000')
    })

    it('provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
      // --- SETUP ---

      // Whale opens CDP with 50 ETH, adds 2000 CLV to StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('2000000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('2000000000000000000000', frontEnd_1, { from: whale })
      // 2 CDPs opened, each withdraws 180 CLV
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_2, { from: defaulter_2 })

      // Alice makes CDP and withdraws 100 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(100, alice, { from: alice })

      // price drops: defaulter's CDPs fall below MCR, whale doesn't
      await priceFeed.setPrice('100000000000000000000');

      // CDPs are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })
      await cdpManager.liquidate(defaulter_2, { from: owner });

      // --- TEST ---
      const P_Before = (await poolManager.P())  // expected: 0.18 CLV
      const S_Before = (await poolManager.epochToScaleToSum(0, 0))  // expected: 0.001 Ether
      const G_Before = (await poolManager.epochToScaleToG(0, 0))

      // Check 'Before' snapshots
      const alice_snapshot_Before = await poolManager.depositSnapshots(alice)
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString()
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString()
      const alice_snapshot_G_Before = alice_snapshot_Before[2].toString()
      assert.equal(alice_snapshot_S_Before, '0')
      assert.equal(alice_snapshot_P_Before, '0')
      assert.equal(alice_snapshot_G_Before, '0')

      // Make deposit
      await poolManager.provideToSP(100, frontEnd_1, { from: alice })

      // Check 'After' snapshots
      const alice_snapshot_After = await poolManager.depositSnapshots(alice)
      const alice_snapshot_S_After = alice_snapshot_After[0].toString()
      const alice_snapshot_P_After = alice_snapshot_After[1].toString()
      const alice_snapshot_G_After = alice_snapshot_Before[2].toString()

      assert.equal(alice_snapshot_S_After, S_Before)
      assert.equal(alice_snapshot_P_After, P_Before)
      assert.equal(alice_snapshot_G_After, G_Before)
    })

    it("provideToSP(), multiple deposits: updates user's deposit and snapshots", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })
      await borrowerOperations.withdrawCLV('1850000000000000000000', alice, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 3 CDPs opened. Two users withdraw 180 CLV each
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, defaulter_3, { from: defaulter_3, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_2, { from: defaulter_2 })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_3, { from: defaulter_3 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      const alice_Snapshot_0 = await poolManager.depositSnapshots(alice)
      const alice_Snapshot_S_0 = alice_Snapshot_0[0]
      const alice_Snapshot_P_0 = alice_Snapshot_0[1]
      assert.equal(alice_Snapshot_S_0, 0)
      assert.equal(alice_Snapshot_P_0, '1000000000000000000')

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      const alice_compoundedDeposit_1 = await poolManager.getCompoundedCLVDeposit(alice)

      // Alice makes deposit #2:  100CLV
      const alice_topUp_1 = web3.utils.toBN('100000000000000000000')
      await borrowerOperations.withdrawCLV(alice_topUp_1, alice, { from: alice })
      await poolManager.provideToSP(alice_topUp_1, frontEnd_1, { from: alice })

      const alice_newDeposit_1 = ((await poolManager.deposits(alice))[0]).toString()
      assert.equal(alice_compoundedDeposit_1.add(alice_topUp_1), alice_newDeposit_1)

      // get system reward terms
      const P_1 = (await poolManager.P()).toString()
      const S_1 = (await poolManager.epochToScaleToSum(0, 0)).toString()

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await poolManager.depositSnapshots(alice)
      const alice_Snapshot_S_1 = alice_Snapshot_1[0].toString()
      const alice_Snapshot_P_1 = alice_Snapshot_1[1].toString()
      assert.equal(alice_Snapshot_S_1, S_1)
      assert.equal(alice_Snapshot_P_1, P_1)

      // Bob withdraws CLV and deposits to StabilityPool, bringing total deposits to: (1850 + 223 + 427) = 2500 CLV
      await borrowerOperations.openLoan(0, bob, { from: bob, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('427000000000000000000', bob, { from: bob })
      await poolManager.provideToSP('427000000000000000000', frontEnd_1, { from: bob })

      // Defaulter 3 CDP is closed
      await cdpManager.liquidate(defaulter_3, { from: owner })

      const alice_compoundedDeposit_2 = await poolManager.getCompoundedCLVDeposit(alice)

      const P_2 = (await poolManager.P()).toString()
      const S_2 = (await poolManager.epochToScaleToSum(0, 0)).toString()

      // Alice makes deposit #3:  100CLV
      await borrowerOperations.withdrawCLV('100000000000000000000', alice, { from: alice })
      await poolManager.provideToSP('100000000000000000000', frontEnd_1, { from: alice })

      // check Alice's new snapshot is correct
      const alice_Snapshot_2 = await poolManager.depositSnapshots(alice)
      const alice_Snapshot_S_2 = alice_Snapshot_2[0].toString()
      const alice_Snapshot_P_2 = alice_Snapshot_2[1].toString()
      assert.equal(alice_Snapshot_S_2, S_2)
      assert.equal(alice_Snapshot_P_2, P_2)
    })

    it("provideToSP(): reverts if user tries to provide more than their CLV balance", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(50, 18), bob, { from: bob, value: dec(1, 'ether') })

      // Alice, with balance 100 CLV, attempts to deposit 100.00000000000000000001 CLV
      try {
        aliceTx = await poolManager.provideToSP('10000000000000000000001', frontEnd_1, { from: alice })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      // Bob, with balance 50 CLV, attempts to deposit 235534 CLV
      try {
        bobTx = await poolManager.provideToSP('235534000000000000000000', frontEnd_1, { from: bob })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("provideToSP(): reverts if user tries to provide 2^256-1 CLV, which exceeds their balance", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(50, 18), bob, { from: bob, value: dec(1, 'ether') })

      const maxBytes32 = web3.utils.toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      // Alice, with balance 100 CLV, attempts to deposit 2^256-1 CLV CLV
      try {
        aliceTx = await poolManager.provideToSP(maxBytes32, frontEnd_1, { from: alice })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }

      // Bob, with balance 50 CLV, attempts to deposit 235534 CLV
      try {
        bobTx = await poolManager.provideToSP(maxBytes32, frontEnd_1, { from: bob })
        assert.isFalse(tx.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
      }
    })

    it("provideToSP(): doesn't impact other users' deposits or ETH gains", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(200, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(300, 18), frontEnd_1, { from: carol })

      // D opens a loan
      await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(4, 'ether') })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(170, 18), defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Defaulters are liquidated
      await cdpManager.liquidate(defaulter_1)
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isFalse(await sortedCDPs.contains(defaulter_2))


      const alice_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const carol_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(carol)).toString()

      const alice_ETHGain_Before = (await poolManager.getDepositorETHGain(alice)).toString()
      const bob_ETHGain_Before = (await poolManager.getDepositorETHGain(bob)).toString()
      const carol_ETHGain_Before = (await poolManager.getDepositorETHGain(carol)).toString()

      //check non-zero CLV and ETHGain in the Stability Pool
      const CLVinSP = await stabilityPool.getCLV()
      const ETHinSP = await stabilityPool.getETH()
      assert.isTrue(CLVinSP.gt(mv._zeroBN))
      assert.isTrue(ETHinSP.gt(mv._zeroBN))

      // D makes an SP deposit
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: dennis })
      assert.equal((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), dec(100, 18))

      const alice_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const carol_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(carol)).toString()

      const alice_ETHGain_After = (await poolManager.getDepositorETHGain(alice)).toString()
      const bob_ETHGain_After = (await poolManager.getDepositorETHGain(bob)).toString()
      const carol_ETHGain_After = (await poolManager.getDepositorETHGain(carol)).toString()

      // Check compounded deposits and ETH gains for A, B and C have not changed
      assert.equal(alice_CLVDeposit_Before, alice_CLVDeposit_After)
      assert.equal(bob_CLVDeposit_Before, bob_CLVDeposit_After)
      assert.equal(carol_CLVDeposit_Before, carol_CLVDeposit_After)

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
      assert.equal(carol_ETHGain_Before, carol_ETHGain_After)
    })

    it("provideToSP(): doesn't impact system debt, collateral or TCR", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(200, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(300, 18), frontEnd_1, { from: carol })

      // D opens a loan
      await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(4, 'ether') })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(170, 18), defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Defaulters are liquidated
      await cdpManager.liquidate(defaulter_1)
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      const activeDebt_Before = (await activePool.getCLVDebt()).toString()
      const defaultedDebt_Before = (await defaultPool.getCLVDebt()).toString()
      const activeColl_Before = (await activePool.getETH()).toString()
      const defaultedColl_Before = (await defaultPool.getETH()).toString()
      const TCR_Before = (await cdpManager.getTCR()).toString()

      // D makes an SP deposit
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: dennis })
      assert.equal((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), dec(100, 18))

      const activeDebt_After = (await activePool.getCLVDebt()).toString()
      const defaultedDebt_After = (await defaultPool.getCLVDebt()).toString()
      const activeColl_After = (await activePool.getETH()).toString()
      const defaultedColl_After = (await defaultPool.getETH()).toString()
      const TCR_After = (await cdpManager.getTCR()).toString()

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After)
      assert.equal(defaultedDebt_Before, defaultedDebt_After)
      assert.equal(activeColl_Before, activeColl_After)
      assert.equal(defaultedColl_Before, defaultedColl_After)
      assert.equal(TCR_Before, TCR_After)
    })

    it("provideToSP(): doesn't impact any troves, including the caller's trove", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      // A and B provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(200, 18), frontEnd_1, { from: bob })

      // D opens a loan
      await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(4, 'ether') })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await cdpManager.CDPs(whale))[0].toString()
      const alice_Debt_Before = (await cdpManager.CDPs(alice))[0].toString()
      const bob_Debt_Before = (await cdpManager.CDPs(bob))[0].toString()
      const carol_Debt_Before = (await cdpManager.CDPs(carol))[0].toString()
      const dennis_Debt_Before = (await cdpManager.CDPs(dennis))[0].toString()

      const whale_Coll_Before = (await cdpManager.CDPs(whale))[1].toString()
      const alice_Coll_Before = (await cdpManager.CDPs(alice))[1].toString()
      const bob_Coll_Before = (await cdpManager.CDPs(bob))[1].toString()
      const carol_Coll_Before = (await cdpManager.CDPs(carol))[1].toString()
      const dennis_Coll_Before = (await cdpManager.CDPs(dennis))[1].toString()

      const whale_ICR_Before = (await cdpManager.getCurrentICR(whale, price)).toString()
      const alice_ICR_Before = (await cdpManager.getCurrentICR(alice, price)).toString()
      const bob_ICR_Before = (await cdpManager.getCurrentICR(bob, price)).toString()
      const carol_ICR_Before = (await cdpManager.getCurrentICR(carol, price)).toString()
      const dennis_ICR_Before = (await cdpManager.getCurrentICR(dennis, price)).toString()

      // D makes an SP deposit
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: dennis })
      assert.equal((await poolManager.getCompoundedCLVDeposit(dennis)).toString(), dec(100, 18))

      const whale_Debt_After = (await cdpManager.CDPs(whale))[0].toString()
      const alice_Debt_After = (await cdpManager.CDPs(alice))[0].toString()
      const bob_Debt_After = (await cdpManager.CDPs(bob))[0].toString()
      const carol_Debt_After = (await cdpManager.CDPs(carol))[0].toString()
      const dennis_Debt_After = (await cdpManager.CDPs(dennis))[0].toString()

      const whale_Coll_After = (await cdpManager.CDPs(whale))[1].toString()
      const alice_Coll_After = (await cdpManager.CDPs(alice))[1].toString()
      const bob_Coll_After = (await cdpManager.CDPs(bob))[1].toString()
      const carol_Coll_After = (await cdpManager.CDPs(carol))[1].toString()
      const dennis_Coll_After = (await cdpManager.CDPs(dennis))[1].toString()

      const whale_ICR_After = (await cdpManager.getCurrentICR(whale, price)).toString()
      const alice_ICR_After = (await cdpManager.getCurrentICR(alice, price)).toString()
      const bob_ICR_After = (await cdpManager.getCurrentICR(bob, price)).toString()
      const carol_ICR_After = (await cdpManager.getCurrentICR(carol, price)).toString()
      const dennis_ICR_After = (await cdpManager.getCurrentICR(dennis, price)).toString()

      assert.equal(whale_Debt_Before, whale_Debt_After)
      assert.equal(alice_Debt_Before, alice_Debt_After)
      assert.equal(bob_Debt_Before, bob_Debt_After)
      assert.equal(carol_Debt_Before, carol_Debt_After)
      assert.equal(dennis_Debt_Before, dennis_Debt_After)

      assert.equal(whale_Coll_Before, whale_Coll_After)
      assert.equal(alice_Coll_Before, alice_Coll_After)
      assert.equal(bob_Coll_Before, bob_Coll_After)
      assert.equal(carol_Coll_Before, carol_Coll_After)
      assert.equal(dennis_Coll_Before, dennis_Coll_After)

      assert.equal(whale_ICR_Before, whale_ICR_After)
      assert.equal(alice_ICR_Before, alice_ICR_After)
      assert.equal(bob_ICR_Before, bob_ICR_After)
      assert.equal(carol_ICR_Before, carol_ICR_After)
      assert.equal(dennis_ICR_Before, dennis_ICR_After)
    })

    it("provideToSP(): doesn't protect the depositor's trove from liquidation", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      // A, B provide 100 CLV to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: bob })

      // Confirm Bob has an active trove in the system
      assert.isTrue(await sortedCDPs.contains(bob))
      assert.equal((await cdpManager.getCDPStatus(bob)).toString(), '1')  // Confirm Bob's trove status is active

      // Confirm Bob has a Stability deposit
      assert.equal((await poolManager.getCompoundedCLVDeposit(bob)).toString(), dec(100, 18))

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // Liquidate bob
      await cdpManager.liquidate(bob)

      // Check Bob's trove has been removed from the system
      assert.isFalse(await sortedCDPs.contains(bob))
      assert.equal((await cdpManager.getCDPStatus(bob)).toString(), '2')  // check Bob's trove status is closed
    })

    it("provideToSP(): providing 0 CLV doesn't alter the caller's deposit or the total CLV in the Stability Pool", async () => {
      // --- SETUP ---
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(30, 18), frontEnd_1, { from: carol })

      const bob_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const CLVinSP_Before = (await stabilityPool.getCLV()).toString()

      assert.equal(CLVinSP_Before, dec(180, 18))

      // Bob provides 0 CLV to the Stability Pool 
      await poolManager.provideToSP(0, frontEnd_1, { from: bob })

      // check Bob's deposit and total CLV in Stability Pool has not changed
      const bob_Deposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()

      assert.equal(bob_Deposit_Before, bob_Deposit_After)
      assert.equal(CLVinSP_Before, CLVinSP_After)
    })


    it("provideToSP(), new deposit: triggers LQTY reward event - increases the sum G", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // A provides to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })

      const G_Before = await poolManager.epochToScaleToG(0, 0)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B provides to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: B })

      const G_After = await poolManager.epochToScaleToG(0, 0)

      // Expect G has increased from the LQTY reward event triggered
      assert.isTrue(G_After.gt(G_Before))
    })

    it("provideToSP(), new deposit: sets the correct front end tag", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(dec(400, 18), D, { from: D, value: dec(3, 'ether') })

      // Check A, B, C D have no front end tags
      const A_tagBefore = await poolManager.getFrontEndTag(A)
      const B_tagBefore = await poolManager.getFrontEndTag(B)
      const C_tagBefore = await poolManager.getFrontEndTag(C)
      const D_tagBefore = await poolManager.getFrontEndTag(D)

      assert.equal(A_tagBefore, ZERO_ADDRESS)
      assert.equal(B_tagBefore, ZERO_ADDRESS)
      assert.equal(C_tagBefore, ZERO_ADDRESS)
      assert.equal(D_tagBefore, ZERO_ADDRESS)

      // A, B, C provides to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(300, 18), frontEnd_3, { from: C })
      await poolManager.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: D })  // transacts directly, no front end

      // Check A, B, C D have no front end tags
      const A_tagAfter = await poolManager.getFrontEndTag(A)
      const B_tagAfter = await poolManager.getFrontEndTag(B)
      const C_tagAfter = await poolManager.getFrontEndTag(C)
      const D_tagAfter = await poolManager.getFrontEndTag(D)

      // Check front end tags are correctly set
      assert.equal(A_tagAfter, frontEnd_1)
      assert.equal(B_tagAfter, frontEnd_2)
      assert.equal(C_tagAfter, frontEnd_3)
      assert.equal(D_tagAfter, ZERO_ADDRESS)
    })

    it("provideToSP(), new deposit with active loan: becomes eligible for LQTY rewards", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // Check A, B, C, are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // A, B, C provides to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: C })  // transacts directly, no front end

      // Check A, B, C, are now eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))
    })

    it("provideToSP(), new deposit without active loan: remains ineligible for LQTY rewards", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers LUSD to A, B and C
      await clvToken.transfer(A, dec(100, 18), { from: whale })
      await clvToken.transfer(B, dec(200, 18), { from: whale })
      await clvToken.transfer(C, dec(300, 18), { from: whale })

      // Check A, B, C, are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // A, B, C provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: C })  // transacts directly, no front end

      // Check A, B, C, are still ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))
    })

    it("provideToSP(), new eligible deposit: depositor does not receive any LQTY rewards", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })

      // Check A, B, are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))

      // Get A, B, C LQTY balances before and confirm they're zero
      const A_LQTYBalance_Before = await growthToken.balanceOf(A)
      const B_LQTYBalance_Before = await growthToken.balanceOf(B)

      assert.equal(A_LQTYBalance_Before, '0')
      assert.equal(B_LQTYBalance_Before, '0')

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B })

      // Confirm A, B, are now eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))

      // Get A, B, C LQTY balances after, and confirm they're still zero
      const A_LQTYBalance_After = await growthToken.balanceOf(A)
      const B_LQTYBalance_After = await growthToken.balanceOf(B)

      assert.equal(A_LQTYBalance_After, '0')
      assert.equal(B_LQTYBalance_After, '0')
    })

    it("provideToSP(), new ineligible deposit: depositor does not receive any LQTY rewards", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers LUSD to A, B
      await clvToken.transfer(A, dec(100, 18), { from: whale })
      await clvToken.transfer(B, dec(200, 18), { from: whale })

      // Check A, B, are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))

      // Get A, B, C LQTY balances before and confirm they're zero
      const A_LQTYBalance_Before = await growthToken.balanceOf(A)
      const B_LQTYBalance_Before = await growthToken.balanceOf(B)

      assert.equal(A_LQTYBalance_Before, '0')
      assert.equal(B_LQTYBalance_Before, '0')

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B })

      // Confirm A, B, are still ineligible for LQTY rewards, as they have not opened troves
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))

      // Get A, B LQTY balances after, and confirm they're still zero
      const A_LQTYBalance_After = await growthToken.balanceOf(A)
      const B_LQTYBalance_After = await growthToken.balanceOf(B)

      assert.equal(A_LQTYBalance_After, '0')
      assert.equal(B_LQTYBalance_After, '0')
    })

    it("provideToSP(), new eligible deposit after past full withdrawal: depositor does not receive any LQTY rewards", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, open loans 
      await borrowerOperations.openLoan(dec(105, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(205, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(10, 18), C, { from: C, value: dec(2, 'ether') })


      await borrowerOperations.openLoan(dec(10, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // --- SETUP --- 

      // A, B provide to SP
      await poolManager.provideToSP(dec(105, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(105, 18), frontEnd_2, { from: B })

      // time passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // C deposits. A, and B earn LQTY
      await poolManager.provideToSP(dec(5, 18), ZERO_ADDRESS, { from: C })

      // Price drops, defaulter is liquidated, A, B and C earn ETH
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())

      await cdpManager.liquidate(defaulter_1)

      // A and B fully withdraw from the pool
      await poolManager.withdrawFromSP(dec(105, 18), { from: A })
      await poolManager.withdrawFromSP(dec(105, 18), { from: B })

      // --- TEST --- 

      // Check A, B, are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))

      // Get A, B, C LQTY balances before and confirm they're zero
      const A_LQTYBalance_Before = await growthToken.balanceOf(A)
      const B_LQTYBalance_Before = await growthToken.balanceOf(B)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B })

      // Confirm A, B, are now eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))

      // Get A, B, C LQTY balances after, and confirm they have not changed
      const A_LQTYBalance_After = await growthToken.balanceOf(A)
      const B_LQTYBalance_After = await growthToken.balanceOf(B)

      assert.isTrue(A_LQTYBalance_After.eq(A_LQTYBalance_Before))
      assert.isTrue(B_LQTYBalance_After.eq(B_LQTYBalance_Before))
    })

    it("provideToSP(), new ineligible deposit after past full withdrawal: depositor does not receive any LQTY rewards", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers CLV to A and B
      await clvToken.transfer(A, dec(300, 18), { from: whale })
      await clvToken.transfer(B, dec(300, 18), { from: whale })

      await borrowerOperations.openLoan(dec(10, 18), C, { from: C, value: dec(2, 'ether') })

      await borrowerOperations.openLoan(dec(10, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // --- SETUP --- 

      // A, B provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(100, 18), frontEnd_2, { from: B })

      // time passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // C deposits. A, and B earn LQTY
      await poolManager.provideToSP(dec(5, 18), ZERO_ADDRESS, { from: C })

      // Price drops, defaulter is liquidated, A, B and C earn ETH
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())

      await cdpManager.liquidate(defaulter_1)

      // A and B fully withdraw from the pool
      await poolManager.withdrawFromSP(dec(105, 18), { from: A })
      await poolManager.withdrawFromSP(dec(105, 18), { from: B })

      // --- TEST --- 

      // Check A, B, are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))

      // Get A, B, C LQTY balances before and confirm they're zero
      const A_LQTYBalance_Before = await growthToken.balanceOf(A)
      const B_LQTYBalance_Before = await growthToken.balanceOf(B)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B })

      // Confirm A, B, are still ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))

      // Get A, B, C LQTY balances after, and confirm they have not changed
      const A_LQTYBalance_After = await growthToken.balanceOf(A)
      const B_LQTYBalance_After = await growthToken.balanceOf(B)

      assert.isTrue(A_LQTYBalance_After.eq(A_LQTYBalance_Before))
      assert.isTrue(B_LQTYBalance_After.eq(B_LQTYBalance_Before))
    })


    it("provideToSP(), new eligible deposit: tagged front end receives LQTY rewards", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C, D, E, F open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), D, { from: D, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), E, { from: E, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), F, { from: F, value: dec(3, 'ether') })

      // Check A, B, C are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // D, E, F provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: D })
      await poolManager.provideToSP(dec(200, 18), frontEnd_2, { from: E })
      await poolManager.provideToSP(dec(300, 18), frontEnd_3, { from: F })

      // Get F1, F2, F3 LQTY balances before, and confirm they're zero
      const frontEnd_1_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_1)
      const frontEnd_2_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_2)
      const frontEnd_3_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_3)

      assert.equal(frontEnd_1_LQTYBalance_Before, '0')
      assert.equal(frontEnd_2_LQTYBalance_Before, '0')
      assert.equal(frontEnd_3_LQTYBalance_Before, '0')

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B, C provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(300, 18), frontEnd_3, { from: C })

      // Confirm A, B, C are now eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // Get F1, F2, F3 LQTY balances after, and confirm they have increased
      const frontEnd_1_LQTYBalance_After = await growthToken.balanceOf(frontEnd_1)
      const frontEnd_2_LQTYBalance_After = await growthToken.balanceOf(frontEnd_2)
      const frontEnd_3_LQTYBalance_After = await growthToken.balanceOf(frontEnd_3)

      assert.isTrue(frontEnd_1_LQTYBalance_After.gt(frontEnd_1_LQTYBalance_Before))
      assert.isTrue(frontEnd_2_LQTYBalance_After.gt(frontEnd_2_LQTYBalance_Before))
      assert.isTrue(frontEnd_3_LQTYBalance_After.gt(frontEnd_3_LQTYBalance_Before))
    })

    it("provideToSP(), new eligible deposit: tagged front end's stake increases", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C, open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // Check A, B, C are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Get front ends' stakes before
      const F1_Stake_Before = await poolManager.frontEndStakes(frontEnd_1)
      const F2_Stake_Before = await poolManager.frontEndStakes(frontEnd_2)
      const F3_Stake_Before = await poolManager.frontEndStakes(frontEnd_3)

      const deposit_A = dec(100, 18)
      const deposit_B = dec(200, 18)
      const deposit_C = dec(300, 18)

      // A, B, C provide to SP
      await poolManager.provideToSP(deposit_A, frontEnd_1, { from: A })
      await poolManager.provideToSP(deposit_B, frontEnd_2, { from: B })
      await poolManager.provideToSP(deposit_C, frontEnd_3, { from: C })

      // Check A, B, C are now eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // Get front ends' stakes after
      const F1_Stake_After = await poolManager.frontEndStakes(frontEnd_1)
      const F2_Stake_After = await poolManager.frontEndStakes(frontEnd_2)
      const F3_Stake_After = await poolManager.frontEndStakes(frontEnd_3)

      const F1_Diff = F1_Stake_After.sub(F1_Stake_Before)
      const F2_Diff = F2_Stake_After.sub(F2_Stake_Before)
      const F3_Diff = F3_Stake_After.sub(F3_Stake_Before)

      console.log(`F1_Stake_Before: ${F1_Stake_Before}`)
      console.log(`F1_Stake_After: ${F1_Stake_After}`)
      console.log(`deposit_A: ${deposit_A}`)
      console.log(`F2_Stake_Before: ${F2_Stake_Before}`)
      console.log(`F2_Stake_After: ${F2_Stake_After}`)
      console.log(`deposit_B: ${deposit_B}`)
      console.log(`F3_Stake_Before: ${F3_Stake_Before}`)
      console.log(`F3_Stake_After: ${F3_Stake_After}`)
      console.log(`deposit_C: ${deposit_C}`)
      // Check front ends' stakes have increased by amount equal to the deposit made through them 
      assert.equal(F1_Diff, deposit_A)
      assert.equal(F2_Diff, deposit_B)
      assert.equal(F3_Diff, deposit_C)
    })

    it("provideToSP(), new eligible deposit: tagged front end's snapshots update", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C, open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // D opens loan
      await borrowerOperations.openLoan(dec(2000, 18), D, { from: D, value: dec(20, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // --- SETUP ---

      await poolManager.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: D })

      // fastforward time then  make an SP deposit, to make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
      await poolManager.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: D })

      // Perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())

      await cdpManager.liquidate(defaulter_1)

      const currentEpoch = await poolManager.currentEpoch()
      const currentScale = await poolManager.currentScale()

      const S_Before = await poolManager.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await poolManager.P()
      const G_Before = await poolManager.epochToScaleToG(currentEpoch, currentScale)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(th.toBN('0')) && P_Before.lt(th.toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(th.toBN('0')))
      assert.isTrue(G_Before.gt(th.toBN('0')))

      // Check A, B, C are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Get front ends' snapshots before
      for (frontEnd of [frontEnd_1, frontEnd_2, frontEnd_3]) {
        const snapshot = await poolManager.frontEndSnapshots(frontEnd)

        assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends, since S corresponds to ETH gain)
        assert.equal(snapshot[1], '0')  // P 
        assert.equal(snapshot[2], '0')  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }

      const deposit_A = dec(100, 18)
      const deposit_B = dec(200, 18)
      const deposit_C = dec(300, 18)

      // --- TEST ---

      // A, B, C provide to SP
      const G1 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_A, frontEnd_1, { from: A })

      const G2 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_B, frontEnd_2, { from: B })

      const G3 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_C, frontEnd_3, { from: C })

      const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
      const G_Values = [G1, G2, G3]

      // Check A, B, C are now eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // Map frontEnds to the value of G at time the deposit was made
      frontEndToG = th.zipToObject(frontEnds, G_Values)

      // Get front ends' snapshots after
      for (const [frontEnd, G] of Object.entries(frontEndToG)) {
        const snapshot = await poolManager.frontEndSnapshots(frontEnd)

        // Check snapshots are the expected values
        assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends)
        assert.isTrue(snapshot[1].eq(P_Before))  // P 
        assert.isTrue(snapshot[2].eq(G))  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }
    })

    it("provideToSP(), new ineligible deposit: tagged front end doesn't receive LQTY rewards", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers LUSD to A, B, C
      await clvToken.transfer(A, dec(100, 18), { from: whale })
      await clvToken.transfer(B, dec(200, 18), { from: whale })
      await clvToken.transfer(C, dec(300, 18), { from: whale })

      // Check A, B, C are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Get F1, F2, F3 LQTY balances before, and confirm they're zero
      const frontEnd_1_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_1)
      const frontEnd_2_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_2)
      const frontEnd_3_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_3)

      assert.equal(frontEnd_1_LQTYBalance_Before, '0')
      assert.equal(frontEnd_2_LQTYBalance_Before, '0')
      assert.equal(frontEnd_3_LQTYBalance_Before, '0')

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B, C provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(200, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(300, 18), frontEnd_3, { from: C })

      // Confirm A, B, C are still ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Get F1, F2, F3 LQTY balances after, and check they are still zero
      const frontEnd_1_LQTYBalance_After = await growthToken.balanceOf(frontEnd_1)
      const frontEnd_2_LQTYBalance_After = await growthToken.balanceOf(frontEnd_2)
      const frontEnd_3_LQTYBalance_After = await growthToken.balanceOf(frontEnd_3)

      assert.equal(frontEnd_1_LQTYBalance_After, '0')
      assert.equal(frontEnd_2_LQTYBalance_After, '0')
      assert.equal(frontEnd_3_LQTYBalance_After, '0')
    })

    it("provideToSP(), new ineligible deposit: tagged front end's stake does not change", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers LUSD to A, B, C
      await clvToken.transfer(A, dec(100, 18), { from: whale })
      await clvToken.transfer(B, dec(200, 18), { from: whale })
      await clvToken.transfer(C, dec(300, 18), { from: whale })

      // Check A, B, C are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Get front ends' stakes before
      const F1_Stake_Before = await poolManager.frontEndStakes(frontEnd_1)
      const F2_Stake_Before = await poolManager.frontEndStakes(frontEnd_2)
      const F3_Stake_Before = await poolManager.frontEndStakes(frontEnd_3)

      const deposit_A = dec(100, 18)
      const deposit_B = dec(200, 18)
      const deposit_C = dec(300, 18)

      // A, B, C provide to SP
      await poolManager.provideToSP(deposit_A, frontEnd_1, { from: A })
      await poolManager.provideToSP(deposit_B, frontEnd_2, { from: B })
      await poolManager.provideToSP(deposit_C, frontEnd_3, { from: C })

      // Check A, B, C are still ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Get front ends' stakes after
      const F1_Stake_After = await poolManager.frontEndStakes(frontEnd_1)
      const F2_Stake_After = await poolManager.frontEndStakes(frontEnd_2)
      const F3_Stake_After = await poolManager.frontEndStakes(frontEnd_3)

      // Check front ends' stakes have not changed
      assert.isTrue(F1_Stake_After.eq(F1_Stake_Before))
      assert.isTrue(F2_Stake_After.eq(F2_Stake_Before))
      assert.isTrue(F3_Stake_After.eq(F3_Stake_Before))
    })

    it("provideToSP(), new eligible deposit: tagged front end's snapshots don't change", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C, open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // D opens loan
      await borrowerOperations.openLoan(dec(2000, 18), D, { from: D, value: dec(20, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // --- SETUP ---

      await poolManager.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: D })

      // fastforward time then  make an SP deposit, to make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await poolManager.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: D })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())

      await cdpManager.liquidate(defaulter_1)



      const currentEpoch = await poolManager.currentEpoch()
      const currentScale = await poolManager.currentScale()

      const S_Before = await poolManager.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await poolManager.P()
      const G_Before = await poolManager.epochToScaleToG(currentEpoch, currentScale)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(th.toBN('0')) && P_Before.lt(th.toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(th.toBN('0')))
      assert.isTrue(G_Before.gt(th.toBN('0')))

      // Check A, B, C are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Get front ends' snapshots before
      for (frontEnd of [frontEnd_1, frontEnd_2, frontEnd_3]) {
        const snapshot = await poolManager.frontEndSnapshots(frontEnd)

        assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends, since S corresponds to ETH gain)
        assert.equal(snapshot[1], '0')  // P 
        assert.equal(snapshot[2], '0')  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }

      const deposit_A = dec(100, 18)
      const deposit_B = dec(200, 18)
      const deposit_C = dec(300, 18)

      // --- TEST ---

      // A, B, C provide to SP
      const G1 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_A, frontEnd_1, { from: A })

      const G2 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_B, frontEnd_2, { from: B })

      const G3 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_C, frontEnd_3, { from: C })

      const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
      const G_Values = [G1, G2, G3]

      // Check A, B, C are now eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // Map frontEnds to the value of G at time the deposit was made
      frontEndToG = th.zipToObject(frontEnds, G_Values)

      // Get front ends' snapshots after
      for (const [frontEnd, G] of Object.entries(frontEndToG)) {
        const snapshot = await poolManager.frontEndSnapshots(frontEnd)

        // Check snapshots are the expected values
        assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends)
        assert.isTrue(snapshot[1].eq(P_Before))  // P 
        assert.isTrue(snapshot[2].eq(G))  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }
    })


    it("provideToSP(), new deposit: depositor does not receive ETH gains", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers LUSD to A, B
      await clvToken.transfer(A, dec(100, 18), { from: whale })
      await clvToken.transfer(B, dec(200, 18), { from: whale })

      // C, D open loans
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(10, 'ether') })
      await borrowerOperations.openLoan(dec(400, 18), D, { from: D, value: dec(10, 'ether') })

      // --- TEST ---

      // get current ETH balances
      const A_ETHBalance_Before = await web3.eth.getBalance(A)
      const B_ETHBalance_Before = await web3.eth.getBalance(B)
      const C_ETHBalance_Before = await web3.eth.getBalance(C)
      const D_ETHBalance_Before = await web3.eth.getBalance(D)

      // A, B, C, D provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A, gasPrice: 0 })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B, gasPrice: 0 })
      await poolManager.provideToSP(dec(300, 18), frontEnd_2, { from: C, gasPrice: 0 })
      await poolManager.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: D, gasPrice: 0 })

      // Get  ETH balances after
      const A_ETHBalance_After = await web3.eth.getBalance(A)
      const B_ETHBalance_After = await web3.eth.getBalance(B)
      const C_ETHBalance_After = await web3.eth.getBalance(C)
      const D_ETHBalance_After = await web3.eth.getBalance(D)

      // Check ETH balances have not changed
      assert.equal(A_ETHBalance_After, A_ETHBalance_Before)
      assert.equal(B_ETHBalance_After, B_ETHBalance_Before)
      assert.equal(C_ETHBalance_After, C_ETHBalance_Before)
      assert.equal(D_ETHBalance_After, D_ETHBalance_Before)
    })


    it("provideToSP(), new deposit: depositor does not receive ETH gains", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers LUSD to A, B
      await clvToken.transfer(A, dec(300, 18), { from: whale })
      await clvToken.transfer(B, dec(300, 18), { from: whale })

      // C, D open loans
      await borrowerOperations.openLoan(dec(400, 18), C, { from: C, value: dec(10, 'ether') })
      await borrowerOperations.openLoan(dec(500, 18), D, { from: D, value: dec(10, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // --- SETUP ---
      // A, B, C, D provide to SP
      await poolManager.provideToSP(dec(105, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(105, 18), ZERO_ADDRESS, { from: B })
      await poolManager.provideToSP(dec(105, 18), frontEnd_1, { from: C })
      await poolManager.provideToSP(dec(105, 18), ZERO_ADDRESS, { from: D })

      // time passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // C deposits. A,B,C,D earn LQTY
      await poolManager.provideToSP(dec(5, 18), ZERO_ADDRESS, { from: B })

      // Price drops, defaulter is liquidated, A, B, C, D earn ETH
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())

      await cdpManager.liquidate(defaulter_1)

      // A B,C, D fully withdraw from the pool
      await poolManager.withdrawFromSP(dec(105, 18), { from: A })
      await poolManager.withdrawFromSP(dec(105, 18), { from: B })
      await poolManager.withdrawFromSP(dec(105, 18), { from: C })
      await poolManager.withdrawFromSP(dec(105, 18), { from: D })

      // --- TEST ---

      // get current ETH balances
      const A_ETHBalance_Before = await web3.eth.getBalance(A)
      const B_ETHBalance_Before = await web3.eth.getBalance(B)
      const C_ETHBalance_Before = await web3.eth.getBalance(C)
      const D_ETHBalance_Before = await web3.eth.getBalance(D)

      // A, B, C, D provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A, gasPrice: 0 })
      await poolManager.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: B, gasPrice: 0 })
      await poolManager.provideToSP(dec(300, 18), frontEnd_2, { from: C, gasPrice: 0 })
      await poolManager.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: D, gasPrice: 0 })

      // Get  ETH balances after
      const A_ETHBalance_After = await web3.eth.getBalance(A)
      const B_ETHBalance_After = await web3.eth.getBalance(B)
      const C_ETHBalance_After = await web3.eth.getBalance(C)
      const D_ETHBalance_After = await web3.eth.getBalance(D)

      // Check ETH balances have not changed
      assert.equal(A_ETHBalance_After, A_ETHBalance_Before)
      assert.equal(B_ETHBalance_After, B_ETHBalance_Before)
      assert.equal(C_ETHBalance_After, C_ETHBalance_Before)
      assert.equal(D_ETHBalance_After, D_ETHBalance_Before)
    })

    it("provideToSP(), topup: triggers LQTY reward event - increases the sum G", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // A, B, C provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: B })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const G_Before = await poolManager.epochToScaleToG(0, 0)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // B tops up
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: B })

      const G_After = await poolManager.epochToScaleToG(0, 0)

      // Expect G has increased from the LQTY reward event triggered by B's topup
      assert.isTrue(G_After.gt(G_Before))
    })

    it("provideToSP(), top up: doesn't change the front end tag", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // whale transfer to troves D and E
      await clvToken.transfer(D, dec(100, 18), { from: whale })
      await clvToken.transfer(E, dec(200, 18), { from: whale })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // A, B, C, D, E provide to SP
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), ZERO_ADDRESS, { from: C })
      await poolManager.provideToSP(dec(40, 18), frontEnd_1, { from: D })
      await poolManager.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: E })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // A, B, C, D, E top up, from different front ends
      await poolManager.provideToSP(dec(10, 18), frontEnd_2, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_1, { from: B })
      await poolManager.provideToSP(dec(15, 18), frontEnd_3, { from: C })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: D })
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: E })

      const frontEndTag_A = (await poolManager.deposits(A))[1]
      const frontEndTag_B = (await poolManager.deposits(B))[1]
      const frontEndTag_C = (await poolManager.deposits(C))[1]
      const frontEndTag_D = (await poolManager.deposits(D))[1]
      const frontEndTag_E = (await poolManager.deposits(E))[1]

      // Check deposits are still tagged with their original front end
      assert.equal(frontEndTag_A, frontEnd_1)
      assert.equal(frontEndTag_B, frontEnd_2)
      assert.equal(frontEndTag_C, ZERO_ADDRESS)
      assert.equal(frontEndTag_D, frontEnd_1)
      assert.equal(frontEndTag_E, ZERO_ADDRESS)
    })

    it("provideToSP(), top up of eligible deposit: depositor receives LQTY rewards", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // A, B, C, provide to SP
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), ZERO_ADDRESS, { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get A, B, C LQTY balance before
      const A_LQTYBalance_Before = await growthToken.balanceOf(A)
      const B_LQTYBalance_Before = await growthToken.balanceOf(B)
      const C_LQTYBalance_Before = await growthToken.balanceOf(C)

      // Check A, B, C, are eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // A, B, C top up
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), ZERO_ADDRESS, { from: C })

      // Get LQTY balance after
      const A_LQTYBalance_After = await growthToken.balanceOf(A)
      const B_LQTYBalance_After = await growthToken.balanceOf(B)
      const C_LQTYBalance_After = await growthToken.balanceOf(C)

      // Check LQTY Balance of A, B, C has increased
      assert.isTrue(A_LQTYBalance_After.gt(A_LQTYBalance_Before))
      assert.isTrue(B_LQTYBalance_After.gt(B_LQTYBalance_Before))
      assert.isTrue(C_LQTYBalance_After.gt(C_LQTYBalance_Before))
    })

    it("provideToSP(), top up of eligible deposit: tagged front end receives LQTY rewards", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })

      // A, B, C, provide to SP
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get front ends' LQTY balance before
      const F1_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_1)
      const F2_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_2)
      const F3_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_3)

      // Check A, B, C, are eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // A, B, C top up  (front end param passed here is irrelevant)
      await poolManager.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: A })  // provides no front end param
      await poolManager.provideToSP(dec(20, 18), frontEnd_1, { from: B })  // provides front end that doesn't match his tag
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: C }) // provides front end that matches his tag

      // Get front ends' LQTY balance after
      const F1_LQTYBalance_After = await growthToken.balanceOf(A)
      const F2_LQTYBalance_After = await growthToken.balanceOf(B)
      const F3_LQTYBalance_After = await growthToken.balanceOf(C)

      // Check LQTY Balance of front ends has increased
      assert.isTrue(F1_LQTYBalance_After.gt(F1_LQTYBalance_Before))
      assert.isTrue(F2_LQTYBalance_After.gt(F2_LQTYBalance_Before))
      assert.isTrue(F3_LQTYBalance_After.gt(F3_LQTYBalance_Before))
    })

    it("provideToSP(), top up of eligible deposit: tagged front end's stake increases", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), B, { from: B, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), C, { from: C, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), D, { from: D, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), E, { from: E, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), F, { from: F, value: dec(3, 'ether') })

      // A, B, C, D, E, F provide to SP
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: C })
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: D })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: E })
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: F })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get front ends' stake before
      const F1_Stake_Before = await poolManager.frontEndStakes(frontEnd_1)
      const F2_Stake_Before = await poolManager.frontEndStakes(frontEnd_2)
      const F3_Stake_Before = await poolManager.frontEndStakes(frontEnd_3)

      // Check A, B, C, are eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // A, B, C top up  (front end param passed here is irrelevant)
      await poolManager.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: A })  // provides no front end param
      await poolManager.provideToSP(dec(20, 18), frontEnd_1, { from: B })  // provides front end that doesn't match his tag
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: C }) // provides front end that matches his tag

      // Get front ends' stakes after
      const F1_Stake_After = await poolManager.frontEndStakes(frontEnd_1)
      const F2_Stake_After = await poolManager.frontEndStakes(frontEnd_2)
      const F3_Stake_After = await poolManager.frontEndStakes(frontEnd_3)

      // Check front ends' stakes have increased
      assert.isTrue(F1_Stake_After.gt(F1_Stake_Before))
      assert.isTrue(F2_Stake_After.gt(F2_Stake_Before))
      assert.isTrue(F3_Stake_After.gt(F3_Stake_Before))
    })

    it("provideToSP(), topup of eligible deposit: tagged front end's snapshots update", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C, open loans 
      await borrowerOperations.openLoan(dec(200, 18), A, { from: A, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(400, 18), B, { from: B, value: dec(4, 'ether') })
      await borrowerOperations.openLoan(dec(600, 18), C, { from: C, value: dec(6, 'ether') })

      // D opens loan
      await borrowerOperations.openLoan(dec(1000, 18), D, { from: D, value: dec(10, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // --- SETUP ---

      const deposit_A = dec(100, 18)
      const deposit_B = dec(200, 18)
      const deposit_C = dec(300, 18)

      // A, B, C make their initial deposits
      await poolManager.provideToSP(deposit_A, frontEnd_1, { from: A })
      await poolManager.provideToSP(deposit_B, frontEnd_2, { from: B })
      await poolManager.provideToSP(deposit_C, frontEnd_3, { from: C })

      // fastforward time then make an SP deposit, to make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await poolManager.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: D })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())

      await cdpManager.liquidate(defaulter_1)

      const currentEpoch = await poolManager.currentEpoch()
      const currentScale = await poolManager.currentScale()

      const S_Before = await poolManager.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await poolManager.P()
      const G_Before = await poolManager.epochToScaleToG(currentEpoch, currentScale)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(th.toBN('0')) && P_Before.lt(th.toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(th.toBN('0')))
      assert.isTrue(G_Before.gt(th.toBN('0')))

      // Check A, B, C are eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // Get front ends' snapshots before
      for (frontEnd of [frontEnd_1, frontEnd_2, frontEnd_3]) {
        const snapshot = await poolManager.frontEndSnapshots(frontEnd)

        assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends, since S corresponds to ETH gain)
        assert.equal(snapshot[1], dec(1, 18))  // P 
        assert.equal(snapshot[2], '0')  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }

      // --- TEST ---

      // A, B, C top up their deposits. Grab G at each stage, as it can increase a bit
      // between topups, because some block.timestamp time passes (and LQTY is issued) between ops
      const G1 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_A, frontEnd_1, { from: A })

      const G2 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_B, frontEnd_2, { from: B })

      const G3 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_C, frontEnd_3, { from: C })

      const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
      const G_Values = [G1, G2, G3]

      // Check A, B, C are now eligible for LQTY rewards
      assert.isTrue(await poolManager.isEligibleForLQTY(A))
      assert.isTrue(await poolManager.isEligibleForLQTY(B))
      assert.isTrue(await poolManager.isEligibleForLQTY(C))

      // Map frontEnds to the value of G at time the deposit was made
      frontEndToG = th.zipToObject(frontEnds, G_Values)

      // Get front ends' snapshots after
      for (const [frontEnd, G] of Object.entries(frontEndToG)) {
        const snapshot = await poolManager.frontEndSnapshots(frontEnd)

        // Check snapshots are the expected values
        assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends)
        assert.isTrue(snapshot[1].eq(P_Before))  // P 
        assert.isTrue(snapshot[2].eq(G))  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }
    })

    it("provideToSP(), top up of ineligible deposit: depositor does not receive LQTY rewards", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers CLV to A, B, C 
      await clvToken.transfer(A, dec(100, 18), { from: whale })
      await clvToken.transfer(B, dec(200, 18), { from: whale })
      await clvToken.transfer(C, dec(300, 18), { from: whale })

      // A, B, C, provide to SP
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), ZERO_ADDRESS, { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get A, B, C LQTY balance before
      const A_LQTYBalance_Before = await growthToken.balanceOf(A)
      const B_LQTYBalance_Before = await growthToken.balanceOf(B)
      const C_LQTYBalance_Before = await growthToken.balanceOf(C)

      // Check A, B, C, are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // A, B, C top up
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), ZERO_ADDRESS, { from: C })

      // Get LQTY balance after
      const A_LQTYBalance_After = await growthToken.balanceOf(A)
      const B_LQTYBalance_After = await growthToken.balanceOf(B)
      const C_LQTYBalance_After = await growthToken.balanceOf(C)

      // Check LQTY Balance of A, B, C has not change
      assert.isTrue(A_LQTYBalance_After.eq(A_LQTYBalance_Before))
      assert.isTrue(B_LQTYBalance_After.eq(B_LQTYBalance_Before))
      assert.isTrue(C_LQTYBalance_After.eq(C_LQTYBalance_Before))
    })

    it("provideToSP(), top up of ineligible deposit: tagged front end does not receive LQTY rewards", async () => {
      await borrowerOperations.openLoan(dec(1000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers CLV to A, B, C 
      await clvToken.transfer(A, dec(100, 18), {from: whale})
      await clvToken.transfer(B, dec(200, 18), {from: whale})
      await clvToken.transfer(C, dec(300, 18), {from: whale})

      // A, B, C, provide to SP
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: C })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get front ends' LQTY balance before
      const F1_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_1)
      const F2_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_2)
      const F3_LQTYBalance_Before = await growthToken.balanceOf(frontEnd_3)

      // Check A, B, C, are eligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // A, B, C top up  (front end param passed here is irrelevant)
      await poolManager.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: A })  // provides no front end param
      await poolManager.provideToSP(dec(20, 18), frontEnd_1, { from: B })  // provides front end that doesn't match his tag
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: C }) // provides front end that matches his tag

      // Get front ends' LQTY balance after
      const F1_LQTYBalance_After = await growthToken.balanceOf(A)
      const F2_LQTYBalance_After = await growthToken.balanceOf(B)
      const F3_LQTYBalance_After = await growthToken.balanceOf(C)

      // Check LQTY Balance of front ends has increased
      assert.isTrue(F1_LQTYBalance_After.eq(F1_LQTYBalance_Before))
      assert.isTrue(F2_LQTYBalance_After.eq(F2_LQTYBalance_Before))
      assert.isTrue(F3_LQTYBalance_After.eq(F3_LQTYBalance_Before))
    })

    it("provideToSP(), top up of ineligible deposit: tagged front end's stake doesn't change", async () => {
      await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers CLV to A, B, C, D, E, F
      await clvToken.transfer(A, dec(100, 18), {from: whale})
      await clvToken.transfer(B, dec(200, 18), {from: whale})
      await clvToken.transfer(C, dec(300, 18), {from: whale})
      await clvToken.transfer(D, dec(100, 18), {from: whale})
      await clvToken.transfer(E, dec(200, 18), {from: whale})
      await clvToken.transfer(F, dec(300, 18), {from: whale})

      // A, B, C, D, E, F provide to SP
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: A })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: B })
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: C })
      await poolManager.provideToSP(dec(10, 18), frontEnd_1, { from: D })
      await poolManager.provideToSP(dec(20, 18), frontEnd_2, { from: E })
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: F })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      // Get front ends' stake before
      const F1_Stake_Before = await poolManager.frontEndStakes(frontEnd_1)
      const F2_Stake_Before = await poolManager.frontEndStakes(frontEnd_2)
      const F3_Stake_Before = await poolManager.frontEndStakes(frontEnd_3)

      // Check A, B, C, are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // A, B, C top up (front end param passed here is irrelevant)
      await poolManager.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: A })  // provides no front end param
      await poolManager.provideToSP(dec(20, 18), frontEnd_1, { from: B })  // provides front end that doesn't match his tag
      await poolManager.provideToSP(dec(30, 18), frontEnd_3, { from: C }) // provides front end that matches his tag

      // Get front ends' stakes after
      const F1_Stake_After = await poolManager.frontEndStakes(frontEnd_1)
      const F2_Stake_After = await poolManager.frontEndStakes(frontEnd_2)
      const F3_Stake_After = await poolManager.frontEndStakes(frontEnd_3)

      // Check front ends' stakes have not changed
      assert.isTrue(F1_Stake_After.eq(F1_Stake_Before))
      assert.isTrue(F2_Stake_After.eq(F2_Stake_Before))
      assert.isTrue(F3_Stake_After.eq(F3_Stake_Before))
    })

    it("provideToSP(), topup of ineligible deposit: tagged front end's snapshots don't change", async () => {
      await borrowerOperations.openLoan(dec(2000, 18), whale, { from: whale, value: dec(100, 'ether') })

      // Whale transfers to A, B, C 
      await clvToken.transfer(A, dec(200, 18), {from: whale})
      await clvToken.transfer(B, dec(400, 18), {from: whale})
      await clvToken.transfer(C, dec(600, 18), {from: whale})

      // D opens loan
      await borrowerOperations.openLoan(dec(1000, 18), D, { from: D, value: dec(10, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // --- SETUP ---

      const deposit_A = dec(100, 18)
      const deposit_B = dec(200, 18)
      const deposit_C = dec(300, 18)

      // A, B, C make their initial deposits
      await poolManager.provideToSP(deposit_A, frontEnd_1, { from: A })
      await poolManager.provideToSP(deposit_B, frontEnd_2, { from: B })
      await poolManager.provideToSP(deposit_C, frontEnd_3, { from: C })

      // fastforward time then make an SP deposit, to make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await poolManager.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: D })

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await cdpManager.checkRecoveryMode())

      await cdpManager.liquidate(defaulter_1)

      const currentEpoch = await poolManager.currentEpoch()
      const currentScale = await poolManager.currentScale()

      const S_Before = await poolManager.epochToScaleToSum(currentEpoch, currentScale)
      const P_Before = await poolManager.P()
      const G_Before = await poolManager.epochToScaleToG(currentEpoch, currentScale)

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(th.toBN('0')) && P_Before.lt(th.toBN(dec(1, 18))))
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(th.toBN('0')))
      assert.isTrue(G_Before.gt(th.toBN('0')))

      // Check A, B, C are ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Get front ends' snapshots before.  Should be 0, as they don't have any eligible deposits
      for (frontEnd of [frontEnd_1, frontEnd_2, frontEnd_3]) {
        const snapshot = await poolManager.frontEndSnapshots(frontEnd)

        assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends, since S corresponds to ETH gain)
        assert.equal(snapshot[1], '0')  // P 
        assert.equal(snapshot[2], '0')  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }

      // --- TEST ---

      // A, B, C top up their deposits. Grab G at each stage, as it can increase a bit
      // between topups, because some block.timestamp time passes (and LQTY is issued) between ops
      const G1 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_A, frontEnd_1, { from: A })

      const G2 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_B, frontEnd_2, { from: B })

      const G3 = await poolManager.epochToScaleToG(currentScale, currentEpoch)
      await poolManager.provideToSP(deposit_C, frontEnd_3, { from: C })

      const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
      const G_Values = [G1, G2, G3]

      // Check A, B, C are still ineligible for LQTY rewards
      assert.isFalse(await poolManager.isEligibleForLQTY(A))
      assert.isFalse(await poolManager.isEligibleForLQTY(B))
      assert.isFalse(await poolManager.isEligibleForLQTY(C))

      // Map frontEnds to the value of G at time the deposit was made
      frontEndToG = th.zipToObject(frontEnds, G_Values)

      // Get front ends' snapshots after
      for (const [frontEnd, G] of Object.entries(frontEndToG)) {
        const snapshot = await poolManager.frontEndSnapshots(frontEnd)

        // Check snapshots are still 0
        assert.equal(snapshot[0], '0')  // S (should always be 0 for front ends)
        assert.equal(snapshot[1], '0')  // P 
        assert.equal(snapshot[2], '0')  // G
        assert.equal(snapshot[3], '0')  // scale
        assert.equal(snapshot[4], '0')  // epoch
      }
    })

    // --- withdrawFromSP ---

    it("withdrawFromSP(): reverts when user has no active deposit", async () => {
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(10, 'ether') })

      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })

      const alice_initialDeposit = ((await poolManager.deposits(alice))[0]).toString()
      const bob_initialDeposit = ((await poolManager.deposits(bob))[0]).toString()

      assert.equal(alice_initialDeposit, dec(100, 18))
      assert.equal(bob_initialDeposit, '0')

      const txAlice = await poolManager.withdrawFromSP(dec(100, 18), { from: alice })
      assert.isTrue(txAlice.receipt.status)


      try {
        const txBob = await poolManager.withdrawFromSP(dec(100, 18), { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "User must have a non-zero deposit")

      }
    })

    it("withdrawFromSP(): partial retrieval - retrieves correct CLV amount and the entire ETH Gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 170 CLV drawn are closed
      const liquidationTX_1 = await cdpManager.liquidate(defaulter_1, { from: owner })  // 170 CLV closed
      const liquidationTX_2 = await cdpManager.liquidate(defaulter_2, { from: owner }) // 170 CLV closed

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2)

      // Alice CLVLoss is ((150/2000) * liquidatedDebt), for each liquidation
      const expectedCLVLoss_A = (liquidatedDebt_1.mul(th.toBN(dec(150, 18))).div(th.toBN(dec(2000, 18))))
        .add(liquidatedDebt_2.mul(th.toBN(dec(150, 18))).div(th.toBN(dec(2000, 18))))

      const expectedCompoundedCLVDeposit_A = th.toBN(dec(150, 18)).sub(expectedCLVLoss_A)
      const compoundedCLVDeposit_A = await poolManager.getCompoundedCLVDeposit(alice)

      assert.isAtMost(th.getDifference(expectedCompoundedCLVDeposit_A, compoundedCLVDeposit_A), 1000)

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP(dec(90, 18), { from: alice })

      const expectedNewDeposit_A = (compoundedCLVDeposit_A.sub(th.toBN(dec(90, 18))))

      // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
      const newDeposit = ((await poolManager.deposits(alice))[0]).toString()
      assert.isAtMost(th.getDifference(newDeposit, expectedNewDeposit_A), 1000)

      // Expect Alice has withdrawn all ETH gain
      const alice_pendingETHGain = await poolManager.getDepositorETHGain(alice)
      assert.equal(alice_pendingETHGain, 0)
    })

    it("withdrawFromSP(): partial retrieval - leaves the correct amount of CLV in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 2 CDPs opened, 170 CLV withdrawn
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      const SP_CLV_Before = await stabilityPool.getCLV()
      assert.equal(SP_CLV_Before, dec(2000, 18))

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 170 CLV drawn are closed
      const liquidationTX_1 = await cdpManager.liquidate(defaulter_1, { from: owner })  // 170 CLV closed
      const liquidationTX_2 = await cdpManager.liquidate(defaulter_2, { from: owner }) // 170 CLV closed

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2)

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      /* Check SP has reduced from liquidations (2*170) and Alice's withdrawal (90)
      Expect CLV in SP = (2000 - 170 - 170 - 90) = 1570 CLV */

      const SP_CLV_After = (await stabilityPool.getCLV()).toString()
      assert.equal(SP_CLV_After, '1570000000000000000000')
    })

    it("withdrawFromSP(): full retrieval - leaves the correct amount of CLV in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      const SP_CLV_Before = await stabilityPool.getCLV()
      assert.equal(SP_CLV_Before, dec(2000, 18))

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 170 CLV drawn are closed
      const liquidationTX_1 = await cdpManager.liquidate(defaulter_1, { from: owner })  // 170 CLV closed
      const liquidationTX_2 = await cdpManager.liquidate(defaulter_2, { from: owner }) // 170 CLV closed

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2)

      // Alice CLVLoss is ((150/2000) * liquidatedDebt), for each liquidation
      const expectedCLVLoss_A = (liquidatedDebt_1.mul(th.toBN(dec(150, 18))).div(th.toBN(dec(2000, 18))))
        .add(liquidatedDebt_2.mul(th.toBN(dec(150, 18))).div(th.toBN(dec(2000, 18))))

      const expectedCompoundedCLVDeposit_A = th.toBN(dec(150, 18)).sub(expectedCLVLoss_A)
      const compoundedCLVDeposit_A = await poolManager.getCompoundedCLVDeposit(alice)

      assert.isAtMost(th.getDifference(expectedCompoundedCLVDeposit_A, compoundedCLVDeposit_A), 1000)

      const CLVinSPBefore = await stabilityPool.getCLV()

      // Alice retrieves all of her entitled CLV:
      await poolManager.withdrawFromSP(dec(150, 18), { from: alice })

      const expectedCLVinSPAfter = CLVinSPBefore.sub(compoundedCLVDeposit_A)

      const CLVinSPAfter = await stabilityPool.getCLV()
      assert.isAtMost(th.getDifference(expectedCLVinSPAfter, CLVinSPAfter), 1000)
    })

    it("withdrawFromSP(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan('1850000000000000000000', whale, { from: whale, value: dec(50, 'ether') })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.openLoan(dec(170, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(170, 18), defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(dec(150, 18), alice, { from: alice, value: dec(1, 'ether') })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }) // 180 CLV closed

      // Alice retrieves all of her entitled CLV:
      await poolManager.withdrawFromSP(dec(150, 18), { from: alice })
      assert.equal(await poolManager.getDepositorETHGain(alice), 0)

      await poolManager.provideToSP('100000000000000000000', frontEnd_1, { from: alice })
      assert.equal(await poolManager.getDepositorETHGain(alice), 0)

      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Alice attempts second withdrawal
      await poolManager.withdrawFromSP('100000000000000000000', { from: alice })
      assert.equal(await poolManager.getDepositorETHGain(alice), 0)

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_1)

      await poolManager.provideToSP('100000000000000000000', frontEnd_1, { from: alice })
      assert.equal(await poolManager.getDepositorETHGain(alice), 0)

      // Alice attempts third withdrawal (this time, frm SP to CDP)
      await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })

      // Check ETH in pool does not change
      const ETHinSP_2 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_2)
    })

    it("withdrawFromSP(): it correctly updates the user's CLV and ETH snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 2 CDPs opened, 180 CLV withdrawn
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(0, defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_1, { from: defaulter_1 })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_2, { from: defaulter_2 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      // check 'Before' snapshots
      const alice_snapshot_Before = await poolManager.depositSnapshots(alice)
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString()
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString()
      assert.equal(alice_snapshot_S_Before, 0)
      assert.equal(alice_snapshot_P_Before, '1000000000000000000')

      // price drops: defaulters' CDPs fall below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // 2 users with CDP with 180 CLV drawn are closed
      await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      await cdpManager.liquidate(defaulter_2, { from: owner }); // 180 CLV closed

      // Alice retrieves part of her entitled CLV: 90 CLV
      await poolManager.withdrawFromSP('90000000000000000000', { from: alice })

      const P = (await poolManager.P()).toString()
      const S = (await poolManager.epochToScaleToSum(0, 0)).toString()
      // check 'After' snapshots
      const alice_snapshot_After = await poolManager.depositSnapshots(alice)
      const alice_snapshot_S_After = alice_snapshot_After[0].toString()
      const alice_snapshot_P_After = alice_snapshot_After[1].toString()
      assert.equal(alice_snapshot_S_After, S)
      assert.equal(alice_snapshot_P_After, P)
    })

    it("withdrawFromSP(): decreases StabilityPool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 1 CDP opened, 150 CLV withdrawn
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // defaulter's CDP is closed.

      const liquidationTx_1 = await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx_1)

      //Get ActivePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getETH()
      const stability_ETH_Before = await stabilityPool.getETH()


      // Expect alice to be entitled to 150/2000 of the liquidated coll
      const aliceExpectedETHGain = liquidatedColl.mul(th.toBN(dec(150, 18))).div(th.toBN(dec(2000, 18)))
      const aliceETHGain = await poolManager.getDepositorETHGain(alice)
      assert.isTrue(aliceExpectedETHGain.eq(aliceETHGain))

      // Alice retrieves all of her deposit
      await poolManager.withdrawFromSP(dec(150, 18), { from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()

      const active_ETH_Difference = (active_ETH_Before.sub(active_ETH_After))
      const stability_ETH_Difference = (stability_ETH_Before.sub(stability_ETH_After))

      assert.equal(active_ETH_Difference, '0')

      // Expect StabilityPool to have decreased by Alice's ETHGain
      assert.isAtMost(th.getDifference(stability_ETH_Difference, aliceETHGain), 100)
    })

    // --- Tests that check any rounding error in accumulated CLVLoss in the SP "favors the Pool" ---

    it("withdrawFromSP(): All depositors are able to withdraw from the SP to their account", async () => {
      // Whale opens loan 
      await borrowerOperations.openLoan(0, accounts[999], { from: whale, value: dec(100, 'ether') })

      // Future defaulter opens loan
      await borrowerOperations.openLoan(dec(100, 18), accounts[0], { from: defaulter_1, value: dec(1, 'ether') })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(1, 'ether') })
        await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: account })
      }

      await priceFeed.setPrice(dec(100, 18))
      await cdpManager.liquidate(defaulter_1)

      // All depositors attempt to withdraw
      await poolManager.withdrawFromSP(dec(100, 18), { from: alice })
      assert.equal(((await poolManager.deposits(alice))[0]).toString(), '0')
      await poolManager.withdrawFromSP(dec(100, 18), { from: bob })
      assert.equal(((await poolManager.deposits(alice))[0]).toString(), '0')
      await poolManager.withdrawFromSP(dec(100, 18), { from: carol })
      assert.equal(((await poolManager.deposits(alice))[0]).toString(), '0')
      await poolManager.withdrawFromSP(dec(100, 18), { from: dennis })
      assert.equal(((await poolManager.deposits(alice))[0]).toString(), '0')
      await poolManager.withdrawFromSP(dec(100, 18), { from: erin })
      assert.equal(((await poolManager.deposits(alice))[0]).toString(), '0')
      await poolManager.withdrawFromSP(dec(100, 18), { from: flyn })
      assert.equal(((await poolManager.deposits(alice))[0]).toString(), '0')

      const totalDeposits = (await stabilityPool.totalCLVDeposits()).toString()

      assert.isAtMost(th.getDifference(totalDeposits, '0'), 1000)
    })

    it("withdrawFromSP(): increases depositor's CLV token balance by the expected amount", async () => {
      // Whale opens loan 
      await borrowerOperations.openLoan(0, accounts[999], { from: whale, value: dec(100, 'ether') })

      // Future defaulter opens loan
      await borrowerOperations.openLoan(dec(100, 18), accounts[0], { from: defaulter_1, value: dec(1, 'ether') })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(1, 'ether') })
        await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: account })
      }

      await priceFeed.setPrice(dec(100, 18))
      await cdpManager.liquidate(defaulter_1)

      /* From a distribution of 100 CLV, each depositor receives
      CLVLoss = 16.666666666666666666 CLV

      and thus with a deposit of 100 CLV, each should withdraw 83.333333333333333333 CLV (in practice, slightly less due to rounding error)
      */

      // Price bounces back to $200 per ETH
      await priceFeed.setPrice(dec(200, 18))

      // Bob issues a further 50 CLV from his trove 
      await borrowerOperations.withdrawCLV(dec(50, 18), bob, { from: bob })

      // Expect Alice's CLV balance to be very close to 83.333333333333333333 CLV
      await poolManager.withdrawFromSP(dec(100, 18), { from: alice })
      const alice_Balance = (await clvToken.balanceOf(alice)).toString()
      assert.isAtMost(th.getDifference(alice_Balance, '83333333333333333333'), 1000)

      // expect Bob's CLV balance to be very close to  133.33333333333333333 CLV
      await poolManager.withdrawFromSP(dec(100, 18), { from: bob })
      const bob_Balance = (await clvToken.balanceOf(bob)).toString()
      assert.isAtMost(th.getDifference(bob_Balance, '133333333333333333333'), 1000)
    })

    it("withdrawFromSP(): doesn't impact other users Stability deposits or ETH gains", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(200, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(300, 18), frontEnd_1, { from: carol })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(170, 18), defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Defaulters are liquidated
      await cdpManager.liquidate(defaulter_1)
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      const alice_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_CLVDeposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()

      const alice_ETHGain_Before = (await poolManager.getDepositorETHGain(alice)).toString()
      const bob_ETHGain_Before = (await poolManager.getDepositorETHGain(bob)).toString()

      //check non-zero CLV and ETHGain in the Stability Pool
      const CLVinSP = await stabilityPool.getCLV()
      const ETHinSP = await stabilityPool.getETH()
      assert.isTrue(CLVinSP.gt(mv._zeroBN))
      assert.isTrue(ETHinSP.gt(mv._zeroBN))

      // Carol withdraws her Stability deposit 
      assert.equal(((await poolManager.deposits(carol))[0]).toString(), dec(300, 18))
      await poolManager.withdrawFromSP(dec(300, 18), { from: carol })
      assert.equal(((await poolManager.deposits(carol))[0]).toString(), '0')

      const alice_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_CLVDeposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()

      const alice_ETHGain_After = (await poolManager.getDepositorETHGain(alice)).toString()
      const bob_ETHGain_After = (await poolManager.getDepositorETHGain(bob)).toString()

      // Check compounded deposits and ETH gains for A and B have not changed
      assert.equal(alice_CLVDeposit_Before, alice_CLVDeposit_After)
      assert.equal(bob_CLVDeposit_Before, bob_CLVDeposit_After)

      assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
      assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
    })

    it("withdrawFromSP(): doesn't impact system debt, collateral or TCR ", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(200, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(300, 18), frontEnd_1, { from: carol })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(170, 18), defaulter_2, { from: defaulter_2, value: dec(1, 'ether') })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Defaulters are liquidated
      await cdpManager.liquidate(defaulter_1)
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      const activeDebt_Before = (await activePool.getCLVDebt()).toString()
      const defaultedDebt_Before = (await defaultPool.getCLVDebt()).toString()
      const activeColl_Before = (await activePool.getETH()).toString()
      const defaultedColl_Before = (await defaultPool.getETH()).toString()
      const TCR_Before = (await cdpManager.getTCR()).toString()

      // Carol withdraws her Stability deposit 
      assert.equal(((await poolManager.deposits(carol))[0]).toString(), dec(300, 18))
      await poolManager.withdrawFromSP(dec(300, 18), { from: carol })
      assert.equal(((await poolManager.deposits(carol))[0]).toString(), '0')

      const activeDebt_After = (await activePool.getCLVDebt()).toString()
      const defaultedDebt_After = (await defaultPool.getCLVDebt()).toString()
      const activeColl_After = (await activePool.getETH()).toString()
      const defaultedColl_After = (await defaultPool.getETH()).toString()
      const TCR_After = (await cdpManager.getTCR()).toString()

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After)
      assert.equal(defaultedDebt_Before, defaultedDebt_After)
      assert.equal(activeColl_Before, activeColl_After)
      assert.equal(defaultedColl_Before, defaultedColl_After)
      assert.equal(TCR_Before, TCR_After)
    })

    it("withdrawFromSP(): doesn't impact any troves, including the caller's trove", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans and make Stability Pool deposits
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      // A, B and C provide to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(200, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(300, 18), frontEnd_1, { from: carol })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await cdpManager.CDPs(whale))[0].toString()
      const alice_Debt_Before = (await cdpManager.CDPs(alice))[0].toString()
      const bob_Debt_Before = (await cdpManager.CDPs(bob))[0].toString()
      const carol_Debt_Before = (await cdpManager.CDPs(carol))[0].toString()

      const whale_Coll_Before = (await cdpManager.CDPs(whale))[1].toString()
      const alice_Coll_Before = (await cdpManager.CDPs(alice))[1].toString()
      const bob_Coll_Before = (await cdpManager.CDPs(bob))[1].toString()
      const carol_Coll_Before = (await cdpManager.CDPs(carol))[1].toString()

      const whale_ICR_Before = (await cdpManager.getCurrentICR(whale, price)).toString()
      const alice_ICR_Before = (await cdpManager.getCurrentICR(alice, price)).toString()
      const bob_ICR_Before = (await cdpManager.getCurrentICR(bob, price)).toString()
      const carol_ICR_Before = (await cdpManager.getCurrentICR(carol, price)).toString()

      // Carol withdraws her Stability deposit 
      assert.equal(((await poolManager.deposits(carol))[0]).toString(), dec(300, 18))
      await poolManager.withdrawFromSP(dec(300, 18), { from: carol })
      assert.equal(((await poolManager.deposits(carol))[0]).toString(), '0')

      const whale_Debt_After = (await cdpManager.CDPs(whale))[0].toString()
      const alice_Debt_After = (await cdpManager.CDPs(alice))[0].toString()
      const bob_Debt_After = (await cdpManager.CDPs(bob))[0].toString()
      const carol_Debt_After = (await cdpManager.CDPs(carol))[0].toString()

      const whale_Coll_After = (await cdpManager.CDPs(whale))[1].toString()
      const alice_Coll_After = (await cdpManager.CDPs(alice))[1].toString()
      const bob_Coll_After = (await cdpManager.CDPs(bob))[1].toString()
      const carol_Coll_After = (await cdpManager.CDPs(carol))[1].toString()

      const whale_ICR_After = (await cdpManager.getCurrentICR(whale, price)).toString()
      const alice_ICR_After = (await cdpManager.getCurrentICR(alice, price)).toString()
      const bob_ICR_After = (await cdpManager.getCurrentICR(bob, price)).toString()
      const carol_ICR_After = (await cdpManager.getCurrentICR(carol, price)).toString()

      // Check all troves are unaffected by Carol's Stability deposit withdrawal
      assert.equal(whale_Debt_Before, whale_Debt_After)
      assert.equal(alice_Debt_Before, alice_Debt_After)
      assert.equal(bob_Debt_Before, bob_Debt_After)
      assert.equal(carol_Debt_Before, carol_Debt_After)

      assert.equal(whale_Coll_Before, whale_Coll_After)
      assert.equal(alice_Coll_Before, alice_Coll_After)
      assert.equal(bob_Coll_Before, bob_Coll_After)
      assert.equal(carol_Coll_Before, carol_Coll_After)

      assert.equal(whale_ICR_Before, whale_ICR_After)
      assert.equal(alice_ICR_Before, alice_ICR_After)
      assert.equal(bob_ICR_Before, bob_ICR_After)
      assert.equal(carol_ICR_Before, carol_ICR_After)
    })

    it("withdrawFromSP(): withdrawing 0 CLV doesn't alter the caller's deposit or the total CLV in the Stability Pool", async () => {
      // --- SETUP ---
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(30, 18), frontEnd_1, { from: carol })

      const bob_Deposit_Before = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const CLVinSP_Before = (await stabilityPool.getCLV()).toString()

      assert.equal(CLVinSP_Before, dec(180, 18))

      // Bob withdraws 0 CLV from the Stability Pool 
      await poolManager.withdrawFromSP(0, { from: bob })

      // check Bob's deposit and total CLV in Stability Pool has not changed
      const bob_Deposit_After = (await poolManager.getCompoundedCLVDeposit(bob)).toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()

      assert.equal(bob_Deposit_Before, bob_Deposit_After)
      assert.equal(CLVinSP_Before, CLVinSP_After)
    })


    it("withdrawFromSP(): withdrawing 0 ETH Gain does not alter the caller's ETH balance, their trove collateral, or the ETH  in the Stability Pool", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans and provide to Stability Pool
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(dec(1000, 18), defaulter_1, { from: defaulter_1, value: dec(10, 'ether') })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Defaulter 1 liquidated, full offset
      await cdpManager.liquidate(defaulter_1)

      // Dennis opens loan and deposits to Stability Pool
      await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: dennis })

      // Check Dennis has 0 ETHGain
      const dennis_ETHGain = (await poolManager.getDepositorETHGain(dennis)).toString()
      assert.equal(dennis_ETHGain, '0')

      const dennis_ETHBalance_Before = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_Before = ((await cdpManager.CDPs(dennis))[1]).toString()
      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Dennis withdraws his full deposit and ETHGain to his account
      await poolManager.withdrawFromSP(dec(100, 18), { from: dennis, gasPrice: 0 })

      // Check withdrawal does not alter Dennis' ETH balance or his trove's collateral
      const dennis_ETHBalance_After = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_After = ((await cdpManager.CDPs(dennis))[1]).toString()
      const ETHinSP_After = (await stabilityPool.getETH()).toString()

      assert.equal(dennis_ETHBalance_Before, dennis_ETHBalance_After)
      assert.equal(dennis_Collateral_Before, dennis_Collateral_After)

      // Check withdrawal has not altered the ETH in the Stability Pool
      assert.equal(ETHinSP_Before, ETHinSP_After)
    })



    it("withdrawFromSP(): Request to withdraw > caller's deposit only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(30, 18), frontEnd_1, { from: carol })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)

      const alice_CLV_Balance_Before = await clvToken.balanceOf(alice)
      const bob_CLV_Balance_Before = await clvToken.balanceOf(bob)

      assert.equal(alice_CLV_Balance_Before.toString(), '0')
      assert.equal(bob_CLV_Balance_Before.toString(), dec(150, 18))

      const alice_Deposit_Before = await poolManager.getCompoundedCLVDeposit(alice)
      const bob_Deposit_Before = await poolManager.getCompoundedCLVDeposit(bob)

      const CLVinSP_Before = await stabilityPool.getCLV()

      // Bob attempts to withdraws 50.000000000000000001 CLV from the Stability Pool
      await poolManager.withdrawFromSP('50000000000000000001', { from: bob })

      // Check Bob's CLV balance has risen by only the value of his compounded deposit
      const bob_expectedCLVBalance = (bob_CLV_Balance_Before.add(bob_Deposit_Before)).toString()
      const bob_CLV_Balance_After = (await clvToken.balanceOf(bob)).toString()
      assert.equal(bob_CLV_Balance_After, bob_expectedCLVBalance)

      // Alice attempts to withdraws 2309842309.000000000000000000 CLV from the Stability Pool 
      await poolManager.withdrawFromSP('2309842309000000000000000000', { from: alice })

      // Check Alice's CLV balance has risen by only the value of her compounded deposit
      const alice_expectedCLVBalance = (alice_CLV_Balance_Before.add(alice_Deposit_Before)).toString()
      const alice_CLV_Balance_After = (await clvToken.balanceOf(alice)).toString()
      assert.equal(alice_CLV_Balance_After, alice_expectedCLVBalance)

      // Check CLV in Stability Pool has been reduced by only Alice's compounded deposit and Bob's compounded deposit
      const expectedCLVinSP = (CLVinSP_Before.sub(alice_Deposit_Before).sub(bob_Deposit_Before)).toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()
      assert.equal(CLVinSP_After, expectedCLVinSP)
    })

    it("withdrawFromSP(): Request to withdraw 2^256-1 CLV only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(30, 18), frontEnd_1, { from: carol })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)

      const bob_CLV_Balance_Before = await clvToken.balanceOf(bob)
      assert.equal(bob_CLV_Balance_Before.toString(), dec(150, 18))

      const bob_Deposit_Before = await poolManager.getCompoundedCLVDeposit(bob)

      const CLVinSP_Before = await stabilityPool.getCLV()

      const maxBytes32 = web3.utils.toBN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

      // Bob attempts to withdraws maxBytes32 CLV from the Stability Pool
      await poolManager.withdrawFromSP(maxBytes32, { from: bob })

      // Check Bob's CLV balance has risen by only the value of his compounded deposit
      const bob_expectedCLVBalance = (bob_CLV_Balance_Before.add(bob_Deposit_Before)).toString()
      const bob_CLV_Balance_After = (await clvToken.balanceOf(bob)).toString()
      assert.equal(bob_CLV_Balance_After, bob_expectedCLVBalance)

      // Check CLV in Stability Pool has been reduced by only  Bob's compounded deposit
      const expectedCLVinSP = (CLVinSP_Before.sub(bob_Deposit_Before)).toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()
      assert.equal(CLVinSP_After, expectedCLVinSP)
    })

    it("withdrawFromSP(): caller can withdraw full deposit and ETH gain during Recovery Mode", async () => {
      // --- SETUP ---

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(30, 18), frontEnd_1, { from: carol })

      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Price drops
      await priceFeed.setPrice(dec(105, 18))
      const price = await priceFeed.getPrice()

      assert.isTrue(await cdpManager.checkRecoveryMode())

      // Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      const alice_CLV_Balance_Before = await clvToken.balanceOf(alice)
      const bob_CLV_Balance_Before = await clvToken.balanceOf(bob)
      const carol_CLV_Balance_Before = await clvToken.balanceOf(carol)

      const alice_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(alice))
      const bob_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(bob))
      const carol_ETH_Balance_Before = web3.utils.toBN(await web3.eth.getBalance(carol))

      const alice_Deposit_Before = await poolManager.getCompoundedCLVDeposit(alice)
      const bob_Deposit_Before = await poolManager.getCompoundedCLVDeposit(bob)
      const carol_Deposit_Before = await poolManager.getCompoundedCLVDeposit(carol)

      const alice_ETHGain_Before = await poolManager.getDepositorETHGain(alice)
      const bob_ETHGain_Before = await poolManager.getDepositorETHGain(bob)
      const carol_ETHGain_Before = await poolManager.getDepositorETHGain(carol)

      const CLVinSP_Before = await stabilityPool.getCLV()

      // A, B, C withdraw their full deposits from the Stability Pool
      await poolManager.withdrawFromSP(dec(100, 18), { from: alice, gasPrice: 0 })
      await poolManager.withdrawFromSP(dec(100, 18), { from: bob, gasPrice: 0 })
      await poolManager.withdrawFromSP(dec(100, 18), { from: carol, gasPrice: 0 })

      // Check CLV balances of A, B, C have risen by the value of their compounded deposits, respectively
      const alice_expectedCLVBalance = (alice_CLV_Balance_Before.add(alice_Deposit_Before)).toString()
      const bob_expectedCLVBalance = (bob_CLV_Balance_Before.add(bob_Deposit_Before)).toString()
      const carol_expectedCLVBalance = (carol_CLV_Balance_Before.add(carol_Deposit_Before)).toString()

      const alice_CLV_Balance_After = (await clvToken.balanceOf(alice)).toString()
      const bob_CLV_Balance_After = (await clvToken.balanceOf(bob)).toString()
      const carol_CLV_Balance_After = (await clvToken.balanceOf(carol)).toString()

      assert.equal(alice_CLV_Balance_After, alice_expectedCLVBalance)
      assert.equal(bob_CLV_Balance_After, bob_expectedCLVBalance)
      assert.equal(carol_CLV_Balance_After, carol_expectedCLVBalance)


      // Check ETH balances of A, B, C have increased by the value of their ETH gain from liquidations, respectively
      const alice_expectedETHBalance = (alice_ETH_Balance_Before.add(alice_ETHGain_Before)).toString()
      const bob_expectedETHBalance = (bob_ETH_Balance_Before.add(bob_ETHGain_Before)).toString()
      const carol_expectedETHBalance = (carol_ETH_Balance_Before.add(carol_ETHGain_Before)).toString()

      const alice_ETHBalance_After = (await web3.eth.getBalance(alice)).toString()
      const bob_ETHBalance_After = (await web3.eth.getBalance(bob)).toString()
      const carol_ETHBalance_After = (await web3.eth.getBalance(carol)).toString()

      assert.equal(alice_expectedETHBalance, alice_ETHBalance_After)
      assert.equal(bob_expectedETHBalance, bob_ETHBalance_After)
      assert.equal(carol_expectedETHBalance, carol_ETHBalance_After)

      // Check CLV in Stability Pool has been reduced by A, B and C's compounded deposit
      const expectedCLVinSP = (CLVinSP_Before
        .sub(alice_Deposit_Before)
        .sub(bob_Deposit_Before)
        .sub(carol_Deposit_Before))
        .toString()
      const CLVinSP_After = (await stabilityPool.getCLV()).toString()
      assert.equal(CLVinSP_After, expectedCLVinSP)

      // Check ETH in SP has reduced to zero
      const ETHinSP_After = (await stabilityPool.getETH()).toString()
      assert.isAtMost(th.getDifference(ETHinSP_After, '0'), 1000)
    })

    it("getDepositorETHGain(): depositor does not earn further ETH gains from liquidations while their compounded deposit == 0: ", async () => {
      await borrowerOperations.openLoan(dec(1, 22), whale, { from: whale, value: dec(1000, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(1000, 18), alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await borrowerOperations.openLoan(dec(200, 18), defaulter_1, { from: defaulter_1, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), defaulter_2, { from: defaulter_2, value: dec(3, 'ether') })
      await borrowerOperations.openLoan(dec(5000, 18), defaulter_3, { from: defaulter_3, value: dec(50, 'ether') })

      // A, B, provide 100, 50 CLV to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: bob })

      //price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate defaulter 1. Empties the Pool
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      const CLVinSP = (await stabilityPool.getCLV()).toString()
      assert.equal(CLVinSP, '0')

      // Check Stability deposits have been fully cancelled with debt, and are now all zero
      const alice_Deposit = (await poolManager.getCompoundedCLVDeposit(alice)).toString()
      const bob_Deposit = (await poolManager.getCompoundedCLVDeposit(bob)).toString()

      assert.equal(alice_Deposit, '0')
      assert.equal(bob_Deposit, '0')

      // Get ETH gain for A and B
      const alice_ETHGain_1 = (await poolManager.getDepositorETHGain(alice)).toString()
      const bob_ETHGain_1 = (await poolManager.getDepositorETHGain(bob)).toString()

      // Whale deposits 10000 CLV to Stability Pool
      await poolManager.provideToSP(dec(1, 22), frontEnd_1, { from: whale })

      // Liquidation 2
      await cdpManager.liquidate(defaulter_2)
      assert.isFalse(await sortedCDPs.contains(defaulter_2))

      // Check Alice and Bob have not received ETH gain from liquidation 2 while their deposit was 0
      const alice_ETHGain_2 = (await poolManager.getDepositorETHGain(alice)).toString()
      const bob_ETHGain_2 = (await poolManager.getDepositorETHGain(bob)).toString()

      assert.equal(alice_ETHGain_1, alice_ETHGain_2)
      assert.equal(bob_ETHGain_1, bob_ETHGain_2)

      // Liquidation 3
      await cdpManager.liquidate(defaulter_3)
      assert.isFalse(await sortedCDPs.contains(defaulter_3))

      // Check Alice and Bob have not received ETH gain from liquidation 3 while their deposit was 0
      const alice_ETHGain_3 = (await poolManager.getDepositorETHGain(alice)).toString()
      const bob_ETHGain_3 = (await poolManager.getDepositorETHGain(bob)).toString()

      assert.equal(alice_ETHGain_1, alice_ETHGain_3)
      assert.equal(bob_ETHGain_1, bob_ETHGain_3)
    })



    // --- withdrawETHGainToTrove ---

    it("withdrawETHGainToTrove(): reverts when user has no active deposit", async () => {
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(10, 'ether') })

      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })

      const alice_initialDeposit = ((await poolManager.deposits(alice))[0]).toString()
      const bob_initialDeposit = ((await poolManager.deposits(bob))[0]).toString()

      assert.equal(alice_initialDeposit, dec(100, 18))
      assert.equal(bob_initialDeposit, '0')

      const txAlice = await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      try {
        const txBob = await poolManager.withdrawETHGainToTrove(bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "User must have a non-zero deposit")
      }
    })

    it("withdrawETHGainToTrove(): reverts when user passes an argument != their own addresss", async () => {
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), bob, { from: bob, value: dec(10, 'ether') })
      await borrowerOperations.openLoan(dec(100, 18), carol, { from: carol, value: dec(10, 'ether') })

      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: carol })

      const alice_initialDeposit = ((await poolManager.deposits(alice))[0]).toString()
      const bob_initialDeposit = ((await poolManager.deposits(bob))[0]).toString()
      const carol_initialDeposit = ((await poolManager.deposits(carol))[0]).toString()

      assert.equal(alice_initialDeposit, dec(100, 18))
      assert.equal(bob_initialDeposit, dec(100, 18))
      assert.equal(carol_initialDeposit, dec(100, 18))

      const txAlice = await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      try {
        const txBob = await poolManager.withdrawETHGainToTrove(carol, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "A user may only withdraw ETH gains to their own trove")
      }
    })

    it("withdrawETHGainToTrove(): Applies CLVLoss to user's deposit, and redirects ETH reward to user's CDP", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      // check Alice's CDP recorded ETH Before:
      const aliceCDP_Before = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_Before = aliceCDP_Before[1]
      assert.equal(aliceCDP_ETH_Before, dec(10, 'ether'))

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // Defaulter's CDP is closed
      const liquidationTx_1 = await cdpManager.liquidate(defaulter_1, { from: owner })  // 180 CLV closed
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx_1)

      const ETHGain_A = await poolManager.getDepositorETHGain(alice)
      const compoundedDeposit_A = await poolManager.getCompoundedCLVDeposit(alice)

      // Alice should receive rewards proportional to her deposit as share of total deposits
      const expectedETHGain_A = liquidatedColl.mul(th.toBN(dec(150, 18))).div(th.toBN(dec(2000, 18)))
      const expectedCLVLoss_A = liquidatedDebt.mul(th.toBN(dec(150, 18))).div(th.toBN(dec(2000, 18)))
      const expectedCompoundedDeposit_A = th.toBN(dec(150, 18)).sub(expectedCLVLoss_A)

      assert.isAtMost(th.getDifference(expectedCompoundedDeposit_A, compoundedDeposit_A), 1000)

      // Alice sends her ETH Gains to her CDP
      await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })

      // check Alice's CLVLoss has been applied to her deposit expectedCompoundedDeposit_A
      alice_deposit_afterDefault = ((await poolManager.deposits(alice))[0])
      assert.isAtMost(th.getDifference(alice_deposit_afterDefault, expectedCompoundedDeposit_A), 1000)

      // check alice's CDP recorded ETH has increased by the expected reward amount
      const aliceCDP_After = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_After = aliceCDP_After[1]

      const CDP_ETH_Increase = (aliceCDP_ETH_After.sub(aliceCDP_ETH_Before)).toString()

      assert.equal(CDP_ETH_Increase, ETHGain_A)
    })

    it("withdrawETHGainToTrove(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan('1850000000000000000000', whale, { from: whale, value: dec(50, 'ether') })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 1 CDP opened, 180 CLV withdrawn
      await borrowerOperations.openLoan(dec(170, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      // check alice's CDP recorded ETH Before:
      const aliceCDP_Before = await cdpManager.CDPs(alice)
      const aliceCDP_ETH_Before = aliceCDP_Before[1]
      assert.equal(aliceCDP_ETH_Before, dec(10, 'ether'))

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // defaulter's CDP is closed.
      await cdpManager.liquidate(defaulter_1, { from: owner })

      // Alice sends her ETH Gains to her CDP
      await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })

      assert.equal(await poolManager.getDepositorETHGain(alice), 0)

      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Alice attempts second withdrawal from SP to CDP
      await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })
      assert.equal(await poolManager.getDepositorETHGain(alice), 0)

      // Check ETH in pool does not change
      const ETHinSP_1 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_1)

      // Alice attempts third withdrawal (this time, from SP to her own account)
      await poolManager.withdrawFromSP(dec(150, 18), { from: alice })

      // Check ETH in pool does not change
      const ETHinSP_2 = (await stabilityPool.getETH()).toString()
      assert.equal(ETHinSP_Before, ETHinSP_2)

    })

    it("withdrawETHGainToTrove(): decreases StabilityPool ETH and increases activePool ETH", async () => {
      // --- SETUP ---
      // Whale deposits 1850 CLV in StabilityPool
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.withdrawCLV('1850000000000000000000', whale, { from: whale })
      await poolManager.provideToSP('1850000000000000000000', frontEnd_1, { from: whale })

      // 1 CDP opened, 170 CLV withdrawn
      await borrowerOperations.openLoan(0, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      await borrowerOperations.withdrawCLV(dec(170, 18), defaulter_1, { from: defaulter_1 })

      // --- TEST ---

      // Alice makes deposit #1: 150 CLV
      await borrowerOperations.openLoan(0, alice, { from: alice, value: dec(10, 'ether') })
      await borrowerOperations.withdrawCLV(dec(150, 18), alice, { from: alice })
      await poolManager.provideToSP(dec(150, 18), frontEnd_1, { from: alice })

      // price drops: defaulter's CDP falls below MCR, alice and whale CDP remain active
      await priceFeed.setPrice('100000000000000000000');

      // defaulter's CDP is closed.

      const liquidationTx = await cdpManager.liquidate(defaulter_1)
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      // Expect alice to be entitled to 150/2000 of the liquidated coll
      const aliceExpectedETHGain = liquidatedColl.mul(th.toBN(dec(150, 18))).div(th.toBN(dec(2000, 18)))
      const aliceETHGain = await poolManager.getDepositorETHGain(alice)
      assert.isTrue(aliceExpectedETHGain.eq(aliceETHGain))

      //check activePool and StabilityPool Ether before retrieval:
      const active_ETH_Before = await activePool.getETH()
      const stability_ETH_Before = await stabilityPool.getETH()

      // Alice retrieves all of her deposit, 150CLV, choosing to redirect to her CDP
      await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })

      const active_ETH_After = await activePool.getETH()
      const stability_ETH_After = await stabilityPool.getETH()

      const active_ETH_Difference = (active_ETH_After.sub(active_ETH_Before)) // AP ETH should increase
      const stability_ETH_Difference = (stability_ETH_Before.sub(stability_ETH_After)) // SP ETH should decrease

      // check Pool ETH values change by Alice's ETHGain, i.e 0.075 ETH
      assert.isAtMost(th.getDifference(active_ETH_Difference, aliceETHGain), 100)
      assert.isAtMost(th.getDifference(stability_ETH_Difference, aliceETHGain), 100)
    })

    it("withdrawETHGainToTrove(): All depositors are able to withdraw their ETH gain from the SP to their CDP", async () => {
      // Whale opens loan 
      await borrowerOperations.openLoan(0, accounts[999], { from: whale, value: dec(100, 'ether') })

      // Future defaulter opens loan
      await borrowerOperations.openLoan(dec(100, 18), accounts[0], { from: defaulter_1, value: dec(1, 'ether') })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(1, 'ether') })
        await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: account })
      }

      await priceFeed.setPrice(dec(100, 18))
      await cdpManager.liquidate(defaulter_1)

      // All depositors attempt to withdraw
      const tx1 = await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })
      assert.isTrue(tx1.receipt.status)
      const tx2 = await poolManager.withdrawETHGainToTrove(bob, bob, { from: bob })
      assert.isTrue(tx1.receipt.status)
      const tx3 = await poolManager.withdrawETHGainToTrove(carol, carol, { from: carol })
      assert.isTrue(tx1.receipt.status)
      const tx4 = await poolManager.withdrawETHGainToTrove(dennis, dennis, { from: dennis })
      assert.isTrue(tx1.receipt.status)
      const tx5 = await poolManager.withdrawETHGainToTrove(erin, erin, { from: erin })
      assert.isTrue(tx1.receipt.status)
      const tx6 = await poolManager.withdrawETHGainToTrove(flyn, flyn, { from: flyn })
      assert.isTrue(tx1.receipt.status)
    })

    it("withdrawETHGainToTrove(): All depositors withdraw, each withdraw their correct ETH gain", async () => {
      // Whale opens loan 
      await borrowerOperations.openLoan(0, accounts[999], { from: whale, value: dec(100, 'ether') })

      // Future defaulter opens loan
      await borrowerOperations.openLoan(dec(100, 18), accounts[0], { from: defaulter_1, value: dec(1, 'ether') })

      // 6 Accounts open loans and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn]
      for (account of depositors) {
        await borrowerOperations.openLoan(dec(100, 18), account, { from: account, value: dec(1, 'ether') })
        await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: account })
      }

      await priceFeed.setPrice(dec(100, 18))
      const liquidationTx = await cdpManager.liquidate(defaulter_1)
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)


      /* All depositors attempt to withdraw their ETH gain to their CDP. Each depositor 
      receives (liquidatedColl/ 6).

      Thus, expected new collateral for each depositor with 1 Ether in their trove originally, is 
      (1 + liquidatedColl/6)
      */

      const expectedNewCollateral = (th.toBN(dec(1, 18))).add(liquidatedColl.div(th.toBN('6')))

      await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })
      aliceColl = (await cdpManager.CDPs(alice))[1]
      assert.isAtMost(th.getDifference(aliceColl, expectedNewCollateral), 100)

      await poolManager.withdrawETHGainToTrove(bob, bob, { from: bob })
      bobColl = (await cdpManager.CDPs(bob))[1]
      assert.isAtMost(th.getDifference(bobColl, expectedNewCollateral), 100)

      await poolManager.withdrawETHGainToTrove(carol, carol, { from: carol })
      carolColl = (await cdpManager.CDPs(carol))[1]
      assert.isAtMost(th.getDifference(carolColl, expectedNewCollateral), 100)

      await poolManager.withdrawETHGainToTrove(dennis, dennis, { from: dennis })
      dennisColl = (await cdpManager.CDPs(dennis))[1]
      assert.isAtMost(th.getDifference(dennisColl, expectedNewCollateral), 100)

      await poolManager.withdrawETHGainToTrove(erin, erin, { from: erin })
      erinColl = (await cdpManager.CDPs(erin))[1]
      assert.isAtMost(th.getDifference(erinColl, expectedNewCollateral), 100)

      await poolManager.withdrawETHGainToTrove(flyn, flyn, { from: flyn })
      flynColl = (await cdpManager.CDPs(flyn))[1]
      assert.isAtMost(th.getDifference(flynColl, expectedNewCollateral), 100)

    })

    it("withdrawETHGainToTrove(): caller can withdraw full deposit and ETH gain to their trove during Recovery Mode", async () => {
      // --- SETUP ---

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // A, B, C open loans 
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      // A, B, C provides 100, 50, 30 CLV to SP
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: alice })
      await poolManager.provideToSP(dec(50, 18), frontEnd_1, { from: bob })
      await poolManager.provideToSP(dec(30, 18), frontEnd_1, { from: carol })

      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Price drops to 105, 
      await priceFeed.setPrice(dec(105, 18))
      const price = await priceFeed.getPrice()

      assert.isTrue(await cdpManager.checkRecoveryMode())

      // Check defaulter 1 has ICR: 100% < ICR < 110%.
      assert.isTrue(await th.ICRbetween100and110(defaulter_1, cdpManager, price))

      const alice_Collateral_Before = (await cdpManager.CDPs(alice))[1]
      const bob_Collateral_Before = (await cdpManager.CDPs(bob))[1]
      const carol_Collateral_Before = (await cdpManager.CDPs(carol))[1]

      // Liquidate defaulter 1
      assert.isTrue(await sortedCDPs.contains(defaulter_1))
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      const alice_ETHGain_Before = await poolManager.getDepositorETHGain(alice)
      const bob_ETHGain_Before = await poolManager.getDepositorETHGain(bob)
      const carol_ETHGain_Before = await poolManager.getDepositorETHGain(carol)

      // A, B, C withdraw their full ETH gain from the Stability Pool to their trove
      await poolManager.withdrawETHGainToTrove(alice, alice, { from: alice })
      await poolManager.withdrawETHGainToTrove(bob, bob, { from: bob })
      await poolManager.withdrawETHGainToTrove(carol, carol, { from: carol })

      // Check collateral of troves A, B, C has increased by the value of their ETH gain from liquidations, respectively
      const alice_expectedCollateral = (alice_Collateral_Before.add(alice_ETHGain_Before)).toString()
      const bob_expectedColalteral = (bob_Collateral_Before.add(bob_ETHGain_Before)).toString()
      const carol_expectedCollateral = (carol_Collateral_Before.add(carol_ETHGain_Before)).toString()

      const alice_Collateral_After = (await cdpManager.CDPs(alice))[1]
      const bob_Collateral_After = (await cdpManager.CDPs(bob))[1]
      const carol_Collateral_After = (await cdpManager.CDPs(carol))[1]

      assert.equal(alice_expectedCollateral, alice_Collateral_After)
      assert.equal(bob_expectedColalteral, bob_Collateral_After)
      assert.equal(carol_expectedCollateral, carol_Collateral_After)

      // Check ETH in SP has reduced to zero
      const ETHinSP_After = (await stabilityPool.getETH()).toString()
      assert.isAtMost(th.getDifference(ETHinSP_After, '0'), 1000)
    })

    it("withdrawETHGainToTrove(): reverts if user has no trove", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(10, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      await borrowerOperations.openLoan(dec(100, 18), defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })

      // A transfers CLV to D
      await clvToken.transfer(dennis, dec(100, 18), { from: alice })

      // D deposits to Stability Pool
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: dennis })

      //Price drops
      await priceFeed.setPrice(dec(100, 18))

      //Liquidate defaulter 1
      await cdpManager.liquidate(defaulter_1)
      assert.isFalse(await sortedCDPs.contains(defaulter_1))

      // D attempts to withdraw his ETH gain to CDP
      try {
        const txD = await poolManager.withdrawETHGainToTrove(dennis, dennis, { from: dennis })
        assert.isFalse(txD.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "caller must have an active trove to withdraw ETHGain to")
      }
    })

    it("withdrawETHGainToTrove(): withdrawing 0 ETH Gain does not alter the caller's ETH balance, the trove collateral, or the ETH in the Stability Pool", async () => {
      await borrowerOperations.openLoan(0, whale, { from: whale, value: dec(100, 'ether') })

      // A, B, C open loans and provide to Stability Pool
      await borrowerOperations.openLoan(dec(100, 18), alice, { from: alice, value: dec(1, 'ether') })
      await borrowerOperations.openLoan(dec(200, 18), bob, { from: bob, value: dec(2, 'ether') })
      await borrowerOperations.openLoan(dec(300, 18), carol, { from: carol, value: dec(3, 'ether') })

      // Would-be defaulters open loans
      await borrowerOperations.openLoan(dec(1000, 18), defaulter_1, { from: defaulter_1, value: dec(10, 'ether') })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      assert.isFalse(await cdpManager.checkRecoveryMode())

      // Defaulter 1 liquidated, full offset
      await cdpManager.liquidate(defaulter_1)

      // Dennis opens loan and deposits to Stability Pool
      await borrowerOperations.openLoan(dec(100, 18), dennis, { from: dennis, value: dec(2, 'ether') })
      await poolManager.provideToSP(dec(100, 18), frontEnd_1, { from: dennis })

      // Check Dennis has 0 ETHGain
      const dennis_ETHGain = (await poolManager.getDepositorETHGain(dennis)).toString()
      assert.equal(dennis_ETHGain, '0')

      const dennis_ETHBalance_Before = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_Before = ((await cdpManager.CDPs(dennis))[1]).toString()
      const ETHinSP_Before = (await stabilityPool.getETH()).toString()

      // Dennis withdraws his ETHGain to his trove
      await poolManager.withdrawETHGainToTrove(dennis, dennis, { from: dennis, gasPrice: 0 })

      // Check withdrawal does not alter Dennis' ETH balance or his trove's collateral
      const dennis_ETHBalance_After = (web3.eth.getBalance(dennis)).toString()
      const dennis_Collateral_After = ((await cdpManager.CDPs(dennis))[1]).toString()
      const ETHinSP_After = (await stabilityPool.getETH()).toString()

      assert.equal(dennis_ETHBalance_Before, dennis_ETHBalance_After)
      assert.equal(dennis_Collateral_Before, dennis_Collateral_After)

      // Check withdrawal has not altered the ETH in the Stability Pool
      assert.equal(ETHinSP_Before, ETHinSP_After)
    })

    it("registerFrontEnd(): registers the front end and chosen kickback rate", async () => {
      const unregisteredFrontEnds = [A, B, C, D, E]

      for (const frontEnd of unregisteredFrontEnds) {
        assert.isFalse((await poolManager.frontEnds(frontEnd))[1])  // check inactive
        assert.equal((await poolManager.frontEnds(frontEnd))[0], '0') // check no chosen kickback rate
      }

      await poolManager.registerFrontEnd(dec(1, 18), {from: A})
      await poolManager.registerFrontEnd('897789897897897', {from: B})
      await poolManager.registerFrontEnd('99990098', {from: C})
      await poolManager.registerFrontEnd('37', {from: D})
      await poolManager.registerFrontEnd('0', {from: E})

      // Check front ends are registered as active, and have correct kickback rates
      assert.isTrue((await poolManager.frontEnds(A))[1])
      assert.equal((await poolManager.frontEnds(A))[0], dec(1, 18))

      assert.isTrue((await poolManager.frontEnds(B))[1])
      assert.equal((await poolManager.frontEnds(B))[0], '897789897897897')

      assert.isTrue((await poolManager.frontEnds(C))[1])
      assert.equal((await poolManager.frontEnds(C))[0], '99990098')

      assert.isTrue((await poolManager.frontEnds(D))[1])
      assert.equal((await poolManager.frontEnds(D))[0], '37')

      assert.isTrue((await poolManager.frontEnds(E))[1])
      assert.equal((await poolManager.frontEnds(E))[0], '0')
    })

    it("registerFrontEnd(): reverts if the front end is already registered", async () => {

      await poolManager.registerFrontEnd(dec(1, 18), {from: A})
      await poolManager.registerFrontEnd('897789897897897', {from: B})
      await poolManager.registerFrontEnd('99990098', {from: C})

      const _2ndAttempt_A = poolManager.registerFrontEnd(dec(1, 18), {from: A})
      const _2ndAttempt_B = poolManager.registerFrontEnd('897789897897897', {from: B})
      const _2ndAttempt_C = poolManager.registerFrontEnd('99990098', {from: C})

      await th.assertRevert(_2ndAttempt_A, "PoolManager: must not already be a registered front end")
      await th.assertRevert(_2ndAttempt_B, "PoolManager: must not already be a registered front end")
      await th.assertRevert(_2ndAttempt_C, "PoolManager: must not already be a registered front end")
    })

    it("registerFrontEnd(): reverts if the kickback rate >1", async () => {

      const invalidKickbackTx_A = poolManager.registerFrontEnd(dec(1, 19), {from: A})
      const invalidKickbackTx_B = poolManager.registerFrontEnd('1000000000000000001', {from: A})
      const invalidKickbackTx_C = poolManager.registerFrontEnd(dec(23423, 45), {from: A})
      const invalidKickbackTx_D = poolManager.registerFrontEnd(maxBytes32, {from: A})

      await th.assertRevert(invalidKickbackTx_A, "PoolManager: Kickback rate must be in range [0,1]")
      await th.assertRevert(invalidKickbackTx_B, "PoolManager: Kickback rate must be in range [0,1]")
      await th.assertRevert(invalidKickbackTx_C, "PoolManager: Kickback rate must be in range [0,1]")
      await th.assertRevert(invalidKickbackTx_D, "PoolManager: Kickback rate must be in range [0,1]")
    })
  })
})

contract('Reset chain state', async accounts => { })