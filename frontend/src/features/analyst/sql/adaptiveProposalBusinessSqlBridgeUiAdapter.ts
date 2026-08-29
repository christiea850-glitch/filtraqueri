import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { AdaptiveReportProposalFallbackState } from "./adaptiveReportProposalUiAdapter";
import {
  createBusinessSqlPlanFromAdaptiveProposal,
  type AdaptiveProposalBusinessSqlBridgeIssue,
  type AdaptiveProposalBusinessSqlBridgeResult,
  type AdaptiveProposalBusinessSqlBridgeState,
} from "./adaptiveProposalBusinessSqlBridge";
import type { BusinessSqlRenderPreview } from "./businessSqlRenderPreview";
import type { BusinessSqlQueryPlan } from "./businessSqlQueryPlan";
import type { BusinessSqlRenderReadinessResult } from "./businessSqlRenderReadiness";
import type { BusinessSqlMeasureClarificationDecision } from "./businessSqlMeasureAmbiguity";
import {
  evaluateBusinessSqlPlanningSourceReadiness,
  type BusinessSqlPlanningSourceReadiness,
} from "./businessSqlPlanningSourceReadiness";
import { isBusinessSqlPreviewReadyRenderable } from "./AdaptiveProposalLlmConsentDisclosure";
import {
  getAdaptiveProposalBusinessSqlPreviewHandoffAction,
  type AdaptiveProposalBusinessSqlPreviewHandoffAction,
} from "./adaptiveProposalBusinessSqlPreviewHandoff";

export type BusinessSqlPlanCandidateDetail = {
  label: string;
  values: string[];
};

export type BusinessSqlPlanCandidateViewModel = {
  state: AdaptiveProposalBusinessSqlBridgeState;
  statusLabel: string;
  heading: string;
  body: string;
  actionLabel: "Prepare Business SQL plan candidate";
  actionDisabled: false;
  safetyLine: string;
  noSqlRendered: true;
  noRenderPreviewCreated: true;
  noInsertAvailable: true;
  noRunAvailable: true;
  noProviderOrLlmUsed: true;
  plan: BusinessSqlQueryPlan | null;
  clarificationDecision: BusinessSqlMeasureClarificationDecision | null;
  readiness: BusinessSqlRenderReadinessResult | null;
  bridgeIssues: AdaptiveProposalBusinessSqlBridgeIssue[];
  previewHandoffAction: AdaptiveProposalBusinessSqlPreviewHandoffAction;
  sourceReadiness: BusinessSqlPlanningSourceReadiness | null;
  details: BusinessSqlPlanCandidateDetail[];
  issues: string[];
  readinessStatus: string;
};

export type CreateBusinessSqlPlanCandidateViewModelInput = {
  fallback: AdaptiveReportProposalFallbackState;
  dataset: DatasetMetadata | null;
  businessSqlRenderPreview: BusinessSqlRenderPreview | null;
  activeSqlDraft: string;
  selectedGuidanceDialect?: SqlDialectId;
};

export const BUSINESS_SQL_PLAN_CANDIDATE_COPY = {
  actionLabel: "Prepare Business SQL plan candidate",
  safetyLine:
    "Read-only plan candidate only. No SQL has been rendered, inserted, or run.",
  noPlan: "No Business SQL plan candidate available.",
  blocked: "Plan candidate blocked.",
  draft: "Draft plan candidate.",
  draftBody: "This is structural only and not render-ready.",
  reviewRequired: "Review required before SQL preview.",
  renderReady: "Plan candidate appears render-ready.",
  renderReadyBody:
    "No SQL has been rendered. Preview/rendering would require a separate explicit step later.",
} as const;

const formatStatus = (state: AdaptiveProposalBusinessSqlBridgeState): string => {
  switch (state) {
    case "no_plan":
      return "No plan";
    case "blocked_plan":
      return "Blocked";
    case "draft_plan":
      return "Draft";
    case "review_required_plan":
      return "Review required";
    case "render_ready_plan":
      return "Render-ready candidate";
  }
};

