/**
 * E-2 — Explore Compose room (E-3-corrected).
 *
 * The calm entry state for the Explore understanding workspace. This
 * component is purely presentational; it does not fetch, does not call any
 * backend, does not generate SQL, does not auto-run anything, and does not
 * call any LLM / provider. Starter prompts only populate the input.
 *
 * After the post-E-3 product-direction correction, Explore is dataset
 * understanding, not query execution. Ask routes the user to the calm
 * Refine room which previews the recommended Analyst path and hands them
 * off. The advanced escape hatch routes directly to Analyst — there is no
 * "Open Query Builder" surface inside Explore anymore.
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
  onContinueInAnalyst: () => void;
};

function ExploreComposeRoom({
  question,
  activeScopeLabel,
  starterPrompts,
  canAsk,
  isAskDisabledReason,
  onQuestionChange,
  onAsk,
  onContinueInAnalyst,
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
          onClick={onContinueInAnalyst}
        >
          Continue in Analyst &rarr;
        </button>
        <small>Skip the recommended path and build manually in Analyst.</small>
      </div>
    </section>
  );
}

export default ExploreComposeRoom;
