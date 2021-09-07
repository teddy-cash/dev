import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({
  tjTokenBalance,
  tjTokenAllowance,
  tjLiquidityMiningStake,
  tjRemainingLiquidityMiningLQTYReward
}: LiquityStoreState) => ({
  tjTokenBalance,
  tjTokenAllowance,
  tjLiquidityMiningStake,
  tjRemainingLiquidityMiningLQTYReward
});

type FarmStakeValidation = {
  isValid: boolean;
  hasApproved: boolean;
  hasEnoughUniToken: boolean;
  isWithdrawing: boolean;
  amountChanged: Decimal;
  maximumStake: Decimal;
  hasSetMaximumStake: boolean;
};

export const useValidationState = (amount: Decimal): FarmStakeValidation => {
  const {
    tjTokenBalance: uniTokenBalance,
    tjTokenAllowance: uniTokenAllowance,
    tjLiquidityMiningStake: liquidityMiningStake,
    tjRemainingLiquidityMiningLQTYReward: remainingLiquidityMiningLQTYReward
  } = useLiquitySelector(selector);

  const isWithdrawing = liquidityMiningStake.gt(amount);
  const amountChanged = isWithdrawing
    ? liquidityMiningStake.sub(amount)
    : Decimal.from(amount).sub(liquidityMiningStake);
  const maximumStake = liquidityMiningStake.add(uniTokenBalance);
  const hasSetMaximumStake = amount.eq(maximumStake);

  if (isWithdrawing) {
    return {
      isValid: true,
      hasApproved: true,
      hasEnoughUniToken: true,
      isWithdrawing,
      amountChanged,
      maximumStake,
      hasSetMaximumStake
    };
  }

  const hasApproved = !uniTokenAllowance.isZero && uniTokenAllowance.gte(amountChanged);
  const hasEnoughUniToken = !uniTokenBalance.isZero && uniTokenBalance.gte(amountChanged);

  return {
    isValid: hasApproved && hasEnoughUniToken,
    hasApproved,
    hasEnoughUniToken,
    isWithdrawing,
    amountChanged,
    maximumStake,
    hasSetMaximumStake
  };
};
