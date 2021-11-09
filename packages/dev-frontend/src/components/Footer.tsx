import React from 'react';
import { Text, Link, Box } from 'theme-ui';

export const Footer = () => {
  const textStyle = { ml: 4, fontWeight: 'bold' };
  return (
    <div>
      <Box sx={{ mt: 4, fontSize: 1, fontWeight: 'normal', display: 'flex' }}>
        <Text sx={textStyle}>
          <Link href="https://extralong.one" target="_blank">
            Website
          </Link>
          &nbsp;&middot;&nbsp;
          <Link href="https://docs.extralong.one" target="_blank">
            Docs
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://twitter.com/ExtraLong_ONE" target="_blank">
            Twitter
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://discord.gg/UqAnbF2wyz" target="_blank">
            Discord
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://docs.extralong.one/audits-and-risks" target="_blank">
            Audit
          </Link>
        </Text>
      </Box>
    </div>
  );
};
