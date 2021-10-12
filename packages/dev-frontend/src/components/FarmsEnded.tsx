import React from "react";
import { Card, Heading, Box, Flex, Image, Link } from "theme-ui";
import { Icon } from "./Icon";
import { useLiquity } from "../hooks/LiquityContext";

const TJ_POOlS = {
  'TSD': '0x2d16af2d7f1edb4bc5dbadf3fff04670b4bcd0bb',
  'TEDDY': '0x91f0963873bbca2e58d21bb0941c0d859db3ca31'
};


export const FarmsEnded: React.FC = () => {
    const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();
  
  return  (
    <Card>
      <Heading>
        <Flex><Image src="./icons/avalanche-avax-logo.svg" width="20" height="20" sx={{marginRight: 1}}/>
        <Image src="./tsd.png" width="25" height="25" sx={{marginRight: 1}}/>
        <Image src="./teddy-cash-icon.png" width="25" height="25" sx={{marginRight: 2}}/>
        Liquidity Farms
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <Flex style={{marginBottom: 5}}>Our Liquidity Farms have ended!<br />Please move your liquidity to these excellent farms</Flex>
          <Flex sx={{paddingBottom: 2, marginBottom: 20, borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)"}}>
            <Image src="./pangolin.svg" width="20" height="20" sx={{marginRight: 2}}/>Pangolin<br />
          </Flex>
          <Flex style={{marginBottom: 15}}>
            <Image src="./icons/avalanche-avax-logo.svg" width="20" height="20" sx={{marginRight: 1}}/>
            <Image src="./tsd.png" width="25" height="25" sx={{marginRight: 1}}/>

            AVAX-TSD
            <Link href={`https://app.pangolin.exchange/#/png/AVAX/${addresses['lusdToken']}/1`} target="_blank">
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5}}/>
            </Link>
          </Flex>
          <Flex>
            <Image src="./icons/avalanche-avax-logo.svg" width="20" height="20" sx={{marginRight: 1}}/>
            <Image src="./teddy-cash-icon.png" width="25" height="25" sx={{marginRight: 1}}/>
            AVAX-TEDDY
            <Link href={`https://app.pangolin.exchange/#/png/AVAX/${addresses['lqtyToken']}/1`} target="_blank">
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5}}/>
            </Link>
          </Flex>
          <Flex sx={{marginBottom: 10, marginTop: 30, paddingBottom: 2, borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)"}}>
            <Image src="./tj.jpg" width="20" height="20" sx={{marginRight: 2}}/>
            Trader Joe
          </Flex>
          <Flex style={{marginBottom: 15}}>
            <Image src="./icons/avalanche-avax-logo.svg" width="20" height="20" sx={{marginRight: 1}}/>
            <Image src="./tsd.png" width="25" height="25" sx={{marginRight: 1}}/>
            AVAX-TSD
            <Link href={`https://www.traderjoexyz.com/#/farm/${TJ_POOlS['TSD']}`} target="_blank">
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5}}/>
            </Link>
          </Flex>
          <Flex>
            <Image src="./icons/avalanche-avax-logo.svg" width="20" height="20" sx={{marginRight: 1}}/>
            <Image src="./teddy-cash-icon.png" width="25" height="25" sx={{marginRight: 1}}/>
            AVAX-TEDDY
            <Link href={`https://www.traderjoexyz.com/#/farm/${TJ_POOlS['TEDDY']}`} target="_blank">
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5}}/>
            </Link>
          </Flex>
          <Box style={{marginTop: 10}}>
            <Link href="https://www.cycle.finance/" target="_blank">Cycle Finance</Link> provides auto-compounding strategies for the farms on Trader Joe
          </Box>
        </Box>
        <Flex variant="layout.actions">
        </Flex>
      </Box>
    </Card>
  );


};