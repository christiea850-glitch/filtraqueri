import { useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import SqlEditorPanel, { SqlDraftPanel } from "./SqlEditorPanel";
import SqlPreviewGrid from "./SqlPreviewGrid";
import SqlSchemaPanel from "./SqlSchemaPanel";
import useSqlWorkspace from "./useSqlWorkspace";

type SqlWorkspaceProps = {
  dataset: DatasetMetadata | null;
  onExecutionResult?: (result: WorkspaceExecutionResult) => void;
};

function SqlWorkspace({ dataset, onExecutionResult }: SqlWorkspaceProps) {
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
    editor,
    insertSql,
    loadDraft,
  } = useSqlWorkspace(dataset, onExecutionResult);

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
