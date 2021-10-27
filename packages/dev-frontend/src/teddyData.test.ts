import { Decimal } from "@liquity/lib-base";
import { getYields, TeddyDataStruct } from "./teddyData";

const input: TeddyDataStruct = {
  borrowing_fee_tsd: {
    last_7d: 8939.157739549939,
    total: 349381.3629802134
  },
  redemption_fee_avax: {
    last_7d: 16.937821113878254,
    total: 401.00510750768325
  },
  supply: {
    circulating: 7495356,
    total: 88000000
  },
  updated_at: "2021-10-27T11:18:43.779442Z"
};

test("calculate yields", () => {
  const teddyStaked = Decimal.from(4017000);
  const avaxPrice = Decimal.from(70);
  const teddyPrice = Decimal.from(0.25);
  const { sevenDay, apr } = getYields(input, teddyStaked, avaxPrice, teddyPrice);
  console.log(`nums ${sevenDay} , ${apr}`);
  expect(sevenDay.prettify(1)).toBe("1.0");
  expect(apr.prettify(1)).toBe("52.4");
});
