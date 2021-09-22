import React from 'react';
import { Heading, Link, Box, Flex, Image } from "theme-ui";
import { Icon } from "./Icon";

import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../hooks/LiquityContext";
import { useQuery } from 'react-query'

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

    return (
        <>
         <Heading><Icon name="chart-line" style={{marginRight: "6px"}}/>Teddy Cash Stats</Heading>
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
                <Box>{tsdValue}</Box>
                <Box>
                    <Link href={`https://info.pangolin.exchange/#/token/${addresses['lusdToken']}`} target="_blank">
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
                <Box><Image src="./teddy-cash-icon.png" width="20" height="20" sx={{marginRight: 2}} />TEDDY</Box>
                <Box>{isLoading ? '...' : '$' + Decimal.from(data['teddy-cash']['usd']).toString(2)}</Box>
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
        </>
    );
}

