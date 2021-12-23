import { Decimal } from "@liquity/lib-base";

export const DEPLOYMENT_TIME = 1629989860;
export const ISSUANCE_FACTOR = 0.999998681227695;

/**
 *
 * @param days
 * @returns
 */
export const spTeddyRewards = (days: number): Decimal => {
  const now = new Date().getTime() / 1000;
  const timePassedInMinutes = Math.round((now - DEPLOYMENT_TIME) / 60);
  const shareNow = Math.pow(ISSUANCE_FACTOR, timePassedInMinutes);

  const rewardsDay = Decimal.from(
    32_000_000 * (shareNow - Math.pow(ISSUANCE_FACTOR, timePassedInMinutes + 60 * 24 * days))
  );

  return rewardsDay;
};
