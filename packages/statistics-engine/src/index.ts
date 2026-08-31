import type {
  HistoricalMetricProfileInput,
  LotteryResultLedgerRecord,
} from "@boloes/lottery-contracts";
import { calculateLotofacilMetricProfile } from "@boloes/lottery-lotofacil";

/** Derives a versioned profile without aggregating history or invoking generation. */
export function deriveLotofacilHistoricalMetricProfile(
  result: LotteryResultLedgerRecord,
): HistoricalMetricProfileInput {
  const profile = calculateLotofacilMetricProfile(result.drawnNumbers);
  return {
    sourceResultId: result.id,
    sourceSnapshotId: result.sourceSnapshotId,
    lotteryId: "lotofacil",
    metricEngineVersion: profile.metricEngineVersion,
    profile,
  };
}
