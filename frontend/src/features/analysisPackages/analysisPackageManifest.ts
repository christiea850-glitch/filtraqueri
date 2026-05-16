import type {
  AnalysisPackageBuildInput,
  AnalysisPackageExportTarget,
  AnalysisPackageManifest,
  AnalysisPackageStatus,
} from "./analysisPackageTypes";
import { buildAnalysisPackageArtifacts } from "./analysisPackageArtifacts";
import { buildAnalysisPackageAuditTrail } from "./analysisPackageAudit";
import {
  buildDatasetReference,
  buildResultReference,
  buildTrailReferences,
  buildWorkbookReference,
} from "./analysisPackageContext";

const packageStatusFromArtifacts = (
  artifacts: ReturnType<typeof buildAnalysisPackageArtifacts>,
): AnalysisPackageStatus => {
  if (artifacts.some((artifact) => artifact.readiness === "ready_now")) return "ready";
  if (artifacts.some((artifact) => artifact.readiness === "needs_result")) return "partial";
  return "planned";
};

const futureTargetsFromArtifacts = (
  artifacts: ReturnType<typeof buildAnalysisPackageArtifacts>,
): AnalysisPackageExportTarget[] => {
  const targets = new Set<AnalysisPackageExportTarget>(["pdf_report", "word_summary", "audit_archive"]);
  if (artifacts.some((artifact) => artifact.type === "result_export")) {
    targets.add("csv_export");
    targets.add("excel_export");
  }
  if (artifacts.some((artifact) => artifact.type === "chart_image")) targets.add("chart_images");
  if (artifacts.some((artifact) => artifact.type === "sql_script")) targets.add("script_bundle");
  targets.add("zip_package");
  return Array.from(targets);
};

export const buildAnalysisPackageManifest = (
  input: AnalysisPackageBuildInput,
): AnalysisPackageManifest => {
  const artifacts = buildAnalysisPackageArtifacts(input);
  const datasetName = input.dataset?.original_filename || "Untitled investigation";

  return {
    manifestVersion: 1,
    packageId: `analysis-package:${input.dataset?.dataset_id || "no-dataset"}`,
    title: `${datasetName} analysis package`,
    status: packageStatusFromArtifacts(artifacts),
    generatedAt: new Date().toISOString(),
    sourceMode: input.sourceMode,
    datasetReference: buildDatasetReference(input),
    workbookReference: buildWorkbookReference(input),
    investigationIntentReferences: input.investigationReport?.intents.slice(0, 5).map((intent) => intent.id) || [],
    generatedQueryReferences: input.queryHistory
      .filter((item) => item.action.toLowerCase().includes("query"))
      .map((item) => `query-history:${item.id}`),
    resultReference: buildResultReference(input),
    trailReferences: buildTrailReferences(input),
    artifactManifest: artifacts,
    futureExportTargets: futureTargetsFromArtifacts(artifacts),
    auditTrail: buildAnalysisPackageAuditTrail(input),
  };
};
