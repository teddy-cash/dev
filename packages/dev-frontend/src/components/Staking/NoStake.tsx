import { Card, Heading, Box, Flex, Button, Link } from "theme-ui";

import { useStakingView } from "./context/StakingViewContext";
import { Icon } from "../Icon";

export const NoStake: React.FC = () => {
  const { dispatch } = useStakingView();

  return (
    <Card>
      <Heading><p>TEDDY Staking</p></Heading>
      <Box sx={{ p: [2, 3] }}>
        Earn TSD borrowing fees and AVAX redemption fees. <Link style={{fontWeight: "normal"}} href="https://docs.teddy.cash/teddy-staking#how-does-staking-work-in-liquity" target="_blank">How does staking work? <Icon name="external-link-alt" /></Link>

        <Flex variant="layout.actions">
          <Button style={{margin: "10px 0 0"}} onClick={() => dispatch({ type: "startAdjusting" })}>Stake TEDDY</Button>
        </Flex>
      </Box>
    </Card>
  );
};
