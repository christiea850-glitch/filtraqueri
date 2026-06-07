import SqlEditorHost from "./SqlEditorHost";
import type {
  SqlEditorInterface,
  SqlDialectContext,
  SqlExecutionStatus,
  SqlGuidanceCard,
  SqlQueryExplanation,
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
  isContextOpen?: boolean;
  onToggleContext?: () => void;
};

const statusLabels: Record<SqlExecutionStatus, string> = {
  idle: "Ready",
  "draft-saved": "Query saved to Saved Drafts",
  "explain-ready": "Diagnostics ready",
  running: "Running query",
  success: "Query complete",
  error: "Query failed",
};

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
  isContextOpen,
  onToggleContext,
}: SqlEditorPanelProps) {
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
          <label className="sql-dialect-selector">
            <span>Dialect</span>
            <select
              value={dialectContext.selectedDialect}
              onChange={(event) =>
                dialectContext.onDialectChange(event.target.value as SqlDialectContext["selectedDialect"])
              }
              aria-label="SQL dialect context"
            >
              {dialectContext.dialectOptions.map((dialect) => (
                <option key={dialect.id} value={dialect.id}>
                  {dialect.displayName}
                </option>
              ))}
            </select>
          </label>
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

      <SqlEditorHost editor={editor} />

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
