import { Flex, Box, NavLink  } from "theme-ui";
import { Link } from "./Link";

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{ display: ["none", "flex"], alignItems: "center", flex: 1 }}>
      <Flex>
        <Link to="/">Home</Link>
        <Link to="/farm">Farm</Link>
      </Flex>
      <Flex sx={{ justifyContent: "flex-end", mr: 3, flex: 1 }}>
        <Link sx={{ fontSize: 1 }} to="/risky-troves">
          Liquidate
        </Link>
        <Link sx={{ fontSize: 1 }} to="/redemption">
          Redeem
        </Link>
        <NavLink sx={{ fontSize: 1 }} target="_blank" href="https://docs.teddy.cash/audits-and-risks">Audit</NavLink>
      </Flex>
    </Box>
  );
};
