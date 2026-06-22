import type { BusinessSqlRenderPreview } from "./businessSqlRenderPreview";
import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { AnalysisScopeSelection } from "../../workbook";
import { createReportOpportunities } from "./reportIntelligencePlanner";
import {
  classifySqlAdaptiveFits,
  type SqlAdaptiveFitCategory,
  type SqlAdaptiveInsertState,
} from "./sqlAdaptiveFitClassifier";
import { recommendAnalyticalStrategies, type SqlAnalyticalStrategy } from "./sqlAnalyticalStrategies";
import { createSqlRelationshipReviewModel } from "./sqlRelationshipReview";
import { createSqlReportRecipes } from "./sqlReportRecipes";
import {
  adaptSingleTableTemplate,
  type SqlSingleTableAdaptationResult,
} from "./sqlSingleTableTemplateAdapter";
import { createSqlAssistantTemplates, type SqlAssistantTemplate } from "./sqlTemplateLibrary";
import { recommendSqlScope, type SqlScopeRecommendation } from "./sqlScopeRecommender";
import {
  recommendSqlTemplates,
  type SqlTemplateRecommendation,
} from "./sqlTemplateRecommender";
import {
  classifySqlBusinessQuestion,
  createBlockedRelationshipAskPlan,
  createSafeGroupedCountAskRecommendation,
  createSafeStatusBreakdownAskRecommendation,
  rankSqlAskRecommendationsForQuestionShape,
  type SqlAskBlockedPlanRecommendation,
  type SqlBusinessQuestionShape,
} from "./sqlBusinessQuestionShape";

export const ASK_FILTRAQUERI_BUTTON_LABEL = "Ask FiltraQueri";

export const BUSINESS_SQL_PREVIEW_IDLE_COPY =
  "No Business SQL preview yet. Ask FiltraQueri a business question to generate a safe SQL preview.";

export const BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE =
  "FiltraQueri needs more details before it can generate this SQL safely.";

export const BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_HELPER =
  "Try mentioning the worksheet, metric, or grouping you want.";

export const ADVANCED_PLANNING_DETAILS_LABEL = "Advanced planning details";

export const ADVANCED_PLANNING_DETAILS_COPY =
  "Planning details are available for review. They do not run SQL.";

export const ASK_RECOMMENDATION_ALREADY_INSERTED_COPY =
  "One suggestion is already inserted. Clear the editor or start a new tab before inserting another suggestion.";

export const ASK_RELATIONSHIP_BLOCK_COMPACT_TITLE =
  "Review worksheet connections before inserting SQL.";

export const ASK_RELATIONSHIP_BLOCK_COMPACT_COPY =
  "FiltraQueri understands the analysis, but worksheet connections must be reviewed before SQL can be inserted.";

export const ASK_ADAPTED_TEMPLATE_BADGE = "Adapted template";
export const ASK_ADAPTED_TEMPLATE_READY_STATUS = "Ready to insert";
export const ASK_ADAPTED_TEMPLATE_READY_COPY =
  "FiltraQueri matched this template to the selected worksheet. Review before inserting.";
export const ASK_ADAPTED_TEMPLATE_BLOCKED_STATUS = "Needs a clearer worksheet or column";
export const ASK_ADAPTED_TEMPLATE_BLOCKED_COPY =
  "FiltraQueri needs a clearer worksheet or column before adapting this template.";
export const ASK_ADAPTED_TEMPLATE_PREVIEW_ONLY_COPY = "This is a preview only.";

export type SqlAskFiltraQueriModel = {
  buttonLabel: typeof ASK_FILTRAQUERI_BUTTON_LABEL;
  canSubmit: boolean;
  prompt: string;
  noRunQuery: true;
  noBackendCall: true;
  noEditorMutation: true;
};

export type SqlAskFiltraQueriKeyInput = {
  key: string;
  shiftKey?: boolean;
  prompt: string;
};

export type BusinessSqlPreviewVisibilityModel = {
  shouldShowPanel: boolean;
  shouldShowDefaultPreviewPanel: boolean;
  shouldShowAdvancedPlanningDetails: boolean;
  shouldShowIdleCopy: boolean;
  shouldShowTechnicalReasons: boolean;
  advancedDetailsLabel: typeof ADVANCED_PLANNING_DETAILS_LABEL;
  advancedDetailsCopy: typeof ADVANCED_PLANNING_DETAILS_COPY;
  failureTitle: string | null;
  failureHelper: string | null;
  noRunQuery: true;
  noBackendCall: true;
  noEditorMutation: true;
};

