import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { FarmsEnded } from "../components/FarmsEnded";

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="left">
      <FarmsEnded />
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
  </Container>
);