const headingFor = (state: AdaptiveProposalBusinessSqlBridgeState): string => {
  switch (state) {
    case "no_plan":
      return BUSINESS_SQL_PLAN_CANDIDATE_COPY.noPlan;
    case "blocked_plan":
      return BUSINESS_SQL_PLAN_CANDIDATE_COPY.blocked;
    case "draft_plan":
      return BUSINESS_SQL_PLAN_CANDIDATE_COPY.draft;
    case "review_required_plan":
      return BUSINESS_SQL_PLAN_CANDIDATE_COPY.reviewRequired;
    case "render_ready_plan":
      return BUSINESS_SQL_PLAN_CANDIDATE_COPY.renderReady;
  }
};

const bodyFor = (result: AdaptiveProposalBusinessSqlBridgeResult): string => {
  switch (result.state) {
    case "no_plan":
      return result.issues[0]?.message || "The adaptive outline cannot become a Business SQL plan candidate yet.";
    case "blocked_plan":
      return "Resolve the blocking planning metadata before preparing a Business SQL preview.";
    case "draft_plan":
      return BUSINESS_SQL_PLAN_CANDIDATE_COPY.draftBody;
    case "review_required_plan":
      return "Review the highlighted joins, filters, confidence, or readiness notes before any later SQL preview step.";
    case "render_ready_plan":
      return BUSINESS_SQL_PLAN_CANDIDATE_COPY.renderReadyBody;
  }
};

const compactValues = (values: readonly string[], fallback: string): string[] =>
  values.length > 0 ? values.slice(0, 6) : [fallback];

const issueMessagesFor = (
  state: AdaptiveProposalBusinessSqlBridgeState,
  issues: readonly AdaptiveProposalBusinessSqlBridgeIssue[],
): string[] => {
  const visible =
    state === "blocked_plan"
      ? issues.filter((issue) => issue.severity === "blocking")
      : issues.filter((issue) => issue.severity !== "info");
  return compactValues(
    visible.map((issue) => issue.message),
    state === "render_ready_plan"
      ? "No blocking bridge issues."
      : "No bridge issues to show.",
  );
};

const detail = (
  label: string,
  values: readonly string[],
  fallback: string,
): BusinessSqlPlanCandidateDetail => ({
  label,
  values: compactValues(values, fallback),
});

const detailsFor = (
  result: AdaptiveProposalBusinessSqlBridgeResult,
): BusinessSqlPlanCandidateDetail[] => {
  const plan = result.plan;
  if (!plan) {
    return [
      detail("Bridge issues", issueMessagesFor(result.state, result.issues), "No candidate details."),
      detail("Readiness", [result.readiness?.status || "not evaluated"], "not evaluated"),
    ];
  }

  return [
    detail(
      "Entities",
      plan.entities.map((entity) =>
        [entity.entity, entity.table ? `table ${entity.table}` : null, entity.role]
          .filter(Boolean)
          .join(" - "),
      ),
      "No entities mapped.",
    ),
    detail(
      "Metric",
      plan.metric
        ? [
            [
              plan.metric.label,
              plan.metric.kind,
              plan.metric.table ? `table ${plan.metric.table}` : null,
              plan.metric.field ? `field ${plan.metric.field}` : null,
            ]
              .filter(Boolean)
              .join(" - "),
          ]
        : [],
      "No metric mapped.",
    ),
    detail(
      "Groupings",
      plan.groupings.map((grouping) =>
        [grouping.label, grouping.table ? `table ${grouping.table}` : null, grouping.field ? `field ${grouping.field}` : null]
          .filter(Boolean)
          .join(" - "),
      ),
      "No groupings mapped.",
    ),
    detail(
      "Filters",
      plan.filters.map((filter) =>
        [filter.label, filter.kind, filter.table ? `table ${filter.table}` : null, filter.field ? `field ${filter.field}` : null]
          .filter(Boolean)
          .join(" - "),
      ),
      "No filters mapped.",
    ),
    detail(
      "Join status",
      [
        plan.joinPath.status,
        ...plan.joinPath.edges.map((edge) =>
          `${edge.fromEntity} to ${edge.toEntity}: ${edge.verified ? "verified" : plan.joinPath.status.replace("_", " ")}`,
        ),
      ],
      "No join path required.",
    ),
    detail(
      "Assumptions",
      plan.assumptions.map((assumption) => assumption.detail),
      "No assumptions listed.",
    ),
    detail(
      "Warnings",
      plan.warnings.map((warning) => warning.message),
      "No warnings listed.",
    ),
    detail(
      "Bridge issues",
      issueMessagesFor(result.state, result.issues),
      "No bridge issues to show.",
    ),
    detail(
      "Readiness",
      [
        result.readiness
          ? `${result.readiness.status}: ${
              result.readiness.reasons[0] ||
              result.readiness.warnings[0] ||
              "Plan is ready for a later explicit preview step."
            }`
          : "not evaluated",
      ],
      "not evaluated",
    ),
  ];
};

