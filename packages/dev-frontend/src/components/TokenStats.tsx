import React, { useState } from "react";
import { Heading, Card, Link, Flex, Image } from "theme-ui";
import { Icon } from "./Icon";
import { InfoIcon } from "./InfoIcon";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../hooks/LiquityContext";
import { useQueries } from "react-query";
import { useTeddyData } from "../hooks/useTeddyData";
import { TeddyDataStruct, getYields } from "../teddyData";

type TokenRowProps = {
  name: React.ReactNode;
  image: string;
  addToken?: any;
  tooltip?: React.ReactNode;
};

export const TokenRow: React.FC<TokenRowProps> = ({ name, image, addToken, tooltip, children }) => {
  // awful CSS hack
  const marginLeft = name === 'XLSD' ? "20px" : "0px";

  return (
    <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
      <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
        <Flex>
          {" "}
          <Image src={image} width="25" height="25" sx={{ marginRight: 2 }} /> {name}
        </Flex>
        {addToken && (
          <Flex style={{ cursor: "pointer", marginLeft: marginLeft }} onClick={addToken}>
            <Image src="./icons/metamask.svg" style={{ marginLeft: "5px", minWidth: "16px" }} />
          </Flex>
        )}
        {tooltip && <InfoIcon size="xs" tooltip={<Card variant="tooltip">{tooltip}</Card>} />}
      </Flex>
      <Flex sx={{ justifyContent: "flex-start", flex: 0.8, alignItems: "center" }}>{children}</Flex>
    </Flex>
  );
};

