import React, { useState } from 'react';
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

    return (
        <>
         <Heading>Teddy Cash Stats</Heading>
            <Box sx={{mb: 1, mt: 1}}>
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
                <Box><Image src="./icons/metamask.svg" style={{maxHeight: '30px', visibility: 'hidden'}}/></Box>
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
                <Flex style={{justifyContent: 'center', cursor: 'pointer'}} onClick={addTsdToken}><Image src="./icons/metamask.svg" style={{maxHeight: '30px'}}/></Flex>
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
                <Flex style={{justifyContent: 'center', cursor: 'pointer'}} onClick={addTeddyToken}><Image src="./icons/metamask.svg" style={{maxHeight: '30px'}}/></Flex>
                </Box>

            </Flex>      
            </Box>
        </>
    );
}

