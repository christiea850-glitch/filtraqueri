/**
 * E-3 (corrected) — Explore Refine room.
 *
 * After the product-direction correction, Explore is part of the dataset
 * understanding workspace and is NOT a query execution surface. The Refine
 * room therefore renders a **Recommended path** preview — what an Analyst
 * build of this question would look like — and hands the user off to Analyst
 * via a single calm Continue button. There is no Run query button, no
 * VisualQueryBuilderPanel embed, no ✎ inline-edit icons that route to a
 * builder, and no advanced-builder disclosure.
 *
 * This component is purely presentational; it does not fetch, does not call
 * any backend, does not generate SQL, does not auto-run anything, and does
 * not call any LLM / provider. Continuing in Analyst is the App-level
 * caller's responsibility — that handler switches workspace mode and routes
 * to the existing Analyst SQL workspace, where the user runs queries
 * manually with the existing Run Query button.
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
  canContinueInAnalyst: boolean;
  continueDisabledReason?: string;
  onEditQuestion: () => void;
  onContinueInAnalyst: () => void;
};

function ExploreRefineRoom({
  question,
  activeScopeLabel,
  setupRows,
  readinessLabel,
  canContinueInAnalyst,
  continueDisabledReason,
  onEditQuestion,
  onContinueInAnalyst,
}: ExploreRefineRoomProps) {
  const handleContinueClick = () => {
    if (!canContinueInAnalyst) return;
    // No execution here — this routes the user to the Analyst workspace
    // where Run Query lives.
    onContinueInAnalyst();
  };

  const trimmedQuestion = question.trim();

  return (
    <section className="explore-refine-room" aria-label="Recommended analysis path">
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

      <article className="explore-refine-room-card" aria-label="Recommended analysis path">
        <div className="explore-refine-room-card-head">
          <div>
            <p className="section-label">Recommended path</p>
            <h2>What an Analyst build of this would look like</h2>
          </div>
          {readinessLabel && (
            <span className="explore-refine-room-readiness">{readinessLabel}</span>
          )}
        </div>

        <p className="explore-refine-room-handoff-note">
          Explore is for understanding the data — running queries lives in Analyst.
          Continue when you&rsquo;re ready to build and run this manually.
        </p>

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
            </div>
          ))}
        </dl>

        <div className="explore-refine-room-card-actions">
          <span className="explore-refine-room-handoff-helper">
            Manual control, manual Run Query — same governance as today.
          </span>
          <button
            type="button"
            className="primary-button explore-refine-room-continue"
            onClick={handleContinueClick}
            disabled={!canContinueInAnalyst}
            title={!canContinueInAnalyst ? continueDisabledReason : undefined}
          >
            Continue in Analyst &rarr;
          </button>
        </div>
      </article>
    </section>
  );
}

export default ExploreRefineRoom;
