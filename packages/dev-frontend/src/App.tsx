import React from "react";
import { Web3ReactProvider } from "@web3-react/core";
import { Flex, Image, Heading, ThemeProvider, Paragraph, Link } from "theme-ui";

import { BatchedWebSocketAugmentedWeb3Provider } from "@liquity/providers";
import { LiquityProvider } from "./hooks/LiquityContext";
import { WalletConnector } from "./components/WalletConnector";
import { TransactionProvider } from "./components/Transaction";
import { Icon } from "./components/Icon";
import { getConfig } from "./config";
import theme from "./theme";
import { keyframes } from "@emotion/react";

import { DisposableWalletProvider } from "./testUtils/DisposableWalletProvider";
import { LiquityFrontend } from "./LiquityFrontend";

if (window.ethereum) {
  // Silence MetaMask warning in console
  Object.assign(window.ethereum, { autoRefreshOnNetworkChange: false });
}

if (process.env.REACT_APP_DEMO_MODE === "true") {
  const ethereum = new DisposableWalletProvider(
    `http://${window.location.hostname}:8545`,
    "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7"
  );

  Object.assign(window, { ethereum });
}

// Start pre-fetching the config
getConfig().then(config => {
  // console.log("Frontend config:");
  // console.log(config);
  Object.assign(window, { config });
});

const EthersWeb3ReactProvider: React.FC = ({ children }) => {
  return (
    <Web3ReactProvider getLibrary={provider => new BatchedWebSocketAugmentedWeb3Provider(provider)}>
      {children}
    </Web3ReactProvider>
  );
};

const UnsupportedMainnetFallback: React.FC = () => (
  <Flex
    sx={{
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      textAlign: "center"
    }}
  >
    <Heading sx={{ mb: 3 }}>
      <Icon name="exclamation-triangle" /> This app is for testing purposes only.
    </Heading>

    <Paragraph sx={{ mb: 3 }}>Please change your network to Avalanche C-Chain.</Paragraph>

    <Paragraph>
      If you'd like to use Teddy Cash on mainnet, please pick a frontend{" "}
      <Link href="https://app.teddy.cash">
        here <Icon name="external-link-alt" size="xs" />
      </Link>
      .
    </Paragraph>
  </Flex>
);

const App = () => {
  const bearSpinner = keyframes`
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  `;
  const loader = (
    <Flex sx={{ alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <Image
        src="./bear-wb.png"
        sx={{ animation: `${bearSpinner} 2s linear infinite`, width: "120px" }}
      />
      <Heading>Loading...</Heading>
    </Flex>
  );

  const unsupportedNetworkFallback = (chainId: number) => (
    <Flex
      sx={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center"
      }}
    >
      <Heading sx={{ mb: 3 }}>
        <Icon name="exclamation-triangle" /> Teddy Cash is not yet deployed to this network
      </Heading>
      Please switch to Avalanche C-Chain.
    </Flex>
  );

  return (
    <EthersWeb3ReactProvider>
      <ThemeProvider theme={theme}>
        <WalletConnector loader={loader}>
          <LiquityProvider
            loader={loader}
            unsupportedNetworkFallback={unsupportedNetworkFallback}
            unsupportedMainnetFallback={<UnsupportedMainnetFallback />}
          >
            <TransactionProvider>
              <LiquityFrontend loader={loader} />
            </TransactionProvider>
          </LiquityProvider>
        </WalletConnector>
      </ThemeProvider>
    </EthersWeb3ReactProvider>
  );
};

export default App;
