import { useEffect, useMemo, useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import SqlEditorHost from "./SqlEditorHost";
import type { BusinessSqlRenderPreview } from "./businessSqlRenderPreview";
import {
  createBusinessSqlPreviewAdaptiveReportProposalFallback,
  type AdaptiveReportProposalFallbackState,
} from "./adaptiveReportProposalUiAdapter";
import type { AdaptiveReportProposal } from "./adaptiveReportProposal";
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
  // Analyst command-bar additions: workbook badge + active source pill +
  // Switch button (toggles SQL Context). Matches the routing mockup so the
  // editor toolbar reads as a single calm Analyst command bar.
  workbookLabel?: string | null;
  activeSourceLabel?: string | null;
  activeSourceTableLabel?: string | null;
  activeSourceKindLabel?: string | null;
  selectedScopeSummary?: string | null;
  appliedScopeSummary?: string | null;
  selectedScopeCount?: number;
  appliedScopeCount?: number;
  selectedTemplateLabel?: string | null;
  isContextOpen?: boolean;
  onToggleContext?: () => void;
  // Option C — Optional execution-mismatch warning. When the active SQL
  // tab's source differs from the dataset's currently executable source,
  // this string is rendered as a calm note below the toolbar. Run Query
  // remains enabled; the warning is informational only and never blocks
  // typing or execution.
  sourceMismatchWarning?: string | null;
  readinessReport?: SqlReadinessReport;
  errorInsight?: SqlPreviewResult["errorInsight"];
  businessSqlRenderPreview?: BusinessSqlRenderPreview;
  dataset?: DatasetMetadata | null;
};

const statusLabels: Record<SqlExecutionStatus, string> = {
  idle: "Ready",
  "draft-saved": "Query saved to Saved Drafts",
  "explain-ready": "Diagnostics ready",
  running: "Running query",
  success: "Query complete",
  error: "Query failed",
};