export type SqlAskFiltraQueriSuggestionModel = {
  hasSubmittedAsk: boolean;
  recommendations: SqlTemplateRecommendation[];
  scopeRecommendations: SqlScopeRecommendation[];
  questionShape: SqlBusinessQuestionShape | null;
  blockedPlan: SqlAskBlockedPlanRecommendation | null;
  analyticalStrategies: SqlAnalyticalStrategy[];
  adaptiveFitSummaries: SqlAskAdaptiveFitSummary[];
  adaptedTemplateEvidence: SqlAskAdaptedTemplateEvidence[];
  recommendedAnalysis: SqlAskRecommendedAnalysisModel;
  guidanceTitle: string;
  guidanceCopy: string;
  noRunQuery: true;
  noBackendCall: true;
  noEditorMutation: true;
};

export type SqlAskAdaptedTemplateEvidence = {
  id: string;
  recommendationId: string;
  templateId: string;
  title: string;
  badge: typeof ASK_ADAPTED_TEMPLATE_BADGE;
  statusLabel: typeof ASK_ADAPTED_TEMPLATE_READY_STATUS | typeof ASK_ADAPTED_TEMPLATE_BLOCKED_STATUS;
  helperCopy: typeof ASK_ADAPTED_TEMPLATE_READY_COPY | typeof ASK_ADAPTED_TEMPLATE_BLOCKED_COPY;
  previewOnlyCopy: typeof ASK_ADAPTED_TEMPLATE_PREVIEW_ONLY_COPY;
  canInsertSql: boolean;
  sql: string | null;
  expectedOutputColumns: string[];
  reasons: string[];
  adapterStatus: SqlSingleTableAdaptationResult["status"];
  selectedTableName: string | null;
  schemaColumnNames: string[];
  bindings: SqlSingleTableAdaptationResult["bindings"];
  relationshipSafe: boolean;
  adapterSafety: SqlSingleTableAdaptationResult["safety"];
  noRunQuery: true;
  noBackendCall: true;
  noEditorMutation: true;
};

export type SqlAskAdaptedTemplateInsertModel = {
  buttonLabel: "Insert SQL";
  canInsert: boolean;
  sql: string | null;
  disabledReason: string | null;
  isInsertedAdaptedTemplate: boolean;
  noRunQuery: true;
  noBackendCall: true;
};

export type SqlAskAdaptiveFitSummary = {
  id: string;
  candidateId: string;
  source: "template" | "recipe" | "opportunity" | "generated" | "strategy" | "blocked_plan";
  label: string;
  title: string;
  description: string;
  statusLabel: string;
  category: SqlAdaptiveFitCategory;
  insertState: SqlAdaptiveInsertState;
  reasons: string[];
  requiredRelationships: string[];
  missingFields: string[];
};

export type SqlAskRecommendedAnalysisAction =
  | "insert_recommendation"
  | "insert_strategy"
  | "review_relationships"
  | "review_first";

export type SqlAskRecommendedAnalysisCard = {
  id: string;
  title: string;
  description: string;
  fitLabel: string;
  statusLabel: string;
  category: SqlAdaptiveFitCategory;
  insertState: SqlAdaptiveInsertState;
  expectedOutput: string[];
  action: SqlAskRecommendedAnalysisAction;
  recommendationId: string | null;
  strategyId: string | null;
  requiredRelationships: string[];
  missingFields: string[];
  isPrimary: boolean;
};

export type SqlAskRecommendedAnalysisModel = {
  title: "Recommended analysis";
  primary: SqlAskRecommendedAnalysisCard | null;
  alternatives: SqlAskRecommendedAnalysisCard[];
  hiddenAlternatives: SqlAskRecommendedAnalysisCard[];
  relationshipAction: {
    title: string;
    copy: string;
    actionLabel: "Review worksheet connections";
    requiredRelationships: string[];
  } | null;
  noRunQuery: true;
  noBackendCall: true;
  noEditorMutation: true;
};

export type SqlAskRecommendationInsertModel = {
  buttonLabel: "Insert into editor";
  canInsert: boolean;
  sql: string | null;
  disabledReason: string | null;
  isInsertedRecommendation: boolean;
  noRunQuery: true;
  noBackendCall: true;
};

export const createSqlAskFiltraQueriModel = (
  prompt: string,
): SqlAskFiltraQueriModel => ({
  buttonLabel: ASK_FILTRAQUERI_BUTTON_LABEL,
  canSubmit: prompt.trim().length > 0,
  prompt,
  noRunQuery: true,
  noBackendCall: true,
  noEditorMutation: true,
});

export const shouldSubmitSqlAskFiltraQueriKey = ({
  key,
  shiftKey = false,
  prompt,
}: SqlAskFiltraQueriKeyInput): boolean =>
  key === "Enter" && !shiftKey && prompt.trim().length > 0;

const worksheetLabelForSelection = (
  dataset: DatasetMetadata | null,
  selection: AnalysisScopeSelection,
): string => {
  const worksheet = dataset?.workbook_metadata?.worksheets.find(
    (candidate) => candidate.worksheetId === selection.worksheetId,
  );

  return worksheet?.displayName || worksheet?.sheetName || selection.tableName;
};

