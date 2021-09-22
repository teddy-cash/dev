import React from "react";
import { Card, Heading, Link, Box, Flex, Text, Image } from "theme-ui";

import { Icon } from "./Icon";
import { Decimal, Percent, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { COIN, GT } from "../strings";
import { Statistic } from "./Statistic";

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

const GitHubCommit: React.FC<{ children?: string }> = ({ children }) => {
  return children?.match(/[0-9a-f]{40}/) ? (
    <Link href={`https://github.com/teddy-cash/dev/commit/${children}`}>{children.substr(0, 7)}</Link>
  ) : (
    <>unknown</>
  )
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
    liquity: {
      connection: { version: contractsVersion, deploymentDate, addresses, chainId }
    }
  } = useLiquity();

  const explorerUrl = chainId === 43114 ? "https://cchain.explorer.avax.network/address/" : "https://cchain.explorer.avax-test.network/address/"

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

      <Heading>Teddy Cash Stats</Heading>
      <Box sx={{mb: 1, mt: 1}}>
      <Flex sx={{ alignItems: "center"}}>
        <Box sx={{margin: 'auto'}}>
          <Box><Image src="./icons/avalanche-avax-logo.svg" width="16" height="16" sx={{marginRight: 2}} />AVAX</Box>
          <Box sx={{margin: 'auto'}}>${Decimal.from(price).toString(2)}</Box>
          <Box  sx={{ml: '10px'}}>
            <Link href="https://www.coingecko.com/en/coins/avalanche" target="_blank">
              <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href="https://data.chain.link/avalanche/mainnet/crypto-usd/avax-usd">
              <Icon name="satellite-dish" style={{marginLeft: "4px"}} size="xs" />
            </Link>
          </Box>
        </Box>
        <Box sx={{margin: 'auto'}}>
          <Box><Image src="./teddy-cash-final-unicorn.png" width="20" height="20" sx={{marginRight: 2}} />TSD</Box>
          <Box>$1.00</Box>
          <Box>
            <Link href="" target="_blank">
              <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`${explorerUrl}${addresses['lusdToken']}`} target="_blank">
              <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses['lusdToken']}`} target="_blank">
              <Icon name="exchange-alt" style={{marginLeft: "4px"}} size="xs" />
            </Link>
          </Box>
        </Box>
        <Box sx={{margin: 'auto'}}>
          <Box><Image src="./teddy-cash-icon.png" width="20" height="20" sx={{marginRight: 2}} /> TEDDY</Box>
          <Box>$0.45</Box>
          <Box>
            <Link href="https://www.coingecko.com/en/coins/teddy-cash" target="_blank">
              <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`${explorerUrl}${addresses['lqtyToken']}`} target="_blank">
              <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses['lqtyToken']}`} target="_blank">
              <Icon name="exchange-alt" style={{marginLeft: "4px"}} size="xs" />
            </Link>
          </Box>
        </Box>
      </Flex>      
      </Box>
      
      <Heading>Protocol</Heading>
      <Statistic
        name="Borrowing Fee"
        tooltip="The Borrowing Fee is a one-off fee charged as a percentage of the borrowed amount (in TSD) and is part of a Trove's debt. The fee varies between 0.5% and 5% depending on TSD redemption volumes."
      >
        {borrowingFeePct.toString(2)}
      </Statistic>

      <Statistic
        name="TVL"
        tooltip="The Total Value Locked (TVL) is the total value of AVAX locked as collateral in the system, given in AVAX and USD."
      >
        {total.collateral.shorten()} <Text sx={{ fontSize: 1 }}>&nbsp;AVAX</Text>
        <Text sx={{ fontSize: 1 }}>
          &nbsp;(${Decimal.from(total.collateral.mul(price)).shorten()})
        </Text>
      </Statistic>
      <Statistic name="Troves" tooltip="The total number of active Troves in the system.">
        {Decimal.from(numberOfTroves).prettify(0)}
      </Statistic>
      <Statistic name="TSD supply" tooltip="The total TSD minted by the Liquity Protocol.">
        {total.debt.shorten()}
      </Statistic>
      {lusdInStabilityPoolPct && (
        <Statistic
          name="TSD in Stability Pool"
          tooltip="The total TSD currently held in the Stability Pool, expressed as an amount and a fraction of the TSD supply.
        "
        >
          {lusdInStabilityPool.shorten()}
          <Text sx={{ fontSize: 1 }}>&nbsp;({lusdInStabilityPoolPct.toString(1)})</Text>
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
      <Box sx={{ mt: 3, opacity: 0.66 }}>
        <Box sx={{ fontSize: 0 }}>
          Deployed: {deploymentDate.toLocaleDateString()}, <GitHubCommit>{contractsVersion}</GitHubCommit>
        </Box>
      </Box>
    </Card>
  );
};
