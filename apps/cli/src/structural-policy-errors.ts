import {
  LotofacilStructuralPolicyError,
  type LotofacilStructuralPolicyErrorCode,
} from "@boloes/lottery-contracts";

export function structuralPolicyErrorRecord(error: unknown): {
  type: "error";
  code: LotofacilStructuralPolicyErrorCode;
  message: string;
} {
  return {
    type: "error",
    code: error instanceof LotofacilStructuralPolicyError
      ? error.code
      : "INVALID_STRUCTURAL_POLICY_REQUEST",
    message: error instanceof Error
      ? error.message
      : "Invalid Lotofacil structural policy request.",
  };
}

export function structuralPolicyExitCode(error: unknown): number {
  return error instanceof LotofacilStructuralPolicyError &&
    error.code === "STRUCTURAL_POLICY_BUILD_CANCELLED" ? 130 : 1;
}
