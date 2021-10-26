import { Decimal } from "@liquity/lib-base";

type UniswapResponse = {
  data?: {
    bundle: {
      ethPrice: string;
    } | null;
    token: {
      derivedETH: string;
    } | null;
    pair: {
      reserveUSD: string;
      totalSupply: string;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

const uniswapQuery = (lqtyTokenAddress: string, uniTokenAddress: string) => `{
  token(id: "${lqtyTokenAddress.toLowerCase()}") {
    derivedAVAX
  },
  bundle(id: 1) {
    avaxPrice
  },
  pair(id: "${uniTokenAddress.toLowerCase()}") {
    totalSupply
    reserveUSD
  }
}`;

export async function fetchPrices(lqtyTokenAddress: string, uniTokenAddress: string) {
  const response = await window.fetch(
    "https://graph.defikingdoms.com/subgraphs/name/defikingdoms/dex/graphql",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query: uniswapQuery(lqtyTokenAddress, uniTokenAddress),
        variables: null
      })
    }
  );

  if (!response.ok) {
    return Promise.reject("Network error connecting to Uniswap subgraph");
  }

  const { data, errors }: UniswapResponse = await response.json();

  if (errors) {
    return Promise.reject(errors);
  }

  if (
    typeof data?.token?.derivedETH === "string" &&
    typeof data?.pair?.reserveUSD === "string" &&
    typeof data?.pair?.totalSupply === "string" &&
    typeof data?.bundle?.ethPrice === "string"
  ) {
    const ethPriceUSD = Decimal.from(data.bundle.ethPrice);
    const lqtyPriceUSD = Decimal.from(data.token.derivedETH).mul(ethPriceUSD);
    const uniLpPriceUSD = Decimal.from(data.pair.reserveUSD).div(
      Decimal.from(data.pair.totalSupply)
    );

    return { lqtyPriceUSD, uniLpPriceUSD };
  }

  return Promise.reject("Uniswap doesn't have the required data to calculate yield");
}
