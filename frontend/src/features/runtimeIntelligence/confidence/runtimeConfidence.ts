export type RuntimeConfidenceLevel = "low" | "medium" | "high";

export type RuntimeConfidenceScore = {
  level: RuntimeConfidenceLevel;
  score: number;
  reason: string;
};

export type RuntimeConfidenceSummary = {
  sourceQualityConfidence: RuntimeConfidenceScore;
  semanticConfidence: RuntimeConfidenceScore;
  narrativeConfidence: RuntimeConfidenceScore;
  executionConfidence: RuntimeConfidenceScore;
  feasibilityConfidence: RuntimeConfidenceScore;
  recommendationConfidence: RuntimeConfidenceScore;
  weakestLink: RuntimeConfidenceScore;
  advisoryOnly: true;
};

export const createRuntimeConfidenceScore = (
  score: number,
  reason: string,
): RuntimeConfidenceScore => ({
  score,
  level: score >= 0.75 ? "high" : score >= 0.45 ? "medium" : "low",
  reason,
});

export const createRuntimeConfidenceSummary = (
  values: Partial<Record<keyof Omit<RuntimeConfidenceSummary, "weakestLink" | "advisoryOnly">, RuntimeConfidenceScore>>,
): RuntimeConfidenceSummary => {
  const fallback = createRuntimeConfidenceScore(0.5, "No runtime confidence evidence has been supplied yet.");
  const summary = {
    sourceQualityConfidence: values.sourceQualityConfidence || fallback,
    semanticConfidence: values.semanticConfidence || fallback,
    narrativeConfidence: values.narrativeConfidence || fallback,
    executionConfidence: values.executionConfidence || fallback,
    feasibilityConfidence: values.feasibilityConfidence || fallback,
    recommendationConfidence: values.recommendationConfidence || fallback,
  };
  const weakestLink = Object.values(summary).sort((left, right) => left.score - right.score)[0];

  return {
    ...summary,
    weakestLink,
    advisoryOnly: true,
  };
};
