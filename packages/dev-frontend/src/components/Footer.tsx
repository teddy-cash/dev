import React from "react";
import { Text, Link, Box } from "theme-ui";

export const Footer = () => {
    const textStyle = {ml: 4, fontWeight: 'bold'};
    return (
    <div>
        <Box sx={{mt: 4, fontSize:3, display: "flex"}}>
            <Text sx={textStyle}>
              <Link href="https://teddy.cash" target="_blank">Website</Link>
            </Text>
            <Text sx={textStyle}>
              <Link href="https://docs.teddy.cash" target="_blank">Docs</Link>
            </Text>
            <Text sx={textStyle}>
              <Link href="https://twitter.com/TeddyCashLive" target="_blank">Twitter</Link>
            </Text>
            <Text sx={textStyle}>
              <Link href="https://medium.com/@teddy.cash" target="_blank">Medium</Link>
            </Text>
            <Text sx={textStyle}>
              <Link href="https://github.com/teddy-cash" target="_blank">Github</Link>
            </Text>
            <Text sx={textStyle}>
              <Link href="https://discord.gg/cHfE2EZE" target="_blank">Discord</Link>
            </Text>
            <Text sx={textStyle}>
              <Link href="https://t.me/teddycashofficial" target="_blank">Telegram</Link>
            </Text>
            <Text sx={textStyle}>
              <Link href="https://defillama.com/protocol/teddy-cash" target="_blank">DeFi Llama</Link>
            </Text>
            
        </Box>
    </div>
    )
}

