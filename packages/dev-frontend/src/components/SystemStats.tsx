import React from "react";
import { Card, Heading, Box, Text } from "theme-ui";


import { Decimal, Percent, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../strings";
import { Statistic } from "./Statistic";
import { TokenStats } from "./TokenStats";

const selectBalances = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
  accountBalance,
  lusdBalance,
  lqtyBalance
});

const Balances: React.FC = () => {
  const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(selectBalances);

  return (
    <Box sx={{ mb: 3 }}>
      <Heading>My Account Balances</Heading>
      <Statistic name="AVAX"> {accountBalance.prettify(4)}</Statistic>
      <Statistic name={COIN}> {lusdBalance.prettify()}</Statistic>
      <Statistic name={GT}>{lqtyBalance.prettify()}</Statistic>
    </Box>
  );
};

type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
};

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  frontend
}: LiquityStoreState) => ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
});

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {

  const {
    numberOfTroves,
    price,
    lusdInStabilityPool,
    total,
    borrowingRate,
    totalStakedLQTY,
    } = useLiquitySelector(select);

  const lusdInStabilityPoolPct =
    total.debt.nonZero && new Percent(lusdInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  const borrowingFeePct = new Percent(borrowingRate);
  
  return (
    <Card {...{ variant }}>
      {showBalances && <Balances />}

      <TokenStats />
      
      <Heading  sx={{pt: 3, mt: 3}} >Protocol</Heading>
      <Statistic
        name="Borrowing Fee"
        tooltip="The Borrowing Fee is a one-off fee charged as a percentage of the borrowed amount (in TSD) and is part of a Trove's debt. The fee varies between 0.5% and 5% depending on TSD redemption volumes."
      >
        {borrowingFeePct.toString(2)}
      </Statistic>

      <Statistic
        name="AVAX Collateral"
        tooltip="The Total Value Locked (TVL) is the total value of AVAX locked as collateral in the system, given in AVAX and USD."
      >
        {total.collateral.shorten()} 
      </Statistic>
      <Statistic name="Troves" tooltip="The total number of active Troves in the system.">
        {Decimal.from(numberOfTroves).prettify(0)}
      </Statistic>
      <Statistic name="TSD supply" tooltip="The total TSD minted by Teddy Cash.">
        {total.debt.shorten()}
      </Statistic>
      {lusdInStabilityPoolPct && (
        <Statistic
          name="TSD in Stability Pool"
          tooltip="The total TSD currently held in the Stability Pool, expressed as an amount and a fraction of the TSD supply.
        "
        >
          <Text sx={{ fontSize: 0 }}>({lusdInStabilityPoolPct.toString(1)})&nbsp;</Text>
          {lusdInStabilityPool.shorten()}
        </Statistic>
      )}
      <Statistic
        name="Staked TEDDY"
        tooltip="The total amount of TEDDY that is staked for earning fee revenue."
      >
        {totalStakedLQTY.shorten()}
      </Statistic>
      
      <Statistic
        name="Total Collateral Ratio"
        tooltip="The ratio of the Dollar value of the entire system collateral at the current AVAX:USD price, to the entire system debt."
      >
        {totalCollateralRatioPct.prettify()}
      </Statistic>
      <Statistic
        name="Recovery Mode"
        tooltip="Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%. When active, your Trove can be liquidated if its collateral ratio is below the TCR. The maximum collateral you can lose from liquidation is capped at 110% of your Trove's debt. Operations are also restricted that would negatively impact the TCR."
      >
        {total.collateralRatioIsBelowCritical(price) ? <Box color="danger">Yes</Box> : "No"}
      </Statistic>
      { }
    </Card>
  );
};
