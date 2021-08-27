import React from "react";
import { Box, Image } from "theme-ui";

type LiquityLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string;
};

export const LiquityLogo: React.FC<LiquityLogoProps> = ({ height, ...boxProps }) => (
  <Box sx={{ lineHeight: 0 }} {...boxProps}>
    <a href="https://teddy.cash"><Image src="./teddy-cash-icon.png" sx={{ height }} /></a>
  </Box>
);
