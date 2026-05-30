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
  isHighBlankRate: boolean;
};

const DEFAULT_VISIBLE = 8;
const MIN_BAR_WIDTH_PERCENT = 2;
const HIGH_BLANK_THRESHOLD_PERCENT = 70;
const REPEATED_PATTERN_MIN_COLUMNS = 3;
const REPEATED_PATTERN_TOLERANCE_PERCENT = 1;

const formatStat = (row: MissingValueRow) =>
  `${row.missingCount.toLocaleString()} (${row.missingPercentage.toFixed(1)}%)`;

const detectRepeatedHighBlankPattern = (rows: MissingValueRow[]): boolean => {
  const highRows = rows.filter(
    (row) => row.missingPercentage >= HIGH_BLANK_THRESHOLD_PERCENT,
  );
  if (highRows.length < REPEATED_PATTERN_MIN_COLUMNS) return false;

  const highest = highRows[0].missingPercentage;
  const lowest = highRows[highRows.length - 1].missingPercentage;
  return highest - lowest <= REPEATED_PATTERN_TOLERANCE_PERCENT;
};

function MissingValuesRow({ row }: { row: MissingValueRow }) {
  const fillWidth = Math.min(100, Math.max(MIN_BAR_WIDTH_PERCENT, row.missingPercentage));

  return (
    <li className={`missing-values-row${row.isHighBlankRate ? " is-high-blank" : ""}`}>
      <div className="missing-values-row-head">
        <span className="missing-values-column-name" title={row.name}>
          {row.name}
        </span>
        <span className="missing-values-stats">{formatStat(row)}</span>
      </div>
      <div className="missing-values-bar-track" aria-hidden="true">
        <div className="missing-values-bar-fill" style={{ width: `${fillWidth}%` }} />
      </div>
      {row.isHighBlankRate && (
        <p className="missing-values-row-hint">High blank rate — review before analysis.</p>
      )}
    </li>
  );
}

function MissingValuesOverview({ schema, rowCount }: MissingValuesOverviewProps) {
  if (!Array.isArray(schema) || schema.length === 0 || rowCount <= 0) return null;

  const columnsWithMissing: MissingValueRow[] = schema
    .filter((column) => (column.null_count || 0) > 0)
    .map((column) => {
      const missingPercentage = ((column.null_count || 0) / rowCount) * 100;
      return {
        name: column.name,
        missingCount: column.null_count || 0,
        missingPercentage,
        isHighBlankRate: missingPercentage >= HIGH_BLANK_THRESHOLD_PERCENT,
      };
    })
    .sort((a, b) => b.missingPercentage - a.missingPercentage);

  if (columnsWithMissing.length === 0) return null;

  const visible = columnsWithMissing.slice(0, DEFAULT_VISIBLE);
  const hidden = columnsWithMissing.slice(DEFAULT_VISIBLE);
  const showRepeatedPatternNote = detectRepeatedHighBlankPattern(columnsWithMissing);

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
      <p className="missing-values-caption">
        Bars show how many rows have no value in each column.
      </p>
      <p className="missing-values-caution">
        For formatted Excel templates, blanks may be layout space or future-entry rows, not true missing data.
      </p>
      {showRepeatedPatternNote && (
        <p className="missing-values-pattern-note">
          Several columns have the same high blank rate. This may mean the sheet contains template rows or repeated sections.
        </p>
      )}
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
