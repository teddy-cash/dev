import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button, Link } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { Icon } from "../Icon";
import { useTroveView } from "./context/TroveViewContext";

export const NoTrove: React.FC = props => {
  const { dispatchEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading><p>Trove</p></Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You haven't borrowed any TSD yet.">
          You can borrow TSD by opening a Trove. Learn more: <Link href="https://docs.teddy.cash/borrowing#what-is-a-trove" target="_blank">What is a trove? <Icon name="external-link-alt" /></Link>
        </InfoMessage>

        <Flex variant="layout.actions">
          <Button onClick={handleOpenTrove}>Open Trove</Button>
        </Flex>
      </Box>
    </Card>
  );
};
