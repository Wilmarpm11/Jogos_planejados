import type { PortfolioDiversityOptimizationErrorCode } from "@boloes/lottery-contracts";
import {
  DuplicatePortfolioDiversityCandidateError,
  InfeasiblePortfolioDiversityAllocationError,
  InvalidPortfolioDiversityRequestError,
  PortfolioDiversityOptimizationCancelledError,
} from "@boloes/portfolio-engine";

export function portfolioDiversityOptimizationExitCode(error: unknown): 1 | 130 {
  return error instanceof PortfolioDiversityOptimizationCancelledError ? 130 : 1;
}

export function portfolioDiversityOptimizationErrorRecord(error: unknown): {
  type: "error";
  code: PortfolioDiversityOptimizationErrorCode;
  message: string;
} {
  let code: PortfolioDiversityOptimizationErrorCode =
    "INVALID_PORTFOLIO_DIVERSITY_REQUEST";
  if (error instanceof DuplicatePortfolioDiversityCandidateError) {
    code = error.code;
  } else if (error instanceof InfeasiblePortfolioDiversityAllocationError) {
    code = error.code;
  } else if (error instanceof PortfolioDiversityOptimizationCancelledError) {
    code = error.code;
  } else if (error instanceof InvalidPortfolioDiversityRequestError) {
    code = error.code;
  }

  return {
    type: "error",
    code,
    message: error instanceof Error
      ? error.message
      : "Invalid portfolio diversity optimization request.",
  };
}
