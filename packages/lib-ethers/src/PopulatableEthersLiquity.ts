import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import {
  Provider,
  TransactionResponse,
  TransactionReceipt,
  Log
} from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract, PopulatedTransaction } from "@ethersproject/contracts";

import { Decimal, Decimalish } from "@liquity/decimal";

import {
  Trove,
  TroveWithPendingRedistribution,
  TroveAdjustmentParams,
  ReadableLiquity,
  LiquityReceipt,
  SentLiquityTransaction,
  LiquidationDetails,
  RedemptionDetails,
  PopulatedLiquityTransaction,
  _sendableFrom,
  _transactableFrom,
  _normalizeTroveAdjustment,
  TroveCreationParams,
  _normalizeTroveCreation,
  TroveClosureDetails,
  CollateralGainTransferDetails,
  _failedReceipt,
  _pendingReceipt,
  _successfulReceipt,
  StabilityPoolGainsWithdrawalDetails,
  StabilityDepositChangeDetails,
  MinedReceipt,
  TroveCreationDetails,
  TroveAdjustmentDetails,
  _SendableFrom,
  _TransactableFrom,
  PopulatableLiquity,
  LiquityStore
} from "@liquity/lib-base";

import { LiquityContracts, priceFeedIsTestnet } from "./contracts";
import { EthersTransactionOverrides } from "./types";
import { EthersLiquityBase } from "./EthersLiquityBase";
import { logsToString } from "./parseLogs";

// With 68 iterations redemption costs about ~10M gas, and each iteration accounts for ~144k more
export const redeemMaxIterations = 68;

const slippageTolerance = Decimal.from(0.005); // 0.5%

const noDetails = () => undefined;

const compose = <T, U, V>(f: (_: U) => V, g: (_: T) => U) => (_: T) => f(g(_));

const id = <T>(t: T) => t;

// Takes ~6-7K to update lastFeeOperationTime. Let's be on the safe side.
const addGasForPotentialLastFeeOperationTimeUpdate = (gas: BigNumber) => gas.add(10000);

// An extra traversal can take ~12K.
const addGasForPotentialListTraversal = (gas: BigNumber) => gas.add(25000);

const addGasForLQTYIssuance = (gas: BigNumber) => gas.add(40000);

// To get the best entropy available, we'd do something like:
//
// const bigRandomNumber = () =>
//   BigNumber.from(
//     `0x${Array.from(crypto.getRandomValues(new Uint32Array(8)))
//       .map(u32 => u32.toString(16).padStart(8, "0"))
//       .join("")}`
//   );
//
// However, Window.crypto is browser-specific. Since we only use this for randomly picking Troves
// during the search for hints, Math.random() will do fine, too.
//
// This returns a random integer between 0 and Number.MAX_SAFE_INTEGER
const randomInteger = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

// Maximum number of trials to perform in a single getApproxHint() call. If the number of trials
// required to get a statistically "good" hint is larger than this, the search for the hint will
// be broken up into multiple getApproxHint() calls.
//
// This should be low enough to work with popular public Ethereum providers like Infura without
// triggering any fair use limits.
const maxNumberOfTrialsAtOnce = 2500;

function* generateTrials(totalNumberOfTrials: number) {
  assert(Number.isInteger(totalNumberOfTrials) && totalNumberOfTrials > 0);

  while (totalNumberOfTrials) {
    const numberOfTrials = Math.min(totalNumberOfTrials, maxNumberOfTrialsAtOnce);
    yield numberOfTrials;

    totalNumberOfTrials -= numberOfTrials;
  }
}

