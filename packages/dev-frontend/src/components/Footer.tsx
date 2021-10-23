import React from 'react';
import { Text, Link, Box } from 'theme-ui';

export const Footer = () => {
  const textStyle = { ml: 4, fontWeight: 'bold' };
  return (
    <div>
      <Box sx={{ mt: 4, fontSize: 1, fontWeight: 'normal', display: 'flex' }}>
        <Text sx={textStyle}>
          <Link href="https://teddy.cash" target="_blank">
            Website
          </Link>
          &nbsp;&middot;&nbsp;
          <Link href="https://docs.teddy.cash" target="_blank">
            Docs
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://twitter.com/TeddyCashLive" target="_blank">
            Twitter
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://medium.com/@teddy.cash" target="_blank">
            Medium
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://github.com/teddy-cash" target="_blank">
            Github
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://discord.gg/TJXnyPXQxf" target="_blank">
            Discord
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://t.me/teddycashofficial" target="_blank">
            Telegram
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link
            href="https://defillama.com/protocol/teddy-cash"
            target="_blank"
          >
            DeFiLlama
          </Link>
          &nbsp;&middot;&nbsp;{' '}
          <Link href="https://docs.teddy.cash/audits-and-risks" target="_blank">
            Audit
          </Link>
        </Text>
      </Box>
    </div>
  );
};
