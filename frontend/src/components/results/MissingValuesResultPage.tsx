import { useState, type FormEvent } from "react";
import type { HumanIntent } from "../dataset/DatasetSummaryPanel";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import { computeMissingValuesSummary } from "../../features/results/computeMissingValuesSummary";

type MissingValuesResultPageProps = {
  dataset: DatasetMetadata;
  activeWorksheetName?: string | null;
  backLabel: string;
  onBack: () => void;
  onContinueExplore: () => void;
  onAskFollowup: () => void;
  onSelectIntent: (intent: HumanIntent) => void;
};

const formatCount = (value: number) => value.toLocaleString();

const formatPercent = (value: number) =>
  `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;

function MissingValuesIcon({ name }: { name: "back" | "search" | "explore" | "complete" }) {
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
      {name === "complete" && (
        <>
          <circle {...commonProps} cx="12" cy="12" r="8" />
          <path {...commonProps} d="m8.5 12.5 2.2 2.2 4.8-5.4" />
        </>
      )}
    </svg>
  );
}

export default function MissingValuesResultPage({
  dataset,
  activeWorksheetName,
  backLabel,
  onBack,
  onContinueExplore,
  onAskFollowup,
  onSelectIntent,
}: MissingValuesResultPageProps) {
  const [followupQuestion, setFollowupQuestion] = useState("");
  const summary = computeMissingValuesSummary(dataset);
  const hasMissingValues = summary.totalMissingCells > 0;
  const visibleWorksheetLabel = activeWorksheetName ? `Active worksheet: ${activeWorksheetName}` : null;

  const submitFollowup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!followupQuestion.trim()) return;
    onAskFollowup();
  };

  return (
    <article className="missing-values-result-page summary-result-page" aria-label="Missing values summary">
      <header className="summary-result-hero">
        <button type="button" className="summary-back-button" onClick={onBack}>
          <MissingValuesIcon name="back" />
          {backLabel}
        </button>
        <div>
          <p className="section-label">Insights · Missing values</p>
          <h2>Missing values in {summary.filename}</h2>
          {visibleWorksheetLabel && <small className="missing-values-active-scope">{visibleWorksheetLabel}</small>}
        </div>
      </header>

      <section
        className={[
          "summary-answer-card",
          "missing-values-answer-card",
          hasMissingValues ? "has-missing-values" : "is-complete",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Missing values answer"
      >
        {!hasMissingValues && (
          <span className="missing-values-success-icon" aria-hidden="true">
            <MissingValuesIcon name="complete" />
          </span>
        )}
        <p className="section-label">Where data is incomplete</p>
        <p>{summary.answer}</p>
      </section>

      <section className="summary-card missing-values-chip-card" aria-label="Missing values summary metrics">
        <dl className="missing-values-summary-chips">
          <div>
            <dt>Percent complete</dt>
            <dd>{formatPercent(summary.percentComplete)}</dd>
          </div>
          <div>
            <dt>Total missing cells</dt>
            <dd>{formatCount(summary.totalMissingCells)}</dd>
          </div>
          <div>
            <dt>Columns with missing values</dt>
            <dd>{formatCount(summary.columnsWithMissing.length)}</dd>
          </div>
          <div>
            <dt>Complete columns</dt>
            <dd>{formatCount(summary.completeColumns.length)}</dd>
          </div>
        </dl>
      </section>

      {hasMissingValues ? (
        <section className="summary-card missing-values-column-card" aria-label="Column quality">
          <div className="summary-section-heading">
            <div>
              <p className="section-label">Column quality</p>
              <h3>Columns with missing values</h3>
            </div>
            <span>Worst first</span>
          </div>
          <div className="missing-values-column-list">
            {summary.columnsWithMissing.map((column) => (
              <article key={`${column.name}-${column.originalIndex}`} className={`is-${column.visualType}`}>
                <div className="missing-values-column-heading">
                  <div>
                    <strong>{column.name}</strong>
                    <span>{column.visualType}</span>
                  </div>
                  <small>
                    {formatCount(column.missingCount)} missing · {formatPercent(column.completenessPercent)} complete
                  </small>
                </div>
                <div className="missing-values-bar-track" aria-hidden="true">
                  <span
                    className="missing-values-bar-fill"
                    style={{ width: `${Math.max(0, Math.min(100, column.completenessPercent))}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="summary-card missing-values-complete-state" aria-label="Complete data profile">
          <span aria-hidden="true">
            <MissingValuesIcon name="complete" />
          </span>
          <div>
            <p className="section-label">Complete profile</p>
            <h3>No missing values reported</h3>
            <p>The available metadata reports every profiled column as complete. No row-level warnings are inferred.</p>
          </div>
        </section>
      )}

      {summary.worksheetSummaries.length > 0 && (
        <section className="summary-card missing-values-worksheet-card" aria-label="Workbook quality">
          <div className="summary-section-heading">
            <div>
              <p className="section-label">Workbook quality</p>
              <h3>Worksheet completeness</h3>
            </div>
            <span>{formatCount(summary.worksheetSummaries.length)} worksheets</span>
          </div>
          <div className="missing-values-worksheet-list">
            {summary.worksheetSummaries.map((worksheet) => (
              <article key={worksheet.id}>
                <div>
                  <strong>{worksheet.name}</strong>
                  <small>
                    {formatCount(worksheet.missingCells)} missing · {formatPercent(worksheet.completenessPercent)} complete
                  </small>
                </div>
                <div className="missing-values-bar-track" aria-hidden="true">
                  <span
                    className="missing-values-bar-fill"
                    style={{ width: `${Math.max(0, Math.min(100, worksheet.completenessPercent))}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="summary-followup-card" aria-label="Follow-up actions">
        <form className="summary-followup-row" onSubmit={submitFollowup}>
          <MissingValuesIcon name="search" />
          <input
            type="text"
            value={followupQuestion}
            onChange={(event) => setFollowupQuestion(event.target.value)}
            placeholder="Ask a follow-up about missing values"
            aria-label="Ask a follow-up about missing values"
          />
          <button type="submit" className="primary-button" disabled={!followupQuestion.trim()}>
            Ask →
          </button>
        </form>
        <div className="summary-action-row">
          <button type="button" className="secondary-button" onClick={onContinueExplore}>
            <MissingValuesIcon name="explore" />
            Continue in Explore
          </button>
          <button
            type="button"
            className="summary-intent-chip"
            onClick={() => onSelectIntent("summary")}
          >
            Summarize this dataset
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
