import React from "react";
import { Decimal } from "@liquity/lib-base";
import { POOL2LP } from "../../../strings";
import { ErrorDescription } from "../../ErrorDescription";
import { useValidationState } from "../context/useValidationState";

type ValidationProps = {
  amount: Decimal;
};

export const Validation: React.FC<ValidationProps> = ({ amount }) => {
  const { isValid, hasApproved, hasEnoughUniToken } = useValidationState(amount);

  if (isValid) {
    return null;
  }

  if (!hasApproved) {
    return <ErrorDescription>You haven't approved enough {POOL2LP}</ErrorDescription>;
  }

  if (!hasEnoughUniToken) {
    return <ErrorDescription>You don't have enough {POOL2LP}</ErrorDescription>;
  }

  return null;
};
