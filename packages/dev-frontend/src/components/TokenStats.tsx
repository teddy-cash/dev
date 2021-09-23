import React from 'react';
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

  const select = ({ price }: LiquityStoreState) => ({ price });

  const {
    liquity: {
      connection: { addresses, chainId }
    }
  } = useLiquity();

  const { price } = useLiquitySelector(select);
  
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

    return (
        <>
         <Heading>Teddy Cash Stats</Heading>
         <TokenRow name="AVAX" image="./icons/avalanche-avax-logo.svg">
             ${Decimal.from(price).toString(2)}
             <Link href="https://www.coingecko.com/en/coins/avalanche" target="_blank">
                <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
             </Link>
             <Link href="https://data.chain.link/avalanche/mainnet/crypto-usd/avax-usd" target="_blank">
                <Icon name="satellite-dish" style={{marginLeft: "4px"}} size="xs" />
            </Link>
        </TokenRow>
        <TokenRow name="TSD" image="./teddy-cash-final-unicorn.png">
            {tsdValue}
            <Link href={`https://info.pangolin.exchange/#/token/${addresses['lusdToken']}`} target="_blank">
               <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`${explorerUrl}${addresses['lusdToken']}`} target="_blank">
               <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses['lusdToken']}`} target="_blank">
              <Icon name="exchange-alt" style={{marginLeft: "4px"}} size="xs" />
            </Link>
        </TokenRow>
        <TokenRow name="TEDDY" image="./teddy-cash-icon.png">
            {isLoading ? '...' : '$' + Decimal.from(data['teddy-cash']['usd']).toString(2)}
            <Link href="https://www.coingecko.com/en/coins/teddy-cash" target="_blank">
                <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`${explorerUrl}${addresses['lqtyToken']}`} target="_blank">
               <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
            </Link>
            <Link href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses['lqtyToken']}`} target="_blank">
                <Icon name="exchange-alt" style={{marginLeft: "4px"}} size="xs" />
            </Link>
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
{/*             <Box sx={{mb: 1, mt: 1}}>
            <Flex sx={{ alignItems: "center"}}>
                <Box sx={{margin: 'auto'}}>
                <Flex style={{justifyContent: 'center'}}><Image src="./icons/avalanche-avax-logo.svg" width="16" height="16" sx={{marginRight: 2}} />AVAX</Flex>
                <Flex style={{justifyContent: 'center'}}>${Decimal.from(price).toString(2)}</Flex>
                <Flex style={{justifyContent: 'center'}}>
                    <Link href="https://www.coingecko.com/en/coins/avalanche" target="_blank">
                    <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
                    </Link>
                    <Link href="https://data.chain.link/avalanche/mainnet/crypto-usd/avax-usd" target="_blank">
                    <Icon name="satellite-dish" style={{marginLeft: "4px"}} size="xs" />
                    </Link>
                </Flex>
                </Box>
                <Box sx={{margin: 'auto'}}>
                <Flex style={{justifyContent: 'center'}}><Image src="./teddy-cash-final-unicorn.png" width="20" height="20" sx={{marginRight: 2}} />TSD</Flex>
                <Flex style={{justifyContent: 'center'}}>{tsdValue}</Flex>
                <Flex style={{justifyContent: 'center'}}>
                    <Link href={`https://info.pangolin.exchange/#/token/${addresses['lusdToken']}`} target="_blank">
                    <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
                    </Link>
                    <Link href={`${explorerUrl}${addresses['lusdToken']}`} target="_blank">
                    <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
                    </Link>
                    <Link href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses['lusdToken']}`} target="_blank">
                    <Icon name="exchange-alt" style={{marginLeft: "4px"}} size="xs" />
                    </Link>
                </Flex>
                </Box>
                <Box sx={{margin: 'auto'}}>
                <Flex style={{justifyContent: 'center'}}><Image src="./teddy-cash-icon.png" width="20" height="20" sx={{marginRight: 2}} />TEDDY</Flex>
                <Flex style={{justifyContent: 'center'}}>{isLoading ? '...' : '$' + Decimal.from(data['teddy-cash']['usd']).toString(2)}</Flex>
                <Flex style={{justifyContent: 'center'}}>
                    <Link href="https://www.coingecko.com/en/coins/teddy-cash" target="_blank">
                    <Icon name="info-circle" style={{marginLeft: "4px"}} size="xs" />
                    </Link>
                    <Link href={`${explorerUrl}${addresses['lqtyToken']}`} target="_blank">
                    <Icon name="file-contract" style={{marginLeft: "4px"}} size="xs" />
                    </Link>
                    <Link href={`https://app.pangolin.exchange/#/swap?outputCurrency=${addresses['lqtyToken']}`} target="_blank">
                    <Icon name="exchange-alt" style={{marginLeft: "4px"}} size="xs" />
                    </Link>
                </Flex>
                </Box>

            </Flex>      
            </Box> */}
        </>
    );
}

