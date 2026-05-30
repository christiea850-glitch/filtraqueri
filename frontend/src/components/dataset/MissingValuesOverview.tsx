import type { SchemaColumn } from "../../features/dataset/datasetTypes";
import { InlineDisclosure } from "../workspace";

type MissingValuesOverviewProps = {
  schema: SchemaColumn[];
  rowCount: number;
};

type MissingValueRow = {
  name: string;
  missingCount: number;
  missingPercentage: number;
};

const DEFAULT_VISIBLE = 8;
const MIN_BAR_WIDTH_PERCENT = 2;

const formatStat = (row: MissingValueRow) =>
  `${row.missingCount.toLocaleString()} (${row.missingPercentage.toFixed(1)}%)`;

function MissingValuesRow({ row }: { row: MissingValueRow }) {
  const fillWidth = Math.min(100, Math.max(MIN_BAR_WIDTH_PERCENT, row.missingPercentage));

  return (
    <li className="missing-values-row">
      <div className="missing-values-row-head">
        <span className="missing-values-column-name" title={row.name}>
          {row.name}
        </span>
        <span className="missing-values-stats">{formatStat(row)}</span>
      </div>
      <div className="missing-values-bar-track" aria-hidden="true">
        <div className="missing-values-bar-fill" style={{ width: `${fillWidth}%` }} />
      </div>
    </li>
  );
}

function MissingValuesOverview({ schema, rowCount }: MissingValuesOverviewProps) {
  if (!Array.isArray(schema) || schema.length === 0 || rowCount <= 0) return null;

  const columnsWithMissing: MissingValueRow[] = schema
    .filter((column) => (column.null_count || 0) > 0)
    .map((column) => ({
      name: column.name,
      missingCount: column.null_count || 0,
      missingPercentage: ((column.null_count || 0) / rowCount) * 100,
    }))
    .sort((a, b) => b.missingPercentage - a.missingPercentage);

  if (columnsWithMissing.length === 0) return null;

  const visible = columnsWithMissing.slice(0, DEFAULT_VISIBLE);
  const hidden = columnsWithMissing.slice(DEFAULT_VISIBLE);

  return (
    <section
      className="missing-values-overview"
      aria-label="Columns with missing values"
    >
      <div className="missing-values-header">
        <p className="section-label">Missing values</p>
        <span className="missing-values-count">
          {columnsWithMissing.length.toLocaleString()} column
          {columnsWithMissing.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="missing-values-list">
        {visible.map((row) => (
          <MissingValuesRow key={row.name} row={row} />
        ))}
      </ul>
      {hidden.length > 0 && (
        <InlineDisclosure
          summary={`Show ${hidden.length.toLocaleString()} more`}
          className="missing-values-disclosure"
        >
          <ul className="missing-values-list">
            {hidden.map((row) => (
              <MissingValuesRow key={row.name} row={row} />
            ))}
          </ul>
        </InlineDisclosure>
      )}
    </section>
  );
}

export default MissingValuesOverview;
