import { useState, type FormEvent } from "react";
import type { HumanIntent } from "../dataset/DatasetSummaryPanel";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import { computeTrendsSummary } from "../../features/results/computeTrendsSummary";

type TrendsResultPageProps = {
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

function TrendsIcon({ name }: { name: "back" | "search" | "explore" | "calendar" }) {
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
      {name === "calendar" && (
        <>
          <rect {...commonProps} x="4" y="5" width="16" height="15" rx="2" />
          <path {...commonProps} d="M8 3v4M16 3v4M4 10h16" />
        </>
      )}
    </svg>
  );
}

export default function TrendsResultPage({
  dataset,
  activeWorksheetName,
  backLabel,
  onBack,
  onContinueExplore,
  onAskFollowup,
  onSelectIntent,
}: TrendsResultPageProps) {
  const [followupQuestion, setFollowupQuestion] = useState("");
  const summary = computeTrendsSummary(dataset);
  const visibleWorksheetLabel = activeWorksheetName ? `Active worksheet: ${activeWorksheetName}` : null;
  const hasUsableDateRange = summary.readiness.hasUsableDateRange;

  const submitFollowup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!followupQuestion.trim()) return;
    onAskFollowup();
  };

  return (
    <article className="trends-result-page summary-result-page" aria-label="Trends readiness summary">
      <header className="summary-result-hero">
        <button type="button" className="summary-back-button" onClick={onBack}>
          <TrendsIcon name="back" />
          {backLabel}
        </button>
        <div>
          <p className="section-label">Insights · Trends</p>
          <h2>Trends in {summary.filename}</h2>
          {visibleWorksheetLabel && <small className="missing-values-active-scope">{visibleWorksheetLabel}</small>}
        </div>
      </header>

      <section
        className={[
          "summary-answer-card",
          "trends-answer-card",
          hasUsableDateRange ? "is-ready" : "is-unavailable",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Trends readiness answer"
      >
        <p className="section-label">Trend readiness</p>
        <p>{summary.answer}</p>
      </section>

      <section className="summary-card trends-readiness-card" aria-label="Trend readiness metrics">
        <dl className="missing-values-summary-chips trends-readiness-chips">
          <div>
            <dt>Date fields detected</dt>
            <dd>{formatCount(summary.dateColumnCount)}</dd>
          </div>
          <div>
            <dt>Widest date range</dt>
            <dd>{summary.widestDateRangeColumn ? summary.widestDateRangeColumn.name : "None"}</dd>
          </div>
          <div>
            <dt>Numeric fields available</dt>
            <dd>{formatCount(summary.numericColumnCount)}</dd>
          </div>
          <div>
            <dt>Rows available</dt>
            <dd>{formatCount(summary.rowsAvailable)}</dd>
          </div>
        </dl>
      </section>

      {summary.dateColumns.length > 0 ? (
        <section className="summary-card trends-date-card" aria-label="Date fields">
          <div className="summary-section-heading">
            <div>
              <p className="section-label">Date fields</p>
              <h3>Available time fields</h3>
            </div>
            <span>No time buckets yet</span>
          </div>
          <div className="trends-date-list">
            {summary.dateColumns.map((column) => (
              <article key={`${column.name}-${column.originalIndex}`}>
                <div className="trends-date-heading">
                  <div>
                    <strong>{column.name}</strong>
                    <span>{column.hasValidRange ? "usable range" : "missing range"}</span>
                  </div>
                  <small>
                    {formatCount(column.missingCount)} missing · {formatPercent(column.completenessPercent)} complete
                  </small>
                </div>
                <p>
                  {column.hasValidRange
                    ? `${column.minDate} to ${column.maxDate}`
                    : "The current profile does not include a usable date range for this field."}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="summary-card trends-empty-state" aria-label="No usable date fields">
          <span aria-hidden="true">
            <TrendsIcon name="calendar" />
          </span>
          <div>
            <p className="section-label">No trend chart</p>
            <h3>Trends need a date field</h3>
            <p>No usable date field was detected, so FiltraQueri cannot prepare trend analysis from metadata alone.</p>
          </div>
        </section>
      )}

      {!hasUsableDateRange && (
        <section className="summary-card trends-type-card" aria-label="Detected field types">
          <div className="summary-section-heading">
            <div>
              <p className="section-label">Detected types</p>
              <h3>What the profile can see</h3>
            </div>
          </div>
          <div className="trends-type-grid">
            <span>Date: {formatCount(summary.detectedTypeCounts.date)}</span>
            <span>Numeric: {formatCount(summary.detectedTypeCounts.numeric)}</span>
            <span>Categorical: {formatCount(summary.detectedTypeCounts.categorical)}</span>
            <span>Text: {formatCount(summary.detectedTypeCounts.text)}</span>
            <span>Boolean: {formatCount(summary.detectedTypeCounts.boolean)}</span>
          </div>
        </section>
      )}

      <section className="summary-followup-card" aria-label="Follow-up actions">
        <form className="summary-followup-row" onSubmit={submitFollowup}>
          <TrendsIcon name="search" />
          <input
            type="text"
            value={followupQuestion}
            onChange={(event) => setFollowupQuestion(event.target.value)}
            placeholder="Ask a follow-up about trend readiness"
            aria-label="Ask a follow-up about trend readiness"
          />
          <button type="submit" className="primary-button" disabled={!followupQuestion.trim()}>
            Ask →
          </button>
        </form>
        <div className="summary-action-row">
          <button type="button" className="secondary-button" onClick={onContinueExplore}>
            <TrendsIcon name="explore" />
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
        </div>
      </section>
    </article>
  );
}
