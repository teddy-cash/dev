import React from "react";
import { Card, Heading, Box, Flex, Image, Link } from "theme-ui";
import { Icon } from "./Icon";
import { useLiquity } from "../hooks/LiquityContext";
import { NavLink } from "react-router-dom";
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
    <>
    <Card>
      <Heading>
        <Flex>
        <Image src="./axial-144x144.png" width="25" height="25" sx={{marginRight: 2}}/>
        Axial Exchange
        </Flex>
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <Box>
          <Flex style={{marginBottom: 15, alignItems: 'center', fontWeight: "bold", color: "white"}}>
            <Image src="./tsd.png" width="25" height="20" sx={{marginRight: 1}}/>
            <Link href={`https://app.axial.exchange/#/pools/ac4d/deposit`} target="_blank">
              A4CD Stablecoin Pool (Dual Rewards)
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5, marginRight: 5}}/>
            </Link>
          </Flex>
        </Box>
      </Box>
    </Card>
    <Card>
      <Heading>
        <Flex>
        <Image src="./pangolin.svg" width="20" height="20" sx={{marginRight: 2}}/>
          Pangolin
        </Flex>
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <Box>
          <Flex style={{marginBottom: 15, alignItems: 'center'}}>
            <Image src="./tsd.png" width="25" height="20" sx={{marginRight: 1}}/>
            AVAX-TSD (LP)
            <Link href={`https://app.pangolin.exchange/#/png/AVAX/${addresses['lusdToken']}/1`} target="_blank">
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5, marginRight: 5}}/>
            </Link>
          </Flex>

          <Flex sx={{color: "white"}}>
            <Image src="./teddy-cash-icon.png" width="25" height="20" sx={{marginRight: 1}}/>
            <Link href={`https://app.pangolin.exchange/#/png/AVAX/${addresses['lqtyToken']}/1`} target="_blank">
              AVAX-TEDDY Farm (2x) 
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5}}/>
            </Link>

          </Flex>
        </Box>
      </Box>
    </Card>

    <Card>
      <Heading>
        <Flex>
        <Image src="./joe.png" width="25" height="25" sx={{marginRight: 2}}/>
          Traderjoe
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <Flex style={{marginBottom: 15}}>
            <Image src="./tsd.png" width="25" height="25" sx={{marginRight: 1}}/>
            AVAX-TSD LP
            <Link href={`https://www.traderjoexyz.com/#/farm/${TJ_POOlS['TSD']}`} target="_blank">
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5}}/>
            </Link>
          </Flex>
          <Flex>
            <Image src="./teddy-cash-icon.png" width="25" height="25" sx={{marginRight: 1}}/>
            AVAX-TEDDY LP
            <Link href={`https://www.traderjoexyz.com/#/farm/${TJ_POOlS['TEDDY']}`} target="_blank">
              <Icon name="external-link-alt" style={{marginLeft: 10, marginTop: 5}}/>
            </Link>
          </Flex> 
        </Box>
      </Box>
    </Card>

    <Card>
      <Heading>
        <Flex>
          Auto Compounders
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <Box style={{marginTop: 10}}>
            <Link href="https://app.snowball.network/compound-and-earn" target="_blank">Snowball</Link>, <Link href="https://yieldyak.com/farms" target="_blank">Yield Yak</Link>, and <Link href="https://www.cycle.finance/" target="_blank">Cycle Finance</Link> provide auto-compounding for select pools
          </Box>
        <Flex variant="layout.actions">
        </Flex>
      </Box>
      </Box>
    </Card>

    <Card>
      <Heading>
        <Flex>
          Other integrations
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <Box style={{marginTop: 10}}>
            Transfer TSD privately with <Link href="https://app.sherpa.cash/" target="_blank">Sherpa Cash</Link>.
          </Box>
        </Box>
        <Flex variant="layout.actions">
        </Flex>
      </Box>
    </Card>
    </>
  );
};