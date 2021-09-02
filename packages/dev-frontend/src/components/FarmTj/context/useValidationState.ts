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

let counter = 0;
const printOnce = (func: any) => {
  if (counter === 0) {
    func();
  }
  counter += 1;
};

export const useValidationState = (amount: Decimal): FarmStakeValidation => {
  const {
    tjTokenBalance: uniTokenBalance,
    tjTokenAllowance: uniTokenAllowance,
    tjLiquidityMiningStake: liquidityMiningStake,
    tjRemainingLiquidityMiningLQTYReward: remainingLiquidityMiningLQTYReward
  } = useLiquitySelector(selector);

  printOnce(() => {
    console.log(`BWB tjPool2TokenBalance is ${uniTokenBalance}`);
    console.log(`BWB tjPool2TokenAllowance is ${uniTokenAllowance}`);
    console.log(`BWB tjPool2LiquidityMiningStake is ${liquidityMiningStake}`);
    console.log(
      `BWB tjPool2RemainingLiquidityMiningLQTYReward is ${remainingLiquidityMiningLQTYReward}`
    );
  });

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
