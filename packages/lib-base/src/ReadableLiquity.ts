import { Decimal } from "./Decimal";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { Fees } from "./Fees";
import { LQTYStake } from "./LQTYStake";

/**
 * Represents whether an address has been registered as a Liquity frontend.
 *
 * @remarks
 * Returned by the {@link ReadableLiquity.getFrontendStatus | getFrontendStatus()} function.
 *
 * When `status` is `"registered"`, `kickbackRate` gives the frontend's kickback rate as a
 * {@link Decimal} between 0 and 1.
 *
 * @public
 */
export type FrontendStatus =
  | { status: "unregistered" }
  | { status: "registered"; kickbackRate: Decimal };

/**
 * Parameters of the {@link ReadableLiquity.(getTroves:2) | getTroves()} function.
 *
 * @public
 */
export interface TroveListingParams {
  /** Number of Troves to retrieve. */
  readonly first: number;

  /** How the Troves should be sorted. */
  readonly sortedBy: "ascendingCollateralRatio" | "descendingCollateralRatio";

  /** Index of the first Trove to retrieve from the sorted list. */
  readonly startingAt?: number;

  /**
   * When set to `true`, the retrieved Troves won't include the liquidation shares received since
   * the last time they were directly modified.
   *
   * @remarks
   * Changes the type of returned Troves to {@link TroveWithPendingRedistribution}.
   */
  readonly beforeRedistribution?: boolean;
}

/**
 * Read the state of the Liquity protocol.
 *
 * @remarks
 * Implemented by {@link @liquity/lib-ethers#EthersLiquity}.
 *
 * @public
 */
export interface ReadableLiquity {
  /**
   * Get the total collateral and debt per stake that has been liquidated through redistribution.
   *
   * @remarks
   * Needed when dealing with instances of {@link @liquity/lib-base#TroveWithPendingRedistribution}.
   */
  getTotalRedistributed(): Promise<Trove>;

  /**
   * Get a Trove in its state after the last direct modification.
   *
   * @param address - Address that owns the Trove.
   *
   * @remarks
   * The current state of a Trove can be fetched using
   * {@link @liquity/lib-base#ReadableLiquity.getTrove | getTrove()}.
   */
  getTroveBeforeRedistribution(address?: string): Promise<TroveWithPendingRedistribution>;

  /**
   * Get the current state of a Trove.
   *
   * @param address - Address that owns the Trove.
   */
  getTrove(address?: string): Promise<UserTrove>;

  /**
   * Get number of Troves that are currently open.
   */
  getNumberOfTroves(): Promise<number>;

  /**
   * Get the current price of the native currency (e.g. Ether) in USD.
   */
  getPrice(): Promise<Decimal>;

  /**
   * Get the total amount of collateral and debt in the Liquity system.
   */
  getTotal(): Promise<Trove>;

  /**
   * Get the current state of a Stability Deposit.
   *
   * @param address - Address that owns the Stability Deposit.
   */
  getStabilityDeposit(address?: string): Promise<StabilityDeposit>;

  /**
   * Get the remaining LQTY that will be collectively rewarded to stability depositors.
   */
  getRemainingStabilityPoolLQTYReward(): Promise<Decimal>;

  /**
   * Get the total amount of LUSD currently deposited in the Stability Pool.
   */
  getLUSDInStabilityPool(): Promise<Decimal>;

  /**
   * Get the amount of LUSD held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getLUSDBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of LQTY held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getLQTYBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of Uniswap ETH/LUSD LP tokens held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getUniTokenBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of TJ Pool2 LP tokens held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  tjGetUniTokenBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of Png Pool2 LP tokens held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  pngGetUniTokenBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of Pool3 LP tokens held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  p3GetUniTokenBalance(address?: string): Promise<Decimal>;

  /**
   * Get the liquidity mining contract's allowance of a holder's Uniswap ETH/LUSD LP tokens.
   *
   * @param address - Address holding the Uniswap ETH/LUSD LP tokens.
   */
  getUniTokenAllowance(address?: string): Promise<Decimal>;

  /**
   * Get the liquidity mining contract's allowance of a holder's Uniswap ETH/LUSD LP tokens.
   *
   * @param address - Address holding the TJ Pool2 tokens.
   */
  tjGetUniTokenAllowance(address?: string): Promise<Decimal>;

  /**
   * Get the liquidity mining contract's allowance of a holder's PNG Pool2 LP tokens.
   *
   * @param address - Address holding the Uniswap ETH/LUSD LP tokens.
   */
  pngGetUniTokenAllowance(address?: string): Promise<Decimal>;

  /**
   * Get the liquidity mining contract's allowance of a holder's Pool3 LP tokens.
   *
   * @param address - Address holding the Pool3 LP tokens.
   */
  p3GetUniTokenAllowance(address?: string): Promise<Decimal>;

  /**
   * Get the remaining LQTY that will be collectively rewarded to liquidity miners.
   */
  getRemainingLiquidityMiningLQTYReward(): Promise<Decimal>;

