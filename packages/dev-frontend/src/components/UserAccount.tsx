import React from "react";
import { Text, Flex, Box, Heading, Button } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../strings";
import { useLiquity } from "../hooks/LiquityContext";
import { shortenAddress } from "../utils/shortenAddress";
import { useColorMode } from 'theme-ui'
import { Icon } from "./Icon";

const select = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
  lusdBalance,
  lqtyBalance
});

export const UserAccount: React.FC = () => {
  const { account } = useLiquity();
  const { lusdBalance, lqtyBalance } = useLiquitySelector(select);
  const [mode, setMode] = useColorMode();
  const modes = ['dark', 'light']
  const handleSetMode = (e: any) => {
    const index = modes.indexOf(mode)
    const next = modes[(index + 1) % modes.length]
    setMode(next)
  }

  return (
    <Box sx={{ display: ["none", "flex"] }}>
      <Flex sx={{ alignItems: "center" }}>
        <Flex sx={{ ml: 3, mr: 4, flexDirection: "column" }}>
          <Heading sx={{ fontSize: 1 }}>Connected as</Heading>
          <Text as="span" sx={{ fontSize: 1 }}>
            {shortenAddress(account)}
          </Text>
        </Flex>
      </Flex>

      <Flex sx={{ alignItems: "center" }}>
        

        {([
          [COIN, lusdBalance],
          [GT, lqtyBalance]
        ] as const).map(([currency, balance], i) => (
          <Flex key={i} sx={{ ml: 2, flexDirection: "column" }}>
            <Heading sx={{ fontSize: 1 }}>{currency}</Heading>
            <Text sx={{ fontSize: 1 }}>{balance.prettify()}</Text>
          </Flex>
        ))}
        <Icon name="wallet" size="lg" style={{marginLeft: "15px"}} />
        <Button sx={{color: '#ffffff', bg: '#000000', borderColor: 'muted', padding: '6px', marginLeft: '4px'}} onClick={handleSetMode}>
          <Icon name="sun" size="lg" />
        </Button>
      </Flex>
    </Box>
  );
};