type BusinessSqlPreviewFeedback = "idle" | "copied" | "copy_failed" | "inserted";

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
  state,
}: {
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
  isContextOpen,
  onToggleContext,
  sourceMismatchWarning,
  readinessReport,
  errorInsight,
  businessSqlRenderPreview,
  dataset,
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
  const [businessSqlPreviewFeedback, setBusinessSqlPreviewFeedback] =
    useState<BusinessSqlPreviewFeedback>("idle");
  const businessSqlPreviewCopyState = useMemo(
    () =>
      businessSqlRenderPreview
        ? getBusinessSqlRenderPreviewCopyState(businessSqlRenderPreview)
        : null,
    [businessSqlRenderPreview],
  );
  const businessSqlPreviewInsertState = useMemo(
    () =>
      businessSqlRenderPreview
        ? getBusinessSqlRenderPreviewManualInsertState(businessSqlRenderPreview, editor.value)
        : null,
    [businessSqlRenderPreview, editor.value],
  );
  const businessSqlPreviewEmptyState = useMemo(
    () =>
      businessSqlRenderPreview
        ? getBusinessSqlRenderPreviewEmptyState({
            preview: businessSqlRenderPreview,
            activeSqlDraft: editor.value,
            activeSqlDraftSource: sqlTabs.activeTabCreatedFrom,
          })
        : null,
    [businessSqlRenderPreview, editor.value, sqlTabs.activeTabCreatedFrom],
  );
  const businessSqlAdaptiveProposalFallback = useMemo(
    () =>
      createBusinessSqlPreviewAdaptiveReportProposalFallback({
        taskPrompt: sqlTabs.taskPrompt,
        dataset: dataset || null,
        selectedDialect: dialectContext.selectedDialect,
        appliedScopeSelections: sqlTabs.appliedScopeSelections,
        preview: businessSqlRenderPreview || null,
      }),
    [
      businessSqlRenderPreview,
      dataset,
      dialectContext.selectedDialect,
      sqlTabs.appliedScopeSelections,
      sqlTabs.taskPrompt,
    ],
  );

  useEffect(() => {
    setBusinessSqlPreviewFeedback("idle");
  }, [businessSqlRenderPreview?.planId, businessSqlRenderPreview?.sql]);

  useEffect(() => {
    if (businessSqlPreviewFeedback === "idle") return undefined;

    const feedbackTimeout = window.setTimeout(() => {
      setBusinessSqlPreviewFeedback("idle");
    }, 1600);

    return () => window.clearTimeout(feedbackTimeout);
  }, [businessSqlPreviewFeedback]);

  const copyBusinessSqlPreview = async () => {
    if (!businessSqlPreviewCopyState?.canCopySql || !businessSqlPreviewCopyState.sql) return;

    try {
      await navigator.clipboard.writeText(businessSqlPreviewCopyState.sql);
      setBusinessSqlPreviewFeedback("copied");
    } catch {
      setBusinessSqlPreviewFeedback("copy_failed");
    }
  };

  const insertBusinessSqlPreview = () => {
    if (!businessSqlRenderPreview) return;

    const insertResult = applyBusinessSqlRenderPreviewManualInsert(
      businessSqlRenderPreview,
      editor.value,
    );

    if (!insertResult.inserted) return;

    editor.onChange(insertResult.activeSqlDraft);
    setBusinessSqlPreviewFeedback("inserted");
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

      <div className="sql-tab-task-scope" aria-label="This tab's task scope">
        <div className="sql-tab-task-scope-head">
          <span>This tab's task scope</span>
          <strong>{sqlTabs.activeTabTitle || "Active SQL tab"}</strong>
        </div>
        <p>
          {appliedScopeSummary
            ? `This tab uses: ${appliedScopeSummary}`
            : "No worksheet scope applied to this tab yet. Use SQL Context to choose worksheets for this tab."}
        </p>
        <div className="sql-tab-task-scope-meta" aria-label="Active tab scope status">
          <span>{appliedScopeCount} applied</span>
          {hasUnappliedSelection && (
            <span>{selectedScopeCount} selected, not applied</span>
          )}
          {selectedTemplateLabel && <span>Template: {selectedTemplateLabel}</span>}
        </div>
        <small>
          Each SQL tab keeps its own worksheets, template, and SQL draft. You do not need to
          remove worksheets from another tab.
        </small>
      </div>

      <div className="sql-editor-toolbar sql-command-bar">
        <div className="sql-command-bar-lead">
          {workbookLabel && (
            <span
              className="sql-workbook-badge"
              title={`Workbook: ${workbookLabel}`}
            >
              <span aria-hidden="true" className="sql-workbook-badge-dot" />
              <span className="sql-workbook-badge-label">{workbookLabel}</span>
            </span>
          )}
          {activeSourceLabel && (
            <span
              className="sql-active-source-pill"
              title={`Active source: ${activeSourceLabel}`}
            >
              <span aria-hidden="true" className="sql-active-source-pill-dot" />
              Active · <strong>{activeSourceLabel}</strong>
            </span>
          )}
          {activeSourceTableLabel && (
            <span
              className="sql-active-source-table"
              title={`Source table: ${activeSourceTableLabel}`}
            >
              {activeSourceTableLabel}
            </span>
          )}
          {activeSourceKindLabel && (
            <span className="sql-active-source-kind">{activeSourceKindLabel}</span>
          )}
          {(appliedScopeSummary || selectedScopeSummary) && (
            <span
              className="sql-active-scope-pill"
              title="This scope belongs to the active SQL tab. It helps templates and reports; Run Query still only runs this tab's SQL."
            >
              Scope - <strong>{appliedScopeSummary || selectedScopeSummary}</strong>
            </span>
          )}
          {onToggleContext && (
            <button
              type="button"
              className={["sql-switch-pill", isContextOpen ? "is-on" : ""].filter(Boolean).join(" ")}
              aria-expanded={isContextOpen}
              onClick={onToggleContext}
            >
              Switch <span aria-hidden="true">▾</span>
            </button>
          )}
        </div>
        <div className="sql-actions">
          <div className="sql-dialect-control">
            <label className="sql-dialect-selector">
              <span className="sql-dialect-selector-label">{SQL_DIALECT_SELECTOR_LABEL}</span>
              <select
                value={dialectContext.selectedDialect}
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
              <small>{SQL_DIALECT_EXECUTION_HELPER_TEXT}</small>
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

      {sourceMismatchWarning && (
        <div
          className="sql-source-mismatch-warning"
          role="status"
          aria-live="polite"
        >
          <strong>Tab source differs from executable source.</strong>
          <span>{sourceMismatchWarning}</span>
        </div>
      )}

      {dialectExecutionAdvisory && (
        <div
          className="sql-dialect-execution-advisory"
          role="status"
          aria-live="polite"
        >
          {dialectExecutionAdvisory}
        </div>
      )}

      {readinessReport && (
        <div
          className={[
            "sql-readiness-guard",
            readinessReport.status === "warning" ? "has-warning" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          <div className="sql-readiness-guard-head">
            <span>SQL readiness check</span>
            <strong>
              {readinessReport.status === "ready"
                ? "Ready"
                : readinessReport.status === "warning"
                  ? "Review before running"
                  : "Review note"}
            </strong>
          </div>
          <p>{readinessReport.summary}</p>
          {readinessReport.issues.length > 0 && (
            <ul>
              {readinessReport.issues.slice(0, 4).map((issue) => (
                <li key={issue.id}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {businessSqlRenderPreview && (
        <section
          className={[
            "business-sql-preview-panel",
            `is-${businessSqlRenderPreview.status.replace("_", "-")}`,
          ].join(" ")}
          aria-label="Read-only Business SQL preview"
        >
          <div className="business-sql-preview-head">
            <div>
              <span>Business SQL preview</span>
              <strong>{businessSqlRenderPreview.title}</strong>
            </div>
            <div className="business-sql-preview-badges" aria-label="Preview metadata">
              <em>{businessSqlRenderPreview.status === "ready" ? "Ready" : businessSqlRenderPreview.status === "blocked" ? "Blocked" : "Needs review"}</em>
              <em>DuckDB target</em>
              {businessSqlRenderPreview.guidanceDialect && (
                <em>{businessSqlRenderPreview.guidanceDialect.toUpperCase()} guidance</em>
              )}
            </div>
          </div>
          <p>{businessSqlRenderPreview.body}</p>

          {businessSqlRenderPreview.sql ? (
            <pre className="business-sql-preview-code" aria-label="Read-only rendered SQL">
              {businessSqlRenderPreview.sql}
            </pre>
          ) : (
            <div className="business-sql-preview-empty" aria-label="No rendered SQL">
              {businessSqlPreviewEmptyState?.message ||
                "Business SQL Preview has no generated preview for this task."}
            </div>
          )}

          {(businessSqlRenderPreview.reasons.length > 0 ||
            businessSqlRenderPreview.warnings.length > 0) && (
            <div className="business-sql-preview-review-notes">
              {businessSqlRenderPreview.reasons.length > 0 && (
                <div>
                  <strong>Reasons</strong>
                  <ul>
                    {businessSqlRenderPreview.reasons.slice(0, 4).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {businessSqlRenderPreview.warnings.length > 0 && (
                <div>
                  <strong>Warnings</strong>
                  <ul>
                    {businessSqlRenderPreview.warnings.slice(0, 4).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

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
          <BusinessSqlAdaptiveProposalSection state={businessSqlAdaptiveProposalFallback} />
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
