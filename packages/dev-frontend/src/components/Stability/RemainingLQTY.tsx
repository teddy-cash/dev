import React from "react";
import { Flex } from "theme-ui";

import { spTeddyRewards } from "../../utils/spTeddyRewards";

export const RemainingLQTY: React.FC = () => {
  const rewardsDay = spTeddyRewards(1);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium", color: "#9fa3b4", textTransform: "none" }}>
      {rewardsDay.div(1_000).prettify(1)}K TEDDY / day
    </Flex>
  );
};
