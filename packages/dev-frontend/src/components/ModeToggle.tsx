import React from "react";

import { Button, useColorMode } from "theme-ui";
import { Icon } from "./Icon";
import { getMode } from "../theme";

const toggleColors = (mode: string) => {
  return getMode(mode) === "night"
    ? {
        color: "#ffffff",
        bg: "#000000"
      }
    : {
        color: "#000000",
        bg: "#ffffff"
      };
};

export const ModeToggle = () => {
  const [mode, setMode] = useColorMode();

  const modes = ["night", "day"];
  const handleSetMode = (e: any) => {
    const index = modes.indexOf(getMode(mode));
    const next = modes[(index + 1) % modes.length];
    setMode(next);
  };
  return (
    <Button
      sx={{
        ...toggleColors(mode),
        padding: "6px",
        marginLeft: "8px",
        border: "0px"
      }}
      onClick={handleSetMode}
    >
      <Icon name={getMode(mode) === "night" ? "sun" : "moon"} size="lg" />
    </Button>
  );
};