const selectedTableForAskAdaptation = ({
  dataset,
  appliedScopeSelections,
}: {
  dataset: DatasetMetadata | null;
  appliedScopeSelections: readonly AnalysisScopeSelection[];
}): {
  worksheetId: string | null;
  worksheetLabel: string;
  tableName: string;
  schema: SchemaColumn[];
} | null => {
  if (!dataset) return null;
  if (appliedScopeSelections.length > 1) return null;

  const workbook = dataset.workbook_metadata;
  const scopedSelection = appliedScopeSelections[0] || null;
  if (scopedSelection) {
    const worksheet =
      workbook?.worksheets.find((candidate) => candidate.worksheetId === scopedSelection.worksheetId) || null;
    return {
      worksheetId: scopedSelection.worksheetId,
      worksheetLabel: worksheet?.displayName || worksheet?.sheetName || scopedSelection.tableName,
      tableName: scopedSelection.tableName,
      schema: worksheet?.schema || dataset.schema,
    };
  }

  const activeWorksheetId =
    workbook?.activeAnalysisSource?.worksheetId ||
    workbook?.activeWorksheetId ||
    null;
  const activeWorksheet = activeWorksheetId
    ? workbook?.worksheets.find((worksheet) => worksheet.worksheetId === activeWorksheetId) || null
    : null;

  return {
    worksheetId: activeWorksheet?.worksheetId || null,
    worksheetLabel:
      activeWorksheet?.displayName ||
      activeWorksheet?.sheetName ||
      dataset.table_name ||
      "Selected worksheet",
    tableName:
      workbook?.activeAnalysisSource?.tableName ||
      activeWorksheet?.tableName ||
      dataset.table_name,
    schema: activeWorksheet?.schema || dataset.schema,
  };
};

const formatNeededTables = (scopeRecommendations: readonly SqlScopeRecommendation[]): string =>
  scopeRecommendations
    .slice(0, 3)
    .map((recommendation) => recommendation.worksheetName)
    .join(", ");

const isApplicableAskRecommendation = (recommendation: SqlTemplateRecommendation): boolean =>
  recommendation.score > 3;

