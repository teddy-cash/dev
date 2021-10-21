import { Decimal } from "./Decimal";
import { Fees } from "./Fees";
import { LQTYStake } from "./LQTYStake";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { FrontendStatus, ReadableLiquity, TroveListingParams } from "./ReadableLiquity";

/** @internal */
export type _ReadableLiquityWithExtraParamsBase<T extends unknown[]> = {
  [P in keyof ReadableLiquity]: ReadableLiquity[P] extends (...params: infer A) => infer R
    ? (...params: [...originalParams: A, ...extraParams: T]) => R
    : never;
};

/** @internal */
export type _LiquityReadCacheBase<T extends unknown[]> = {
  [P in keyof ReadableLiquity]: ReadableLiquity[P] extends (...args: infer A) => Promise<infer R>
    ? (...params: [...originalParams: A, ...extraParams: T]) => R | undefined
    : never;
};

// Overloads get lost in the mapping, so we need to define them again...

/** @internal */
export interface _ReadableLiquityWithExtraParams<T extends unknown[]>
  extends _ReadableLiquityWithExtraParamsBase<T> {
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;
}

/** @internal */
export interface _LiquityReadCache<T extends unknown[]> extends _LiquityReadCacheBase<T> {
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): TroveWithPendingRedistribution[] | undefined;

  getTroves(params: TroveListingParams, ...extraParams: T): UserTrove[] | undefined;
}

