import { useState, type FormEvent } from "react";
import type { HumanIntent } from "../dataset/DatasetSummaryPanel";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import { computeDatasetSummary } from "../../features/results/computeDatasetSummary";

type SummaryResultPageProps = {
  dataset: DatasetMetadata;
  activeWorksheetName?: string | null;
  backLabel: string;
  onBack: () => void;
  onContinueExplore: () => void;
  onAskFollowup: () => void;
  onSelectIntent: (intent: HumanIntent) => void;
};

function SummaryIcon({ name }: { name: "back" | "search" | "explore" }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === "back" && <path {...commonProps} d="m15 18-6-6 6-6" />}
      {name === "search" && (
        <>
          <circle {...commonProps} cx="11" cy="11" r="6" />
          <path {...commonProps} d="m16 16 4 4" />
        </>
      )}
      {name === "explore" && (
        <>
          <path {...commonProps} d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <circle {...commonProps} cx="12" cy="12" r="4" />
        </>
      )}
    </svg>
  );
}

export default function SummaryResultPage({
  dataset,
  activeWorksheetName,
  backLabel,
  onBack,
  onContinueExplore,
  onAskFollowup,
  onSelectIntent,
}: SummaryResultPageProps) {
  const [followupQuestion, setFollowupQuestion] = useState("");
  const summary = computeDatasetSummary({ dataset, activeWorksheetName });
  const totalProfiledColumns = Math.max(
    1,
    summary.typeBreakdown.reduce((total, item) => total + item.count, 0),
  );

  const submitFollowup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!followupQuestion.trim()) return;
    onAskFollowup();
  };

  return (
    <article className="summary-result-page" aria-label="Dataset summary">
      <header className="summary-result-hero">
        <button type="button" className="summary-back-button" onClick={onBack}>
          <SummaryIcon name="back" />
          {backLabel}
        </button>
        <div>
          <p className="section-label">Insights · Summary</p>
          <h2>Summary of {summary.filename}</h2>
        </div>
      </header>

      <section className="summary-answer-card" aria-label="Summary answer">
        <p className="section-label">What you have</p>
        <p>{summary.headline}</p>
      </section>

      <section className="summary-card" aria-label="Column type breakdown">
        <div className="summary-section-heading">
          <div>
            <p className="section-label">Column shape</p>
            <h3>Field types in this dataset</h3>
          </div>
          <span>{summary.typeBreakdown.length.toLocaleString()} detected groups</span>
        </div>
        <div className="summary-type-bar" aria-hidden="true">
          {summary.typeBreakdown.map((item) => (
            <span
              key={item.kind}
              className={`summary-type-segment is-${item.kind}`}
              style={{ flexGrow: item.count, flexBasis: `${(item.count / totalProfiledColumns) * 100}%` }}
            />
          ))}
        </div>
        <div className="summary-type-legend">
          {summary.typeBreakdown.map((item) => (
            <span key={item.kind}>
              <i className={`summary-type-dot is-${item.kind}`} aria-hidden="true" />
              {item.label}: {item.count.toLocaleString()}
            </span>
          ))}
        </div>
      </section>

      {summary.notableColumns.length > 0 && (
        <section className="summary-card" aria-label="Notable columns">
          <div className="summary-section-heading">
            <div>
              <p className="section-label">Notable columns</p>
              <h3>Useful signals already in the metadata</h3>
            </div>
          </div>
          <div className="summary-notable-grid">
            {summary.notableColumns.map((column) => (
              <article key={`${column.kind}-${column.columnName}`}>
                <span>{column.label}</span>
                <strong>{column.columnName}</strong>
                <p>{column.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {summary.worksheetRows.length > 0 && (
        <section className="summary-card" aria-label="Worksheet breakdown">
          <div className="summary-section-heading">
            <div>
              <p className="section-label">Workbook</p>
              <h3>Worksheet breakdown</h3>
            </div>
            <span>{summary.worksheetRows.length.toLocaleString()} worksheets</span>
          </div>
          <div className="summary-worksheet-list">
            {summary.worksheetRows.map((worksheet) => (
              <span
                key={worksheet.id}
                className={worksheet.isActive ? "is-active" : ""}
              >
                <strong>{worksheet.name}</strong>
                <small>
                  {worksheet.rowCount.toLocaleString()} rows · {worksheet.columnCount.toLocaleString()} columns
                </small>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="summary-followup-card" aria-label="Follow-up actions">
        <form className="summary-followup-row" onSubmit={submitFollowup}>
          <SummaryIcon name="search" />
          <input
            type="text"
            value={followupQuestion}
            onChange={(event) => setFollowupQuestion(event.target.value)}
            placeholder="Ask a follow-up about this dataset"
            aria-label="Ask a follow-up about this dataset"
          />
          <button type="submit" className="primary-button" disabled={!followupQuestion.trim()}>
            Ask →
          </button>
        </form>
        <div className="summary-action-row">
          <button type="button" className="secondary-button" onClick={onContinueExplore}>
            <SummaryIcon name="explore" />
            Continue in Explore
          </button>
          <button
            type="button"
            className="summary-intent-chip"
            onClick={() => onSelectIntent("missing_values")}
          >
            Show missing values
          </button>
          <button
            type="button"
            className="summary-intent-chip"
            onClick={() => onSelectIntent("top_categories")}
          >
            View top categories
          </button>
          <button
            type="button"
            className="summary-intent-chip"
            onClick={() => onSelectIntent("trends")}
          >
            Check trends
          </button>
        </div>
      </section>
    </article>
  );
}
