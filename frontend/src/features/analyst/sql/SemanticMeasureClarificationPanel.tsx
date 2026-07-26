import { useEffect, useMemo, useState } from "react";
import type { BusinessSqlMeasureAmbiguity } from "./businessSqlMeasureAmbiguity";

type SemanticMeasureClarificationPanelProps = {
  ambiguity: BusinessSqlMeasureAmbiguity;
  onApplySelection: (optionId: string) => void;
};

export const createSemanticMeasureClarificationPanelViewModel = (
  ambiguity: BusinessSqlMeasureAmbiguity,
) => ({
  prompt: ambiguity.prompt,
  optionLabels: ambiguity.options.map((option) => option.label),
  optionIds: ambiguity.options.map((option) => option.optionId),
  initialSelectedOptionId: null as string | null,
  applyDisabled: true,
  noAutoSelection: true,
  noSqlPreview: true,
  noInsert: true,
  noRun: true,
});

export const createSemanticMeasureClarificationPanelResetKey = (
  ambiguity: BusinessSqlMeasureAmbiguity,
): string =>
  [
    ambiguity.ambiguityId,
    ...ambiguity.options.map((option) => option.optionId),
  ].join("|");

function SemanticMeasureClarificationPanel({
  ambiguity,
  onApplySelection,
}: SemanticMeasureClarificationPanelProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const model = createSemanticMeasureClarificationPanelViewModel(ambiguity);
  const resetKey = createSemanticMeasureClarificationPanelResetKey(ambiguity);
  const optionName = useMemo(
    () => `measure-clarification-${ambiguity.ambiguityId}`,
    [ambiguity.ambiguityId],
  );

  useEffect(() => {
    setSelectedOptionId(null);
  }, [resetKey]);

  return (
    <section
      className="semantic-measure-clarification-panel"
      aria-label="Measure clarification"
    >
      <div className="sql-adaptive-proposal-header">
        <strong>Clarify ranking measure</strong>
        <span className="sql-grounding-badge needs_review">Needs choice</span>
      </div>
      <p>{model.prompt}</p>
      <fieldset>
        <legend>Choose one grounded measure</legend>
        {ambiguity.options.map((option) => (
          <label key={option.optionId} className="semantic-measure-option">
            <input
              type="radio"
              name={optionName}
              value={option.optionId}
              checked={selectedOptionId === option.optionId}
              onChange={() => setSelectedOptionId(option.optionId)}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.evidence}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="sql-assistant-card-foot">
        <small>Selection only. No SQL is previewed, inserted, or run from this panel.</small>
        <button
          type="button"
          className="secondary-button"
          disabled={!selectedOptionId}
          onClick={() => {
            if (selectedOptionId) onApplySelection(selectedOptionId);
          }}
        >
          Apply measure
        </button>
      </div>
    </section>
  );
}

export default SemanticMeasureClarificationPanel;
