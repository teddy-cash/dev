import { Card, Heading, Box, Flex, Button, Link } from "theme-ui";

import { GT } from "../../strings";

import { InfoMessage } from "../InfoMessage";
import { useStakingView } from "./context/StakingViewContext";
import { Icon } from "../Icon";

export const NoStake: React.FC = () => {
  const { dispatch } = useStakingView();

  return (
    <Card>
      <Heading><p>Staking</p></Heading>
      <Box sx={{ p: [2, 3] }}>
        
        Earn your share from borrowing and redemption fees. 
        <br />
        <Link href="https://docs.teddy.cash/teddy-staking#how-does-staking-work-in-liquity" target="_blank">How it works? <Icon name="external-link-alt" /></Link>
        <br />
        
          <Button style={{display: "block", margin: "18px auto", lineHeight: 1.2}} onClick={() => dispatch({ type: "startAdjusting" })}>
            <strong style={{fontSize: 18}}>Stake TEDDY</strong>
            <br />
            <small style={{fontWeight: "normal"}}>Earn TSD and AVAX</small>
          </Button>
      </Box>
    </Card>
  );
};
