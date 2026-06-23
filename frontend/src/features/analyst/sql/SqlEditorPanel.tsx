import { useEffect, useMemo, useRef, useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import SqlEditorHost from "./SqlEditorHost";
import type { BusinessSqlRenderPreview } from "./businessSqlRenderPreview";
import {
  createBusinessSqlPreviewAdaptiveReportProposalFallback,
  type AdaptiveReportProposalFallbackState,
} from "./adaptiveReportProposalUiAdapter";
import type { AdaptiveReportProposal } from "./adaptiveReportProposal";
import AdaptiveProposalLlmConsentDisclosure, {
  shouldShowAdaptiveProposalLlmConsentDisclosure,
} from "./AdaptiveProposalLlmConsentDisclosure";
import BusinessSqlPlanCandidatePanel from "./BusinessSqlPlanCandidatePanel";
import {
  createAdaptiveProposalLlmConsentShellViewModel,
  type AdaptiveProposalLlmConsentShellViewModel,
} from "./adaptiveProposalLlmConsentShellAdapter";
import {
  createBusinessSqlPlanCandidateViewModel,
  type BusinessSqlPlanCandidateViewModel,
} from "./adaptiveProposalBusinessSqlBridgeUiAdapter";
import { createAdaptiveProposalBusinessSqlPreviewHandoff } from "./adaptiveProposalBusinessSqlPreviewHandoff";
import {
  applyBusinessSqlRenderPreviewManualInsert,
  getBusinessSqlRenderPreviewEmptyState,
  getBusinessSqlRenderPreviewCopyState,
  getBusinessSqlRenderPreviewManualInsertState,
} from "./businessSqlRenderPreviewUiAdapter";
import {
  getSqlDialectExecutionAdvisory,
  SQL_DIALECT_EXECUTION_HELPER_TEXT,
  SQL_DIALECT_SELECTOR_LABEL,
} from "./sqlDialectExecutionGuidance";
import {
  BUSINESS_SQL_PREVIEW_IDLE_COPY,
  ASK_FILTRAQUERI_BUTTON_LABEL,
  createBusinessSqlPreviewVisibilityModel,
  createSqlAskAdaptedTemplateInsertModel,
  createSqlAskRecommendationInsertModel,
  createSqlAskFiltraQueriModel,
  createSqlAskFiltraQueriSuggestionModel,
  shouldSubmitSqlAskFiltraQueriKey,
} from "./sqlAskFiltraQueriAdapter";
import { RELATIONSHIP_REVIEW_ACTION_LABEL } from "./sqlRelationshipReview";
import { createSqlSourceLineModel } from "./sqlSourceLineAdapter";
import {
  createSqlWorksheetScopeModel,
  setSqlWorksheetScopeSourceType,
  toggleSqlWorksheetScopeSelection,
} from "./sqlWorksheetScopeAdapter";
import type { AnalysisScopeSourceType } from "../../workbook";
import type {
  SqlEditorInterface,
  SqlDialectContext,
  SqlExecutionStatus,
  SqlGuidanceCard,
  SqlPreviewResult,
  SqlQueryExplanation,
  SqlReadinessReport,
  SqlValidationSummary,
  SqlWorkspaceTabsInterface,
} from "./sqlTypes";
import type { SqlWorkspaceTabSource } from "./sqlTabsTypes";

type SqlEditorPanelProps = {
  editor: SqlEditorInterface;
  executionStatus: SqlExecutionStatus;
  characterCount: number;
  canRunQuery: boolean;
  canOpenResultPreview: boolean;
  onOpenResultPreview: () => void;
  onOpenSavedDrafts: () => void;
  sqlTabs: SqlWorkspaceTabsInterface;
  dialectContext: SqlDialectContext;
  // Analyst command-bar additions: a quiet active source line plus editor actions.
  workbookLabel?: string | null;
  activeSourceLabel?: string | null;
  activeSourceTableLabel?: string | null;
  activeSourceKindLabel?: string | null;
  selectedScopeSummary?: string | null;
  appliedScopeSummary?: string | null;
  selectedScopeCount?: number;
  appliedScopeCount?: number;
  selectedTemplateLabel?: string | null;
  onInsertSql?: (
    sql: string,
    templateMetadata?: { id?: string; label?: string; createdFrom?: "template" | "report" },
  ) => void;
  onOpenSqlSourceTab?: (source: SqlWorkspaceTabSource) => void;
  // Option C - Optional execution-mismatch warning. When the active SQL
  // tab's source differs from the dataset's currently executable source,
  // this string is rendered as a calm note below the toolbar. Run Query
  // remains enabled; the warning is informational only and never blocks
  // typing or execution.
  sourceMismatchWarning?: string | null;
  readinessReport?: SqlReadinessReport;
  errorInsight?: SqlPreviewResult["errorInsight"];
  businessSqlRenderPreview?: BusinessSqlRenderPreview;
  dataset?: DatasetMetadata | null;
  onReviewRelationships?: (requiredRelationships: string[]) => void;
  planningDetailMode?: boolean;
  onOpenPlanningDetails?: () => void;
  onBackFromPlanningDetails?: () => void;
  businessSqlPreviewFeedback: BusinessSqlPreviewFeedback;
  onBusinessSqlPreviewFeedbackChange: (feedback: BusinessSqlPreviewFeedback) => void;
  businessSqlCandidatePreview: BusinessSqlRenderPreview | null;
  onBusinessSqlCandidatePreviewChange: (preview: BusinessSqlRenderPreview | null) => void;
  hasBusinessSqlPreviewAttempt: boolean;
  onHasBusinessSqlPreviewAttemptChange: (hasAttempt: boolean) => void;
  insertedAskRecommendationId: string | null;
  onInsertedAskRecommendationIdChange: (recommendationId: string | null) => void;
};

const statusLabels: Record<SqlExecutionStatus, string> = {
  idle: "Ready",
  "draft-saved": "Query saved to Saved Drafts",
  "explain-ready": "Diagnostics ready",
  running: "Running query",
  success: "Query complete",
  error: "Query failed",
};

export type BusinessSqlPreviewFeedback = "idle" | "copied" | "copy_failed" | "inserted";

const renderAdaptiveProposalValues = (values: readonly string[], fallback: string) =>
  values.length > 0 ? values.slice(0, 6).join(", ") : fallback;

const adaptivePlanningSafetyCopy = "Planning only · SQL not generated · Insert disabled · Run disabled";

const scopeFallbackDisclosure =
  "We could not fully match the items in your question to worksheet concepts yet, so this sketch uses your applied scope.";

const isScopeFallbackOnly = (proposal: AdaptiveReportProposal): boolean =>
  proposal.entities.length > 0 &&
  proposal.entities.every((entity) => entity.binding === "scope_fallback");

const adaptiveProposalRows = (proposal: AdaptiveReportProposal) =>
  [
    {
      label: "Entities",
      values: proposal.entities.map((entity) => entity.label),
    },
    {
      label: "Metrics",
      values: proposal.metrics.map((metric) => metric.label),
    },
    {
      label: "Groupings",
      values: proposal.groupings.map((grouping) => grouping.label),
    },
    {
      label: "Filters",
      values: proposal.filters.map((filter) => filter.label),
    },
    {
      label: "Join needs",
      values: proposal.joinNeeds
        .filter((join) => join.status !== "not_required")
        .map((join) => `${join.leftEntity} to ${join.rightEntity}: ${join.status.replace("_", " ")}`),
    },
    {
      label: "Assumptions",
      values: proposal.assumptions.map((item) => item.detail),
    },
    {
      label: "Warnings",
      values: proposal.warnings.map((warning) => warning.message),
    },
    {
      label: "Missing requirements",
      values: proposal.missingRequirements.map((requirement) => requirement.message),
    },
  ].filter((row) => row.values.length > 0);

function BusinessSqlAdaptiveProposalSection({
  consentDisclosure,
  onPreviewSqlFromCandidate,
  planCandidate,
  state,
}: {
  consentDisclosure?: AdaptiveProposalLlmConsentShellViewModel | null;
  onPreviewSqlFromCandidate?: () => void;
  planCandidate?: BusinessSqlPlanCandidateViewModel | null;
  state: AdaptiveReportProposalFallbackState;
}) {
  const proposal = state.proposal;
  if (!state.shouldShow || !proposal) return null;

  return (
    <section className="business-sql-adaptive-proposal" aria-label="Adaptive analysis proposal">
      <div className="business-sql-preview-head">
        <div>
          <span>Different layer: adaptive planning outline</span>
          <strong>{proposal.title}</strong>
        </div>
        <div className="business-sql-preview-badges" aria-label="Adaptive proposal metadata">
          <em>
            {proposal.support === "supported"
              ? "Proposal"
              : proposal.support === "needs_review"
                ? "Needs review"
                : "Unsupported"}
          </em>
          <em>Read-only</em>
        </div>
      </div>
      <p>
        Business SQL could not be rendered yet. FiltraQueri generated an adaptive analysis proposal from your question and dataset metadata.
      </p>
      <p>{proposal.proposalNarrative}</p>
      {isScopeFallbackOnly(proposal) && <p>{scopeFallbackDisclosure}</p>}
      {adaptiveProposalRows(proposal).length > 0 && (
        <dl>
          {adaptiveProposalRows(proposal).map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{renderAdaptiveProposalValues(row.values, "")}</dd>
            </div>
          ))}
        </dl>
      )}
      {consentDisclosure && <AdaptiveProposalLlmConsentDisclosure model={consentDisclosure} />}
      {planCandidate && (
        <BusinessSqlPlanCandidatePanel
          model={planCandidate}
          onPreviewSqlFromCandidate={onPreviewSqlFromCandidate}
        />
      )}
      <p className="business-sql-preview-action-note">
        {adaptivePlanningSafetyCopy}. It is not Business SQL, not a validation result for the editor draft, and not executable SQL.
      </p>
    </section>
  );
}

