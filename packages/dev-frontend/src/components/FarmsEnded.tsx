import React from "react";
import { Card, Heading, Box, Flex, Image, Link } from "theme-ui";
import { Icon } from "./Icon";
import { useLiquity } from "../hooks/LiquityContext";

export const FarmsEnded: React.FC = () => {
  const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();

  return (
    <>
      <Card>
        <Heading>
          <Flex>
            <Image src="./tsd.png" width="25" height="25" sx={{ marginRight: 2 }} />
            TSD Farms
          </Flex>
        </Heading>

        <Box sx={{ p: [2, 3] }}>
          <Box>
            <Flex
              style={{ marginBottom: 15, alignItems: "center", fontWeight: "bold", color: "white" }}
            >
              <Image src="./Axial_Token.svg" width="25" height="20" sx={{ marginRight: 1 }} />
              <Link href={`https://app.axial.exchange/#/pools/ac4d/deposit`} target="_blank">
                A4CD Stablecoin Pool (Dual Rewards)
                <Icon
                  name="external-link-alt"
                  style={{ marginLeft: 10, marginTop: 5, marginRight: 5 }}
                />
              </Link>
            </Flex>
            <Flex style={{ marginBottom: 15, alignItems: "center" }}>
              <Image src="./pangolin2.svg" width="25" height="20" sx={{ marginRight: 1 }} />
              <Link
                href={`https://app.pangolin.exchange/#/png/AVAX/${addresses["lusdToken"]}/1`}
                target="_blank"
              >
                AVAX-TSD (LP)
                <Icon
                  name="external-link-alt"
                  style={{ marginLeft: 10, marginTop: 5, marginRight: 5 }}
                />
              </Link>
            </Flex>
          </Box>
        </Box>
      </Card>
      <Card>
        <Heading>
          <Flex>
            <Image src="./teddy-cash-icon.png" width="20" height="20" sx={{ marginRight: 2 }} />
            Teddy Farms
          </Flex>
        </Heading>

        <Box sx={{ p: [2, 3] }}>
          <Box>
            <Flex sx={{ color: "white" }}>
              <Image
                src="./Elk_Logo_Compact_ 512x512.png"
                width="25"
                height="20"
                sx={{ marginRight: 1 }}
              />
              <Link
                href={`https://app.elk.finance/#/elk/${addresses["lqtyToken"]}/1`}
                target="_blank"
              >
                AVAX-TEDDY Farm on ELK Finance[Boosted]
                <Icon name="external-link-alt" style={{ marginLeft: 10, marginTop: 5 }} />
              </Link>
            </Flex>
          </Box>
        </Box>
      </Card>

      <Card>
        <Heading>
          <Flex>Auto Compounders</Flex>
        </Heading>
        <Box sx={{ p: [2, 3] }}>
          <Box>
            <Box style={{ marginTop: 10 }}>
              <Link href="https://app.snowball.network/compound-and-earn" target="_blank">
                Snowball
              </Link>
              ,{" "}
              <Link href="https://yieldyak.com/farms" target="_blank">
                Yield Yak
              </Link>
              , and{" "}
              <Link href="https://www.cycle.finance/" target="_blank">
                Cycle Finance
              </Link>{" "}
              provide auto-compounding for select pools
            </Box>
            <Flex variant="layout.actions"></Flex>
          </Box>
        </Box>
      </Card>

      <Card>
        <Heading>
          <Flex>Other integrations</Flex>
        </Heading>
        <Box sx={{ p: [2, 3] }}>
          <Box>
            <Box style={{ marginTop: 10 }}>
              Transfer TSD privately with{" "}
              <Link href="https://app.sherpa.cash/" target="_blank">
                Sherpa Cash
              </Link>
              .
            </Box>
          </Box>
          <Flex variant="layout.actions"></Flex>
        </Box>
      </Card>
    </>
  );
};
