import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { AnalysisScopeSelection, WorksheetMetadata } from "../../workbook";
import { detectBusinessIntent } from "./businessIntentGrounding";
import {
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type AdaptiveReportProposalRequest,
} from "./adaptiveReportProposal";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { SqlTemplateRecommendation } from "./sqlTemplateRecommender";

export type AdaptiveReportProposalFallbackState = {
  shouldShow: boolean;
  reason: "available" | "has_static_matches" | "missing_prompt" | "missing_scope" | "missing_metadata";
  proposal: AdaptiveReportProposal | null;
  insertDisabled: true;
  runDisabled: true;
};

export type CreateAdaptiveReportProposalFallbackInput = {
  taskPrompt: string;
  dataset: DatasetMetadata | null;
  selectedDialect: SqlDialectId;
  appliedScopeLabels: readonly string[];
  recommendations: readonly SqlTemplateRecommendation[];
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchesScopeLabel = (worksheet: WorksheetMetadata, label: string): boolean => {
  const normalizedLabel = normalize(label);
  return [
    worksheet.displayName,
    worksheet.sheetName,
    worksheet.tableName,
  ].some((candidate) => normalize(candidate) === normalizedLabel);
};

const createScopeSelection = (worksheet: WorksheetMetadata): AnalysisScopeSelection => ({
  worksheetId: worksheet.worksheetId,
  sourceType: "original",
  tableName: worksheet.tableName,
  originalTableName: worksheet.tableName,
});

const resolveAppliedScopeSelections = (
  dataset: DatasetMetadata,
  appliedScopeLabels: readonly string[],
): AnalysisScopeSelection[] => {
  const worksheets = dataset.workbook_metadata?.worksheets || [];

  if (worksheets.length > 0) {
    return appliedScopeLabels
      .map((label) => worksheets.find((worksheet) => matchesScopeLabel(worksheet, label)))
      .filter((worksheet): worksheet is WorksheetMetadata => Boolean(worksheet))
      .map(createScopeSelection);
  }

  return appliedScopeLabels.some((label) => normalize(label) === normalize(dataset.table_name))
    ? [
        {
          worksheetId: dataset.dataset_id,
          sourceType: "original",
          tableName: dataset.table_name,
          originalTableName: dataset.table_name,
        },
      ]
    : [];
};

const resolveWorksheets = (
  dataset: DatasetMetadata,
): AdaptiveReportProposalRequest["worksheets"] => {
  const workbookWorksheets = dataset.workbook_metadata?.worksheets || [];
  if (workbookWorksheets.length > 0) {
    return workbookWorksheets.map((worksheet) => ({
      worksheetId: worksheet.worksheetId,
      displayName: worksheet.displayName,
      sheetName: worksheet.sheetName,
      tableName: worksheet.tableName,
      schema: worksheet.schema,
    }));
  }

  return [
    {
      worksheetId: dataset.dataset_id,
      displayName: dataset.original_filename,
      sheetName: dataset.original_filename,
      tableName: dataset.table_name,
      schema: dataset.schema,
    },
  ];
};

export function createAdaptiveReportProposalFallback({
  taskPrompt,
  dataset,
  selectedDialect,
  appliedScopeLabels,
  recommendations,
}: CreateAdaptiveReportProposalFallbackInput): AdaptiveReportProposalFallbackState {
  if (recommendations.length > 0) {
    return {
      shouldShow: false,
      reason: "has_static_matches",
      proposal: null,
      insertDisabled: true,
      runDisabled: true,
    };
  }

  if (!taskPrompt.trim()) {
    return {
      shouldShow: false,
      reason: "missing_prompt",
      proposal: null,
      insertDisabled: true,
      runDisabled: true,
    };
  }

  if (!dataset) {
    return {
      shouldShow: false,
      reason: "missing_metadata",
      proposal: null,
      insertDisabled: true,
      runDisabled: true,
    };
  }

  if (appliedScopeLabels.length === 0) {
    return {
      shouldShow: false,
      reason: "missing_scope",
      proposal: null,
      insertDisabled: true,
      runDisabled: true,
    };
  }

  const appliedScopeSelections = resolveAppliedScopeSelections(dataset, appliedScopeLabels);
  if (appliedScopeSelections.length === 0) {
    return {
      shouldShow: false,
      reason: "missing_scope",
      proposal: null,
      insertDisabled: true,
      runDisabled: true,
    };
  }

  return {
    shouldShow: true,
    reason: "available",
    proposal: proposeAdaptiveReport({
      prompt: taskPrompt,
      detectedIntent: detectBusinessIntent(taskPrompt),
      selectedGuidanceDialect: selectedDialect,
      appliedScopeSelections,
      worksheets: resolveWorksheets(dataset),
      acceptedRelationshipContracts:
        dataset.workbook_metadata?.acceptedRelationshipContracts || [],
    }),
    insertDisabled: true,
    runDisabled: true,
  };
}
