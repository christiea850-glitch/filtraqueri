import type { NarrativeSeverity } from "./narrativeTypes";

export const scoreSeverity = ({
  ratio = 0,
  operationalRelevance = 0,
  variance = 0,
}: {
  ratio?: number;
  operationalRelevance?: number;
  variance?: number;
}): NarrativeSeverity => {
  const impact = Math.max(ratio, variance) + operationalRelevance;

  if (impact >= 0.92 || ratio >= 0.85) return "critical";
  if (impact >= 0.72 || ratio >= 0.65) return "high";
  if (impact >= 0.42 || ratio >= 0.3) return "medium";
  return "low";
};

export const severityRank = (severity: NarrativeSeverity) =>
  ({ critical: 4, high: 3, medium: 2, low: 1 })[severity];
