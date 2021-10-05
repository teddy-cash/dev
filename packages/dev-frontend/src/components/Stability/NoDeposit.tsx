import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button, Link } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingLQTY } from "./RemainingLQTY";
import { Yield } from "./Yield";
import { Icon } from "../Icon";
export const NoDeposit: React.FC = props => {
  const { dispatchEvent } = useStabilityView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        <p>
          Stability Pool
        </p>
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingLQTY />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You have no TSD in the Stability Pool.">
          You can earn AVAX and TEDDY rewards by depositing TSD. Learn more: <Link href="https://docs.teddy.cash/stability-pool-and-liquidations#what-is-the-stability-pool" target="_blank">What is the Stability Pool? <Icon name="external-link-alt" /></Link>
        </InfoMessage>

        <Flex variant="layout.actions">          
          <Button  onClick={handleOpenTrove}>Deposit</Button>
          <Flex sx={{ justifyContent: "flex-end", flex: 1, alignItems: "center" }}>
            <Yield />
          </Flex>
        </Flex>
      </Box>
    </Card>
  );
};
