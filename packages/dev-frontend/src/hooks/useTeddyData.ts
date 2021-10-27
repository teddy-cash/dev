/*
{
  "borrowing_fee_tsd": {
    "last_7d": 9839.637064358416,
    "since_inception": 349328.8365719536
  },
  "redemption_fee_avax": {
    "last_7d": 14.616648283212067,
    "since_inception": 398.6820133984177
  },
  "updated_at": "2021-10-26T17:55:50.349114Z"
}
*/
import { useQuery } from "react-query";
import { TeddyDataStruct } from "../teddyData";

type TeddyDataQuery = {
  isLoading: boolean;
  error: unknown;
  data: TeddyDataStruct;
};

export const useTeddyData = (): TeddyDataQuery => {
  const { isLoading, error, data } = useQuery("teddy-data", () => {
    return fetch("https://api.teddy.cash/data.json").then(res => res.json());
  });
  return { isLoading: isLoading, error: error, data: data };
};
