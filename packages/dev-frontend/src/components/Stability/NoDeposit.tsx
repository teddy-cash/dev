import React, { useCallback } from 'react';
import { Card, Heading, Box, Flex, Button, Link } from 'theme-ui';
import { useStabilityView } from './context/StabilityViewContext';
import { RemainingLQTY } from './RemainingLQTY';
import { Yield } from './Yield';
import { Icon } from '../Icon';
export const NoDeposit: React.FC = (props) => {
  const { dispatchEvent } = useStabilityView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent('DEPOSIT_PRESSED');
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        <p>Stability Pool</p>
        <Flex sx={{ justifyContent: 'flex-end' }}>
          <RemainingLQTY />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        
        Earn TEDDY rewards and AVAX from liquidation fees. <Link
          href="https://docs.teddy.cash/stability-pool-and-liquidations#what-is-the-stability-pool"
          target="_blank"
          style={{fontWeight: "normal"}}
        >
          What is the Stability Pool? <Icon name="external-link-alt" />
        </Link>
        
        <Flex variant="layout.actions">
          <Flex
            sx={{ justifyContent: 'flex-end', flex: 1, alignItems: 'center' }}
          >
            <Yield />
          </Flex>
          <Button style={{margin: "10px 0 0"}}  onClick={handleOpenTrove}>Stake TSD</Button>
        </Flex>
      </Box>
    </Card>
  );
};
