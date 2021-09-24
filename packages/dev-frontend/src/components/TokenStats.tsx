import React, { useState } from 'react';
import { Heading, Card, Link, Flex, Image } from "theme-ui";
import { Icon } from "./Icon";
import { InfoIcon } from './InfoIcon';
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../hooks/LiquityContext";
import { useQuery } from 'react-query'

type TokenRowProps = {
  name: React.ReactNode;
  image: string;
  tooltip?: React.ReactNode;
};

export const TokenRow: React.FC<TokenRowProps> = ({ name, image, tooltip, children }) => {
  return (
    <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
      <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
        <Flex> <Image src={image} width="25" height="25" sx={{marginRight: 2}}/> {name}</Flex>
        {tooltip && <InfoIcon size="xs" tooltip={<Card variant="tooltip">{tooltip}</Card>} />}
      </Flex>
      <Flex sx={{ justifyContent: "flex-start", flex: 0.8, alignItems: "center" }}>{children}</Flex>
    </Flex>
  );
};


export const TokenStats: React.FC = () => {

  const select = ({ price, lusdInStabilityPool, total, totalStakedLQTY }: LiquityStoreState) => ({ price, lusdInStabilityPool, total, totalStakedLQTY });

  const {
    liquity: {
      connection: { addresses, chainId }
    }
  } = useLiquity();

  const { price, lusdInStabilityPool, total, totalStakedLQTY } = useLiquitySelector(select);
  // code for how to add token copied from here https://github.com/rsksmart/metamask-rsk-custom-network/blob/main/src/App.tsx
  const [log, setLog] = useState<string[]>([])

  const addToken = (params: any) => {
    //@ts-ignore
    window.ethereum.request({ method: 'wallet_watchAsset', params })
      .then(() => setLog([...log, 'Success, Token added!']))
      .catch((error: Error) => setLog([...log, `Error: ${error.message}`]));
  }

  const addTsdToken = () => {
    addToken({
      type: 'ERC20',
      options: {
        address: addresses['lusdToken'],
        symbol: 'TSD',
        decimals: 18,
        image: 'https://assets.coingecko.com/coins/images/18303/small/logo_-_2021-09-13T111436.680.png'
      }
    });
  }

  const addTeddyToken = () => {
    addToken({
      type: 'ERC20',
      options: {
        address: addresses['lqtyToken'],
        symbol: 'TEDDY',
        decimals: 18,
        image: 'https://assets.coingecko.com/coins/images/18303/small/logo_-_2021-09-13T111436.680.png'
      }
    });
  }


  // eslint-disable-next-line
  const { isLoading, error, data } = useQuery('teddyPriceData', () =>
     fetch('https://api.coingecko.com/api/v3/simple/price?ids=teddy-cash&vs_currencies=usd').then(res =>
       res.json()
     )
   );

    const pngQuery = (tsdTokenAddress: string) => `{
        token(id: "${tsdTokenAddress.toLowerCase()}") {
            derivedETH
        },
        bundle(id: 1) {
            ethPrice
        }
    }`;

    const fetchTSD = () => fetch(
        "https://api.thegraph.com/subgraphs/name/dasconnor/pangolin-dex",
        {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({
            query: pngQuery(addresses['lusdToken']),
            variables: null
        })
        }
    );

  const { isLoading: tsdIsLoading, error: tsdError, data: tsdData } = useQuery('tsdPriceData', () =>
     fetchTSD().then(res =>
       res.json()
     )
   );
   const computeTsdVal = (tsdData: any, tsdError: any) => {
    if (tsdError) {
        throw new Error(tsdError);
    }
    
    const d = tsdData['data'];
    return Decimal.from(d['token']['derivedETH']).mul(Decimal.from(d['bundle']['ethPrice'])).toString(2);
   }

   const tsdValue = tsdIsLoading ? '...' : '$' + computeTsdVal(tsdData, tsdError);

   const explorerUrl = chainId === 43114 ? "https://cchain.explorer.avax.network/address/" : "https://cchain.explorer.avax-test.network/address/"

   // hard-coded for current week. needs to be adapted to consume
   // circulating supply API feed.
   const circSupply = 5; // millions
   const teddyRewardsYear1 = 25000000;
   let apr: Decimal = Decimal.from(0);
   let tvl: Decimal = Decimal.from(0);
   if (!isLoading) {
    const teddyPrice = Decimal.from(data['teddy-cash']['usd']);
    const teddyRewardsUSD = teddyPrice.mul(teddyRewardsYear1);
    apr = teddyRewardsUSD.div(lusdInStabilityPool).mul(100);
      
    tvl = totalStakedLQTY.mul(teddyPrice).add(total.collateral.mul(price));
  } 

  //  const apr = .mul(circSupply).toString(1);

    return (
        <>
         <Heading>Teddy Cash Stats</Heading>
         <TokenRow name="AVAX" image="./icons/avalanche-avax-logo.svg">
             <Flex sx={{minWidth: '55px', justifyContent: 'right', paddingRight: '2px'}}>${Decimal.from(price).toString(2)}</Flex>
             <Link href="https://www.coingecko.com/en/coins/avalanche" target="_blank">
                <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
             </Link>
             <Link href="https://data.chain.link/avalanche/mainnet/crypto-usd/avax-usd" target="_blank">
                <Icon name="satellite-dish" style={{marginLeft: "4px"}} size="xs" />
            </Link>
        </TokenRow>
        <TokenRow name="TSD" image="./teddy-cash-final-unicorn.png">
            <Flex sx={{minWidth: '55px', justifyContent: 'right', paddingRight: '2px'}}>{tsdValue}</Flex>
            <Link href={`https://info.pangolin.exchange/#/token/${addresses['lusdToken']}`} target="_blank">
               <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`${explorerUrl}${addresses['lusdToken']}`} target="_blank">
               <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses['lusdToken']}`} target="_blank">
              <Icon name="exchange-alt" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Flex style={{cursor: 'pointer'}} onClick={addTsdToken}><Image src="./icons/metamask.svg" style={{marginLeft: '5px', minWidth: '25px'}}/></Flex>
        </TokenRow>
        <TokenRow name="TEDDY" image="./teddy-cash-icon.png">
            <Flex sx={{minWidth: '55px', justifyContent: 'right', paddingRight: '2px'}}>{isLoading ? '...' : '$' + Decimal.from(data['teddy-cash']['usd']).toString(2)}</Flex>
            <Link href="https://www.coingecko.com/en/coins/teddy-cash" target="_blank">
                <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`${explorerUrl}${addresses['lqtyToken']}`} target="_blank">
               <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses['lqtyToken']}`} target="_blank">
                <Icon name="exchange-alt" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Flex style={{cursor: 'pointer'}} onClick={addTeddyToken}><Image src="./icons/metamask.svg" style={{marginLeft: '5px', minWidth: '25px'}}/></Flex>
        </TokenRow>
        <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
          <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
            <Flex>TEDDY Market Cap</Flex>
            <InfoIcon size="xs" tooltip={<Card variant="tooltip">Circulating Supply * Price</Card>} />
          </Flex>
          <Flex sx={{ justifyContent: "flex-start", flex: 0.8, alignItems: "center" }}>
            {isLoading ? '...' : '~ $' + Decimal.from(data['teddy-cash']['usd']).mul(circSupply).toString(1)}M
          </Flex>
        </Flex>
        <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
          <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
            <Flex>Stability Pool APR</Flex>
          </Flex>
          <Flex sx={{ justifyContent: "flex-start", flex: 0.8, alignItems: "center" }}>
            {isLoading ? '...' : apr.prettify(2)}%
          </Flex>
        </Flex>
        <Flex sx={{ paddingBottom: "4px", borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)", mb: 1 }}>
          <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.2, fontWeight: 200 }}>
            <Flex>TVL</Flex>
            <InfoIcon size="xs" tooltip={<Card variant="tooltip">TVL Stability Pool + TEDDY Staking</Card>} />
          </Flex>
          <Flex sx={{ justifyContent: "flex-start", flex: 0.8, alignItems: "center" }}>
            {isLoading ? '...' : '$' + tvl.shorten()}
          </Flex>
        </Flex>
        </>
    );
}

