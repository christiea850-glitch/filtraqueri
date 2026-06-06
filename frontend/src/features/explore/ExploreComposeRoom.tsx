/**
 * E-2 — Explore Compose room.
 *
 * The calm entry state for the Three Rooms Explore redesign. This component is
 * purely presentational; it does not fetch, does not call any backend, does
 * not generate SQL, does not auto-run anything, and does not call any LLM /
 * provider. All inputs and event handlers come from props — the App-level
 * caller owns the question text and the transition into the legacy review
 * stage when the user clicks Ask. Starter prompts only populate the input.
 *
 * The Compose room is rendered when the E-1 state machine reports
 * `isComposeRoom === true`. The legacy QuestionWorkspacePanel +
 * VisualQueryBuilderPanel + answer panel stacks continue to live in App.tsx
 * and are gated with the `hidden` attribute so their mount state survives the
 * room flip. E-3 will redesign the Refine room and condense those stacks.
 */

import { type ChangeEvent, type FormEvent } from "react";

export type ExploreComposeStarterPrompt = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

type ExploreComposeRoomProps = {
  question: string;
  activeScopeLabel: string | null;
  starterPrompts: readonly ExploreComposeStarterPrompt[];
  canAsk: boolean;
  isAskDisabledReason?: string;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onOpenAdvancedBuilder: () => void;
};

function ExploreComposeRoom({
  question,
  activeScopeLabel,
  starterPrompts,
  canAsk,
  isAskDisabledReason,
  onQuestionChange,
  onAsk,
  onOpenAdvancedBuilder,
}: ExploreComposeRoomProps) {
  const handleQuestionInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onQuestionChange(event.target.value);
  };

  const handleStarterClick = (starterPrompt: string) => {
    // Starter cards only populate the input — they never auto-submit, do not
    // generate SQL, and do not call any backend / provider / model.
    onQuestionChange(starterPrompt);
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAsk) return;
    // The Ask action only flips the existing humanAnalyzeStage to "review"
    // via the App-level handler. No query runs at this point — the user still
    // has to press Run query in the existing builder.
    onAsk();
  };

  return (
    <section className="explore-compose-room" aria-label="Compose a question">
      <div className="explore-compose-room-badge" aria-label="Compose, room 1 of 3">
        <span>Room 1 of 3</span>
        <strong>Compose</strong>
      </div>

      <header className="explore-compose-room-header">
        <h1>What would you like to know?</h1>
        <p>
          Ask a business question in your own words. FiltraQueri will suggest a setup before
          anything runs.
        </p>
      </header>

      {activeScopeLabel && (
        <span
          className="explore-compose-room-scope"
          title={`Active scope: ${activeScopeLabel}`}
        >
          <span aria-hidden="true" className="explore-compose-room-scope-dot" />
          Active scope: <strong>{activeScopeLabel}</strong>
        </span>
      )}

      <form
        className="explore-compose-room-composer"
        onSubmit={handleFormSubmit}
        aria-label="Compose your question"
      >
        <label className="explore-compose-room-input" htmlFor="explore-compose-question">
          <span className="explore-compose-room-input-label">Your question</span>
          <textarea
            id="explore-compose-question"
            value={question}
            onChange={handleQuestionInput}
            placeholder="e.g. What were rent payments by property in 2025?"
            rows={3}
          />
        </label>
        <div className="explore-compose-room-actions">
          <button
            type="submit"
            className="primary-button explore-compose-room-ask"
            disabled={!canAsk}
            title={!canAsk ? isAskDisabledReason : undefined}
          >
            Ask &rarr;
          </button>
        </div>
      </form>

      {starterPrompts.length > 0 && (
        <section
          className="explore-compose-room-starters"
          aria-label="Starter business questions"
        >
          <div className="explore-compose-room-starters-heading">
            <p className="section-label">Starter prompts</p>
            <small>Pick one to fill the input. No query runs until you click Ask.</small>
          </div>
          <div className="explore-compose-room-starter-grid">
            {starterPrompts.map((starter) => (
              <button
                key={starter.id}
                type="button"
                className="explore-compose-room-starter"
                onClick={() => handleStarterClick(starter.prompt)}
                aria-label={`Use starter prompt: ${starter.title}`}
              >
                <span className="explore-compose-room-starter-label">Starter</span>
                <strong>{starter.title}</strong>
                <small>{starter.description}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="explore-compose-room-power-user">
        <button
          type="button"
          className="text-button explore-compose-room-advanced"
          onClick={onOpenAdvancedBuilder}
        >
          Open Query Builder &rarr;
        </button>
        <small>For when you want manual control without natural-language prep.</small>
      </div>
    </section>
  );
}

export default ExploreComposeRoom;