export class SentEthersTransaction<T = unknown>
  implements SentLiquityTransaction<TransactionResponse, LiquityReceipt<TransactionReceipt, T>> {
  readonly rawSentTransaction: TransactionResponse;

  private readonly _parse: (rawReceipt: TransactionReceipt) => T;
  private readonly _provider: Provider;
  private readonly _contracts: LiquityContracts;

  constructor(
    rawSentTransaction: TransactionResponse,
    parse: (rawReceipt: TransactionReceipt) => T,
    provider: Provider,
    contracts: LiquityContracts
  ) {
    this.rawSentTransaction = rawSentTransaction;
    this._parse = parse;
    this._provider = provider;
    this._contracts = contracts;
  }

  private _receiptFrom(rawReceipt: TransactionReceipt | null) {
    return rawReceipt
      ? rawReceipt.status
        ? _successfulReceipt(rawReceipt, this._parse(rawReceipt), () =>
            logsToString(rawReceipt, (this._contracts as unknown) as Record<string, Contract>)
          )
        : _failedReceipt(rawReceipt)
      : _pendingReceipt;
  }

  async getReceipt(): Promise<LiquityReceipt<TransactionReceipt, T>> {
    return this._receiptFrom(
      await this._provider.getTransactionReceipt(this.rawSentTransaction.hash)
    );
  }

  async waitForReceipt(): Promise<MinedReceipt<TransactionReceipt, T>> {
    const receipt = this._receiptFrom(
      await this._provider.waitForTransaction(this.rawSentTransaction.hash)
    );

    assert(receipt.status !== "pending");
    return receipt;
  }
}

export class PopulatedEthersTransaction<T = unknown>
  implements PopulatedLiquityTransaction<PopulatedTransaction, SentEthersTransaction<T>> {
  readonly rawPopulatedTransaction: PopulatedTransaction;

  private readonly _parse: (rawReceipt: TransactionReceipt) => T;
  private readonly _signer: Signer;
  private readonly _contracts: LiquityContracts;

  constructor(
    rawPopulatedTransaction: PopulatedTransaction,
    parse: (rawReceipt: TransactionReceipt) => T,
    signer: Signer,
    contracts: LiquityContracts
  ) {
    this.rawPopulatedTransaction = rawPopulatedTransaction;
    this._parse = parse;
    this._signer = signer;
    this._contracts = contracts;
  }

  async send(): Promise<SentEthersTransaction<T>> {
    if (!this._signer.provider) {
      throw new Error("Signer must have a Provider");
    }

    return new SentEthersTransaction(
      await this._signer.sendTransaction(this.rawPopulatedTransaction),
      this._parse,
      this._signer.provider,
      this._contracts
    );
  }
}

interface TroveChangeWithFees<T> {
  params: T;
  newTrove: Trove;
  fee: Decimal;
}

class PopulatableEthersLiquityBase extends EthersLiquityBase {
  protected readonly _readableLiquity: ReadableLiquity;
  protected readonly _store?: LiquityStore;
  protected readonly _signer: Signer;

  constructor(
    contracts: LiquityContracts,
    readableLiquity: ReadableLiquity,
    signer: Signer,
    store?: LiquityStore
  ) {
    super(contracts);

    this._readableLiquity = readableLiquity;
    this._signer = signer;
    this._store = store;
  }

  protected _wrapSimpleTransaction(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction(
      rawPopulatedTransaction,
      noDetails,
      this._signer,
      this._contracts
    );
  }

  protected _wrapTroveChangeWithFees<T>(params: T, rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<TroveChangeWithFees<T>>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [newTrove] = this._contracts.borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(({ args: { _coll, _debt } }) => new Trove(new Decimal(_coll), new Decimal(_debt)));

        const [fee] = this._contracts.borrowerOperations
          .extractEvents(logs, "LUSDBorrowingFeePaid")
          .map(({ args: { _LUSDFee } }) => new Decimal(_LUSDFee));

        return {
          params,
          newTrove,
          fee
        };
      },

