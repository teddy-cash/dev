import React from 'react';
import { Card, Box, Link, Text } from "theme-ui";

export const Help = () => {
    return (
        <Card>
            <Box>
                <Box style={{margin: "12px"}}>
                <Text>
                <Link href="https://extralong.one" target="_blank">Extra Long</Link> is a decentralized borrowing protocol and <Link href="https://docs.extralong.one/general#what-are-lusd-and-lqty" target="_blank">XLSD</Link> is the leading native stablecoin on Harmony.

                Watch this <Link href="https://youtu.be/0Rk1mszNWL8" target="_blank">video</Link> for a guided tour or explore our <Link href="https://docs.extralong.one" target="_blank">documentation</Link>.
                </Text>
                </Box>
            </Box>
        </Card>
    );
}