/** @internal */
export class _CachedReadableLiquity<T extends unknown[]>
  implements _ReadableLiquityWithExtraParams<T> {
  private _readable: _ReadableLiquityWithExtraParams<T>;
  private _cache: _LiquityReadCache<T>;

  constructor(readable: _ReadableLiquityWithExtraParams<T>, cache: _LiquityReadCache<T>) {
    this._readable = readable;
    this._cache = cache;
  }

  async getTotalRedistributed(...extraParams: T): Promise<Trove> {
    return (
      this._cache.getTotalRedistributed(...extraParams) ??
      this._readable.getTotalRedistributed(...extraParams)
    );
  }

  async getTroveBeforeRedistribution(
    address?: string,
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution> {
    return (
      this._cache.getTroveBeforeRedistribution(address, ...extraParams) ??
      this._readable.getTroveBeforeRedistribution(address, ...extraParams)
    );
  }

  async getTrove(address?: string, ...extraParams: T): Promise<UserTrove> {
    const [troveBeforeRedistribution, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address, ...extraParams),
      this.getTotalRedistributed(...extraParams)
    ]);

    return troveBeforeRedistribution.applyRedistribution(totalRedistributed);
  }

  async getNumberOfTroves(...extraParams: T): Promise<number> {
    return (
      this._cache.getNumberOfTroves(...extraParams) ??
      this._readable.getNumberOfTroves(...extraParams)
    );
  }

  async getPrice(...extraParams: T): Promise<Decimal> {
    return this._cache.getPrice(...extraParams) ?? this._readable.getPrice(...extraParams);
  }

  async getTotal(...extraParams: T): Promise<Trove> {
    return this._cache.getTotal(...extraParams) ?? this._readable.getTotal(...extraParams);
  }

  async getStabilityDeposit(address?: string, ...extraParams: T): Promise<StabilityDeposit> {
    return (
      this._cache.getStabilityDeposit(address, ...extraParams) ??
      this._readable.getStabilityDeposit(address, ...extraParams)
    );
  }

  async getRemainingStabilityPoolLQTYReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingStabilityPoolLQTYReward(...extraParams) ??
      this._readable.getRemainingStabilityPoolLQTYReward(...extraParams)
    );
  }

  async getLUSDInStabilityPool(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLUSDInStabilityPool(...extraParams) ??
      this._readable.getLUSDInStabilityPool(...extraParams)
    );
  }

  async getLUSDBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLUSDBalance(address, ...extraParams) ??
      this._readable.getLUSDBalance(address, ...extraParams)
    );
  }

  async getLQTYBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLQTYBalance(address, ...extraParams) ??
      this._readable.getLQTYBalance(address, ...extraParams)
    );
  }

  async getUniTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getUniTokenBalance(address, ...extraParams) ??
      this._readable.getUniTokenBalance(address, ...extraParams)
    );
  }

  async pngGetUniTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.pngGetUniTokenBalance(address, ...extraParams) ??
      this._readable.pngGetUniTokenBalance(address, ...extraParams)
    );
  }

  async tjGetUniTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.tjGetUniTokenBalance(address, ...extraParams) ??
      this._readable.tjGetUniTokenBalance(address, ...extraParams)
    );
  }

  async p3GetUniTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.p3GetUniTokenBalance(address, ...extraParams) ??
      this._readable.p3GetUniTokenBalance(address, ...extraParams)
    );
  }

  async getUniTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getUniTokenAllowance(address, ...extraParams) ??
      this._readable.getUniTokenAllowance(address, ...extraParams)
    );
  }

  async pngGetUniTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.pngGetUniTokenAllowance(address, ...extraParams) ??
      this._readable.pngGetUniTokenAllowance(address, ...extraParams)
    );
  }

  async tjGetUniTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.tjGetUniTokenAllowance(address, ...extraParams) ??
      this._readable.tjGetUniTokenAllowance(address, ...extraParams)
    );
  }

  async p3GetUniTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.p3GetUniTokenAllowance(address, ...extraParams) ??
      this._readable.p3GetUniTokenAllowance(address, ...extraParams)
    );
  }

  async getRemainingLiquidityMiningLQTYReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingLiquidityMiningLQTYReward(...extraParams) ??
      this._readable.getRemainingLiquidityMiningLQTYReward(...extraParams)
    );
  }

  async pngGetRemainingLiquidityMiningLQTYReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.pngGetRemainingLiquidityMiningLQTYReward(...extraParams) ??
      this._readable.pngGetRemainingLiquidityMiningLQTYReward(...extraParams)
    );
  }

  async tjGetRemainingLiquidityMiningLQTYReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.tjGetRemainingLiquidityMiningLQTYReward(...extraParams) ??
      this._readable.tjGetRemainingLiquidityMiningLQTYReward(...extraParams)
    );
  }

  async p3GetRemainingLiquidityMiningLQTYReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.p3GetRemainingLiquidityMiningLQTYReward(...extraParams) ??
      this._readable.p3GetRemainingLiquidityMiningLQTYReward(...extraParams)
    );
  }

  async getLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLiquidityMiningStake(address, ...extraParams) ??
      this._readable.getLiquidityMiningStake(address, ...extraParams)
    );
  }

  async pngGetLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.pngGetLiquidityMiningStake(address, ...extraParams) ??
      this._readable.pngGetLiquidityMiningStake(address, ...extraParams)
    );
  }

  async tjGetLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.tjGetLiquidityMiningStake(address, ...extraParams) ??
      this._readable.tjGetLiquidityMiningStake(address, ...extraParams)
    );
  }

  async p3GetLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.p3GetLiquidityMiningStake(address, ...extraParams) ??
      this._readable.p3GetLiquidityMiningStake(address, ...extraParams)
    );
  }

  async getTotalStakedUniTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedUniTokens(...extraParams) ??
      this._readable.getTotalStakedUniTokens(...extraParams)
    );
  }

  async pngGetTotalStakedUniTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.pngGetTotalStakedUniTokens(...extraParams) ??
      this._readable.pngGetTotalStakedUniTokens(...extraParams)
    );
  }

  async tjGetTotalStakedUniTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.tjGetTotalStakedUniTokens(...extraParams) ??
      this._readable.tjGetTotalStakedUniTokens(...extraParams)
    );
  }

  async p3GetTotalStakedUniTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.p3GetTotalStakedUniTokens(...extraParams) ??
      this._readable.p3GetTotalStakedUniTokens(...extraParams)
    );
  }

  async getLiquidityMiningLQTYReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLiquidityMiningLQTYReward(address, ...extraParams) ??
      this._readable.getLiquidityMiningLQTYReward(address, ...extraParams)
    );
  }

  async pngGetLiquidityMiningLQTYReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.pngGetLiquidityMiningLQTYReward(address, ...extraParams) ??
      this._readable.pngGetLiquidityMiningLQTYReward(address, ...extraParams)
    );
  }

  async tjGetLiquidityMiningLQTYReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.tjGetLiquidityMiningLQTYReward(address, ...extraParams) ??
      this._readable.tjGetLiquidityMiningLQTYReward(address, ...extraParams)
    );
  }

  async p3GetLiquidityMiningLQTYReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.p3GetLiquidityMiningLQTYReward(address, ...extraParams) ??
      this._readable.p3GetLiquidityMiningLQTYReward(address, ...extraParams)
    );
  }

  async getCollateralSurplusBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getCollateralSurplusBalance(address, ...extraParams) ??
      this._readable.getCollateralSurplusBalance(address, ...extraParams)
    );
  }

  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;

  async getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]> {
    const { beforeRedistribution, ...restOfParams } = params;

    const [totalRedistributed, troves] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(...extraParams),
      this._cache.getTroves({ beforeRedistribution: true, ...restOfParams }, ...extraParams) ??
        this._readable.getTroves({ beforeRedistribution: true, ...restOfParams }, ...extraParams)
    ]);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed));
    } else {
      return troves;
    }
  }

  async getFees(...extraParams: T): Promise<Fees> {
    return this._cache.getFees(...extraParams) ?? this._readable.getFees(...extraParams);
  }

  async getLQTYStake(address?: string, ...extraParams: T): Promise<LQTYStake> {
    return (
      this._cache.getLQTYStake(address, ...extraParams) ??
      this._readable.getLQTYStake(address, ...extraParams)
    );
  }

  async getTotalStakedLQTY(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedLQTY(...extraParams) ??
      this._readable.getTotalStakedLQTY(...extraParams)
    );
  }

  async getFrontendStatus(address?: string, ...extraParams: T): Promise<FrontendStatus> {
    return (
      this._cache.getFrontendStatus(address, ...extraParams) ??
      this._readable.getFrontendStatus(address, ...extraParams)
    );
  }
}
