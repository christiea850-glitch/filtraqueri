import { useState, type FormEvent } from "react";
import type { HumanIntent } from "../dataset/DatasetSummaryPanel";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import { computeTopCategoriesSummary } from "../../features/results/computeTopCategoriesSummary";

type TopCategoriesResultPageProps = {
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

function TopCategoriesIcon({ name }: { name: "back" | "search" | "explore" | "categories" }) {
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
      {name === "categories" && (
        <>
          <path {...commonProps} d="M5 7h14M5 12h10M5 17h7" />
          <path {...commonProps} d="M18 12h1M15 17h4" />
        </>
      )}
    </svg>
  );
}

const emptyTitle = (reason: ReturnType<typeof computeTopCategoriesSummary>["emptyReason"]) => {
  if (reason === "only_identifiers") return "Only identifier-like fields were detected";
  if (reason === "top_values_unavailable") return "Top-value counts are unavailable";
  if (reason === "row_count_zero") return "No rows available for category counts";
  return "No categorical fields detected";
};

export default function TopCategoriesResultPage({
  dataset,
  activeWorksheetName,
  backLabel,
  onBack,
  onContinueExplore,
  onAskFollowup,
  onSelectIntent,
}: TopCategoriesResultPageProps) {
  const [followupQuestion, setFollowupQuestion] = useState("");
  const summary = computeTopCategoriesSummary(dataset);
  const hasUsableCategories = summary.categoryColumns.length > 0;
  const visibleWorksheetLabel = activeWorksheetName ? `Active worksheet: ${activeWorksheetName}` : null;

  const submitFollowup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!followupQuestion.trim()) return;
    onAskFollowup();
  };

  return (
    <article className="top-categories-result-page summary-result-page" aria-label="Top categories summary">
      <header className="summary-result-hero">
        <button type="button" className="summary-back-button" onClick={onBack}>
          <TopCategoriesIcon name="back" />
          {backLabel}
        </button>
        <div>
          <p className="section-label">Insights · Top categories</p>
          <h2>Top categories in {summary.filename}</h2>
          {visibleWorksheetLabel && <small className="missing-values-active-scope">{visibleWorksheetLabel}</small>}
        </div>
      </header>

      <section
        className={[
          "summary-answer-card",
          "top-categories-answer-card",
          hasUsableCategories ? "has-categories" : "is-empty",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Top categories answer"
      >
        <p className="section-label">Most common values</p>
        <p>{summary.answer}</p>
      </section>

      <section className="summary-card top-categories-chip-card" aria-label="Top categories metrics">
        <dl className="missing-values-summary-chips top-categories-summary-chips">
          <div>
            <dt>Categorical fields</dt>
            <dd>{formatCount(summary.categoryColumnCount)}</dd>
          </div>
          <div>
            <dt>Fields with top values</dt>
            <dd>{formatCount(summary.usableCategoryColumnCount)}</dd>
          </div>
          <div>
            <dt>Identifiers excluded</dt>
            <dd>{formatCount(summary.excludedIdentifierCount)}</dd>
          </div>
          <div>
            <dt>Highest repeated category</dt>
            <dd>{summary.strongestCategory ? formatPercent(summary.strongestCategory.percent) : "None"}</dd>
          </div>
        </dl>
      </section>

      {hasUsableCategories ? (
        <section className="summary-card top-categories-distribution-card" aria-label="Category distributions">
          <div className="summary-section-heading">
            <div>
              <p className="section-label">Category distributions</p>
              <h3>Most common values by field</h3>
            </div>
            <span>Top 5 values</span>
          </div>
          <div className="top-categories-column-list">
            {summary.categoryColumns.map((column) => (
              <article key={`${column.name}-${column.originalIndex}`}>
                <div className="top-categories-column-heading">
                  <div>
                    <strong>{column.name}</strong>
                    <span>{column.inferredType === "boolean" ? "categorical" : column.inferredType}</span>
                  </div>
                  <small>{formatCount(column.uniqueCount)} unique values</small>
                </div>
                <div className="top-categories-value-list">
                  {column.topValues.map((topValue) => (
                    <div key={`${column.name}-${topValue.value}`} className="top-categories-value-row">
                      <div>
                        <strong>{topValue.value}</strong>
                        <small>
                          {formatCount(topValue.count)} rows · {formatPercent(topValue.percent)}
                        </small>
                      </div>
                      <div className="top-categories-bar-track" aria-hidden="true">
                        <span
                          className="top-categories-bar-fill"
                          style={{ width: `${Math.max(0, Math.min(100, topValue.percent))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {column.other && column.other.count > 0 && (
                    <div className="top-categories-value-row is-other">
                      <div>
                        <strong>Other</strong>
                        <small>
                          {formatCount(column.other.count)} rows · {formatPercent(column.other.percent)}
                        </small>
                      </div>
                      <div className="top-categories-bar-track" aria-hidden="true">
                        <span
                          className="top-categories-bar-fill"
                          style={{ width: `${Math.max(0, Math.min(100, column.other.percent))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="summary-card top-categories-empty-state" aria-label="No category distributions">
          <span aria-hidden="true">
            <TopCategoriesIcon name="categories" />
          </span>
          <div>
            <p className="section-label">No category chart</p>
            <h3>{emptyTitle(summary.emptyReason)}</h3>
            <p>{summary.answer}</p>
          </div>
        </section>
      )}

      <section className="summary-followup-card" aria-label="Follow-up actions">
        <form className="summary-followup-row" onSubmit={submitFollowup}>
          <TopCategoriesIcon name="search" />
          <input
            type="text"
            value={followupQuestion}
            onChange={(event) => setFollowupQuestion(event.target.value)}
            placeholder="Ask a follow-up about top categories"
            aria-label="Ask a follow-up about top categories"
          />
          <button type="submit" className="primary-button" disabled={!followupQuestion.trim()}>
            Ask →
          </button>
        </form>
        <div className="summary-action-row">
          <button type="button" className="secondary-button" onClick={onContinueExplore}>
            <TopCategoriesIcon name="explore" />
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
            onClick={() => onSelectIntent("trends")}
          >
            Check trends
          </button>
        </div>
      </section>
    </article>
  );
}