      this._signer,
      this._contracts
    );
  }

  protected async _wrapTroveClosure(rawPopulatedTransaction: PopulatedTransaction) {
    const userAddress = await this._signer.getAddress();

    return new PopulatedEthersTransaction<TroveClosureDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [repayLUSD] = this._contracts.lusdToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === userAddress && to === AddressZero)
          .map(({ args: { value } }) => new Decimal(value));

        const [withdrawCollateral] = this._contracts.activePool
          .extractEvents(logs, "EtherSent")
          .filter(({ args: { _to } }) => _to === userAddress)
          .map(({ args: { _amount } }) => new Decimal(_amount));

        return {
          params: repayLUSD.nonZero ? { withdrawCollateral, repayLUSD } : { withdrawCollateral }
        };
      },

      this._signer,
      this._contracts
    );
  }

  protected _wrapLiquidation(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<LiquidationDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const liquidatedAddresses = this._contracts.troveManager
          .extractEvents(logs, "TroveLiquidated")
          .map(({ args: { _borrower } }) => _borrower);

        const [totals] = this._contracts.troveManager
          .extractEvents(logs, "Liquidation")
          .map(
            ({
              args: { _LUSDGasCompensation, _collGasCompensation, _liquidatedColl, _liquidatedDebt }
            }) => ({
              collateralGasCompensation: new Decimal(_collGasCompensation),
              lusdGasCompensation: new Decimal(_LUSDGasCompensation),
              totalLiquidated: new Trove(new Decimal(_liquidatedColl), new Decimal(_liquidatedDebt))
            })
          );

        return {
          liquidatedAddresses,
          ...totals
        };
      },

      this._signer,
      this._contracts
    );
  }

  protected _wrapRedemption(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<RedemptionDetails>(
      rawPopulatedTransaction,

      ({ logs }) =>
        this._contracts.troveManager
          .extractEvents(logs, "Redemption")
          .map(({ args: { _ETHSent, _ETHFee, _actualLUSDAmount, _attemptedLUSDAmount } }) => ({
            attemptedLUSDAmount: new Decimal(_attemptedLUSDAmount),
            actualLUSDAmount: new Decimal(_actualLUSDAmount),
            collateralTaken: new Decimal(_ETHSent),
            fee: new Decimal(_ETHFee)
          }))[0],

      this._signer,
      this._contracts
    );
  }

  private _extractStabilityPoolGainsWithdrawalDetails(
    logs: Log[]
  ): StabilityPoolGainsWithdrawalDetails {
    const [newLUSDDeposit] = this._contracts.stabilityPool
      .extractEvents(logs, "UserDepositChanged")
      .map(({ args: { _newDeposit } }) => new Decimal(_newDeposit));

    const [[collateralGain, lusdLoss]] = this._contracts.stabilityPool
      .extractEvents(logs, "ETHGainWithdrawn")
      .map(({ args: { _ETH, _LUSDLoss } }) => [new Decimal(_ETH), new Decimal(_LUSDLoss)]);

    const [lqtyReward] = this._contracts.stabilityPool
      .extractEvents(logs, "LQTYPaidToDepositor")
      .map(({ args: { _LQTY } }) => new Decimal(_LQTY));

    return {
      lusdLoss,
      newLUSDDeposit,
      collateralGain,
      lqtyReward
    };
  }

  protected _wrapStabilityPoolGainsWithdrawal(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<StabilityPoolGainsWithdrawalDetails>(
      rawPopulatedTransaction,
      ({ logs }) => this._extractStabilityPoolGainsWithdrawalDetails(logs),
      this._signer,
      this._contracts
    );
  }

  protected _wrapStabilityDepositTopup(
    change: { depositLUSD: Decimal },
    rawPopulatedTransaction: PopulatedTransaction
  ) {
    return new PopulatedEthersTransaction<StabilityDepositChangeDetails>(
      rawPopulatedTransaction,

      ({ logs }) => ({
        ...this._extractStabilityPoolGainsWithdrawalDetails(logs),
        change
      }),

      this._signer,
      this._contracts
    );
  }

  protected async _wrapStabilityDepositWithdrawal(rawPopulatedTransaction: PopulatedTransaction) {
    const userAddress = await this._signer.getAddress();

    return new PopulatedEthersTransaction<StabilityDepositChangeDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const gainsWithdrawalDetails = this._extractStabilityPoolGainsWithdrawalDetails(logs);

        const [withdrawLUSD] = this._contracts.lusdToken
          .extractEvents(logs, "Transfer")
          .filter(
            ({ args: { from, to } }) =>
              from === this._contracts.stabilityPool.address && to === userAddress
          )
          .map(({ args: { value } }) => new Decimal(value));

        return {
          ...gainsWithdrawalDetails,
          change: { withdrawLUSD, withdrawAllLUSD: gainsWithdrawalDetails.newLUSDDeposit.isZero }
        };
      },

      this._signer,
      this._contracts
    );
  }

  protected _wrapCollateralGainTransfer(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<CollateralGainTransferDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [newTrove] = this._contracts.borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(({ args: { _coll, _debt } }) => new Trove(new Decimal(_coll), new Decimal(_debt)));

        return {
          ...this._extractStabilityPoolGainsWithdrawalDetails(logs),
          newTrove
        };
      },

      this._signer,
      this._contracts
    );
  }

  private async _findHintsForNominalCollateralRatio(
    nominalCollateralRatio: Decimal
  ): Promise<[string, string]> {
    const numberOfTroves =
      this._store?.state.numberOfTroves ?? (await this._readableLiquity.getNumberOfTroves());

    if (!numberOfTroves) {
      return [AddressZero, AddressZero];
    }

    if (nominalCollateralRatio.infinite) {
      return [AddressZero, await this._contracts.sortedTroves.getFirst()];
    }

    const totalNumberOfTrials = Math.ceil(10 * Math.sqrt(numberOfTroves));
    const [firstTrials, ...restOfTrials] = generateTrials(totalNumberOfTrials);

    const collectApproxHint = (
      {
        latestRandomSeed,
        results
      }: {
        latestRandomSeed: BigNumberish;
        results: { diff: BigNumber; hintAddress: string }[];
      },
      numberOfTrials: number
    ) =>
      this._contracts.hintHelpers
        .getApproxHint(nominalCollateralRatio.bigNumber, numberOfTrials, latestRandomSeed)
        .then(({ latestRandomSeed, ...result }) => ({
          latestRandomSeed,
          results: [...results, result]
        }));

    const { results } = await restOfTrials.reduce(
      (p, numberOfTrials) => p.then(state => collectApproxHint(state, numberOfTrials)),
      collectApproxHint({ latestRandomSeed: randomInteger(), results: [] }, firstTrials)
    );

    const { hintAddress } = results.reduce((a, b) => (a.diff.lt(b.diff) ? a : b));

    return this._contracts.sortedTroves.findInsertPosition(
      nominalCollateralRatio.bigNumber,
      hintAddress,
      hintAddress
    );
  }

  protected async _findHints(trove: Trove) {
    if (trove instanceof TroveWithPendingRedistribution) {
      throw new Error("Rewards must be applied to this Trove");
    }

    return this._findHintsForNominalCollateralRatio(trove._nominalCollateralRatio);
  }

  protected async _findRedemptionHints(amount: Decimal): Promise<[string, string, string, Decimal]> {
    const price = this._store?.state.price ?? (await this._readableLiquity.getPrice());

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await this._contracts.hintHelpers.getRedemptionHints(
      amount.bigNumber,
      price.bigNumber,
      redeemMaxIterations
    );

    const collateralRatio = new Decimal(partialRedemptionHintNICR);

    const [upperHint, lowerHint] = collateralRatio.nonZero
      ? await this._findHintsForNominalCollateralRatio(collateralRatio)
      : [AddressZero, AddressZero];

    return [firstRedemptionHint, upperHint, lowerHint, collateralRatio];
  }
}