function SqlExecutionErrorDock({
  insight,
}: {
  insight: NonNullable<SqlPreviewResult["errorInsight"]>;
}) {
  const compactGuidance = insight.suggestions.length > 0 ? insight.suggestions : insight.howToFix;
  const visibleGuidance = compactGuidance.slice(0, 2);
  const hiddenGuidanceCount = Math.max(compactGuidance.length - visibleGuidance.length, 0);

  return (
    <aside
      className="sql-execution-error-dock"
      aria-labelledby="sql-execution-error-dock-title"
      role="status"
      aria-live="polite"
    >
      <div className="sql-execution-error-dock-summary">
        <div className="sql-execution-error-dock-copy">
          <span className="sql-execution-error-eyebrow">Query failed</span>
          <strong id="sql-execution-error-dock-title">{insight.title}</strong>
          <span>{insight.summary}</span>
        </div>

        {insight.likelyLocation?.token && (
          <div className="sql-execution-error-token" aria-label="Likely error location">
            <span>Likely location</span>
            <code>{insight.likelyLocation.token}</code>
          </div>
        )}
      </div>

      {visibleGuidance.length > 0 && (
        <ul className="sql-execution-error-suggestions" aria-label="Suggested next steps">
          {visibleGuidance.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
          {hiddenGuidanceCount > 0 && (
            <li>
              {hiddenGuidanceCount} more item{hiddenGuidanceCount === 1 ? "" : "s"} in details.
            </li>
          )}
        </ul>
      )}

      <details className="sql-execution-error-details">
        <summary>Technical details and full guidance</summary>
        <div className="sql-execution-error-details-grid">
          <section className="sql-execution-error-section">
            <span className="sql-execution-error-label">Likely cause</span>
            <p>{insight.likelyCause}</p>
          </section>

          {insight.howToFix.length > 0 && (
            <section className="sql-execution-error-section">
              <span className="sql-execution-error-label">How to fix</span>
              <ul>
                {insight.howToFix.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </section>
          )}

          {insight.suggestions.length > 0 && (
            <section className="sql-execution-error-section">
              <span className="sql-execution-error-label">Suggestions</span>
              <ul>
                {insight.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="sql-execution-error-section">
            <span className="sql-execution-error-label">Raw error</span>
            <pre>{insight.rawMessage}</pre>
          </section>
        </div>
      </details>
    </aside>
  );
}

function SqlEditorPanel({
  editor,
  executionStatus,
  characterCount,
  canRunQuery,
  canOpenResultPreview,
  onOpenResultPreview,
  onOpenSavedDrafts,
  sqlTabs,
  dialectContext,
  workbookLabel,
  activeSourceLabel,
  activeSourceTableLabel,
  activeSourceKindLabel,
  selectedScopeSummary,
  appliedScopeSummary,
  selectedScopeCount = 0,
  appliedScopeCount = 0,
  selectedTemplateLabel,
  onInsertSql,
  onOpenSqlSourceTab,
  sourceMismatchWarning,
  readinessReport,
  errorInsight,
  businessSqlRenderPreview,
  dataset,
  onReviewRelationships,
  planningDetailMode = false,
  onOpenPlanningDetails,
  onBackFromPlanningDetails,
  businessSqlPreviewFeedback,
  onBusinessSqlPreviewFeedbackChange,
  businessSqlCandidatePreview,
  onBusinessSqlCandidatePreviewChange,
  hasBusinessSqlPreviewAttempt,
  onHasBusinessSqlPreviewAttemptChange,
  insertedAskRecommendationId,
  onInsertedAskRecommendationIdChange,
}: SqlEditorPanelProps) {
  const hasUnappliedSelection =
    selectedScopeCount > 0 && selectedScopeSummary !== appliedScopeSummary;
  const dialectExecutionAdvisory = getSqlDialectExecutionAdvisory(
    dialectContext.selectedDialect,
    dialectContext.selectedDialectProfile,
  );
  const draftConversionPreview = dialectContext.draftConversionPreview?.canConvert
    ? dialectContext.draftConversionPreview
    : null;
  const [isSourcePopoverOpen, setIsSourcePopoverOpen] = useState(false);
  const [pendingSourceOptionId, setPendingSourceOptionId] = useState<string | null>(null);
  const [isScopePopoverOpen, setIsScopePopoverOpen] = useState(false);
  const sourceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sourcePopoverRef = useRef<HTMLDivElement | null>(null);
  const scopeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const scopePopoverRef = useRef<HTMLDivElement | null>(null);
  const effectiveBusinessSqlRenderPreview =
    businessSqlCandidatePreview || businessSqlRenderPreview;
  const askFiltraQueri = useMemo(
    () => createSqlAskFiltraQueriModel(sqlTabs.taskPrompt),
    [sqlTabs.taskPrompt],
  );
  const businessSqlPreviewVisibility = useMemo(
    () =>
      createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: hasBusinessSqlPreviewAttempt,
        prompt: sqlTabs.taskPrompt,
        preview: effectiveBusinessSqlRenderPreview || null,
      }),
    [effectiveBusinessSqlRenderPreview, hasBusinessSqlPreviewAttempt, sqlTabs.taskPrompt],
  );
  const askFiltraQueriSuggestions = useMemo(
    () =>
      createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: hasBusinessSqlPreviewAttempt,
        prompt: sqlTabs.taskPrompt,
        dataset: dataset || null,
        selectedDialect: dialectContext.selectedDialect,
        appliedScopeSelections: sqlTabs.appliedScopeSelections,
      }),
    [
      dataset,
      dialectContext.selectedDialect,
      hasBusinessSqlPreviewAttempt,
      sqlTabs.appliedScopeSelections,
      sqlTabs.taskPrompt,
    ],
  );
  const businessSqlPreviewCopyState = useMemo(
    () =>
      effectiveBusinessSqlRenderPreview
        ? getBusinessSqlRenderPreviewCopyState(effectiveBusinessSqlRenderPreview)
        : null,
    [effectiveBusinessSqlRenderPreview],
  );
  const businessSqlPreviewInsertState = useMemo(
    () =>
      effectiveBusinessSqlRenderPreview
        ? getBusinessSqlRenderPreviewManualInsertState(effectiveBusinessSqlRenderPreview, editor.value)
        : null,
    [effectiveBusinessSqlRenderPreview, editor.value],
  );
  const businessSqlPreviewEmptyState = useMemo(
    () =>
      effectiveBusinessSqlRenderPreview
        ? getBusinessSqlRenderPreviewEmptyState({
            preview: effectiveBusinessSqlRenderPreview,
            activeSqlDraft: editor.value,
            activeSqlDraftSource: sqlTabs.activeTabCreatedFrom,
          })
        : null,
    [effectiveBusinessSqlRenderPreview, editor.value, sqlTabs.activeTabCreatedFrom],
  );
  const businessSqlAdaptiveProposalFallback = useMemo(
    () =>
      createBusinessSqlPreviewAdaptiveReportProposalFallback({
        taskPrompt: sqlTabs.taskPrompt,
        dataset: dataset || null,
        selectedDialect: dialectContext.selectedDialect,
        appliedScopeSelections: sqlTabs.appliedScopeSelections,
        preview: effectiveBusinessSqlRenderPreview || null,
      }),
    [
      effectiveBusinessSqlRenderPreview,
      dataset,
      dialectContext.selectedDialect,
      sqlTabs.appliedScopeSelections,
      sqlTabs.taskPrompt,
    ],
  );
  const businessSqlAdaptiveProposalDisclosure = useMemo(() => {
    const proposal = businessSqlAdaptiveProposalFallback.proposal;
    if (!proposal) return null;

    const model = createAdaptiveProposalLlmConsentShellViewModel({
      proposal,
      dataset: dataset || null,
      selectedGuidanceDialect: dialectContext.selectedDialect,
    });

    return shouldShowAdaptiveProposalLlmConsentDisclosure({
      model,
      businessSqlRenderPreview: effectiveBusinessSqlRenderPreview || null,
      activeSqlDraft: editor.value,
    })
      ? model
      : null;
  }, [
    businessSqlAdaptiveProposalFallback.proposal,
    effectiveBusinessSqlRenderPreview,
    dataset,
    dialectContext.selectedDialect,
    editor.value,
  ]);
  const businessSqlPlanCandidate = useMemo(
    () =>
      createBusinessSqlPlanCandidateViewModel({
        fallback: businessSqlAdaptiveProposalFallback,
        dataset: dataset || null,
        businessSqlRenderPreview: effectiveBusinessSqlRenderPreview || null,
        activeSqlDraft: editor.value,
        selectedGuidanceDialect: dialectContext.selectedDialect,
      }),
    [
      businessSqlAdaptiveProposalFallback,
      effectiveBusinessSqlRenderPreview,
      dataset,
      dialectContext.selectedDialect,
      editor.value,
    ],
  );
  const sourceLine = useMemo(
    () =>
      createSqlSourceLineModel({
        dataset: dataset || null,
        workbookLabel,
        activeSourceLabel,
        activeSourceTableLabel,
        activeSourceKindLabel,
        appliedScopeSummary,
        appliedScopeCount,
      }),
    [
      activeSourceKindLabel,
      activeSourceLabel,
      activeSourceTableLabel,
      appliedScopeCount,
      appliedScopeSummary,
      dataset,
      workbookLabel,
    ],
  );
  const pendingSourceOption =
    sourceLine.options.find((option) => option.id === pendingSourceOptionId) ||
    sourceLine.options.find((option) => option.isCurrent) ||
    sourceLine.options[0] ||
    null;
  const worksheetScope = useMemo(
    () =>
      createSqlWorksheetScopeModel({
        dataset: dataset || null,
        selectedScopeSelections: sqlTabs.selectedScopeSelections,
        appliedScopeSummary,
        appliedScopeCount,
        activeSourceLabel,
      }),
    [
      activeSourceLabel,
      appliedScopeCount,
      appliedScopeSummary,
      dataset,
      sqlTabs.selectedScopeSelections,
    ],
  );
  const scopeSummaryLabel = appliedScopeSummary || "Workbook default";
  const sourceSummaryLabel = [
    activeSourceLabel || activeSourceTableLabel || "Active source",
    activeSourceKindLabel || "Original",
  ]
    .filter(Boolean)
    .join(" · ");
  const readinessStatusLabel = !editor.value.trim()
    ? "Write SQL first"
    : readinessReport?.status === "ready"
      ? "Ready to run"
      : readinessReport?.status === "warning"
        ? "Review before running"
        : "Readiness note";

  const closeSourcePopover = (returnFocus = true) => {
    setIsSourcePopoverOpen(false);
    if (returnFocus) {
      window.setTimeout(() => sourceTriggerRef.current?.focus(), 0);
    }
  };
  const closeScopePopover = (returnFocus = true) => {
    setIsScopePopoverOpen(false);
    if (returnFocus) {
      window.setTimeout(() => scopeTriggerRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    onBusinessSqlPreviewFeedbackChange("idle");
  }, [
    effectiveBusinessSqlRenderPreview?.planId,
    effectiveBusinessSqlRenderPreview?.sql,
    onBusinessSqlPreviewFeedbackChange,
  ]);

  useEffect(() => {
    onBusinessSqlCandidatePreviewChange(null);
  }, [
    businessSqlRenderPreview?.planId,
    businessSqlRenderPreview?.sql,
    dataset?.dataset_id,
    dialectContext.selectedDialect,
    sqlTabs.taskPrompt,
    editor.value,
    onBusinessSqlCandidatePreviewChange,
  ]);

  useEffect(() => {
    if (!sqlTabs.taskPrompt.trim()) {
      onHasBusinessSqlPreviewAttemptChange(false);
    }
  }, [onHasBusinessSqlPreviewAttemptChange, sqlTabs.taskPrompt]);

  useEffect(() => {
    if (!editor.value.trim()) {
      onInsertedAskRecommendationIdChange(null);
    }
  }, [editor.value, onInsertedAskRecommendationIdChange]);

  useEffect(() => {
    if (businessSqlPreviewFeedback === "idle") return undefined;

    const feedbackTimeout = window.setTimeout(() => {
      onBusinessSqlPreviewFeedbackChange("idle");
    }, 1600);

    return () => window.clearTimeout(feedbackTimeout);
  }, [businessSqlPreviewFeedback, onBusinessSqlPreviewFeedbackChange]);

  useEffect(() => {
    if (!isSourcePopoverOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (sourcePopoverRef.current?.contains(target) ||
          sourceTriggerRef.current?.contains(target))
      ) {
        return;
      }
      closeSourcePopover(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSourcePopover();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSourcePopoverOpen]);

  useEffect(() => {
    if (!isScopePopoverOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (scopePopoverRef.current?.contains(target) ||
          scopeTriggerRef.current?.contains(target))
      ) {
        return;
      }
      closeScopePopover();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeScopePopover();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isScopePopoverOpen]);

  const copyBusinessSqlPreview = async () => {
    if (!businessSqlPreviewCopyState?.canCopySql || !businessSqlPreviewCopyState.sql) return;

    try {
      await navigator.clipboard.writeText(businessSqlPreviewCopyState.sql);
      onBusinessSqlPreviewFeedbackChange("copied");
    } catch {
      onBusinessSqlPreviewFeedbackChange("copy_failed");
    }
  };

  const insertBusinessSqlPreview = () => {
    if (!effectiveBusinessSqlRenderPreview) return;

    const insertResult = applyBusinessSqlRenderPreviewManualInsert(
      effectiveBusinessSqlRenderPreview,
      editor.value,
    );

    if (!insertResult.inserted) return;

    editor.onChange(insertResult.activeSqlDraft);
    onBusinessSqlPreviewFeedbackChange("inserted");
  };
  const businessSqlInsertButtonLabel =
    businessSqlPreviewFeedback === "inserted"
      ? "Inserted into editor"
      : businessSqlPreviewInsertState?.disabledReason?.startsWith("Editor already has SQL")
        ? "Replace disabled for now"
        : "Insert into editor";
  const businessSqlPreviewActionHelper =
    businessSqlPreviewInsertState?.canManuallyInsertSqlPreview
      ? "Insert places this SQL in the editor only. Review it, then use the separate Run Query button when ready."
      : businessSqlPreviewInsertState?.disabledReason ||
        "Preview actions become available only when SQL is ready.";
  const dialectStyleName = dialectContext.selectedDialectProfile.displayName;
  const previewSqlFromPlanCandidate = () => {
    if (!businessSqlPlanCandidate) return;

    const handoff = createAdaptiveProposalBusinessSqlPreviewHandoff({
      candidateState: businessSqlPlanCandidate.state,
      plan: businessSqlPlanCandidate.plan,
      readiness: businessSqlPlanCandidate.readiness,
      issues: businessSqlPlanCandidate.bridgeIssues,
      activeSqlDraft: editor.value,
      existingPreview: effectiveBusinessSqlRenderPreview || null,
    });

    if (!handoff.preview) return;

    onBusinessSqlCandidatePreviewChange(handoff.preview);
  };
  const openSourcePopover = () => {
    setIsScopePopoverOpen(false);
    setPendingSourceOptionId(
      sourceLine.options.find((option) => option.isCurrent)?.id ||
        sourceLine.options[0]?.id ||
        null,
    );
    setIsSourcePopoverOpen(true);
  };
  const openPendingSource = () => {
    if (!pendingSourceOption || !onOpenSqlSourceTab) return;
    onOpenSqlSourceTab(pendingSourceOption.source);
    closeSourcePopover();
  };
  const openScopePopover = () => {
    setIsSourcePopoverOpen(false);
    setIsScopePopoverOpen(true);
  };
  const toggleWorksheetScope = (worksheetId: string) => {
    sqlTabs.onSelectedScopeChange(
      toggleSqlWorksheetScopeSelection({
        dataset: dataset || null,
        selectedScopeSelections: sqlTabs.selectedScopeSelections,
        worksheetId,
      }),
    );
  };
  const setWorksheetScopeSource = (
    worksheetId: string,
    sourceType: AnalysisScopeSourceType,
  ) => {
    sqlTabs.onSelectedScopeChange(
      setSqlWorksheetScopeSourceType({
        dataset: dataset || null,
        selectedScopeSelections: sqlTabs.selectedScopeSelections,
        worksheetId,
        sourceType,
      }),
    );
  };
  const applyWorksheetScope = () => {
    sqlTabs.onApplyScope();
    closeScopePopover();
  };
  const askFiltraQueriForPreview = () => {
    if (!askFiltraQueri.canSubmit) return;
    onHasBusinessSqlPreviewAttemptChange(true);
  };
  const insertAnalyticalStrategy = (
    strategy: typeof askFiltraQueriSuggestions.analyticalStrategies[number],
  ) => {
    const recommendationId = `strategy:${strategy.id}:${strategy.sourceRecommendationId || "review"}`;
    const insertState = createSqlAskRecommendationInsertModel(
      { id: recommendationId, sql: strategy.sql || "" },
      { activeSqlDraft: editor.value, insertedAskRecommendationId },
    );
    if (!strategy.isInsertable || !insertState.canInsert || !insertState.sql) return;

    onInsertSql?.(insertState.sql, {
      id: recommendationId,
      label: strategy.title,
      createdFrom: "template",
    });
    onInsertedAskRecommendationIdChange(recommendationId);
  };

  const insertAskRecommendation = (
    recommendation: typeof askFiltraQueriSuggestions.recommendations[number],
  ) => {
    const insertState = createSqlAskRecommendationInsertModel(recommendation, {
      activeSqlDraft: editor.value,
      insertedAskRecommendationId,
    });
    if (!insertState.canInsert || !insertState.sql) return;

    onInsertSql?.(insertState.sql, {
      id: recommendation.id,
      label: recommendation.title,
      createdFrom: recommendation.kind,
    });
    onInsertedAskRecommendationIdChange(recommendation.id);
  };
  const insertAdaptedTemplateEvidence = (
    evidence: typeof askFiltraQueriSuggestions.adaptedTemplateEvidence[number],
  ) => {
    const insertState = createSqlAskAdaptedTemplateInsertModel(evidence, {
      activeSqlDraft: editor.value,
      insertedAskRecommendationId,
    });
    if (!insertState.canInsert || !insertState.sql) return;

    onInsertSql?.(insertState.sql, {
      id: evidence.id,
      label: evidence.title,
      createdFrom: "template",
    });
    onInsertedAskRecommendationIdChange(evidence.id);
  };
  const relationshipReviewRelationships =
    askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction?.requiredRelationships ||
    askFiltraQueriSuggestions.blockedPlan?.missingRelationships ||
    askFiltraQueriSuggestions.analyticalStrategies.find(
      (strategy) => strategy.requiredRelationships.length > 0,
    )?.requiredRelationships ||
    [];
  const showRelationshipReviewAction =
    relationshipReviewRelationships.length > 0 && Boolean(onReviewRelationships);
  const relationshipReviewActionShownInRecommendedAnalysis =
    Boolean(askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction) &&
    showRelationshipReviewAction;
  const compactRelationshipBlock = askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction
    ? {
        title: askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction.title,
        copy: askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction.copy,
        requiredRelationships:
          askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction.requiredRelationships,
      }
    : askFiltraQueriSuggestions.blockedPlan?.missingRelationships.length
      ? {
          title: "Review worksheet connections before inserting SQL",
          copy:
            "FiltraQueri understands the analysis, but worksheet connections need review before SQL can be inserted.",
          requiredRelationships: askFiltraQueriSuggestions.blockedPlan.missingRelationships,
        }
      : null;
  const compactRelevantWorksheets = askFiltraQueriSuggestions.scopeRecommendations.slice(0, 3);
  const compactRelevantWorksheetHintColumns = Array.from(
    new Set(
      compactRelevantWorksheets.flatMap((recommendation) =>
        recommendation.matchedColumns,
      ),
    ),
  ).slice(0, 3);
  const compactRelevantWorksheetCountLabel =
    askFiltraQueriSuggestions.scopeRecommendations.length === 1
      ? "1 worksheet"
      : `${askFiltraQueriSuggestions.scopeRecommendations.length} worksheets`;
  const insertRecommendedAnalysisCard = (
    card: NonNullable<typeof askFiltraQueriSuggestions.recommendedAnalysis.primary>,
  ) => {
    if (card.action === "insert_strategy" && card.strategyId) {
      const strategy = askFiltraQueriSuggestions.analyticalStrategies.find(
        (candidate) => candidate.id === card.strategyId,
      );
      if (strategy) insertAnalyticalStrategy(strategy);
      return;
    }

    if (card.action === "insert_recommendation" && card.recommendationId) {
      const recommendation = askFiltraQueriSuggestions.recommendations.find(
        (candidate) => candidate.id === card.recommendationId,
      );
      if (recommendation) insertAskRecommendation(recommendation);
    }
  };
  const renderBusinessSqlPreviewPanel = ({
    includePreviewActions,
  }: {
    includePreviewActions: boolean;
  }) => effectiveBusinessSqlRenderPreview ? (
    <section
      className={[
        "business-sql-preview-panel",
        `is-${effectiveBusinessSqlRenderPreview.status.replace("_", "-")}`,
      ].join(" ")}
      aria-label="Read-only Business SQL preview"
    >
      <div className="business-sql-preview-head">
        <div>
          <span>Business SQL preview</span>
          <strong>{effectiveBusinessSqlRenderPreview.title}</strong>
        </div>
        <div className="business-sql-preview-badges" aria-label="Preview metadata">
          <em>{effectiveBusinessSqlRenderPreview.status === "ready" ? "Ready" : effectiveBusinessSqlRenderPreview.status === "blocked" ? "Blocked" : "Needs review"}</em>
          <em>DuckDB target</em>
          {effectiveBusinessSqlRenderPreview.guidanceDialect && (
            <em>{effectiveBusinessSqlRenderPreview.guidanceDialect.toUpperCase()} guidance</em>
          )}
        </div>
      </div>
      <p>
        {effectiveBusinessSqlRenderPreview.status === "ready"
          ? effectiveBusinessSqlRenderPreview.body
          : businessSqlPreviewVisibility.failureHelper ||
            effectiveBusinessSqlRenderPreview.body}
      </p>

      {effectiveBusinessSqlRenderPreview.sql ? (
        <pre className="business-sql-preview-code" aria-label="Read-only rendered SQL">
          {effectiveBusinessSqlRenderPreview.sql}
        </pre>
      ) : (
        <div className="business-sql-preview-empty" aria-label="No rendered SQL">
          {businessSqlPreviewEmptyState?.message ||
            "Business SQL Preview has no generated preview for this task."}
        </div>
      )}

      {effectiveBusinessSqlRenderPreview.status !== "ready" &&
        businessSqlPreviewVisibility.failureTitle && (
          <div className="business-sql-preview-review-notes">
            <div>
              <strong>{businessSqlPreviewVisibility.failureTitle}</strong>
              {businessSqlPreviewVisibility.failureHelper && (
                <span>{businessSqlPreviewVisibility.failureHelper}</span>
              )}
            </div>
          </div>
        )}

      {effectiveBusinessSqlRenderPreview.status === "ready" &&
        (effectiveBusinessSqlRenderPreview.reasons.length > 0 ||
        effectiveBusinessSqlRenderPreview.warnings.length > 0) && (
        <div className="business-sql-preview-review-notes">
          {effectiveBusinessSqlRenderPreview.reasons.length > 0 && (
            <div>
              <strong>Reasons</strong>
              <ul>
                {effectiveBusinessSqlRenderPreview.reasons.slice(0, 4).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {effectiveBusinessSqlRenderPreview.warnings.length > 0 && (
            <div>
              <strong>Warnings</strong>
              <ul>
                {effectiveBusinessSqlRenderPreview.warnings.slice(0, 4).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {includePreviewActions && (
        <>
          <div className="business-sql-preview-actions" aria-label="Preview actions">
            <button
              type="button"
              className="secondary-button"
              onClick={copyBusinessSqlPreview}
              disabled={!businessSqlPreviewCopyState?.canCopySql}
              title={businessSqlPreviewCopyState?.disabledReason || "Copy preview SQL"}
            >
              {businessSqlPreviewFeedback === "copied" ? "Copied" : "Copy SQL"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={insertBusinessSqlPreview}
              disabled={!businessSqlPreviewInsertState?.canManuallyInsertSqlPreview}
              title={businessSqlPreviewInsertState?.disabledReason || "Insert preview SQL into the empty editor"}
            >
              {businessSqlInsertButtonLabel}
            </button>
            <button type="button" className="secondary-button" disabled>
              Run preview disabled
            </button>
          </div>
          <p className="business-sql-preview-action-note">{businessSqlPreviewActionHelper}</p>
          {businessSqlPreviewFeedback === "copy_failed" && (
            <p className="business-sql-preview-feedback" role="status">
              Copy failed. Select the preview SQL and copy it manually.
            </p>
          )}
          {businessSqlPreviewFeedback === "inserted" && (
            <p className="business-sql-preview-feedback" role="status">
              Inserted into editor. Review the SQL before running it manually.
            </p>
          )}
        </>
      )}
      <BusinessSqlAdaptiveProposalSection
        consentDisclosure={businessSqlAdaptiveProposalDisclosure}
        onPreviewSqlFromCandidate={previewSqlFromPlanCandidate}
        planCandidate={businessSqlPlanCandidate}
        state={businessSqlAdaptiveProposalFallback}
      />
    </section>
  ) : null;
  const businessSqlPreviewPanel = renderBusinessSqlPreviewPanel({
    includePreviewActions: !planningDetailMode,
  });
  const planningDetailsAvailable =
    Boolean(effectiveBusinessSqlRenderPreview) &&
    (businessSqlPreviewVisibility.shouldShowDefaultPreviewPanel ||
      businessSqlPreviewVisibility.shouldShowAdvancedPlanningDetails);
  const planningStatusLabel =
    effectiveBusinessSqlRenderPreview?.status === "ready"
      ? "Preview ready"
      : effectiveBusinessSqlRenderPreview?.status === "blocked"
        ? "Needs review"
        : "Planning details";

  if (planningDetailMode) {
    return (
      <section className="sql-detail-placeholder-page" aria-label="Planning details">
        <div className="sql-result-page-header">
          <button
            type="button"
            className="secondary-button"
            onClick={onBackFromPlanningDetails}
          >
            {"\u2190 Back to SQL workspace"}
          </button>
          <div>
            <p className="section-label">Analyst SQL</p>
            <h2>Planning details</h2>
            <p>Review how FiltraQueri interpreted the question before preparing SQL.</p>
            <p>Read-only view. Nothing here runs SQL or changes the SQL editor.</p>
          </div>
        </div>
        {businessSqlPreviewPanel || (
          <div className="empty-state compact-empty">
            <p className="section-label">Details</p>
            <h2>Planning details</h2>
            <p>No planning details yet. Ask FiltraQueri a question to generate a plan.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="sql-editor-panel" aria-label="SQL editor">
      <div className="sql-workspace-tabbar" aria-label="Open SQL tabs">
        <div className="sql-workspace-tabs" role="tablist" aria-label="SQL drafts">
          {sqlTabs.tabs.map((tab) => (
            <div
              key={tab.id}
              className={["sql-workspace-tab", tab.isActive ? "is-active" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab.isActive}
                className="sql-workspace-tab-button"
                onClick={() => sqlTabs.onSwitchTab(tab.id)}
              >
                <span className="sql-workspace-tab-title">
                  {tab.title}
                  {tab.isDirty ? <span aria-label="Unsaved changes"> *</span> : null}
                </span>
                {tab.sourceBadge && (
                  <span className="sql-workspace-tab-source">{tab.sourceBadge}</span>
                )}
              </button>
              {tab.canClose && (
                <button
                  type="button"
                  className="sql-workspace-tab-close"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => sqlTabs.onCloseTab(tab.id)}
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="sql-workspace-new-tab" onClick={sqlTabs.onNewTab}>
          + New tab
        </button>
      </div>

      <div className="sql-ask-bar" aria-label="Ask FiltraQueri">
        <label htmlFor="sql-ask-filtraqueri">Ask FiltraQueri</label>
        <input
          id="sql-ask-filtraqueri"
          type="text"
          value={sqlTabs.taskPrompt}
          onChange={(event) => sqlTabs.onTaskPromptChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              shouldSubmitSqlAskFiltraQueriKey({
                key: event.key,
                shiftKey: event.shiftKey,
                prompt: sqlTabs.taskPrompt,
              })
            ) {
              event.preventDefault();
              askFiltraQueriForPreview();
            }
          }}
          placeholder="Describe the analysis you want, like Count leases by status"
          aria-label="Ask FiltraQueri"
        />
        <button
          type="button"
          className="primary-button"
          onClick={askFiltraQueriForPreview}
          disabled={!askFiltraQueri.canSubmit}
        >
          {ASK_FILTRAQUERI_BUTTON_LABEL}
        </button>
      </div>

      {askFiltraQueriSuggestions.hasSubmittedAsk && (
        <section className="sql-template-recommender" aria-label="Ask FiltraQueri suggestions">
          <div className="sql-template-recommender-head">
            <div>
              <strong>{askFiltraQueriSuggestions.guidanceTitle}</strong>
              <span>{askFiltraQueriSuggestions.guidanceCopy}</span>
            </div>
            <em>Deterministic</em>
          </div>
          {askFiltraQueriSuggestions.scopeRecommendations.length > 0 && (
            <div className="sql-scope-recommendation-list" aria-label="Relevant worksheets">
              <div className="sql-scope-recommendation-compact">
                <span className="sql-scope-recommendation-compact-label">Worksheets:</span>
                <div className="sql-scope-recommendation-pill-list">
                  {compactRelevantWorksheets.map((recommendation) => (
                    <span
                      className="sql-scope-recommendation-pill"
                      key={recommendation.worksheetId}
                    >
                      {recommendation.worksheetName}
                    </span>
                  ))}
                </div>
                <small>{compactRelevantWorksheetCountLabel}</small>
                {compactRelevantWorksheetHintColumns.length > 0 && (
                  <em>Includes: {compactRelevantWorksheetHintColumns.join(", ")}</em>
                )}
              </div>
            </div>
          )}
          {compactRelationshipBlock && (
            <div className="sql-recommended-analysis" aria-label="Relationship review required">
              <div className="sql-adaptive-fit-relationship-action">
                <div>
                  <strong>{compactRelationshipBlock.title}</strong>
                  <span>{compactRelationshipBlock.copy}</span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    onReviewRelationships?.(compactRelationshipBlock.requiredRelationships)
                  }
                >
                  {RELATIONSHIP_REVIEW_ACTION_LABEL}
                </button>
              </div>
            </div>
          )}
          {!compactRelationshipBlock && askFiltraQueriSuggestions.recommendedAnalysis.primary && (
            <div className="sql-recommended-analysis" aria-label="Recommended analysis">
              <div className="sql-helper-section-label">
                <span>{askFiltraQueriSuggestions.recommendedAnalysis.title}</span>
                <small>
                  {1 + askFiltraQueriSuggestions.recommendedAnalysis.alternatives.length}
                </small>
              </div>
              {askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction && (
                <div className="sql-adaptive-fit-relationship-action">
                  <div>
                    <strong>{askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction.title}</strong>
                    <span>{askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction.copy}</span>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      onReviewRelationships?.(
                        askFiltraQueriSuggestions.recommendedAnalysis.relationshipAction?.requiredRelationships || [],
                      )
                    }
                  >
                    {RELATIONSHIP_REVIEW_ACTION_LABEL}
                  </button>
                </div>
              )}
              {askFiltraQueriSuggestions.adaptedTemplateEvidence.length > 0 && (
                <div className="sql-recommended-analysis-alternatives" aria-label="Adapted template evidence">
                  {askFiltraQueriSuggestions.adaptedTemplateEvidence.slice(0, 1).map((evidence) => {
                    const insertState = createSqlAskAdaptedTemplateInsertModel(evidence, {
                      activeSqlDraft: editor.value,
                      insertedAskRecommendationId,
                    });
                    return (
                      <article className="sql-recommended-analysis-card" key={evidence.id}>
                        <div className="sql-template-recommendation-title-row">
                          <strong>{evidence.title}</strong>
                          <span className="sql-grounding-badge supported">{evidence.badge}</span>
                        </div>
                        <p>{evidence.helperCopy}</p>
                        <div className="sql-adaptive-fit-meta">
                          <span>{evidence.statusLabel}</span>
                          <span>{evidence.previewOnlyCopy}</span>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={!insertState.canInsert || !onInsertSql}
                          onClick={() => insertAdaptedTemplateEvidence(evidence)}
                        >
                          {insertState.buttonLabel}
                        </button>
                        {!insertState.canInsert && insertState.disabledReason && (
                          <p>{insertState.disabledReason}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              {[askFiltraQueriSuggestions.recommendedAnalysis.primary].map((card) => {
                const canInsert = card.action === "insert_recommendation" || card.action === "insert_strategy";
                return (
                  <article
                    className={[
                      "sql-recommended-analysis-card",
                      "is-primary",
                      `is-${card.category.replace(/_/g, "-")}`,
                    ].join(" ")}
                    key={card.id}
                  >
                    <div className="sql-template-recommendation-title-row">
                      <strong>{card.title}</strong>
                      <span className={`sql-grounding-badge ${card.insertState === "blocked_relationships" ? "needs_review" : "supported"}`}>
                        {card.fitLabel}
                      </span>
                    </div>
                    <p>{card.description}</p>
                    <div className="sql-adaptive-fit-meta">
                      <span>{card.statusLabel}</span>
                    </div>
                    {card.requiredRelationships.length > 0 && (
                      <p>Review worksheet connections before inserting SQL.</p>
                    )}
                    {canInsert ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!onInsertSql}
                        onClick={() => insertRecommendedAnalysisCard(card)}
                      >
                        Insert into editor
                      </button>
                    ) : card.action === "review_relationships" && !relationshipReviewActionShownInRecommendedAnalysis ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onReviewRelationships?.(card.requiredRelationships)}
                      >
                        {RELATIONSHIP_REVIEW_ACTION_LABEL}
                      </button>
                    ) : (
                      <button type="button" className="secondary-button" disabled>
                        Review first
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {!compactRelationshipBlock &&
          !askFiltraQueriSuggestions.recommendedAnalysis.primary &&
          (askFiltraQueriSuggestions.blockedPlan || askFiltraQueriSuggestions.recommendations.length > 0) ? (
            <div className="sql-template-recommendation-list" aria-label="Recommended templates">
              <div className="sql-helper-section-label">
                <span>Recommended templates</span>
                <small>
                  {askFiltraQueriSuggestions.recommendations.length +
                    (askFiltraQueriSuggestions.blockedPlan ? 1 : 0)}
                </small>
              </div>
              {askFiltraQueriSuggestions.blockedPlan && (
                <article className="sql-template-recommendation-card">
                  <div>
                    <div className="sql-template-recommendation-title-row">
                      <strong>{askFiltraQueriSuggestions.blockedPlan.title}</strong>
                      <span className="sql-grounding-badge needs_review">
                        {askFiltraQueriSuggestions.blockedPlan.statusLabel}
                      </span>
                    </div>
                    <span>{askFiltraQueriSuggestions.blockedPlan.expectedOutput}</span>
                  </div>
                  <ul>
                    <li>
                      Relevant worksheets:{" "}
                      {askFiltraQueriSuggestions.blockedPlan.relevantEntities.join(", ")}
                    </li>
                    <li>Review worksheet connections before inserting SQL.</li>
                    <li>{askFiltraQueriSuggestions.blockedPlan.explanation}</li>
                  </ul>
                  {!relationshipReviewActionShownInRecommendedAnalysis && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        onReviewRelationships?.(
                          askFiltraQueriSuggestions.blockedPlan?.missingRelationships || [],
                        )
                      }
                      title={askFiltraQueriSuggestions.blockedPlan.disabledReason}
                    >
                      {RELATIONSHIP_REVIEW_ACTION_LABEL}
                    </button>
                  )}
                  <small>{askFiltraQueriSuggestions.blockedPlan.disabledReason}</small>
                </article>
              )}
              {askFiltraQueriSuggestions.recommendations.map((recommendation) => {
                const insertState = createSqlAskRecommendationInsertModel(recommendation, {
                  activeSqlDraft: editor.value,
                  insertedAskRecommendationId,
                });
                return (
                  <article
                    className={[
                      "sql-template-recommendation-card",
                      insertState.isInsertedRecommendation ? "is-inserted" : "",
                    ].filter(Boolean).join(" ")}
                    key={`${recommendation.kind}:${recommendation.id}`}
                  >
                    <div>
                      <div className="sql-template-recommendation-title-row">
                        <strong>{recommendation.title}</strong>
                        <span className={`sql-grounding-badge ${recommendation.support || "supported"}`}>
                          {recommendation.support === "needs_review" ? "Needs review" : "Supported"}
                        </span>
                      </div>
                      <span>{recommendation.description}</span>
                    </div>
                    <ul>
                      {recommendation.reasons.slice(0, 2).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!insertState.canInsert || !onInsertSql}
                      title={insertState.disabledReason || "Insert this suggestion into the SQL editor"}
                      onClick={() => insertAskRecommendation(recommendation)}
                    >
                      {insertState.isInsertedRecommendation ? "Inserted" : insertState.buttonLabel}
                    </button>
                    {insertState.isInsertedRecommendation ? (
                      <small>Inserted into editor. Review before running manually.</small>
                    ) : !insertState.canInsert && insertState.disabledReason && (
                      <small>{insertState.disabledReason}</small>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            askFiltraQueriSuggestions.scopeRecommendations.length === 0 && (
              <p className="sql-template-recommender-empty">
                {askFiltraQueriSuggestions.guidanceCopy}
              </p>
            )
          )}
        </section>
      )}

      <div className="sql-source-scope-strip" aria-label="Worksheet source and scope">
        <div className="sql-source-scope-items" aria-label="Active worksheet context">
          <span className="sql-source-scope-pill">
            <strong>Scope:</strong> {scopeSummaryLabel}
          </span>
          <span className="sql-source-scope-pill">
            <strong>Source:</strong> {sourceSummaryLabel}
          </span>
          {selectedTemplateLabel && (
            <span className="sql-source-scope-pill">
              <strong>Template:</strong> {selectedTemplateLabel}
            </span>
          )}
          {hasUnappliedSelection && (
            <span className="sql-source-scope-pill is-warning">
              {selectedScopeCount} selected, not applied
            </span>
          )}
          {sourceMismatchWarning && (
            <span className="sql-source-scope-pill is-warning">
              {sourceMismatchWarning}
            </span>
          )}
        </div>
        <div className="sql-source-scope-actions">
          {worksheetScope.options.length > 0 && (
            <button
              ref={scopeTriggerRef}
              type="button"
              className="sql-scope-manage-button"
              aria-label="Manage worksheet scope"
              aria-expanded={isScopePopoverOpen}
              aria-controls="sql-worksheet-scope-popover"
              onClick={() =>
                isScopePopoverOpen ? closeScopePopover(false) : openScopePopover()
              }
            >
              Manage scope
            </button>
          )}
          {onOpenSqlSourceTab && sourceLine.options.length > 0 && (
            <button
              ref={sourceTriggerRef}
              type="button"
              className="sql-source-line-button"
              aria-label="Change source for this tab"
              aria-expanded={isSourcePopoverOpen}
              aria-controls="sql-source-popover"
              onClick={() =>
                isSourcePopoverOpen ? closeSourcePopover(false) : openSourcePopover()
              }
            >
              Change source
            </button>
          )}
        </div>
        {isScopePopoverOpen && (
          <div
            id="sql-worksheet-scope-popover"
            ref={scopePopoverRef}
            className="sql-scope-popover"
            role="dialog"
            aria-labelledby="sql-worksheet-scope-popover-title"
          >
            <div className="sql-scope-popover-head">
              <strong id="sql-worksheet-scope-popover-title">{worksheetScope.title}</strong>
              <p>{worksheetScope.helperCopy}</p>
            </div>
            <div className="sql-scope-option-list" aria-label="Worksheet planning scope">
              {worksheetScope.options.map((option) => (
                <div
                  key={option.worksheetId}
                  className={[
                    "sql-scope-option",
                    option.isSelected ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={option.isSelected}
                      onChange={() => toggleWorksheetScope(option.worksheetId)}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.sourceLabel} · {option.tableName}</small>
                    </span>
                  </label>
                  <label className="sql-scope-source-select">
                    <span>Planning source</span>
                    <select
                      value={option.selectedSourceType}
                      disabled={!option.isSelected}
                      onChange={(event) =>
                        setWorksheetScopeSource(
                          option.worksheetId,
                          event.target.value as AnalysisScopeSourceType,
                        )
                      }
                    >
                      <option value="original">Original worksheet</option>
                      {option.cleanedCopyAvailable && (
                        <option value="cleaned_working_copy">Cleaned working copy</option>
                      )}
                    </select>
                  </label>
                  {!option.cleanedCopyAvailable && (
                    <small className="sql-scope-option-helper">
                      No cleaned working copy available for this worksheet.
                    </small>
                  )}
                </div>
              ))}
            </div>
            <div className="sql-scope-popover-actions">
              <button type="button" className="secondary-button" onClick={() => closeScopePopover()}>
                {worksheetScope.cancelLabel}
              </button>
              <button type="button" className="primary-button" onClick={applyWorksheetScope}>
                {worksheetScope.applyLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sql-editor-toolbar sql-command-bar">
            {isSourcePopoverOpen && (
              <div
                id="sql-source-popover"
                ref={sourcePopoverRef}
                className="sql-source-popover"
                role="dialog"
                aria-labelledby="sql-source-popover-title"
              >
                <div className="sql-source-popover-head">
                  <strong id="sql-source-popover-title">Change source for this tab</strong>
                  <p>
                    Executable source. Open or reuse one SQL tab for the worksheet you want to query. This does not change worksheet planning scope.
                  </p>
                </div>
                <div className="sql-source-option-list" role="radiogroup" aria-label="Worksheet sources">
                  {sourceLine.options.map((option) => (
                    <label
                      key={option.id}
                      className={[
                        "sql-source-option",
                        option.isCurrent ? "is-current" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <input
                        type="radio"
                        name="sql-source-option"
                        value={option.id}
                        checked={pendingSourceOption?.id === option.id}
                        onChange={() => setPendingSourceOptionId(option.id)}
                      />
                      <span>
                        <strong>{option.worksheetLabel}</strong>
                        <small>
                          {option.sourceKindLabel === "Cleaned"
                            ? "Cleaned working copy"
                            : "Original worksheet"} · {option.tableName}
                          {option.isCurrent ? " · Current" : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                {sourceLine.noCleanedCopyHelper && (
                  <p className="sql-source-popover-helper">{sourceLine.noCleanedCopyHelper}</p>
                )}
                <div className="sql-source-popover-actions">
                  <button type="button" className="secondary-button" onClick={() => closeSourcePopover()}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={openPendingSource}
                    disabled={!pendingSourceOption}
                  >
                    Open source
                  </button>
                </div>
              </div>
            )}
        <div className="sql-actions">
          <div className="sql-dialect-control">
            <label className="sql-dialect-selector">
              <span className="sql-dialect-selector-label">{SQL_DIALECT_SELECTOR_LABEL}</span>
              <select
                value={dialectContext.selectedDialect}
                title={SQL_DIALECT_EXECUTION_HELPER_TEXT}
                onChange={(event) =>
                  dialectContext.onDialectChange(event.target.value as SqlDialectContext["selectedDialect"])
                }
                aria-label="SQL guidance dialect"
              >
                {dialectContext.dialectOptions.map((dialect) => (
                  <option key={dialect.id} value={dialect.id}>
                    {dialect.displayName}
                  </option>
                ))}
              </select>
            </label>
            {draftConversionPreview && (
              <div
                className="sql-dialect-draft-conversion"
                role="status"
                aria-live="polite"
              >
                <span>{dialectStyleName} style is available for this draft.</span>
                <small>Run Query still executes with DuckDB. This only changes the draft syntax.</small>
                <button
                  type="button"
                  className="text-button"
                  onClick={dialectContext.onApplyDraftConversion}
                  title={draftConversionPreview.summary}
                >
                  Apply {dialectStyleName} style
                </button>
              </div>
            )}
          </div>
          {readinessReport && (
            <div
              className={[
                "sql-command-readiness",
                readinessReport.status === "warning" ? "has-warning" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="status"
              aria-live="polite"
              title={readinessReport.summary}
            >
              <span className="sql-command-readiness-chip">{readinessStatusLabel}</span>
              {readinessReport.status === "warning" && (
                <div className="sql-command-readiness-summary">
                  <span>{readinessReport.summary}</span>
                  {readinessReport.issues.length > 0 && (
                    <ul>
                      {readinessReport.issues.slice(0, 2).map((issue) => (
                        <li key={issue.id}>{issue.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          <button type="button" className="primary-button" onClick={editor.onRun} disabled={!canRunQuery}>
            Run query
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onOpenResultPreview}
            disabled={!canOpenResultPreview}
          >
            Result Preview
          </button>
          <button type="button" className="secondary-button" onClick={editor.onSaveDraft}>
            Save Query
          </button>
          <button type="button" className="secondary-button" onClick={onOpenSavedDrafts}>
            Saved Drafts
          </button>
          <button type="button" className="text-button" onClick={editor.onClear}>
            Clear
          </button>
        </div>
      </div>

      {dialectExecutionAdvisory && (
        <div
          className="sql-dialect-execution-advisory"
          role="status"
          aria-live="polite"
        >
          {dialectExecutionAdvisory}
        </div>
      )}

      {businessSqlPreviewVisibility.shouldShowIdleCopy && (
        <p className="business-sql-preview-idle" role="status">
          {BUSINESS_SQL_PREVIEW_IDLE_COPY}
        </p>
      )}

      {planningDetailsAvailable && effectiveBusinessSqlRenderPreview && (
        <section className="business-sql-preview-panel" aria-label="Planning status">
          <div className="business-sql-preview-head">
            <div>
              <span>Planning status</span>
              <strong>{planningStatusLabel}</strong>
            </div>
            <div className="business-sql-preview-badges" aria-label="Planning status metadata">
              <em>
                {effectiveBusinessSqlRenderPreview.status === "ready"
                  ? "Ready"
                  : effectiveBusinessSqlRenderPreview.status === "blocked"
                    ? "Needs review"
                    : "Review"}
              </em>
            </div>
          </div>
          <p>
            {effectiveBusinessSqlRenderPreview.status === "ready"
              ? "FiltraQueri prepared SQL preview details for review."
              : businessSqlPreviewVisibility.advancedDetailsCopy ||
                "FiltraQueri has planning details ready for review."}
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={onOpenPlanningDetails}
          >
            View planning details
          </button>
        </section>
      )}

      <SqlEditorHost
        editor={editor}
        errorInsight={errorInsight}
        errorDock={errorInsight ? <SqlExecutionErrorDock insight={errorInsight} /> : null}
      />

      <div className="sql-editor-footer">
        <span>{statusLabels[executionStatus]}</span>
        <span>{characterCount.toLocaleString()} characters</span>
      </div>
    </section>
  );
}

type SqlGuidancePanelProps = {
  queryExplanation: SqlQueryExplanation;
  diagnostics: SqlEditorInterface["diagnostics"];
  guidanceCards: SqlGuidanceCard[];
  dialectContext: Pick<SqlDialectContext, "selectedDialectProfile">;
  validation: SqlValidationSummary;
};

export function SqlGuidancePanel({
  queryExplanation,
  diagnostics,
  guidanceCards,
  dialectContext,
  validation,
}: SqlGuidancePanelProps) {
  const visibleDiagnostics = diagnostics.slice(0, 4);
  const functionCount = diagnostics.filter((diagnostic) => diagnostic.source === "function").length;
  const conceptCount = diagnostics.filter((diagnostic) => diagnostic.source === "concept").length;
  const safetyCount = validation.diagnostics.filter(
    (diagnostic) => diagnostic.category === "safety",
  ).length;

  return (
    <section className="sql-draft-panel" aria-label="SQL diagnostics">
      <div className="sql-guidance-sections" aria-label="SQL diagnostic notes">
        <div className="builder-block-header">
          <span>What this query does</span>
          <small>{queryExplanation.isComplex ? "Review needed" : "Draft explanation"}</small>
        </div>
        <div
          className={[
            "sql-query-explanation-card",
            queryExplanation.isComplex ? "is-complex" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="sql-query-explanation-summary">
            <strong>{queryExplanation.title}</strong>
            <span>{queryExplanation.fallbackMessage || queryExplanation.summary}</span>
          </div>
          <div className="sql-query-explanation-grid">
            <article>
              <strong>Purpose</strong>
              <span>{queryExplanation.intent}</span>
            </article>
            <article>
              <strong>Looks in</strong>
              <span>{queryExplanation.source}</span>
            </article>
            <article>
              <strong>Information shown</strong>
              <span>{queryExplanation.fields.join(" ")}</span>
            </article>
            <article>
              <strong>Only includes</strong>
              <span>{queryExplanation.filters.join(" ")}</span>
            </article>
            <article>
              <strong>Grouping / aggregation</strong>
              <span>{queryExplanation.grouping.join(" ")}</span>
            </article>
            <article>
              <strong>Sorting / limit</strong>
              <span>{queryExplanation.sorting.join(" ")}</span>
            </article>
            <article>
              <strong>Joins</strong>
              <span>{queryExplanation.joins.join(" ")}</span>
            </article>
            <article>
              <strong>Result you should expect</strong>
              <span>{queryExplanation.outputShape}</span>
            </article>
            <article className="sql-query-explanation-wide">
              <strong>Business meaning</strong>
              <span>{queryExplanation.businessMeaning}</span>
            </article>
            <article className="sql-query-explanation-wide">
              <strong>Safety</strong>
              <span>{queryExplanation.safetyNote}</span>
            </article>
          </div>
        </div>

        <div className="builder-block-header sql-technical-diagnostics-header">
          <span>Technical diagnostics</span>
          <small>{diagnostics.length} notes</small>
        </div>
        <div className="sql-guidance-context">
          <strong>{dialectContext.selectedDialectProfile.displayName}</strong>
          <span>
            {functionCount} functions | {conceptCount} concepts | {safetyCount} safety
          </span>
        </div>
        <div className="sql-draft-list">
          {visibleDiagnostics.length === 0 && guidanceCards.length === 0 ? (
            <p>No SQL diagnostics yet.</p>
          ) : (
            <>
              {visibleDiagnostics.map((diagnostic) => (
                <article key={diagnostic.id}>
                  <strong>{diagnostic.title}</strong>
                  <span>{diagnostic.message}</span>
                </article>
              ))}
              {guidanceCards.map((card) => (
                <article key={card.id}>
                  <strong>{card.title}</strong>
                  <span>{card.detail || card.summary}</span>
                </article>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default SqlEditorPanel;
