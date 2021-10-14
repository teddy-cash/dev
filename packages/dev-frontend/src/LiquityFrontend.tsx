import React from "react";
import { Flex, Container } from "theme-ui";
import { HashRouter as Router, Switch, Route } from "react-router-dom";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Trove } from "@liquity/lib-base";
import { LiquityStoreProvider } from "@liquity/lib-react";

import { useLiquity } from "./hooks/LiquityContext";
import { TransactionMonitor } from "./components/Transaction";
import { UserAccount } from "./components/UserAccount";
import { SystemStatsPopup } from "./components/SystemStatsPopup";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";

import { PageSwitcher } from "./pages/PageSwitcher";
import { Farm } from "./pages/Farm";
import { DisabledFarms } from "./pages/DisabledFarms";
import { RiskyTrovesPage } from "./pages/RiskyTrovesPage";
import { RedemptionPage } from "./pages/RedemptionPage";

import { TroveViewProvider } from "./components/Trove/context/TroveViewProvider";
import { StabilityViewProvider } from "./components/Stability/context/StabilityViewProvider";
import { StakingViewProvider } from "./components/Staking/context/StakingViewProvider";
import { FarmViewProvider } from "./components/Farm/context/FarmViewProvider";
import { FarmViewProvider as TjFarmViewProvider } from "./components/FarmTj/context/FarmViewProvider";
import { FarmViewProvider as PngFarmViewProvider } from "./components/FarmPng/context/FarmViewProvider";

import {QueryClient, QueryClientProvider } from 'react-query'

type LiquityFrontendProps = {
  loader?: React.ReactNode;
};
export const LiquityFrontend: React.FC<LiquityFrontendProps> = ({ loader }) => {
  const { account, provider, liquity } = useLiquity();

  // For console tinkering ;-)
  Object.assign(window, {
    account,
    provider,
    liquity,
    Trove,
    Decimal,
    Difference,
    Wallet
  });

  const queryClient = new QueryClient()
  return (
    <LiquityStoreProvider {...{ loader }} store={liquity.store}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <TroveViewProvider>
            <StabilityViewProvider>
              <StakingViewProvider>
                <FarmViewProvider>
                  <TjFarmViewProvider>
                    <PngFarmViewProvider>
                      <Flex sx={{ flexDirection: "column", minHeight: "100%" }}>
                          <Header>
                            <UserAccount />
                            <SystemStatsPopup />
                          </Header>

                          <Container
                            variant="main"
                            sx={{
                              display: "flex",
                              flexGrow: 1,
                              flexDirection: "column",
                              alignItems: "center"
                            }}
                          >
                            <Switch>
                              <Route path="/" exact>
                                <PageSwitcher />
                              </Route>
                              <Route path="/farm">
                                <Farm />
                              </Route>
                              <Route path="/ended-farms">
                                <DisabledFarms />
                              </Route>
                              <Route path="/risky-troves">
                                <RiskyTrovesPage />
                              </Route>
                              <Route path="/redemption">
                                <RedemptionPage />
                              </Route>
                            </Switch>
                            <Footer /> 
                          </Container>
                      </Flex>
                    </PngFarmViewProvider>
                  </TjFarmViewProvider>
                </FarmViewProvider>
              </StakingViewProvider>
            </StabilityViewProvider>
          </TroveViewProvider>
        </Router>
      </QueryClientProvider>
      <TransactionMonitor />
    </LiquityStoreProvider>
  );
};
