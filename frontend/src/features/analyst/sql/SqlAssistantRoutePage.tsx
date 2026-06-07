import type { ActiveView, DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
import SqlAssistantPanel, { type SqlAssistantMode } from "./SqlAssistantPanel";
import useSqlWorkspace from "./useSqlWorkspace";

type SqlAssistantRoutePageKind = "templates" | "reports";

type SqlAssistantRoutePageProps = {
  dataset: DatasetMetadata | null;
  metadata?: SqlWorkspaceMetadataSnapshot;
  onMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void;
  kind: SqlAssistantRoutePageKind;
  requestedMode?: SqlAssistantMode | null;
  onAnalystViewChange?: (view: ActiveView) => void;
};

const templateModes: SqlAssistantMode[] = ["templates", "assist"];
const reportModes: SqlAssistantMode[] = ["recipes"];

const pageCopy: Record<
  SqlAssistantRoutePageKind,
  {
    label: string;
    title: string;
    description: string;
    bannerTitle: string;
    bannerText: string;
    note: string;
  }
> = {
  templates: {
    label: "Analyst - Browse Templates",
    title: "SQL patterns",
    description:
      "Pick a starting point from the Template Library or use Complex SQL Assist. Inserts return to Inspect SQL for review.",
    bannerTitle: "Browse Templates",
    bannerText:
      "Find the right SQL pattern without knowing the syntax. Search filters, joins, summaries, date logic, missing records, and data-quality checks.",
    note: "Selecting a template inserts SQL into Inspect SQL only. Run query stays manual.",
  },
  reports: {
    label: "Analyst - Browse Reports",
    title: "Reports for this dataset",
    description:
      "Review deterministic recipes and local metadata-only AI preview suggestions in one gallery.",
    bannerTitle: "Browse Reports",
    bannerText:
      "Turn your dataset into business-ready reports. Use deterministic recipes or review metadata-only AI suggestions before any draft is created.",
    note: "Deterministic reports can insert SQL into Inspect SQL. AI preview cards do not insert SQL.",
  },
};

function SqlAssistantRoutePage({
  dataset,
  metadata,
  onMetadataChange,
  kind,
  requestedMode,
  onAnalystViewChange,
}: SqlAssistantRoutePageProps) {
  const {
    selectedDialect,
    selectedDialectProfile,
    sqlTabs,
    insertSql,
  } = useSqlWorkspace(dataset, undefined, metadata, onMetadataChange);
  const copy = pageCopy[kind];
  const allowedModes = kind === "templates" ? templateModes : reportModes;
  const activeSourceLabel = sqlTabs.activeTabTitle || "No active SQL tab";

  const insertAndReturnToInspectSql = (sql: string) => {
    insertSql(sql);
    onAnalystViewChange?.("sqlWorkspace");
  };

  return (
    <section className="sql-assistant-route-page" aria-label={copy.title}>
      <div className="analyst-page-banner">
        <p className="section-label">Analyst workspace</p>
        <h2>{copy.bannerTitle}</h2>
        <p>{copy.bannerText}</p>
      </div>

      <div className="sql-assistant-route-topbar">
        <span className="sql-route-source-pill">
          {dataset?.original_filename || "No dataset open"}
        </span>
        <span className="sql-route-source-pill is-active">
          Active tab - {activeSourceLabel}
        </span>
        {sqlTabs.activeTabSourceKind && (
          <span className="sql-route-source-pill">
            {sqlTabs.activeTabSourceKind}
          </span>
        )}
        <span>{copy.note}</span>
      </div>

      <div className="sql-assistant-route-header">
        <div>
          <p className="section-label">{copy.label}</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      <SqlAssistantPanel
        dataset={dataset}
        selectedDialect={selectedDialect}
        selectedDialectProfile={selectedDialectProfile}
        onInsertSql={insertAndReturnToInspectSql}
        requestedMode={kind === "reports" ? "recipes" : requestedMode}
        allowedModes={allowedModes}
      />
    </section>
  );
}

export default SqlAssistantRoutePage;