const uniqueRecommendations = (
  recommendations: readonly SqlTemplateRecommendation[],
): SqlTemplateRecommendation[] => {
  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    const key = `${recommendation.kind}:${recommendation.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const formatRelationshipGaps = (shape: SqlBusinessQuestionShape): string =>
  shape.relationshipGaps
    .map((gap) => `${gap.fromTable} to ${gap.toTable}`)
    .join(", ");

const createGuidanceForQuestionShape = ({
  hasTemplate,
  neededTables,
  shape,
}: {
  hasTemplate: boolean;
  neededTables: string;
  shape: SqlBusinessQuestionShape | null;
}) => {
  if (shape?.preferredOutputShape === "blocked_relationship_plan") {
    const relationshipGaps = formatRelationshipGaps(shape);
    return {
      guidanceTitle: "Review worksheet connections before inserting SQL",
      guidanceCopy: relationshipGaps
        ? `This question needs related worksheets (${shape.mentionedEntities.map((entity) => entity.label).join(", ")}). Review the worksheet connections before inserting SQL.`
        : "This question needs related worksheets. Review the worksheet connections before inserting SQL.",
    };
  }

  if (hasTemplate) {
    return {
      guidanceTitle: "Suggested template",
      guidanceCopy:
        "FiltraQueri found a deterministic template or report pattern for your question. Review it before inserting or running anything.",
    };
  }

  if (neededTables) {
    return {
      guidanceTitle: "Relevant worksheets",
      guidanceCopy: `This question appears to need: ${neededTables}. Review these worksheets before choosing a template.`,
    };
  }

  return {
    guidanceTitle: BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE,
    guidanceCopy: BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_HELPER,
  };
};

const adaptiveFitLabels: Record<SqlAdaptiveFitCategory, string> = {
  exact_fit: "Exact match",
  adapted_fit: "Can be adapted",
  partial_fit: "Partial match",
  composed_solution: "Composed analysis",
  blocked_fit: "Needs worksheet relationships",
  poor_fit: "Weak match",
};

const adaptiveFitStatusLabels: Record<SqlAdaptiveInsertState, string> = {
  insertable_existing_sql: "Ready to insert",
  read_only: "Read-only for now",
  blocked_relationships: "Relationships needed",
  blocked_missing_fields: "Fields needed",
  needs_confirmation: "Review suggested match",
};

const adaptiveFitCategoryRank: Record<SqlAdaptiveFitCategory, number> = {
  exact_fit: 0,
  blocked_fit: 1,
  adapted_fit: 2,
  composed_solution: 3,
  partial_fit: 4,
  poor_fit: 5,
};

const confidenceRank: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const emptyRecommendedAnalysis = (): SqlAskRecommendedAnalysisModel => ({
  title: "Recommended analysis",
  primary: null,
  alternatives: [],
  hiddenAlternatives: [],
  relationshipAction: null,
  noRunQuery: true,
  noBackendCall: true,
  noEditorMutation: true,
});

const normalizeAnalysisKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\b(records?|rows?|sql|query|analysis)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const actionForFit = (
  fit: Pick<SqlAskAdaptiveFitSummary, "insertState" | "source" | "candidateId">,
): SqlAskRecommendedAnalysisAction => {
  if (fit.insertState === "blocked_relationships") return "review_relationships";
  if (fit.insertState === "insertable_existing_sql") {
    return fit.source === "strategy" ? "insert_strategy" : "insert_recommendation";
  }
  return "review_first";
};

const actionForStrategy = (
  strategy: Pick<SqlAnalyticalStrategy, "isInsertable" | "requiredRelationships">,
): SqlAskRecommendedAnalysisAction => {
  if (strategy.requiredRelationships.length > 0) return "review_relationships";
  return strategy.isInsertable ? "insert_strategy" : "review_first";
};

const statusLabelForStrategy = (
  strategy: Pick<SqlAnalyticalStrategy, "isInsertable" | "requiredRelationships">,
): string => {
  if (strategy.requiredRelationships.length > 0) return "Relationships needed";
  return strategy.isInsertable ? "Ready to insert" : "Read-only for now";
};

const strategyCategory = (
  strategy: Pick<SqlAnalyticalStrategy, "isInsertable" | "requiredRelationships">,
): SqlAdaptiveFitCategory => {
  if (strategy.requiredRelationships.length > 0) return "blocked_fit";
  return strategy.isInsertable ? "exact_fit" : "composed_solution";
};

const matchingStrategyForFit = (
  fit: SqlAskAdaptiveFitSummary,
  strategies: readonly SqlAnalyticalStrategy[],
): SqlAnalyticalStrategy | null =>
  strategies.find((strategy) => strategy.id === fit.candidateId) ||
  strategies.find((strategy) => normalizeAnalysisKey(strategy.title) === normalizeAnalysisKey(fit.title)) ||
  strategies.find((strategy) => strategy.sourceRecommendationId === fit.candidateId) ||
  null;

const matchingRecommendationForFit = (
  fit: SqlAskAdaptiveFitSummary,
  recommendations: readonly SqlTemplateRecommendation[],
): SqlTemplateRecommendation | null =>
  recommendations.find((recommendation) => recommendation.id === fit.candidateId) ||
  recommendations.find((recommendation) => normalizeAnalysisKey(recommendation.title) === normalizeAnalysisKey(fit.title)) ||
  null;

export const createSqlAskRecommendedAnalysisModel = ({
  adaptiveFitSummaries,
  analyticalStrategies,
  recommendations,
}: {
  adaptiveFitSummaries: readonly SqlAskAdaptiveFitSummary[];
  analyticalStrategies: readonly SqlAnalyticalStrategy[];
  recommendations: readonly SqlTemplateRecommendation[];
}): SqlAskRecommendedAnalysisModel => {
  if (adaptiveFitSummaries.length === 0 && analyticalStrategies.length === 0) {
    return emptyRecommendedAnalysis();
  }

  const seen = new Set<string>();
  const cards: SqlAskRecommendedAnalysisCard[] = [];
  const addCard = (card: SqlAskRecommendedAnalysisCard) => {
    const key = normalizeAnalysisKey(`${card.title} ${card.expectedOutput.join(" ")}`);
    if (seen.has(key)) return;
    seen.add(key);
    cards.push(card);
  };

  adaptiveFitSummaries.forEach((fit, index) => {
    const strategy = matchingStrategyForFit(fit, analyticalStrategies);
    const recommendation = matchingRecommendationForFit(fit, recommendations);
    addCard({
      id: `fit:${fit.id}`,
      title: fit.title,
      description: fit.description,
      fitLabel: index === 0 ? "Best fit" : fit.label,
      statusLabel: fit.statusLabel,
      category: fit.category,
      insertState: fit.insertState,
      expectedOutput: strategy?.outputShape || [],
      action: actionForFit(fit),
      recommendationId: recommendation?.id || (fit.source === "strategy" ? null : fit.candidateId),
      strategyId: strategy?.id || (fit.source === "strategy" ? fit.candidateId : null),
      requiredRelationships: fit.requiredRelationships,
      missingFields: fit.missingFields,
      isPrimary: index === 0,
    });
  });

  analyticalStrategies.forEach((strategy) => {
    addCard({
      id: `strategy:${strategy.id}`,
      title: strategy.title,
      description: strategy.description,
      fitLabel: strategy.requiredRelationships.length > 0 ? "Needs worksheet relationships" : "Analysis option",
      statusLabel: statusLabelForStrategy(strategy),
      category: strategyCategory(strategy),
      insertState:
        strategy.requiredRelationships.length > 0
          ? "blocked_relationships"
          : strategy.isInsertable
            ? "insertable_existing_sql"
            : "read_only",
      expectedOutput: strategy.outputShape,
      action: actionForStrategy(strategy),
      recommendationId: null,
      strategyId: strategy.id,
      requiredRelationships: strategy.requiredRelationships,
      missingFields: [],
      isPrimary: cards.length === 0,
    });
  });

  const [primary = null, ...remaining] = cards.map((card, index) => ({
    ...card,
    isPrimary: index === 0,
  }));
  const visibleCards = remaining.slice(0, 2);
  const topCards = [primary, ...visibleCards].filter((card): card is SqlAskRecommendedAnalysisCard => Boolean(card));
  const relationshipAction =
    topCards.length > 0 &&
    topCards.every((card) => card.insertState === "blocked_relationships") &&
    topCards.some((card) => card.requiredRelationships.length > 0)
      ? {
          title: ASK_RELATIONSHIP_BLOCK_COMPACT_TITLE,
          copy: ASK_RELATIONSHIP_BLOCK_COMPACT_COPY,
          actionLabel: "Review worksheet connections" as const,
          requiredRelationships: uniqueStrings(topCards.flatMap((card) => card.requiredRelationships)),
        }
      : null;

  return {
    title: "Recommended analysis",
    primary,
    alternatives: visibleCards,
    hiddenAlternatives: remaining.slice(2),
    relationshipAction,
    noRunQuery: true,
    noBackendCall: true,
    noEditorMutation: true,
  };
};

export const createSqlAskAdaptiveFitSummaries = ({
  prompt,
  questionShape,
  recommendations,
  analyticalStrategies,
  blockedPlan,
  dataset,
}: {
  prompt: string;
  questionShape: SqlBusinessQuestionShape | null;
  recommendations: readonly SqlTemplateRecommendation[];
  analyticalStrategies: readonly SqlAnalyticalStrategy[];
  blockedPlan: SqlAskBlockedPlanRecommendation | null;
  dataset: DatasetMetadata | null;
}): SqlAskAdaptiveFitSummary[] => {
  if (!questionShape) return [];

  const relationshipReviewItems =
    blockedPlan && blockedPlan.missingRelationships.length > 0
      ? createSqlRelationshipReviewModel({
          dataset,
          requiredRelationships: blockedPlan.missingRelationships,
        }).pairs
      : [];
  const fits = classifySqlAdaptiveFits({
    prompt,
    questionShape,
    recommendations,
    strategies: analyticalStrategies,
    relationshipReviewItems,
  });
  const visibleFits = fits.some((fit) => fit.category !== "poor_fit")
    ? fits.filter((fit) => fit.category !== "poor_fit")
    : fits;

  return [...visibleFits]
    .sort(
      (a, b) =>
        confidenceRank[a.confidence] - confidenceRank[b.confidence] ||
        adaptiveFitCategoryRank[a.category] - adaptiveFitCategoryRank[b.category],
    )
    .slice(0, 2)
    .map((fit): SqlAskAdaptiveFitSummary => {
      const firstReason =
        fit.category === "blocked_fit"
          ? ASK_RELATIONSHIP_BLOCK_COMPACT_COPY
          : fit.reasons[0] || "Deterministic fit metadata is available for this suggestion.";
      return {
        id: `${fit.source}:${fit.candidateId}`,
        candidateId: fit.candidateId,
        source: fit.source,
        label: adaptiveFitLabels[fit.category],
        title: fit.title,
        description: firstReason,
        statusLabel: adaptiveFitStatusLabels[fit.insertState],
        category: fit.category,
        insertState: fit.insertState,
        reasons: fit.reasons,
        requiredRelationships: fit.requiredRelationships,
        missingFields: fit.missingFields,
      };
    });
};

const userFacingAdaptationCopy = (
  result: SqlSingleTableAdaptationResult,
): Pick<SqlAskAdaptedTemplateEvidence, "statusLabel" | "helperCopy"> =>
  result.status === "ready"
    ? {
        statusLabel: ASK_ADAPTED_TEMPLATE_READY_STATUS,
        helperCopy: ASK_ADAPTED_TEMPLATE_READY_COPY,
      }
    : {
        statusLabel: ASK_ADAPTED_TEMPLATE_BLOCKED_STATUS,
        helperCopy: ASK_ADAPTED_TEMPLATE_BLOCKED_COPY,
      };

const shouldCreateAdaptedTemplateEvidence = (
  questionShape: SqlBusinessQuestionShape | null,
  blockedPlan: SqlAskBlockedPlanRecommendation | null,
): questionShape is SqlBusinessQuestionShape =>
  Boolean(
    questionShape &&
      !blockedPlan &&
      questionShape.preferredOutputShape !== "blocked_relationship_plan" &&
      !questionShape.relationshipDependent &&
      questionShape.relationshipGaps.length === 0,
  );

export const createSqlAskAdaptedTemplateEvidence = ({
  prompt,
  questionShape,
  recommendations,
  templateCandidates = [],
  dataset,
  selectedDialect,
  appliedScopeSelections,
  blockedPlan,
}: {
  prompt: string;
  questionShape: SqlBusinessQuestionShape | null;
  recommendations: readonly SqlTemplateRecommendation[];
  templateCandidates?: readonly SqlAssistantTemplate[];
  dataset: DatasetMetadata | null;
  selectedDialect: SqlDialectId;
  appliedScopeSelections: readonly AnalysisScopeSelection[];
  blockedPlan: SqlAskBlockedPlanRecommendation | null;
}): SqlAskAdaptedTemplateEvidence[] => {
  if (selectedDialect !== "duckdb") return [];
  if (!shouldCreateAdaptedTemplateEvidence(questionShape, blockedPlan)) return [];

  const selectedTable = selectedTableForAskAdaptation({
    dataset,
    appliedScopeSelections,
  });
  const evidence: SqlAskAdaptedTemplateEvidence[] = [];
  const candidates = uniqueRecommendations([
    ...recommendations,
    ...templateCandidates.map((template): SqlTemplateRecommendation => ({
      id: template.id,
      kind: "template",
      title: template.title,
      description: template.explanation,
      sql: template.sql,
      score: 0,
      reasons: [],
      support: "supported",
      adaptiveMetadata: template.adaptiveMetadata,
    })),
  ]);

  for (const recommendation of candidates) {
    if (recommendation.kind !== "template" || !recommendation.adaptiveMetadata) continue;

    const result = adaptSingleTableTemplate({
      prompt,
      questionShape,
      selectedTable,
      template: {
        id: recommendation.id,
        title: recommendation.title,
        adaptiveMetadata: recommendation.adaptiveMetadata,
      },
      dialect: "duckdb",
    });

    if (
      result.status !== "ready" &&
      ![
        "blocked_missing_grouping",
        "blocked_missing_metric",
        "blocked_missing_filter",
        "blocked_missing_sort",
        "blocked_missing_table",
      ].includes(result.status)
    ) {
      continue;
    }

    const copy = userFacingAdaptationCopy(result);
    evidence.push({
      id: `adapted-template:${recommendation.id}`,
      recommendationId: recommendation.id,
      templateId: recommendation.id,
      title: result.adaptedTitle,
      badge: ASK_ADAPTED_TEMPLATE_BADGE,
      statusLabel: copy.statusLabel,
      helperCopy: copy.helperCopy,
      previewOnlyCopy: ASK_ADAPTED_TEMPLATE_PREVIEW_ONLY_COPY,
      canInsertSql: result.status === "ready",
      sql: result.status === "ready" ? result.sql : null,
      expectedOutputColumns: result.expectedOutputColumns,
      reasons: result.reasons,
      adapterStatus: result.status,
      selectedTableName: selectedTable?.tableName || null,
      schemaColumnNames: selectedTable?.schema.map((column) => column.name) || [],
      bindings: result.bindings,
      relationshipSafe:
        !questionShape.relationshipDependent &&
        questionShape.relationshipGaps.length === 0 &&
        questionShape.preferredOutputShape !== "blocked_relationship_plan",
      adapterSafety: result.safety,
      noRunQuery: true,
      noBackendCall: true,
      noEditorMutation: true,
    });
  }

  const readyEvidence = evidence.filter((item) => item.adapterStatus === "ready");
  return readyEvidence.length > 0 ? readyEvidence.slice(0, 1) : evidence.slice(0, 1);
};

export const createSqlAskFiltraQueriSuggestionModel = ({
  hasSubmittedAsk,
  prompt,
  dataset,
  selectedDialect,
  appliedScopeSelections,
}: {
  hasSubmittedAsk: boolean;
  prompt: string;
  dataset: DatasetMetadata | null;
  selectedDialect: SqlDialectId;
  appliedScopeSelections: AnalysisScopeSelection[];
}): SqlAskFiltraQueriSuggestionModel => {
  const trimmedPrompt = prompt.trim();
  const appliedScopeLabels = appliedScopeSelections.map((selection) =>
    worksheetLabelForSelection(dataset, selection),
  );
  const templates = createSqlAssistantTemplates(dataset, selectedDialect);
  const recipes = createSqlReportRecipes(dataset, selectedDialect);
  const opportunities = createReportOpportunities(dataset, selectedDialect);
  const scopeRecommendations =
    hasSubmittedAsk && trimmedPrompt
      ? recommendSqlScope({
          taskPrompt: trimmedPrompt,
          dataset,
          appliedScopeLabels,
        })
      : [];
  const questionShape =
    hasSubmittedAsk && trimmedPrompt
      ? classifySqlBusinessQuestion({
          prompt: trimmedPrompt,
          dataset,
        })
      : null;
  const rawRecommendations =
    hasSubmittedAsk && trimmedPrompt
      ? recommendSqlTemplates({
          taskPrompt: trimmedPrompt,
          dataset,
          appliedScopeLabels,
          templates,
          recipes,
          opportunities,
        }).filter(isApplicableAskRecommendation)
      : [];
  const groupedCountRecommendation =
    questionShape && hasSubmittedAsk && trimmedPrompt
      ? createSafeGroupedCountAskRecommendation({
          dataset,
          selectedDialect,
          shape: questionShape,
        })
      : null;
  const statusBreakdownRecommendation =
    questionShape && hasSubmittedAsk && trimmedPrompt
      ? createSafeStatusBreakdownAskRecommendation({
          dataset,
          selectedDialect,
          shape: questionShape,
        })
      : null;
  const recommendations = questionShape
    ? uniqueRecommendations([
        ...(groupedCountRecommendation ? [groupedCountRecommendation] : []),
        ...(statusBreakdownRecommendation ? [statusBreakdownRecommendation] : []),
        ...rankSqlAskRecommendationsForQuestionShape(rawRecommendations, questionShape),
      ]).slice(0, 3)
    : rawRecommendations;
  const blockedPlan = questionShape
    ? createBlockedRelationshipAskPlan({
        dataset,
        shape: questionShape,
      })
    : null;
  const analyticalStrategies = questionShape
    ? recommendAnalyticalStrategies({
        prompt: trimmedPrompt,
        questionShape,
        relevantWorksheets: scopeRecommendations,
        acceptedRelationships: dataset?.workbook_metadata?.acceptedRelationshipContracts || [],
        existingRecommendations: recommendations,
      })
    : [];
  const adaptiveFitSummaries = createSqlAskAdaptiveFitSummaries({
    prompt: trimmedPrompt,
    questionShape,
    recommendations,
    analyticalStrategies,
    blockedPlan,
    dataset,
  });
  const adaptedTemplateEvidence = createSqlAskAdaptedTemplateEvidence({
    prompt: trimmedPrompt,
    questionShape,
    recommendations: uniqueRecommendations([...recommendations, ...rawRecommendations]),
    templateCandidates: templates,
    dataset,
    selectedDialect,
    appliedScopeSelections,
    blockedPlan,
  });
  const recommendedAnalysis = createSqlAskRecommendedAnalysisModel({
    adaptiveFitSummaries,
    analyticalStrategies,
    recommendations,
  });
  const neededTables = formatNeededTables(scopeRecommendations);
  const hasTemplate = recommendations.length > 0;
  const guidance = createGuidanceForQuestionShape({
    hasTemplate,
    neededTables,
    shape: questionShape,
  });

  return {
    hasSubmittedAsk,
    recommendations,
    scopeRecommendations,
    questionShape,
    blockedPlan,
    analyticalStrategies,
    adaptiveFitSummaries,
    adaptedTemplateEvidence,
    recommendedAnalysis,
    guidanceTitle: guidance.guidanceTitle,
    guidanceCopy: guidance.guidanceCopy,
    noRunQuery: true,
    noBackendCall: true,
    noEditorMutation: true,
  };
};

export const createSqlAskRecommendationInsertModel = (
  recommendation: Pick<SqlTemplateRecommendation, "id" | "sql">,
  options: {
    activeSqlDraft?: string;
    insertedAskRecommendationId?: string | null;
  } = {},
): SqlAskRecommendationInsertModel => {
  const sql = recommendation.sql.trim();
  const hasActiveDraft = Boolean(options.activeSqlDraft?.trim());
  const isInsertedRecommendation =
    hasActiveDraft && options.insertedAskRecommendationId === recommendation.id;

  if (!sql) {
    return {
      buttonLabel: "Insert into editor",
      canInsert: false,
      sql: null,
      disabledReason: "No safe SQL is available for this suggestion yet.",
      isInsertedRecommendation: false,
      noRunQuery: true,
      noBackendCall: true,
    };
  }

  if (hasActiveDraft) {
    return {
      buttonLabel: "Insert into editor",
      canInsert: false,
      sql: null,
      disabledReason: isInsertedRecommendation
        ? "This suggestion is already inserted in the editor."
        : ASK_RECOMMENDATION_ALREADY_INSERTED_COPY,
      isInsertedRecommendation,
      noRunQuery: true,
      noBackendCall: true,
    };
  }

  return {
    buttonLabel: "Insert into editor",
    canInsert: true,
    sql: recommendation.sql,
    disabledReason: null,
    isInsertedRecommendation: false,
    noRunQuery: true,
    noBackendCall: true,
  };
};

const quotedIdentifier = (value: string): string =>
  `"${value.replace(/"/g, '""')}"`;