export const TokenStats: React.FC = () => {
  const select = ({ price, lusdInStabilityPool, total, totalStakedLQTY }: LiquityStoreState) => ({
    price,
    lusdInStabilityPool,
    total,
    totalStakedLQTY
  });

  const {
    liquity: {
      connection: { addresses, chainId }
    }
  } = useLiquity();

  const { price, lusdInStabilityPool, total, totalStakedLQTY } = useLiquitySelector(select);
  // code for how to add token copied from here https://github.com/rsksmart/metamask-rsk-custom-network/blob/main/src/App.tsx
  const [log, setLog] = useState<string[]>([]);

  const addToken = (params: any) => {
    // @ts-ignore
    const func = window.ethereum.request;

    func({ method: "wallet_watchAsset", params }) //@ts-ignore
      .then(() => setLog([...log, "Success, Token added!"]))
      .catch((error: Error) => setLog([...log, `Error: ${error.message}`]));
  };

  const addXlsdToken = () => {
    addToken({
      type: "ERC20",
      options: {
        address: addresses['lusdToken'],
        symbol: 'XLSD',
        decimals: 18,
        image:
          "https://assets.coingecko.com/coins/images/18303/small/logo_-_2021-09-13T111436.680.png"
      }
    });
  };

  const addXlongToken = () => {
    addToken({
      type: "ERC20",
      options: {
        address: addresses['lqtyToken'],
        symbol: 'XLONG',
        decimals: 18,
        image:
          "https://assets.coingecko.com/coins/images/18303/small/logo_-_2021-09-13T111436.680.png"
      }
    });
  };

  const pngQuery = (address: string) => `{
        token(id: "${address.toLowerCase()}") {
            derivedETH
        },
        bundle(id: 1) {
            ethPrice
        }
    }`;

    const fetchPrice = (address: string) => fetch(
        "https://graph.defikingdoms.com/subgraphs/name/defikingdoms/dex/graphql",
        {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({
            query: pngQuery(address),
            variables: null
        })
        }
    );

  const [
    { isLoading, error, data },
    { isLoading: tsdIsLoading, error: tsdError, data: tsdData }
  ] = useQueries(
    [
      { address: addresses["lqtyToken"], name: "lqty" },
      { address: addresses["lusdToken"], name: "lusd" }
    ].map((token: any) => {
      return {
        queryKey: ["token", token],
        queryFn: () => {
          // return dummy data if on testnet
          if (chainId === 43113) {
            const tokenData = token.name === 'lqty' ? 
              {
                token: {
                  derivedETH: '20.00000000000000000'
                },
                bundle: {
                  ethPrice: '0.300000000000000000',
                }
              }
            :
            {
              token: {
                derivedETH: '20.000000000000000000'
              },
               bundle: {
                ethPrice: '0.300000000000000000',
              }
            }
            return {isLoading: true, error: undefined,  data: tokenData}
          } else {
            return fetchPrice(token.address).then(res => res.json());
          }
        }
      };
    })
  );

  const {
    isLoading: teddyDataIsLoading,
    error: teddyDataError,
    data: teddyData
  }: { isLoading: boolean; error: unknown; data: TeddyDataStruct } = useTeddyData();

  const computeVal = (data: any, error: any) => {
    if (error) {
      throw new Error(error);
    }

    const d = data["data"];
    //return Decimal.from(d['token']['derivedETH']).mul(Decimal.from(d['bundle']['ethPrice'])).toString(2);
    return Decimal.from(d['token']['derivedETH']).mul(Decimal.from(d['bundle']['ethPrice']))
   }

   const xlongValue = isLoading ? Decimal.from(0) : computeVal(data, error);
   const tsdValue = tsdIsLoading ? Decimal.from(0) : computeVal(tsdData, tsdError);
   
   const explorerUrl = chainId === 1666600000 ? "https://explorer.harmony.one/address/" : "https://explorer.testnet.harmony.one/address/"

   // hard-coded for current week. needs to be adapted to consume
   // circulating supply API feed.
   const circSupply = 5753340; 
   const marketCapEstimate = xlongValue.mul(circSupply);
   
   let tvlSP = lusdInStabilityPool;
   let tvlXlong = totalStakedLQTY.mul(xlongValue);
   
   let tvlTotal: Decimal = Decimal.from(0);
   let tvlCollateral: Decimal = Decimal.from(0);
   
    let aprDaily: Decimal = Decimal.from(0);
    let aprWeekly: Decimal = Decimal.from(0);
    let aprYearly: Decimal = Decimal.from(0);
     
    if (!isLoading) {     
      // Stability APR calculation
      const deploymentTime = 1629989860;
      const now = new Date().getTime() / 1000      
      const timePassedInMinutes = Math.round((now - deploymentTime) / 60);

      const ISSUANCE_FACTOR = 0.999998681227695000;      
      const shareNow = Math.pow(ISSUANCE_FACTOR, timePassedInMinutes);
      
      const rewardsDay = 32_000_000 * (shareNow - Math.pow(ISSUANCE_FACTOR, timePassedInMinutes + 60*24))
      const rewardsWeek = 32_000_000 * (shareNow -  Math.pow(ISSUANCE_FACTOR, timePassedInMinutes + 60*24*7));
      const rewardsYear = 32_000_000 * (shareNow - Math.pow(ISSUANCE_FACTOR, timePassedInMinutes + 60*24*365));
            
      aprDaily = xlongValue.mul(rewardsDay).div(lusdInStabilityPool).mul(100);
      aprWeekly = xlongValue.mul(rewardsWeek).div(lusdInStabilityPool).mul(100);
      aprYearly = xlongValue.mul(rewardsYear).div(lusdInStabilityPool).mul(100);

      tvlCollateral = total.collateral.mul(price)
      tvlTotal = tvlXlong
        .add(tvlSP)
        .add(tvlCollateral);
    } 

    // this function is a hack to make the UI readable in testnet where the APR is super high
    const prettifyDecimal = (dec: Decimal, precision: number) => {
      const prettyVal = dec.prettify(precision)
      // on the testnet, if no XLSD in stability pool, this number is close to infinite
      if (prettyVal.length > 10) {
        return '\u221E';
      } else {
        return prettyVal;
      }
    }
  }

    return (
        <>
         <Heading>Extra Long Stats</Heading>
         <TokenRow name="ONE" image="./icons/avalanche-avax-logo.svg">
             <Flex sx={{minWidth: '55px', justifyContent: 'right', paddingRight: '2px'}}>${Decimal.from(price).toString(2)}</Flex>
             <Link href="https://www.coingecko.com/en/coins/harmony" target="_blank">
                <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
             </Link>
        </TokenRow>
        <TokenRow name="XLSD" image="./tsd.png" addToken={addXlsdToken}>
            <Flex sx={{minWidth: '55px', justifyContent: 'right', paddingRight: '2px'}}>{tsdIsLoading ? '...' : '$' + tsdValue.prettify(2)}</Flex>
            <Link href={`https://info.pangolin.exchange/#/token/${addresses['lusdToken']}`} target="_blank">
               <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`${explorerUrl}${addresses['lusdToken']}`} target="_blank">
               <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`https://viperswap.one/#/swap?outputCurrency=${addresses['lusdToken']}`} target="_blank">
              <Image src="./pangolin.svg" width="15px" height="15px" style={{paddingTop: '8px', marginLeft: '3px'}}/>
            </Link>
            <Link href={`https://game.defikingdoms.com/#/marketplace?outputCurrency=${addresses['lusdToken']}`} target="_blank">
                <Image src="./joe.png" width="15px" height="15px" style={{paddingTop: '8px', marginLeft: '3px'}}/>
            </Link>
        </TokenRow>
        <TokenRow name="TEDDY" image="./teddy-cash-icon.png" addToken={addXlongToken}>
            <Flex sx={{minWidth: '55px', justifyContent: 'right', paddingRight: '2px'}}>{isLoading ? '...' : '$' + xlongValue.prettify(2)}</Flex>
            <Link href="https://www.coingecko.com/en/coins/teddy-cash" target="_blank">
                <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`${explorerUrl}${addresses['lqtyToken']}`} target="_blank">
               <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`https://viperswap.one/#/swap?outputCurrency=${addresses['lqtyToken']}`} target="_blank">
                <Image src="./pangolin.svg" width="15px" height="15px" style={{paddingTop: '8px', marginLeft: '3px'}}/>
            </Link>
            <Link href={`https://game.defikingdoms.com/#/marketplace?outputCurrency=${addresses['lqtyToken']}`} target="_blank">
                <Image src="./joe.png" width="15px" height="15px" style={{paddingTop: '8px', marginLeft: '3px'}}/>
            </Link>
        </TokenRow>
        <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
          <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
            <Flex> XLONG Market Cap
            </Flex>
          </Flex>
          <Flex sx={{ fontVariantNumeric: "tabular-nums", justifyContent: "flex-end", flex: 0.8,alignItems: "center" }}>
            {isLoading ? '...' : "~$" + marketCapEstimate.div(1_000_000).prettify(1)}M
          </Flex>
        </Flex>
        <Link
          href={`https://www.coingecko.com/en/coins/teddy-dollar`}
          target="_blank"
        >
          <Icon name="info-circle" style={{ marginLeft: "4px" }} size="xs" />
        </Link>
        <Link href={`${explorerUrl}${addresses["lusdToken"]}`} target="_blank">
          <Icon name="file-contract" style={{ marginLeft: "4px" }} size="xs" />
        </Link>
        <Link
          href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses["lusdToken"]}`}
          target="_blank"
        >
          <Image
            src="./pangolin.svg"
            width="15px"
            height="15px"
            style={{ paddingTop: "8px", marginLeft: "3px" }}
          />
        </Link>
        <Link
          href={`https://www.traderjoexyz.com/#/trade?outputCurrency=${addresses["lusdToken"]}`}
          target="_blank"
        >
          <Image
            src="./joe.png"
            width="15px"
            height="15px"
            style={{ paddingTop: "8px", marginLeft: "3px" }}
          />
        </Link>
      </TokenRow>
      <TokenRow name="TEDDY" image="./teddy-cash-icon.png" addToken={addTeddyToken}>
        <Flex sx={{ minWidth: "55px", justifyContent: "right", paddingRight: "2px" }}>
          {isLoading ? "..." : "$" + teddyValue.prettify(2)}
        </Flex>
        <Link href="https://www.coingecko.com/en/coins/teddy-cash" target="_blank">
          <Icon name="info-circle" style={{ marginLeft: "4px" }} size="xs" />
        </Link>
        <Link href={`${explorerUrl}${addresses["lqtyToken"]}`} target="_blank">
          <Icon name="file-contract" style={{ marginLeft: "4px" }} size="xs" />
        </Link>
        <Link
          href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses["lqtyToken"]}`}
          target="_blank"
        >
          <Image
            src="./pangolin.svg"
            width="15px"
            height="15px"
            style={{ paddingTop: "8px", marginLeft: "3px" }}
          />
        </Link>
        <Link
          href={`https://www.traderjoexyz.com/#/trade?outputCurrency=${addresses["lqtyToken"]}`}
          target="_blank"
        >
          <Image
            src="./joe.png"
            width="15px"
            height="15px"
            style={{ paddingTop: "8px", marginLeft: "3px" }}
          />
        </Link>
      </TokenRow>

      <Flex sx={{ mt:2, paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
        <Flex
          sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}
        >
          <Flex> TEDDY Market Cap</Flex>
        </Flex>
        <Flex
          sx={{
            fontVariantNumeric: "tabular-nums",
            justifyContent: "flex-end",
            flex: 0.8,
            alignItems: "center"
          }}
        >
          {marketCap}
        </Flex>
      </Flex>

      <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
        <Flex
          sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}
        >
          <Flex>Circulating/Total Supply</Flex>
        </Flex>
        <Flex
          sx={{
            fontVariantNumeric: "tabular-nums",
            justifyContent: "flex-end",
            flex: 0.8,
            alignItems: "center"
          }}
        >
          {circulatingSupply} / 82M
        </Flex>
        <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mt: 3, mb: 1 }}>
          <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
            <Flex sx={{fontWeight: "bold"}}>TVL Total</Flex>
            <InfoIcon size="xs" tooltip={<Card variant="tooltip">TVL ONE collateral + XLSD in Stability Pool + XLONG Staking</Card>} />
          </Flex>
          <Flex sx={{ fontVariantNumeric: "tabular-nums", fontWeight: "bold", justifyContent: "flex-end", flex: 0.8, alignItems: "center" }}>
            {isLoading ? '...' : '$' + tvlTotal.shorten()}
          </Flex>
        </Flex>
        <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
          <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
            <Flex> &middot; in Troves</Flex>
            <InfoIcon size="xs" tooltip={<Card variant="tooltip">ONE collateralized in troves.</Card>} />
          </Flex>
          <Flex sx={{ fontVariantNumeric: "tabular-nums", justifyContent: "flex-end", flex: 0.8, alignItems: "center" }}>
            {isLoading ? '...' : '$' + tvlCollateral.shorten()}
          </Flex>
        </Flex>
      </Flex>
      <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
        <Flex
          sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}
        >
          <Flex> &middot; Week</Flex>
        </Flex>
        <Flex
          sx={{
            fontVariantNumeric: "tabular-nums",
            justifyContent: "flex-end",
            flex: 0.8,
            alignItems: "center"
          }}
        >
          {isLoading ? "..." : prettifyDecimal(aprWeekly, 1)}%
        </Flex>
      </Flex>
      <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
        <Flex
          sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}
        >
          <Flex> &middot; Year (APR)
          </Flex>
        </Flex>
        <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
          <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
            <Flex> &middot; XLONG Staking</Flex>
            <InfoIcon size="xs" tooltip={<Card variant="tooltip">XLONG Staking</Card>} />
          </Flex>
          <Flex sx={{ fontVariantNumeric: "tabular-nums", justifyContent: "flex-end", flex: 0.8, alignItems: "center" }}>
            {isLoading ? '...' : '$' + tvlXlong.shorten()}
          </Flex>
        </Flex>
        <Flex
          sx={{
            fontVariantNumeric: "tabular-nums",
            justifyContent: "flex-end",
            flex: 0.8,
            alignItems: "center"
          }}
        >
          {teddyDataIsLoading ? "..." : prettifyDecimal(teddyApr, 1)}%
        </Flex>
      </Flex>

      <Heading sx={{ pt: 3 }}>TVL</Heading>
      <Flex
        sx={{
          paddingBottom: "4px",
          borderBottom: 1,
          borderColor: "rgba(0, 0, 0, 0.1)",
          mt: 3,
          mb: 1
        }}
      >
        <Flex
          sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}
        >
          <Flex sx={{ fontWeight: "bold" }}>Total</Flex>
          <InfoIcon
            size="xs"
            tooltip={
              <Card variant="tooltip">
                TVL AVAX collateral + TSD in Stability Pool + TEDDY Staking
              </Card>
            }
          />
        </Flex>
        <Flex
          sx={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: "bold",
            justifyContent: "flex-end",
            flex: 0.8,
            alignItems: "center"
          }}
        >
          {isLoading ? "..." : "$" + tvlTotal.shorten()}
        </Flex>
      </Flex>
      <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
        <Flex
          sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}
        >
          <Flex> &middot; in Troves</Flex>
          <InfoIcon
            size="xs"
            tooltip={<Card variant="tooltip">AVAX collateralized in troves.</Card>}
          />
        </Flex>
        <Flex
          sx={{
            fontVariantNumeric: "tabular-nums",
            justifyContent: "flex-end",
            flex: 0.8,
            alignItems: "center"
          }}
        >
          {isLoading ? "..." : "$" + tvlCollateral.shorten()}
        </Flex>
      </Flex>
      <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
        <Flex
          sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}
        >
          <Flex> &middot; Stability Pool</Flex>
          <InfoIcon size="xs" tooltip={<Card variant="tooltip">TVL in Stability Pool</Card>} />
        </Flex>
        <Flex
          sx={{
            fontVariantNumeric: "tabular-nums",
            justifyContent: "flex-end",
            flex: 0.8,
            alignItems: "center"
          }}
        >
          {isLoading ? "..." : "$" + tvlSP.shorten()}
        </Flex>
      </Flex>
      <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
        <Flex
          sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}
        >
          <Flex> &middot; Teddy Staking</Flex>
          <InfoIcon size="xs" tooltip={<Card variant="tooltip">TEDDY Staking</Card>} />
        </Flex>
        <Flex
          sx={{
            fontVariantNumeric: "tabular-nums",
            justifyContent: "flex-end",
            flex: 0.8,
            alignItems: "center"
          }}
        >
          {isLoading ? "..." : "$" + tvlTeddy.shorten()}
        </Flex>
      </Flex>
    </>
  );
};
