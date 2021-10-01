import React from "react";
import { Text, Link, Box } from "theme-ui";

export const Footer = () => {
    const textStyle = {ml: 4, fontWeight: 'bold'};
    return (
    <div>
        <Box sx={{mt: 4, fontSize:1, fontWeight: "normal", display: "flex"}}>
            <Text sx={textStyle}>
              <Link href="https://teddy.cash" target="_blank">Website</Link>
              , 
              <Link href="https://docs.teddy.cash" target="_blank">Docs</Link>
            ,  <Link href="https://twitter.com/TeddyCashLive" target="_blank">Twitter</Link>
            ,  <Link href="https://medium.com/@teddy.cash" target="_blank">Medium</Link>
          ,   <Link href="https://github.com/teddy-cash" target="_blank">Github</Link>
            
           ,   <Link href="https://discord.gg/TJXnyPXQxf" target="_blank">Discord</Link>
            ,  <Link href="https://t.me/teddycashofficial" target="_blank">Telegram</Link>
            ,  <Link href="https://defillama.com/protocol/teddy-cash" target="_blank">DeFiLlama</Link>
            </Text>
            
        </Box>
    </div>
    )
}

