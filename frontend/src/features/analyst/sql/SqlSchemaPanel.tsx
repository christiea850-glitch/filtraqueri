import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import {
  WORKBOOK_HEADER_WARNING_COPY,
  getStructuralColumnNotice,
  hasSuspiciousWorkbookHeaders,
} from "../../workbook";

type SqlSchemaPanelProps = {
  dataset: DatasetMetadata | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onInsertSql: (sql: string) => void;
  // Option C — Active tab source-of-truth. When provided, the rail shows
  // the active tab's worksheet schema and label instead of the global
  // dataset's schema, so opening properties / managers / realtors tabs
  // shows the correct columns for each.
  activeSourceLabel?: string | null;
  schemaOverride?: SchemaColumn[];
  columnCountOverride?: number;
};

const getSchemaTypeGroup = (inferredType: string | null | undefined): string => {
  if (inferredType === "numeric") return "numeric";
  if (inferredType === "date") return "date";
  if (inferredType === "categorical") return "categorical";
  return "text";
};

/**
 * K8A-Fix-2: the right-rail "Worksheet tables" picker that previously lived in
 * this panel has been removed. Worksheet activation is now driven solely from
 * the SQL Context centre panel's existing Worksheet tables list (see
 * WorkbookContextPanel). This component now focuses only on its original
 * responsibility: showing the active schema's columns so users can insert
 * column names into the SQL editor.
 */
function SqlSchemaPanel({
  dataset,
  collapsed,
  onToggleCollapsed,
  onInsertSql,
  activeSourceLabel,
  schemaOverride,
  columnCountOverride,
}: SqlSchemaPanelProps) {
  const showHeaderWarning = hasSuspiciousWorkbookHeaders(dataset);
  const structuralColumnNotice = getStructuralColumnNotice(dataset);
  // Option C — Render the active tab's schema when an override is supplied;
  // otherwise fall back to the dataset's global schema for backward
  // compatibility.
  const railSchema: SchemaColumn[] =
    schemaOverride && schemaOverride.length > 0
      ? schemaOverride
      : dataset
        ? dataset.schema
        : [];
  const columnCount =
    typeof columnCountOverride === "number" ? columnCountOverride : railSchema.length;
  const headerLabel = activeSourceLabel ? `Columns · ${activeSourceLabel}` : "Columns";

  return (
    <aside className="sql-context-panel" aria-label="SQL schema intelligence">
      <button
        type="button"
        className="panel-collapse-button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand SQL schema tools" : "Collapse SQL schema tools"}
      >
        {collapsed ? "Schema" : "Hide schema"}
      </button>

      <div className="sql-context-body">
        {structuralColumnNotice ? (
          <p className="workbook-header-warning">{structuralColumnNotice}</p>
        ) : showHeaderWarning ? (
          <p className="workbook-header-warning">{WORKBOOK_HEADER_WARNING_COPY}</p>
        ) : null}

        <div className="sql-helper-section">
          <div className="sql-schema-header">
            <span className="sql-schema-header-label">{headerLabel}</span>
            <span className="sql-schema-header-count" aria-label={`${columnCount} columns`}>
              {columnCount}
            </span>
          </div>
          <div className="schema-list sql-schema-list" aria-label="SQL available columns">
            {dataset && railSchema.length > 0 ? (
              railSchema.map((column) => {
                const typeGroup = getSchemaTypeGroup(column.inferred_type);
                return (
                  <button
                    type="button"
                    className={`schema-pill sql-schema-chip is-type-${typeGroup}`}
                    key={column.name}
                    onClick={() => onInsertSql(`"${column.name.replace(/"/g, '""')}"`)}
                  >
                    <span aria-hidden="true" className="sql-schema-chip-dot" />
                    {column.name}
                    <small>{column.inferred_type}</small>
                  </button>
                );
              })
            ) : dataset ? (
              <p className="sql-helper-empty">No columns available for this source.</p>
            ) : (
              <p className="sql-helper-empty">No dataset open.</p>
            )}
          </div>
        </div>

        {dataset && (
          <p className="sql-schema-helper">
            Click any chip to insert the column name into the editor.
          </p>
        )}
      </div>
    </aside>
  );
}

export default SqlSchemaPanel;
