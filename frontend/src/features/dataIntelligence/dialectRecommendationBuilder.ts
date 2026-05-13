import type { DataProfileReport } from "./dataProfileTypes";
import type {
  DialectRecommendationReport,
  FutureDialectRecommendation,
  FutureDialectRecommendationId,
} from "./dialectRecommendationTypes";

const recommendationLabels: Record<FutureDialectRecommendationId, string> = {
  duckdb_sql: "DuckDB SQL",
  excel_workbook: "Excel workbook logic",
  python_analysis: "Python analysis",
  r_statistical_analysis: "R statistical analysis",
  future_mariadb: "Future MariaDB dialect inspection",
  future_oracle: "Future Oracle dialect inspection",
  future_postgresql_general_sql: "Future PostgreSQL/general SQL inspection",
};

const createRecommendation = (
  id: FutureDialectRecommendationId,
  rank: number,
  confidence: FutureDialectRecommendation["confidence"],
  reasons: string[],
): FutureDialectRecommendation => {
  const enterpriseSql = id.startsWith("future_");

  return {
    id,
    label: recommendationLabels[id],
    category:
      id === "duckdb_sql"
        ? "local_sql"
        : id === "excel_workbook"
          ? "workbook_logic"
          : enterpriseSql
            ? "enterprise_sql_dialect"
            : "statistical_runtime",
    confidence,
    rank,
    reasons,
    safetyNotes: [
      "Recommendation is metadata only.",
      enterpriseSql
        ? "Enterprise dialect inspection is a future compatibility path only."
        : "No engine execution is connected to this recommendation.",
    ],
  };
};

const confidenceFromSignals = (primarySignal: boolean, secondarySignal: boolean) => {
  if (primarySignal && secondarySignal) return "high";
  if (primarySignal || secondarySignal) return "moderate";
  return "low";
};

const sortRecommendations = (recommendations: FutureDialectRecommendation[]) =>
  [...recommendations].sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    const confidenceRank = { high: 0, moderate: 1, low: 2 };
    return confidenceRank[left.confidence] - confidenceRank[right.confidence];
  });

export const buildDialectRecommendationReport = (
  profile: DataProfileReport | null,
): DialectRecommendationReport | null => {
  if (!profile) return null;

  const isWorkbook = profile.workbookRelationshipContext.hasWorkbookContext;
  const isTabular = profile.shape.shapeLabel !== "empty";
  const hasGrouping = profile.possibleDimensions.length > 0 && profile.possibleMetrics.length > 0;
  const hasTimeSeries = profile.timeSeriesReadiness.ready;
  const hasStatistics = profile.statisticalReadiness.ready;
  const hasEnterpriseSignals =
    profile.possibleIdFields.length > 0 ||
    profile.shape.shapeLabel === "large_table" ||
    profile.shape.shapeLabel === "wide_table";

  const recommendations = sortRecommendations([
    createRecommendation(
      "duckdb_sql",
      hasGrouping ? 1 : 3,
      confidenceFromSignals(isTabular, hasGrouping),
      [
        "Mostly tabular filtering, grouping, and summaries fit a future DuckDB SQL path.",
        `${profile.possibleMetrics.length} possible metric field${profile.possibleMetrics.length === 1 ? "" : "s"} and ${profile.possibleDimensions.length} possible dimension field${profile.possibleDimensions.length === 1 ? "" : "s"} were detected.`,
      ],
    ),
    createRecommendation(
      "excel_workbook",
      isWorkbook ? 1 : 5,
      confidenceFromSignals(isWorkbook, profile.workbookRelationshipContext.relationshipCandidateCount > 0),
      [
        isWorkbook
          ? "Multi-sheet workbook metadata suggests Excel workbook logic and relationship planning."
          : "No multi-sheet workbook context is currently detected.",
        profile.workbookRelationshipContext.summary,
      ],
    ),
    createRecommendation(
      "python_analysis",
      hasTimeSeries || hasStatistics ? 2 : 4,
      confidenceFromSignals(hasTimeSeries || hasStatistics, profile.possibleMetrics.length > 0),
      [
        "Python is a future path for forecasting, statistical checks, anomaly workflows, and modeling.",
        profile.timeSeriesReadiness.summary,
      ],
    ),
    createRecommendation(
      "r_statistical_analysis",
      hasStatistics ? 2 : 4,
      confidenceFromSignals(hasStatistics, profile.possibleMetrics.length >= 2),
      [
        "R is a future path for statistical testing, correlation, and forecasting.",
        profile.statisticalReadiness.summary,
      ],
    ),
    createRecommendation(
      "future_mariadb",
      hasEnterpriseSignals ? 6 : 7,
      confidenceFromSignals(hasEnterpriseSignals, false),
      [
        "MariaDB dialect inspection may help future enterprise SQL compatibility checks.",
        "This recommendation is for metadata inspection only.",
      ],
    ),
    createRecommendation(
      "future_oracle",
      hasEnterpriseSignals ? 6 : 7,
      confidenceFromSignals(hasEnterpriseSignals, false),
      [
        "Oracle dialect inspection may help future enterprise SQL compatibility checks.",
        "This recommendation is for metadata inspection only.",
      ],
    ),
    createRecommendation(
      "future_postgresql_general_sql",
      hasEnterpriseSignals ? 5 : 6,
      confidenceFromSignals(isTabular, hasEnterpriseSignals),
      [
        "PostgreSQL/general SQL inspection may help future portable SQL compatibility checks.",
        "This path does not imply current execution support.",
      ],
    ),
  ]);
  const recommendedFutureEngine =
    recommendations.find((recommendation) => recommendation.confidence !== "low") ||
    recommendations[0] ||
    null;

  return {
    datasetId: profile.datasetId,
    recommendedFutureEngine,
    recommendations,
    humanSummary: recommendedFutureEngine
      ? `Recommended future path: ${recommendedFutureEngine.label}.`
      : "No future engine path is recommended yet.",
    analystSummary: recommendedFutureEngine
      ? `Recommended future engine: ${recommendedFutureEngine.label}. ${recommendations.length} metadata recommendation paths available.`
      : "Recommended future engine: not available from current metadata.",
  };
};
