import React from 'react';
import { Card, Box, Link, Text } from "theme-ui";

export const Help = () => {
    return (
        <Card>
            <Box>
                <Box style={{margin: "12px"}}>
                <Text>
                <Link href="https://teddy.cash" target="_blank">Teddy Cash</Link> is a decentralized borrowing protocol and
                &nbsp;<Link href="https://docs.teddy.cash/general#what-are-lusd-and-lqty" target="_blank">Teddy USD($TSD)</Link> is the leading native stablecoin on Avalanche.

                Watch this <Link href="https://youtu.be/0Rk1mszNWL8" target="_blank">video</Link> for a guided tour or explore our <Link href="https://docs.teddy.cash" target="_blank">documentation</Link>.
                </Text>
                </Box>
            </Box>
        </Card>
    );
}