const hasJoinKeyword = (sql: string): boolean => /\bjoin\b/i.test(sql);

const referencesSelectedTableOnly = (
  sql: string,
  selectedTableName: string | null,
): boolean => {
  if (!selectedTableName) return false;
  const fromMatches = Array.from(sql.matchAll(/\bFROM\s+"([^"]+)"/gi)).map((match) => match[1]);
  return fromMatches.length === 1 && fromMatches[0] === selectedTableName;
};

const bindingsAreSchemaBacked = (
  evidence: SqlAskAdaptedTemplateEvidence,
): boolean => {
  const schemaNames = new Set(evidence.schemaColumnNames);
  const columns = [
    evidence.bindings.groupingColumn,
    evidence.bindings.metricColumn,
    evidence.bindings.filterColumn,
    evidence.bindings.sortColumn,
  ].filter((value): value is string => Boolean(value));

  return columns.length > 0 && columns.every((column) => schemaNames.has(column));
};

const sqlUsesKnownBindingColumns = (
  evidence: SqlAskAdaptedTemplateEvidence,
): boolean => {
  const sql = evidence.sql || "";
  const allowed = new Set([
    ...(evidence.selectedTableName ? [evidence.selectedTableName] : []),
    ...evidence.schemaColumnNames,
    "row_count",
    "total_value",
    "average_value",
  ].map(quotedIdentifier));
  const identifiers = Array.from(sql.matchAll(/"((?:[^"]|"")+)"/g)).map((match) => `"${match[1]}"`);
  return identifiers.every((identifier) => allowed.has(identifier));
};

