import React, { useEffect, useReducer } from "react";
import { useWeb3React } from "@web3-react/core";
import { AbstractConnector } from "@web3-react/abstract-connector";
import { Button, Image, Text, Flex, Link, Box } from "theme-ui";

import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";
import { WalletLinkConnector } from "@web3-react/walletlink-connector";
import metamaskImage from "../assets/metamask.svg";
import walletconnectIcon from "../assets/walletconnect.svg";
import coinbasewalletIcon from "../assets/coinbasewallet.svg";

import { useAuthorizedConnection } from "../hooks/useAuthorizedConnection";

import { RetryDialog } from "./RetryDialog";
import { ConnectionConfirmationDialog } from "./ConnectionConfirmationDialog";
import { MetaMaskIcon } from "./MetaMaskIcon";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { map } from "lodash";

const injectedConnector = new InjectedConnector({
  supportedChainIds: [43114, 43113]
});

const walletconnect = new WalletConnectConnector({
  rpc: {
    43114: "https://api.avax.network/ext/bc/C/rpc",
    43113: "https://api.avax-test.network/ext/bc/C/rpc"
  },
  bridge: "https://bridge.walletconnect.org",
  qrcode: true
  // pollingInterval: POLLING_INTERVAL / 12000
});

const walletlink = new WalletLinkConnector({
  url: "https://api.avax.network/ext/bc/C/rpc",
  appName: "vault"
});
interface WalletInfo {
  name: string;
  icon: string;
  connector: AbstractConnector;
}

const SUPPORTED_WALLETS: { [key: string]: WalletInfo } = {
  METAMASK: {
    name: "MetaMask",
    icon: metamaskImage,
    connector: injectedConnector
  },
  WALLET_CONNECT: {
    name: "WalletConnect",
    icon: walletconnectIcon,
    connector: walletconnect
  },
  WALLET_LINK: {
    name: "Coinbase Wallet",
    icon: coinbasewalletIcon,
    connector: walletlink
  }
};
interface MaybeHasMetaMask {
  ethereum?: {
    isMetaMask?: boolean;
  };
}

type ConnectionState =
  | { type: "inactive" }
  | {
      type: "activating" | "active" | "rejectedByUser" | "alreadyPending" | "failed";
      error?: Error;
      connector: AbstractConnector;
    };

type ConnectionAction =
  | { type: "startActivating"; connector: AbstractConnector }
  | { type: "fail"; error: Error }
  | { type: "finishActivating" | "retry" | "cancel" | "deactivate" };

const connectionReducer: React.Reducer<ConnectionState, ConnectionAction> = (state, action) => {
  switch (action.type) {
    case "startActivating":
      return {
        type: "activating",
        connector: action.connector
      };
    case "finishActivating":
      return {
        type: "active",
        connector: state.type === "inactive" ? injectedConnector : state.connector
      };
    case "fail":
      if (state.type !== "inactive") {
        //     throw action.error;

        return {
          type: action.error.message.match(/user rejected/i)
            ? "rejectedByUser"
            : action.error.message.match(/already pending/i)
            ? "alreadyPending"
            : "failed",
          error: action.error,
          connector: state.connector
        };
      }
      break;
    case "retry":
      if (state.type !== "inactive") {
        return {
          type: "activating",
          connector: state.connector
        };
      }
      break;
    case "cancel":
      return {
        type: "inactive"
      };
    case "deactivate":
      return {
        type: "inactive"
      };
  }

  console.warn("Ignoring connectionReducer action:");
  console.log(action);
  console.log("  in state:");
  console.log(state);

  return state;
};

const detectMetaMask = () => (window as MaybeHasMetaMask).ethereum?.isMetaMask ?? false;

type WalletConnectorProps = {
  loader?: React.ReactNode;
};

export const WalletConnector: React.FC<WalletConnectorProps> = ({ children, loader }) => {
  const { activate, deactivate, active, error } = useWeb3React<unknown>();
  const triedAuthorizedConnection = useAuthorizedConnection();
  const [connectionState, dispatch] = useReducer(connectionReducer, { type: "inactive" });
  const isMetaMask = detectMetaMask();

  useEffect(() => {
    if (error) {
      dispatch({ type: "fail", error });
      deactivate();
    }
  }, [error, deactivate]);

  useEffect(() => {
    if (active) {
      dispatch({ type: "finishActivating" });
    } else {
      dispatch({ type: "deactivate" });
    }
  }, [active]);

  if (!triedAuthorizedConnection) {
    return <>{loader}</>;
  }

  if (connectionState.type === "active") {
    return <>{children}</>;
  }
  const doActivate = (connector: AbstractConnector) => {
    return activate(connector);
  };
  return (
    <>
      <Flex
        sx={{
          height: "100vh",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column"
        }}
      >
        <h3>Connect your wallet</h3>
        <div className="display: grid; grid-template-rows: auto; row-gap: 16px;">
          {map(SUPPORTED_WALLETS, (wallet, index) => {
            return (
              <Button
                key={wallet.name}
                onClick={() => {
                  dispatch({ type: "startActivating", connector: wallet.connector });
                  doActivate(wallet.connector);
                }}
                sx={{
                  marginTop: "5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%"
                }}
              >
                <Box sx={{ mr: 5 }}>{wallet.name}</Box>
                <Image src={wallet.icon} alt="icon" style={{ width: "24px" }} />
              </Button>
            );
          })}
        </div>
      </Flex>

      {connectionState.type === "failed" && (
        <Modal>
          <RetryDialog
            title="Failed to connect wallet"
            onCancel={() => dispatch({ type: "cancel" })}
            onRetry={() => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }}
          >
            <Box sx={{ textAlign: "center" }}>{connectionState.error?.message}</Box>
            <Link sx={{ lineHeight: 3 }} href="https://metamask.io/download.html" target="_blank">
              Learn more <Icon size="xs" name="external-link-alt" />
            </Link>
          </RetryDialog>
        </Modal>
      )}

      {connectionState.type === "activating" && (
        <Modal>
          <ConnectionConfirmationDialog
            title={isMetaMask ? "Confirm connection in " : "Confirm connection in your wallet"}
            icon={isMetaMask ? <MetaMaskIcon /> : <Icon name="wallet" size="lg" />}
            onCancel={() => dispatch({ type: "cancel" })}
          >
            <Text sx={{ textAlign: "center" }}>
              Confirm the request that&apos;s just appeared.
              {isMetaMask ? (
                <> If you can&apos;t see a request, open your MetaMask extension via your browser.</>
              ) : (
                <> If you can&apos;t see a request, you might have to open your wallet.</>
              )}
            </Text>
          </ConnectionConfirmationDialog>
        </Modal>
      )}

      {connectionState.type === "rejectedByUser" && (
        <Modal>
          <RetryDialog
            title="Cancel connection?"
            onCancel={() => dispatch({ type: "cancel" })}
            onRetry={() => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }}
          >
            <Text>To use Teddy Cash, you need to connect your Avalanche account.</Text>
          </RetryDialog>
        </Modal>
      )}

      {connectionState.type === "alreadyPending" && (
        <Modal>
          <RetryDialog
            title="Connection already requested"
            onCancel={() => dispatch({ type: "cancel" })}
            onRetry={() => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }}
          >
            <Text>Please check your wallet and accept the connection request before retrying.</Text>
          </RetryDialog>
        </Modal>
      )}
    </>
  );
};
