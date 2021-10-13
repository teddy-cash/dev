import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { FarmsEnded } from "../components/FarmsEnded";

import { Farm as FarmP3Panel } from "../components/FarmP3/Farm";

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="left">
      <FarmP3Panel />
      <FarmsEnded />
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
  </Container>
);
