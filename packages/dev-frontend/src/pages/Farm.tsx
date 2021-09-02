import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { Farm as FarmPanel } from "../components/Farm/Farm";
import { Farm as FarmTjPanel } from "../components/FarmTj/Farm";
import { Farm as FarmPngPanel } from "../components/FarmPng/Farm";

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="left">
      {/* <FarmPanel /> */}
      <FarmTjPanel />
      {/* <FarmPngPanel /> */}
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
  </Container>
);
