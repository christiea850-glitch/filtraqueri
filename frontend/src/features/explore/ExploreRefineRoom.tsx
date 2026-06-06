/**
 * E-3 — Explore Refine room.
 *
 * The "confirm setup before running" state of the Three Rooms Explore
 * redesign. This component is purely presentational; it does not fetch, does
 * not call any backend, does not generate SQL, does not auto-run anything,
 * and does not call any LLM / provider. The Run query button calls back into
 * the App-level handler that wires to the existing `runReviewedQueryBuilder`
 * path — the same execution route the legacy VisualQueryBuilderPanel has
 * always used. The Open advanced builder button routes the user to the
 * existing legacy review stack (which contains VisualQueryBuilderPanel) via
 * an App-level state flip; the Refine card is hidden while the user is in
 * the advanced builder, and a "Back to Suggested setup" pill returns them.
 *
 * Setup rows are deterministic, frontend-only summaries of state that
 * already exists in App.tsx (selected columns, group-by, aggregations,
 * filters, sort / limit). No new analysis is run here. Row edit icons route
 * to the advanced builder rather than implementing inline editing in E-3.
 */

import { type ReactNode } from "react";

export type ExploreRefineSetupRow = {
  id: string;
  label: string;
  summary: ReactNode;
  detail?: string;
};

type ExploreRefineRoomProps = {
  question: string;
  activeScopeLabel: string | null;
  setupRows: readonly ExploreRefineSetupRow[];
  readinessLabel?: string;
  canRun: boolean;
  isRunning: boolean;
  runDisabledReason?: string;
  onEditQuestion: () => void;
  onRunQuery: () => void;
  onOpenAdvancedBuilder: () => void;
};

function ExploreRefineRoom({
  question,
  activeScopeLabel,
  setupRows,
  readinessLabel,
  canRun,
  isRunning,
  runDisabledReason,
  onEditQuestion,
  onRunQuery,
  onOpenAdvancedBuilder,
}: ExploreRefineRoomProps) {
  const handleRunClick = () => {
    if (!canRun || isRunning) return;
    // No new execution path — this calls back to the existing safe
    // runReviewedQueryBuilder handler at the App level.
    onRunQuery();
  };

  const trimmedQuestion = question.trim();

  return (
    <section className="explore-refine-room" aria-label="Refine your question setup">
      <div className="explore-refine-room-badge" aria-label="Refine, room 2 of 3">
        <span>Room 2 of 3</span>
        <strong>Refine</strong>
      </div>

      <div className="explore-refine-room-context" aria-label="Active question context">
        {activeScopeLabel && (
          <span
            className="explore-refine-room-scope"
            title={`Active scope: ${activeScopeLabel}`}
          >
            <span aria-hidden="true" className="explore-refine-room-scope-dot" />
            <strong>{activeScopeLabel}</strong>
          </span>
        )}
        {trimmedQuestion.length > 0 ? (
          <span className="explore-refine-room-question-pill" title={trimmedQuestion}>
            <span className="explore-refine-room-question-quote" aria-hidden="true">
              &ldquo;
            </span>
            {trimmedQuestion}
            <span className="explore-refine-room-question-quote" aria-hidden="true">
              &rdquo;
            </span>
          </span>
        ) : (
          <span className="explore-refine-room-question-pill is-empty">
            No question yet — return to Compose to add one.
          </span>
        )}
        <button
          type="button"
          className="explore-refine-room-edit"
          onClick={onEditQuestion}
        >
          &larr; Edit question
        </button>
      </div>

      <article className="explore-refine-room-card" aria-label="Suggested setup">
        <div className="explore-refine-room-card-head">
          <div>
            <p className="section-label">Suggested setup</p>
            <h2>Confirm the setup before running</h2>
          </div>
          {readinessLabel && (
            <span className="explore-refine-room-readiness">{readinessLabel}</span>
          )}
        </div>

        <dl className="explore-refine-room-rows">
          {setupRows.map((row) => (
            <div className="explore-refine-room-row" key={row.id}>
              <dt>{row.label}</dt>
              <dd>
                <span className="explore-refine-room-row-summary">{row.summary}</span>
                {row.detail && (
                  <small className="explore-refine-room-row-detail">{row.detail}</small>
                )}
              </dd>
              <button
                type="button"
                className="explore-refine-room-row-edit"
                onClick={onOpenAdvancedBuilder}
                aria-label={`Edit ${row.label} in advanced builder`}
                title="Edit in advanced builder"
              >
                &#9998;
              </button>
            </div>
          ))}
        </dl>

        <div className="explore-refine-room-card-actions">
          <button
            type="button"
            className="text-button explore-refine-room-advanced-toggle"
            onClick={onOpenAdvancedBuilder}
          >
            Open advanced builder &#9662;
          </button>
          <button
            type="button"
            className="primary-button explore-refine-room-run"
            onClick={handleRunClick}
            disabled={!canRun || isRunning}
            title={!canRun || isRunning ? runDisabledReason : undefined}
          >
            {isRunning ? "Running…" : "▶ Run query"}
          </button>
        </div>
      </article>
    </section>
  );
}

export default ExploreRefineRoom;
