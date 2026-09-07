import {
  OperationalCostAndQuotasError,
  type OperationalCostAndQuotasErrorCode,
} from "@boloes/lottery-contracts";

export function operationalCostAndQuotasErrorRecord(error: unknown): {
  type: "error";
  code: OperationalCostAndQuotasErrorCode;
  message: string;
} {
  return {
    type: "error",
    code: error instanceof OperationalCostAndQuotasError
      ? error.code
      : "INVALID_OPERATIONAL_COST_AND_QUOTAS_REQUEST",
    message: error instanceof Error
      ? error.message
      : "Invalid operational cost and quotas request.",
  };
}