export const shouldShowBusinessSqlPlanCandidate = ({
  fallback,
  businessSqlRenderPreview,
  activeSqlDraft,
}: Pick<
  CreateBusinessSqlPlanCandidateViewModelInput,
  "fallback" | "businessSqlRenderPreview" | "activeSqlDraft"
>): boolean =>
  Boolean(fallback.shouldShow) &&
  Boolean(fallback.proposal) &&
  Boolean(businessSqlRenderPreview) &&
  !isBusinessSqlPreviewReadyRenderable(businessSqlRenderPreview) &&
  !activeSqlDraft.trim();

export const createBusinessSqlPlanCandidateViewModel = ({
  fallback,
  dataset,
  businessSqlRenderPreview,
  activeSqlDraft,
  selectedGuidanceDialect,
}: CreateBusinessSqlPlanCandidateViewModelInput): BusinessSqlPlanCandidateViewModel | null => {
  if (!shouldShowBusinessSqlPlanCandidate({ fallback, businessSqlRenderPreview, activeSqlDraft })) {
    return null;
  }
  if (fallback.measureAmbiguity && !fallback.clarificationDecision) return null;
  if (!fallback.proposal) return null;

  const result = createBusinessSqlPlanFromAdaptiveProposal({
    proposal: fallback.proposal,
    acceptedRelationshipContracts:
      dataset?.workbook_metadata?.acceptedRelationshipContracts || [],
    readyRelationshipContracts: [],
    selectedGuidanceDialect,
  });

  if (result.state === "no_plan" && result.issues.length === 0) return null;
  const sourceReadiness =
    result.plan && dataset
      ? evaluateBusinessSqlPlanningSourceReadiness({
          plan: result.plan,
          datasetId: dataset.dataset_id,
          workbookMetadata: dataset.workbook_metadata || null,
        })
      : null;

  return {
    state: result.state,
    statusLabel: formatStatus(result.state),
    heading: headingFor(result.state),
    body: bodyFor(result),
    actionLabel: BUSINESS_SQL_PLAN_CANDIDATE_COPY.actionLabel,
    actionDisabled: false,
    safetyLine: BUSINESS_SQL_PLAN_CANDIDATE_COPY.safetyLine,
    noSqlRendered: true,
    noRenderPreviewCreated: true,
    noInsertAvailable: true,
    noRunAvailable: true,
    noProviderOrLlmUsed: true,
    plan: result.plan,
    clarificationDecision: fallback.clarificationDecision,
    readiness: result.readiness,
    bridgeIssues: [...result.issues],
    previewHandoffAction: getAdaptiveProposalBusinessSqlPreviewHandoffAction({
      candidateState: result.state,
      plan: result.plan,
      readiness: result.readiness,
      issues: result.issues,
      activeSqlDraft,
      existingPreview: businessSqlRenderPreview,
      clarificationDecision: fallback.clarificationDecision,
      sourceReadiness,
    }),
    sourceReadiness,
    details: detailsFor(result),
    issues: issueMessagesFor(result.state, result.issues),
    readinessStatus: result.readiness?.status || "not evaluated",
  };
};

export const serializeBusinessSqlPlanCandidateViewModelForAudit = (
  model: BusinessSqlPlanCandidateViewModel,
): string =>
  JSON.stringify({
    state: model.state,
    statusLabel: model.statusLabel,
    heading: model.heading,
    body: model.body,
    actionLabel: model.actionLabel,
    actionDisabled: model.actionDisabled,
    safetyLine: model.safetyLine,
    noSqlRendered: model.noSqlRendered,
    noRenderPreviewCreated: model.noRenderPreviewCreated,
    noInsertAvailable: model.noInsertAvailable,
    noRunAvailable: model.noRunAvailable,
    noProviderOrLlmUsed: model.noProviderOrLlmUsed,
    previewHandoffAction: model.previewHandoffAction,
    details: model.details,
    issues: model.issues,
    readinessStatus: model.readinessStatus,
  });
