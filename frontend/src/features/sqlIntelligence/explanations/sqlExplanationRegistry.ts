import { getFunctionCompatibility } from "../functions";
import { getSqlConcept } from "../concepts";
import type { SqlConceptId } from "../types";

export type SqlExplanation = {
  title: string;
  summary: string;
  beginnerNote: string;
  advancedNote: string;
};

export const getSqlConceptExplanation = (conceptId: SqlConceptId): SqlExplanation => {
  const concept = getSqlConcept(conceptId);

  return {
    title: concept.title,
    summary: concept.summary,
    beginnerNote: concept.beginnerNote,
    advancedNote: concept.advancedNote,
  };
};

export const getSqlFunctionExplanation = (functionName: string): SqlExplanation | null => {
  const compatibility = getFunctionCompatibility(functionName);
  if (!compatibility) return null;

  return {
    title: compatibility.canonicalName,
    summary: compatibility.purpose,
    beginnerNote: compatibility.portabilityNotes[0] || "This function transforms values in a query.",
    advancedNote: compatibility.portabilityNotes.join(" "),
  };
};
