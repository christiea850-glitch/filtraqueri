import { useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
import WorkbookContextPanel from "../../../components/workbook/WorkbookContextPanel";
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

type BottomTab = "result" | "guidance" | "drafts";

const bottomTabLabels: Record<BottomTab, string> = {
  result: "Result preview",
  guidance: "SQL guidance",
  drafts: "Drafts",
};

const bottomTabOrder: BottomTab[] = ["result", "guidance", "drafts"];

function SqlWorkspace({ dataset, onExecutionResult, metadata, onMetadataChange }: SqlWorkspaceProps) {
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab | null>(null);
  const {
    savedDrafts,
    characterCount,
    editorStatus,
    previewResult,
    templates,
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
  const toggleBottomTab = (tab: BottomTab) => {
    setBottomTab((current) => (current === tab ? null : tab));
  };

  return (
    <section
      className={["sql-workspace-v2", isRailCollapsed ? "is-rail-collapsed" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label="SQL workspace"
    >
      <div className="sqlw-main">
        <div className="sqlw-dockbar">
          <button
            type="button"
            className={["sqlw-pill", isContextOpen ? "is-on" : ""].filter(Boolean).join(" ")}
            aria-expanded={isContextOpen}
            onClick={() => setIsContextOpen((current) => !current)}
          >
            SQL context
          </button>
        </div>

        {isContextOpen && (
          <section className="sqlw-dock sqlw-dock-top" aria-label="SQL context">
            <div className="sqlw-dock-head">
              <span>SQL context</span>
              <button
                type="button"
                className="sqlw-dock-x"
                onClick={() => setIsContextOpen(false)}
                aria-label="Close SQL context"
              >
                Close
              </button>
            </div>
            <div className="sqlw-dock-body">
              <WorkbookContextPanel dataset={dataset} variant="analyst" />
            </div>
          </section>
        )}

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

        {bottomTab && (
          <section className="sqlw-dock sqlw-dock-bot" aria-label="Query output">
            <div className="sqlw-dock-head">
              <span>{bottomTabLabels[bottomTab]}</span>
              <button
                type="button"
                className="sqlw-dock-x"
                onClick={() => setBottomTab(null)}
                aria-label="Close query output"
              >
                Close
              </button>
            </div>
            <div className="sqlw-dock-body">
              {bottomTab === "result" && <SqlPreviewGrid previewResult={previewResult} />}
              {bottomTab === "guidance" && (
                <SqlGuidancePanel
                  diagnostics={sqlAnalysis.diagnostics}
                  guidanceCards={sqlAnalysis.explanationCards}
                  dialectContext={{ selectedDialectProfile }}
                  validation={sqlAnalysis.validation}
                />
              )}
              {bottomTab === "drafts" && (
                <SqlDraftPanel savedDrafts={savedDrafts} onLoadDraft={loadDraft} />
              )}
            </div>
          </section>
        )}

        <div className="sqlw-dockbar sqlw-dockbar-bottom">
          <span className="sqlw-dockbar-label">Query output</span>
          {bottomTabOrder.map((tab) => (
            <button
              type="button"
              key={tab}
              className={["sqlw-pill", bottomTab === tab ? "is-on" : ""].filter(Boolean).join(" ")}
              aria-pressed={bottomTab === tab}
              onClick={() => toggleBottomTab(tab)}
            >
              {bottomTabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      <SqlSchemaPanel
        dataset={dataset}
        templates={templates}
        keywordSuggestions={keywordSuggestions}
        collapsed={isRailCollapsed}
        onToggleCollapsed={() => setIsRailCollapsed((current) => !current)}
        onInsertSql={insertSql}
      />
    </section>
  );
}

export default SqlWorkspace;
