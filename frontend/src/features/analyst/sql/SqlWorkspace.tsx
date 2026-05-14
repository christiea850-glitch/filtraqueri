import { useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
import WorkspaceTabs from "../../../components/layout/WorkspaceTabs";
import SqlEditorPanel, { SqlDraftPanel, SqlGuidancePanel } from "./SqlEditorPanel";
import SqlPreviewGrid from "./SqlPreviewGrid";
import SqlSchemaPanel from "./SqlSchemaPanel";
import useSqlWorkspace from "./useSqlWorkspace";

type SqlWorkspaceProps = {
  dataset: DatasetMetadata | null;
  onExecutionResult?: (result: WorkspaceExecutionResult) => void;
  metadata?: SqlWorkspaceMetadataSnapshot;
  onMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void;
};

function SqlWorkspace({ dataset, onExecutionResult, metadata, onMetadataChange }: SqlWorkspaceProps) {
  const [isSchemaCollapsed, setIsSchemaCollapsed] = useState(true);
  const [isSqlSideCollapsed, setIsSqlSideCollapsed] = useState(false);
  const [activeAnalystView, setActiveAnalystView] = useState<"sql" | "schema" | "context" | "runtime">("sql");
  const {
    savedDrafts,
    characterCount,
    editorStatus,
    previewResult,
    templates,
    suggestions,
    keywordSuggestions,
    sqlAnalysis,
    selectedDialect,
    selectedDialectProfile,
    dialectOptions,
    setSelectedDialect,
    editor,
    insertSql,
    loadDraft,
  } = useSqlWorkspace(dataset, onExecutionResult, metadata, onMetadataChange);
  const readinessLabel = dataset ? "Dataset context ready" : "Open data to inspect queries";
  const warningCount = sqlAnalysis.validation.diagnostics.length;
  const planStepCount = sqlAnalysis.explanationCards.length + sqlAnalysis.diagnostics.length;
  const analystTabs = [
    { id: "sql", label: "SQL" },
    { id: "schema", label: "Schema" },
    { id: "context", label: "Context" },
    { id: "runtime", label: "Runtime" },
  ] satisfies Array<{ id: "sql" | "schema" | "context" | "runtime"; label: string }>;

  const changeAnalystView = (view: "sql" | "schema" | "context" | "runtime") => {
    setActiveAnalystView(view);
    if (view === "schema") setIsSchemaCollapsed(false);
  };

  return (
    <section
      className={[
        "sql-workspace",
        isSchemaCollapsed ? "is-schema-collapsed" : "",
        isSqlSideCollapsed ? "is-sql-side-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="SQL workspace"
    >
      <section className="sql-inspection-overview" aria-label="SQL inspection overview">
        <div>
          <p className="section-label">Analyst inspection</p>
          <h2>Verify SQL before execution</h2>
          <span>Inspection and verification only. Monaco and execution behavior are unchanged.</span>
        </div>
        <div className="sql-inspection-metrics">
          <span>
            Query generated
            <strong>{characterCount > 0 ? "Draft present" : "No draft"}</strong>
          </span>
          <span>
            Execution plan
            <strong>{planStepCount.toLocaleString()} notes</strong>
          </span>
          <span>
            SQL dialect
            <strong>{selectedDialectProfile.displayName}</strong>
          </span>
          <span>
            Readiness
            <strong>{readinessLabel}</strong>
          </span>
          <span>
            Warnings
            <strong>{warningCount.toLocaleString()}</strong>
          </span>
        </div>
      </section>

      <SqlSchemaPanel
        dataset={dataset}
        columnSuggestions={suggestions}
        templates={templates}
        keywordSuggestions={keywordSuggestions}
        collapsed={isSchemaCollapsed}
        onToggleCollapsed={() => setIsSchemaCollapsed((currentValue) => !currentValue)}
        onInsertSql={insertSql}
      />

      <div className="sql-main-panel">
        <SqlEditorPanel
          editor={editor}
          executionStatus={editorStatus}
          characterCount={characterCount}
          canRunQuery={Boolean(dataset)}
          dialectContext={{
            selectedDialect,
            selectedDialectProfile,
            dialectOptions,
            onDialectChange: setSelectedDialect,
          }}
        />
        <div className="sql-side-panel">
          <WorkspaceTabs
            items={analystTabs}
            activeItem={activeAnalystView}
            label="Analyst workspace views"
            onChange={changeAnalystView}
          />
          <button
            type="button"
            className="panel-collapse-button sql-side-collapse-button"
            onClick={() => setIsSqlSideCollapsed((currentValue) => !currentValue)}
          >
            {isSqlSideCollapsed ? "Show preview" : "Hide preview"}
          </button>
          {!isSqlSideCollapsed && (
            <>
              {activeAnalystView === "sql" && <SqlPreviewGrid previewResult={previewResult} />}
              {activeAnalystView === "schema" && (
                <section className="sql-draft-panel" aria-label="Schema view">
                  <div className="sql-draft-list">
                    <div className="builder-block-header">
                      <span>Schema</span>
                      <small>{isSchemaCollapsed ? "Collapsed" : "Open"}</small>
                    </div>
                    <p>Use the schema rail on the left to inspect columns, suggestions, keywords, and templates.</p>
                  </div>
                </section>
              )}
              {activeAnalystView === "context" && (
                <SqlGuidancePanel
                  diagnostics={sqlAnalysis.diagnostics}
                  guidanceCards={sqlAnalysis.explanationCards}
                  dialectContext={{ selectedDialectProfile }}
                  validation={sqlAnalysis.validation}
                />
              )}
              {activeAnalystView === "runtime" && (
                <SqlDraftPanel
                  savedDrafts={savedDrafts}
                  onLoadDraft={loadDraft}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default SqlWorkspace;
