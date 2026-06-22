import type { BusinessSqlRenderPreview } from "./businessSqlRenderPreview";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
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
import { createSqlAssistantTemplates } from "./sqlTemplateLibrary";
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
  guidanceTitle: string;
  guidanceCopy: string;
  noRunQuery: true;
  noBackendCall: true;
  noEditorMutation: true;
};

export type SqlAskAdaptiveFitSummary = {
  id: string;
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
      guidanceTitle: "Relationship needed before SQL can be inserted",
      guidanceCopy: relationshipGaps
        ? `This question needs related worksheets (${shape.mentionedEntities.map((entity) => entity.label).join(", ")}), but FiltraQueri cannot safely join ${relationshipGaps} from accepted relationship metadata yet.`
        : "This question needs related worksheets, but FiltraQueri cannot safely verify the required relationship metadata yet.",
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
  blocked_missing_fields: "Missing fields",
  needs_confirmation: "Needs confirmation",
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
      const firstReason = fit.reasons[0] || "Deterministic fit metadata is available for this suggestion.";
      return {
        id: `${fit.source}:${fit.candidateId}`,
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
