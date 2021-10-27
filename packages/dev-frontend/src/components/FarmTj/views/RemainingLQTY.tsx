import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ tjRemainingLiquidityMiningLQTYReward }: LiquityStoreState) => ({
  tjRemainingLiquidityMiningLQTYReward
});

export const RemainingLQTY: React.FC = () => {
  const { tjRemainingLiquidityMiningLQTYReward: remainingLiquidityMiningLQTYReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingLiquidityMiningLQTYReward.div(1_000_000).prettify(1)}M TEDDY remaining
    </Flex>
  );
};
