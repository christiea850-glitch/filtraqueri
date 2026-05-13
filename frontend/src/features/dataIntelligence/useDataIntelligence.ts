import { useMemo } from "react";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import { buildDataProfile } from "./dataProfileBuilder";
import { buildDialectRecommendationReport } from "./dialectRecommendationBuilder";

export function useDataIntelligence(dataset: DatasetMetadata | null) {
  const dataProfile = useMemo(() => buildDataProfile(dataset), [dataset]);
  const dialectRecommendation = useMemo(
    () => buildDialectRecommendationReport(dataProfile),
    [dataProfile],
  );

  return {
    dataProfile,
    dialectRecommendation,
    recommendedFutureEngine: dialectRecommendation?.recommendedFutureEngine || null,
    humanSummary: dataProfile?.humanSummary || "No data profile is available yet.",
    analystSummary:
      dialectRecommendation?.analystSummary ||
      dataProfile?.analystSummary ||
      "No analyst data intelligence is available yet.",
  };
}
