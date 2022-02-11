import { Flex, Box } from "theme-ui";
import { Link } from "./Link";

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{ display: ["none", "flex"], alignItems: "center", flex: 1 }}>
      <Flex>
        <Link to="/">Home</Link>
        <Link to="/farm">Farm</Link>
        <Link to="/risky-troves">Liquidate</Link>
        <Link to="/redemption">Redeem</Link>
      </Flex>
    </Box>
  );
};