const adaptedTemplateInsertDisabled = (
  disabledReason: string,
  isInsertedAdaptedTemplate = false,
): SqlAskAdaptedTemplateInsertModel => ({
  buttonLabel: "Insert SQL",
  canInsert: false,
  sql: null,
  disabledReason,
  isInsertedAdaptedTemplate,
  noRunQuery: true,
  noBackendCall: true,
});

export const createSqlAskAdaptedTemplateInsertModel = (
  evidence: SqlAskAdaptedTemplateEvidence,
  options: {
    activeSqlDraft?: string;
    insertedAskRecommendationId?: string | null;
  } = {},
): SqlAskAdaptedTemplateInsertModel => {
  const sql = evidence.sql?.trim() || "";
  const hasActiveDraft = Boolean(options.activeSqlDraft?.trim());
  const isInsertedAdaptedTemplate =
    hasActiveDraft && options.insertedAskRecommendationId === evidence.id;

  if (isInsertedAdaptedTemplate) {
    return adaptedTemplateInsertDisabled("This adapted SQL is already inserted in the editor.", true);
  }

  if (hasActiveDraft) {
    return adaptedTemplateInsertDisabled(ASK_RECOMMENDATION_ALREADY_INSERTED_COPY);
  }

  if (
    !evidence.canInsertSql ||
    evidence.adapterStatus !== "ready" ||
    !sql ||
    !evidence.adapterSafety.noBackendCall ||
    !evidence.adapterSafety.noRunQuery ||
    !evidence.adapterSafety.manualInsertOnly ||
    !evidence.adapterSafety.singleTableOnly ||
    !evidence.adapterSafety.noJoins ||
    !evidence.adapterSafety.noEditorMutationUntilManualInsert ||
    hasJoinKeyword(sql) ||
    !referencesSelectedTableOnly(sql, evidence.selectedTableName) ||
    !bindingsAreSchemaBacked(evidence) ||
    !sqlUsesKnownBindingColumns(evidence) ||
    !evidence.relationshipSafe
  ) {
    return adaptedTemplateInsertDisabled("This adapted SQL needs review before it can be inserted.");
  }

  return {
    buttonLabel: "Insert SQL",
    canInsert: true,
    sql,
    disabledReason: null,
    isInsertedAdaptedTemplate: false,
    noRunQuery: true,
    noBackendCall: true,
  };
};

