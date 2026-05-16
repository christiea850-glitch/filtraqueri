import type {
  AnalysisPackageArtifact,
  AnalysisPackageArtifactType,
  AnalysisPackageBuildInput,
  AnalysisPackageGenerationEngine,
  AnalysisPackageReadiness,
} from "./analysisPackageTypes";

const engineForArtifact: Record<AnalysisPackageArtifactType, AnalysisPackageGenerationEngine> = {
  report_summary: "report_writer",
  result_export: "csv_exporter",
  sql_script: "script_writer",
  python_script: "script_writer",
  r_script: "script_writer",
  chart_image: "chart_renderer",
  dashboard_snapshot: "chart_renderer",
  workbook_snapshot: "excel_writer",
  optimization_model: "optimizer",
  audit_log: "audit_writer",
  explanation_note: "report_writer",
  investigation_timeline: "audit_writer",
};

const createArtifact = ({
  id,
  label,
  description,
  type,
  readiness,
  relatedDatasetId,
  relatedInvestigationStep,
}: {
  id: string;
  label: string;
  description: string;
  type: AnalysisPackageArtifactType;
  readiness: AnalysisPackageReadiness;
  relatedDatasetId: string | null;
  relatedInvestigationStep: AnalysisPackageArtifact["relatedInvestigationStep"];
}): AnalysisPackageArtifact => ({
  artifactId: id,
  label,
  description,
  type,
  status: readiness === "ready_now" ? "ready" : readiness === "not_applicable" ? "not_available" : "recommended",
  readiness,
  relatedInvestigationStep,
  relatedDatasetId,
  futureFilePath: null,
  generationEngine: {
    engine: engineForArtifact[type],
    configured: false,
    notes: ["Generation is planned for a future phase."],
  },
});

export const buildAnalysisPackageArtifacts = ({
  dataset,
  activeResultModel,
  investigationReport,
  queryHistory,
}: AnalysisPackageBuildInput): AnalysisPackageArtifact[] => {
  const datasetId = dataset?.dataset_id || null;
  const hasResult = Boolean(activeResultModel && activeResultModel.rows.length > 0);
  const hasWorkbook = Boolean(dataset?.workbook_metadata);
  const hasQuery = Boolean(activeResultModel?.sourceType === "query" || queryHistory.some((item) => item.action.toLowerCase().includes("query")));
  const artifacts: AnalysisPackageArtifact[] = [
    createArtifact({
      id: "artifact:report-summary",
      label: "Investigation summary",
      description: "A future business-facing summary of the question, scope, result, and recommended next step.",
      type: "report_summary",
      readiness: investigationReport?.suggestions.length ? "ready_now" : "needs_result",
      relatedDatasetId: datasetId,
      relatedInvestigationStep: "question",
    }),
    createArtifact({
      id: "artifact:result-export",
      label: activeResultModel?.grouping.hasGrouping ? "Grouped summary export" : "Result snapshot export",
      description: "A future export artifact based on the current result shape.",
      type: "result_export",
      readiness: hasResult ? "ready_now" : "needs_result",
      relatedDatasetId: datasetId,
      relatedInvestigationStep: "review_result",
    }),
    createArtifact({
      id: "artifact:explanation-note",
      label: "Investigation explanation",
      description: "Plain-language notes explaining why the suggested investigation path matters.",
      type: "explanation_note",
      readiness: investigationReport?.humanSummary ? "ready_now" : "needs_result",
      relatedDatasetId: datasetId,
      relatedInvestigationStep: "question",
    }),
    createArtifact({
      id: "artifact:timeline",
      label: "Investigation timeline",
      description: "A future timeline of filters, query runs, and result review steps.",
      type: "investigation_timeline",
      readiness: queryHistory.length > 0 ? "ready_now" : "needs_result",
      relatedDatasetId: datasetId,
      relatedInvestigationStep: "next_investigation",
    }),
    createArtifact({
      id: "artifact:audit-log",
      label: "Audit notes",
      description: "A reproducibility record for dataset, worksheet, filters, grouping, and result references.",
      type: "audit_log",
      readiness: dataset ? "ready_now" : "needs_result",
      relatedDatasetId: datasetId,
      relatedInvestigationStep: "validate",
    }),
  ];

  if (hasWorkbook) {
    artifacts.push(
      createArtifact({
        id: "artifact:workbook-notes",
        label: "Workbook relationship notes",
        description: "Future package notes covering related sheets and workbook context.",
        type: "workbook_snapshot",
        readiness: "ready_now",
        relatedDatasetId: datasetId,
        relatedInvestigationStep: "scope",
      }),
    );
  }

  if (hasQuery) {
    artifacts.push(
      createArtifact({
        id: "artifact:sql-script",
        label: "SQL or query draft",
        description: "A future script artifact describing the current query shape.",
        type: "sql_script",
        readiness: "future_generation",
        relatedDatasetId: datasetId,
        relatedInvestigationStep: "summarize",
      }),
    );
  }

  artifacts.push(
    createArtifact({
      id: "artifact:chart-image",
      label: "Chart image placeholder",
      description: "A future visual summary generated from grouped results or recommended comparisons.",
      type: "chart_image",
      readiness: activeResultModel?.chartReady.numericColumns.length && activeResultModel.chartReady.categoricalColumns.length
        ? "future_generation"
        : "needs_result",
      relatedDatasetId: datasetId,
      relatedInvestigationStep: "review_result",
    }),
  );

  return artifacts;
};