export class PopulatableEthersLiquity
  extends PopulatableEthersLiquityBase
  implements PopulatableLiquity<TransactionReceipt, TransactionResponse, PopulatedTransaction> {
  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveCreationDetails>> {
    const normalized = _normalizeTroveCreation(params);
    const { depositCollateral, borrowLUSD } = normalized;

    const fees = borrowLUSD && (this._store?.state.fees ?? (await this._readableLiquity.getFees()));
    const borrowingRate = fees?.borrowingRate();
    const newTrove = Trove.create(normalized, borrowingRate);
    const maxBorrowingRate = borrowingRate?.add(slippageTolerance);

    return this._wrapTroveChangeWithFees(
      normalized,
      await this._contracts.borrowerOperations.estimateAndPopulate.openTrove(
        { value: depositCollateral.bigNumber, ...overrides },
        compose(addGasForPotentialLastFeeOperationTimeUpdate, addGasForPotentialListTraversal),
        maxBorrowingRate?.bigNumber ?? 0,
        borrowLUSD?.bigNumber ?? 0,
        ...(await this._findHints(newTrove))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.closeTrove} */
  async closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveClosureDetails>> {
    return this._wrapTroveClosure(
      await this._contracts.borrowerOperations.estimateAndPopulate.closeTrove({ ...overrides }, id)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ depositCollateral: amount }, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ withdrawCollateral: amount }, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.borrowLUSD} */
  borrowLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ borrowLUSD: amount }, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.repayLUSD} */
  repayLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ repayLUSD: amount }, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.adjustTrove} */
  async adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    const normalized = _normalizeTroveAdjustment(params);
    const { depositCollateral, withdrawCollateral, borrowLUSD, repayLUSD } = normalized;

    const [trove, fees] = await Promise.all([
      this._store?.state.trove ?? this._readableLiquity.getTrove(),
      borrowLUSD && (this._store?.state.fees ?? this._readableLiquity.getFees())
    ]);

    const borrowingRate = fees?.borrowingRate();
    const finalTrove = trove.adjust(normalized, borrowingRate);
    const maxBorrowingRate = borrowingRate?.add(slippageTolerance);

    return this._wrapTroveChangeWithFees(
      normalized,
      await this._contracts.borrowerOperations.estimateAndPopulate.adjustTrove(
        { value: depositCollateral?.bigNumber, ...overrides },
        compose(
          borrowLUSD ? addGasForPotentialLastFeeOperationTimeUpdate : id,
          addGasForPotentialListTraversal
        ),
        maxBorrowingRate?.bigNumber ?? 0,
        withdrawCollateral?.bigNumber ?? 0,
        (borrowLUSD ?? repayLUSD)?.bigNumber ?? 0,
        !!borrowLUSD,
        ...(await this._findHints(finalTrove))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.claimCollateralSurplus} */
  async claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.borrowerOperations.estimateAndPopulate.claimCollateral(
        { ...overrides },
        id
      )
    );
  }

  /** @internal */
  async setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    if (!priceFeedIsTestnet(this._contracts.priceFeed)) {
      throw new Error("setPrice() unavailable on this deployment of Liquity");
    }

    return this._wrapSimpleTransaction(
      await this._contracts.priceFeed.estimateAndPopulate.setPrice(
        { ...overrides },
        id,
        Decimal.from(price).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.liquidate} */
  async liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<LiquidationDetails>> {
    if (Array.isArray(address)) {
      return this._wrapLiquidation(
        await this._contracts.troveManager.estimateAndPopulate.batchLiquidateTroves(
          { ...overrides },
          addGasForLQTYIssuance,
          address
        )
      );
    } else {
      return this._wrapLiquidation(
        await this._contracts.troveManager.estimateAndPopulate.liquidate(
          { ...overrides },
          addGasForLQTYIssuance,
          address
        )
      );
    }
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.liquidateUpTo} */
  async liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<LiquidationDetails>> {
    return this._wrapLiquidation(
      await this._contracts.troveManager.estimateAndPopulate.liquidateTroves(
        { ...overrides },
        addGasForLQTYIssuance,
        maximumNumberOfTrovesToLiquidate
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.depositLUSDInStabilityPool} */
  async depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag = AddressZero,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<StabilityDepositChangeDetails>> {
    const depositLUSD = Decimal.from(amount);

    return this._wrapStabilityDepositTopup(
      { depositLUSD },
      await this._contracts.stabilityPool.estimateAndPopulate.provideToSP(
        { ...overrides },
        addGasForLQTYIssuance,
        depositLUSD.bigNumber,
        frontendTag
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.withdrawLUSDFromStabilityPool} */
  async withdrawLUSDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<StabilityDepositChangeDetails>> {
    return this._wrapStabilityDepositWithdrawal(
      await this._contracts.stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForLQTYIssuance,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.withdrawGainsFromStabilityPool} */
  async withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._wrapStabilityPoolGainsWithdrawal(
      await this._contracts.stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForLQTYIssuance,
        Decimal.ZERO.bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.transferCollateralGainToTrove} */
  async transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<CollateralGainTransferDetails>> {
    const initialTrove = this._store?.state.trove ?? (await this._readableLiquity.getTrove());
    const deposit =
      this._store?.state.deposit ?? (await this._readableLiquity.getStabilityDeposit());
    const finalTrove = initialTrove.addCollateral(deposit.collateralGain);

    return this._wrapCollateralGainTransfer(
      await this._contracts.stabilityPool.estimateAndPopulate.withdrawETHGainToTrove(
        { ...overrides },
        compose(addGasForPotentialListTraversal, addGasForLQTYIssuance),
        ...(await this._findHints(finalTrove))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.sendLUSD} */
  async sendLUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.lusdToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.sendLQTY} */
  async sendLQTY(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.lqtyToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.redeemLUSD} */
  async redeemLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<RedemptionDetails>> {
    amount = Decimal.from(amount);

    const [
      fees,
      total,
      [
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR
      ]
    ] = await Promise.all([
      this._store?.state.fees ?? this._readableLiquity.getFees(),
      this._store?.state.total ?? this._readableLiquity.getTotal(),
      this._findRedemptionHints(amount)
    ]);

    const redemptionRate = fees.redemptionRate(amount.div(total.debt));
    const maxRedemptionRate = Decimal.min(redemptionRate.add(slippageTolerance), Decimal.ONE);

    return this._wrapRedemption(
      await this._contracts.troveManager.estimateAndPopulate.redeemCollateral(
        { ...overrides },
        addGasForPotentialLastFeeOperationTimeUpdate,
        amount.bigNumber,
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR.bigNumber,
        redeemMaxIterations,
        maxRedemptionRate.bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.stakeLQTY} */
  async stakeLQTY(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.lqtyStaking.estimateAndPopulate.stake(
        { ...overrides },
        id,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.unstakeLQTY} */
  async unstakeLQTY(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.lqtyStaking.estimateAndPopulate.unstake(
        { ...overrides },
        id,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this.unstakeLQTY(Decimal.ZERO, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.registerFrontend} */
  async registerFrontend(
    kickbackRate: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.stabilityPool.estimateAndPopulate.registerFrontEnd(
        { ...overrides },
        id,
        Decimal.from(kickbackRate).bigNumber
      )
    );
  }
}

export type SendableEthersLiquity = _SendableFrom<PopulatableEthersLiquity>;

export const SendableEthersLiquity: new (
  populatable: PopulatableEthersLiquity
) => SendableEthersLiquity = _sendableFrom(PopulatableEthersLiquity);

export type TransactableEthersLiquity = _TransactableFrom<SendableEthersLiquity>;

export const TransactableEthersLiquity: new (
  sendable: SendableEthersLiquity
) => TransactableEthersLiquity = _transactableFrom(SendableEthersLiquity);
