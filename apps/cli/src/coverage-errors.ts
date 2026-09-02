import {
  ExactCoverageAuditCancelledError,
  ExactCoverageAuditTimeoutError,
} from "@boloes/coverage-engine";

export function exactCoverageAuditExitCode(error: unknown): number {
  if (error instanceof ExactCoverageAuditCancelledError) return 130;
  if (error instanceof ExactCoverageAuditTimeoutError) return 124;
  return 1;
}

export function exactCoverageAuditErrorRecord(error: unknown): {
  type: "error";
  code: "COVERAGE_CANCELLED" | "COVERAGE_TIMEOUT" | "INVALID_COVERAGE_REQUEST";
  message: string;
} {
  return {
    type: "error",
    code: error instanceof ExactCoverageAuditCancelledError
      ? "COVERAGE_CANCELLED"
      : error instanceof ExactCoverageAuditTimeoutError
        ? "COVERAGE_TIMEOUT"
        : "INVALID_COVERAGE_REQUEST",
    message: error instanceof Error ? error.message : "Solicitação de cobertura inválida.",
  };
}
