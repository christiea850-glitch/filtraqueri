export type FutureDialectRecommendationId =
  | "duckdb_sql"
  | "excel_workbook"
  | "python_analysis"
  | "r_statistical_analysis"
  | "future_mariadb"
  | "future_oracle"
  | "future_postgresql_general_sql";

export type FutureDialectRecommendationCategory =
  | "local_sql"
  | "workbook_logic"
  | "statistical_runtime"
  | "enterprise_sql_dialect";

export type FutureDialectRecommendation = {
  id: FutureDialectRecommendationId;
  label: string;
  category: FutureDialectRecommendationCategory;
  confidence: "low" | "moderate" | "high";
  rank: number;
  reasons: string[];
  safetyNotes: string[];
};

export type DialectRecommendationReport = {
  datasetId: string;
  recommendedFutureEngine: FutureDialectRecommendation | null;
  recommendations: FutureDialectRecommendation[];
  humanSummary: string;
  analystSummary: string;
};