export const createBusinessSqlPreviewVisibilityModel = ({
  hasPreviewAttempt,
  prompt,
  preview,
}: {
  hasPreviewAttempt: boolean;
  prompt: string;
  preview: BusinessSqlRenderPreview | null;
}): BusinessSqlPreviewVisibilityModel => {
  const hasPrompt = prompt.trim().length > 0;
  const shouldShowPanel = hasPreviewAttempt && hasPrompt && Boolean(preview);
  const isFailedPreview = shouldShowPanel && preview?.status !== "ready";
  const shouldShowDefaultPreviewPanel = shouldShowPanel && preview?.status === "ready";
  const shouldShowAdvancedPlanningDetails = shouldShowPanel && preview?.status !== "ready";

  return {
    shouldShowPanel,
    shouldShowDefaultPreviewPanel,
    shouldShowAdvancedPlanningDetails,
    shouldShowIdleCopy: !shouldShowPanel,
    shouldShowTechnicalReasons: false,
    advancedDetailsLabel: ADVANCED_PLANNING_DETAILS_LABEL,
    advancedDetailsCopy: ADVANCED_PLANNING_DETAILS_COPY,
    failureTitle: isFailedPreview ? BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE : null,
    failureHelper: isFailedPreview ? BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_HELPER : null,
    noRunQuery: true,
    noBackendCall: true,
    noEditorMutation: true,
  };
};
