import type { DatasetMetadata } from "../../dataset/datasetTypes";
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
  // Optional active worksheet label shown in the rail header
  // ("Columns · {sheet}") so the rail matches the routing mockup.
  activeSourceLabel?: string | null;
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
}: SqlSchemaPanelProps) {
  const showHeaderWarning = hasSuspiciousWorkbookHeaders(dataset);
  const structuralColumnNotice = getStructuralColumnNotice(dataset);
  const columnCount = dataset ? dataset.schema.length : 0;
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
            {dataset ? (
              dataset.schema.map((column) => {
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
