import { useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
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
  const [isSchemaCollapsed, setIsSchemaCollapsed] = useState(false);
  const [isSqlSideCollapsed, setIsSqlSideCollapsed] = useState(false);
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
          <button
            type="button"
            className="panel-collapse-button sql-side-collapse-button"
            onClick={() => setIsSqlSideCollapsed((currentValue) => !currentValue)}
          >
            {isSqlSideCollapsed ? "Show preview" : "Hide preview"}
          </button>
          {!isSqlSideCollapsed && (
            <>
              <SqlPreviewGrid previewResult={previewResult} />
              <SqlGuidancePanel
                diagnostics={sqlAnalysis.diagnostics}
                guidanceCards={sqlAnalysis.explanationCards}
                dialectContext={{ selectedDialectProfile }}
                validation={sqlAnalysis.validation}
              />
              <SqlDraftPanel
                savedDrafts={savedDrafts}
                onLoadDraft={loadDraft}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default SqlWorkspace;
