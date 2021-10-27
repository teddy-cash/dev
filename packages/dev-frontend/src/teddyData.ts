import { Decimal } from "@liquity/lib-base";

export type TeddyDataStruct = {
  supply: {
    circulating: number;
    total: number;
  };
  borrowing_fee_tsd: {
    last_7d: number;
    total: number;
  };
  redemption_fee_avax: {
    last_7d: number;
    total: number;
  };
  updated_at: string;
};

export const getYields = (
  data: TeddyDataStruct,
  amountTeddyStaked: Decimal,
  avaxPrice: Decimal,
  teddyPrice: Decimal
) => {
  /* const startDate = "August 26, 2021";
  const daySinceStart = (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24); */
  const sevenDay = Decimal.from(data.borrowing_fee_tsd.last_7d)
    .add(Decimal.from(data.redemption_fee_avax.last_7d).mul(avaxPrice))
    .div(amountTeddyStaked.mul(teddyPrice))
    .mul(100);

  const apr = sevenDay.mul(52);
  return { sevenDay, apr };
};