  /**
   * Get the remaining LQTY that will be collectively rewarded to liquidity miners on TJ Pool2.
   */
  tjGetRemainingLiquidityMiningLQTYReward(): Promise<Decimal>;

  /**
   * Get the remaining LQTY that will be collectively rewarded to liquidity miners on PNG pool2.
   */
  pngGetRemainingLiquidityMiningLQTYReward(): Promise<Decimal>;

  /**
   * Get the remaining LQTY that will be collectively rewarded to liquidity miners on PNG pool2.
   */
  p3GetRemainingLiquidityMiningLQTYReward(): Promise<Decimal>;

  /**
   * Get the amount of Uniswap ETH/LUSD LP tokens currently staked by an address in liquidity mining.
   *
   * @param address - Address whose LP stake should be retrieved.
   */
  getLiquidityMiningStake(address?: string): Promise<Decimal>;

  /**
   * Get the amount of Uniswap ETH/LUSD LP tokens currently staked by an address in liquidity mining on TJ.
   *
   * @param address - Address whose LP stake should be retrieved.
   */
  tjGetLiquidityMiningStake(address?: string): Promise<Decimal>;

  /**
   * Get the amount of PNG Pool2 LP tokens currently staked by an address in liquidity mining.
   *
   * @param address - Address whose LP stake should be retrieved.
   */
  pngGetLiquidityMiningStake(address?: string): Promise<Decimal>;

  /**
   * Get the amount of Pool3 LP tokens currently staked by an address in liquidity mining.
   *
   * @param address - Address whose LP stake should be retrieved.
   */
  p3GetLiquidityMiningStake(address?: string): Promise<Decimal>;

  /**
   * Get the total amount of Uniswap ETH/LUSD LP tokens currently staked in liquidity mining.
   */
  getTotalStakedUniTokens(): Promise<Decimal>;

  /**
   * Get the total amount of Uniswap ETH/LUSD LP tokens currently staked in liquidity mining on TJ.
   */
  tjGetTotalStakedUniTokens(): Promise<Decimal>;

  /**
   * Get the total amount of PNG Pool2 LP tokens currently staked in liquidity mining.
   */
  pngGetTotalStakedUniTokens(): Promise<Decimal>;

  /**
   * Get the total amount of Pool3 LP tokens currently staked in liquidity mining.
   */
  p3GetTotalStakedUniTokens(): Promise<Decimal>;

  /**
   * Get the amount of LQTY earned by an address through mining liquidity.
   *
   * @param address - Address whose LQTY reward should be retrieved.
   */
  getLiquidityMiningLQTYReward(address?: string): Promise<Decimal>;

  /**
   * Get the amount of LQTY earned by an address through mining liquidity on TJ.
   *
   * @param address - Address whose LQTY reward should be retrieved.
   */
  tjGetLiquidityMiningLQTYReward(address?: string): Promise<Decimal>;

  /**
   * Get the amount of LQTY earned by an address through mining liquidity on PNG pool2.
   *
   * @param address - Address whose LQTY reward should be retrieved.
   */
  pngGetLiquidityMiningLQTYReward(address?: string): Promise<Decimal>;

  /**
   * Get the amount of LQTY earned by an address through mining liquidity on pool3.
   *
   * @param address - Address whose LQTY reward should be retrieved.
   */
  p3GetLiquidityMiningLQTYReward(address?: string): Promise<Decimal>;

  /**
   * Get the amount of leftover collateral available for withdrawal by an address.
   *
   * @remarks
   * When a Trove gets liquidated or redeemed, any collateral it has above 110% (in case of
   * liquidation) or 100% collateralization (in case of redemption) gets sent to a pool, where it
   * can be withdrawn from using
   * {@link @liquity/lib-base#TransactableLiquity.claimCollateralSurplus | claimCollateralSurplus()}.
   */
  getCollateralSurplusBalance(address?: string): Promise<Decimal>;

  /** @internal */
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true }
  ): Promise<TroveWithPendingRedistribution[]>;

  /**
   * Get a slice from the list of Troves.
   *
   * @param params - Controls how the list is sorted, and where the slice begins and ends.
   * @returns Pairs of owner addresses and their Troves.
   */
  getTroves(params: TroveListingParams): Promise<UserTrove[]>;

  /**
   * Get a calculator for current fees.
   */
  getFees(): Promise<Fees>;

  /**
   * Get the current state of an LQTY Stake.
   *
   * @param address - Address that owns the LQTY Stake.
   */
  getLQTYStake(address?: string): Promise<LQTYStake>;

  /**
   * Get the total amount of LQTY currently staked.
   */
  getTotalStakedLQTY(): Promise<Decimal>;

  /**
   * Check whether an address is registered as a Liquity frontend, and what its kickback rate is.
   *
   * @param address - Address to check.
   */
  getFrontendStatus(address?: string): Promise<FrontendStatus>;
}
