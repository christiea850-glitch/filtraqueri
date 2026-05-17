import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeGovernanceReport,
  RuntimeBridgeGovernanceSummary,
} from "./runtimeBridgeGovernance";
import { summarizeRuntimeBridgeGovernance } from "./runtimeBridgeGovernance";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type {
  RuntimeBridgeNarrativeSequence,
  RuntimeBridgeNarrativeTheme,
  RuntimeBridgeNarrativeTimeline,
} from "./runtimeBridgeNarrativeIntelligence";
import { generateRuntimeBridgeNarrative } from "./runtimeBridgeNarrativeIntelligence";
import type {
  RuntimeBridgeSnapshot,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";

export type RuntimeBridgeInsightSeverity = "low" | "medium" | "high" | "critical";

export type RuntimeBridgeInterpretationTheme =
  | "operational"
  | "financial"
  | "quality"
  | "governance"
  | "confidence"
  | "advisory"
  | "lineage"
  | "evidence"
  | "opportunity"
  | "risk"
  | (string & {});

export type RuntimeBridgeOperationalSignal = {
  readonly signalId: string;
  readonly theme: RuntimeBridgeInterpretationTheme;
  readonly label: string;
  readonly strength: "low" | "medium" | "high";
  readonly sourceSignalIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeBusinessImpact = {
  readonly impactId: string;
  readonly theme: RuntimeBridgeInterpretationTheme;
  readonly severity: RuntimeBridgeInsightSeverity;
  readonly label: string;
  readonly summary: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeRiskIndicator = {
  readonly riskId: string;
  readonly severity: RuntimeBridgeInsightSeverity;
  readonly label: string;
  readonly rationale: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeOpportunityIndicator = {
  readonly opportunityId: string;
  readonly priority: "low" | "medium" | "high";
  readonly label: string;
  readonly rationale: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeRecommendationSummary = {
  readonly recommendationId: string;
  readonly priority: "low" | "medium" | "high";
  readonly label: string;
  readonly summary: string;
  readonly relatedInsightIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeInsightInterpretation = {
  readonly interpretationId: string;
  readonly subjectId: string;
  readonly severity: RuntimeBridgeInsightSeverity;
  readonly themes: ReadonlyArray<RuntimeBridgeInterpretationTheme>;
  readonly operationalSignals: ReadonlyArray<RuntimeBridgeOperationalSignal>;
  readonly businessImpact: RuntimeBridgeBusinessImpact;
  readonly riskIndicators: ReadonlyArray<RuntimeBridgeRiskIndicator>;
  readonly opportunityIndicators: ReadonlyArray<RuntimeBridgeOpportunityIndicator>;
  readonly recommendations: ReadonlyArray<RuntimeBridgeRecommendationSummary>;
  readonly timeline: RuntimeBridgeNarrativeTimeline;
  readonly operationalNarrative: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeInsightInterpretationGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-insight-interpretation",
  label: "Runtime bridge insight interpretation",
  description:
    "Metadata-only business interpretation helpers for RuntimeBridge narrative, governance, confidence, evidence, and advisory metadata.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-business-impact",
    "runtime-bridge-operational-signal",
    "runtime-bridge-risk-indicator",
    "runtime-bridge-opportunity-indicator",
    "runtime-bridge-recommendation-summary",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeInsightInterpretationSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-insight-interpretation",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeInsightInterpretation.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge insight interpretation",
};

const uniqueStable = <T extends string>(items: ReadonlyArray<T>): T[] => {
  const seen = new Set<string>();
  const values: T[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    values.push(item);
  }

  return values;
};

const severityScore = (severity: RuntimeBridgeInsightSeverity) => {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
};

const priorityScore = (priority: "low" | "medium" | "high") => {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const mapNarrativeThemeToInterpretationTheme = (
  theme: RuntimeBridgeNarrativeTheme,
): RuntimeBridgeInterpretationTheme => {
  if (theme === "governance") return "governance";
  if (theme === "confidence") return "confidence";
  if (theme === "advisory") return "advisory";
  if (theme === "lineage" || theme === "relationship") return "lineage";
  if (theme === "evidence") return "evidence";
  if (theme === "quality") return "quality";
  return "operational";
};

const severityFromCounts = ({
  highInsightCount,
  riskSignalCount,
  evidenceCount,
}: {
  readonly highInsightCount: number;
  readonly riskSignalCount: number;
  readonly evidenceCount: number;
}): RuntimeBridgeInsightSeverity => {
  if (riskSignalCount >= 2 && highInsightCount >= 2) return "critical";
  if (riskSignalCount > 0 || highInsightCount >= 2 || evidenceCount >= 12) return "high";
  if (highInsightCount > 0 || evidenceCount >= 5) return "medium";
  return "low";
};

export const summarizeRuntimeBridgeInsightSeverity = (
  narrative: RuntimeBridgeNarrativeSequence,
  governance?: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport,
): RuntimeBridgeInsightSeverity => {
  const highInsightCount = narrative.insights.filter((insight) => insight.priority === "high").length;
  const riskSignalCount = governance && governance.riskClassification !== "safe" ? 1 : 0;
  const evidenceCount = uniqueStable(
    narrative.insights.flatMap((insight) => insight.evidenceReferenceIds),
  ).length;

  return severityFromCounts({ highInsightCount, riskSignalCount, evidenceCount });
};

export const classifyRuntimeBridgeOperationalSignals = (
  narrative: RuntimeBridgeNarrativeSequence,
): ReadonlyArray<RuntimeBridgeOperationalSignal> =>
  narrative.signals.map((signal) => ({
    signalId: createRuntimeBridgeId("runtime-bridge-operational-signal", signal.signalId),
    theme: mapNarrativeThemeToInterpretationTheme(signal.theme),
    label: signal.label,
    strength: signal.strength,
    sourceSignalIds: [signal.signalId],
    evidenceReferenceIds: signal.evidenceReferenceIds,
    metadataOnly: true,
  }));

export const collectRuntimeBridgeInterpretationThemes = (
  narrative: RuntimeBridgeNarrativeSequence,
): ReadonlyArray<RuntimeBridgeInterpretationTheme> =>
  uniqueStable([
    ...narrative.themes.map(mapNarrativeThemeToInterpretationTheme),
    ...narrative.insights.map((insight) => mapNarrativeThemeToInterpretationTheme(insight.theme)),
    narrative.insights.some((insight) => insight.priority === "high") ? "risk" : "",
    narrative.signals.some((signal) => signal.theme === "advisory") ? "opportunity" : "",
  ]);

export const collectRuntimeBridgeRiskIndicators = ({
  narrative,
  governance,
}: {
  readonly narrative: RuntimeBridgeNarrativeSequence;
  readonly governance?: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
}): ReadonlyArray<RuntimeBridgeRiskIndicator> => {
  const insightRisks = narrative.insights
    .filter((insight) => insight.priority === "high")
    .map((insight) => ({
      riskId: createRuntimeBridgeId("runtime-bridge-risk", insight.insightId),
      severity: "high" as const,
      label: insight.label,
      rationale: insight.summary,
      evidenceReferenceIds: insight.evidenceReferenceIds,
      metadataOnly: true as const,
    }));
  const governanceRisk =
    governance && governance.riskClassification !== "safe"
      ? [
          {
            riskId: createRuntimeBridgeId("runtime-bridge-risk", governance.subjectId, "governance"),
            severity:
              governance.riskClassification === "execution_risk" ||
              governance.riskClassification === "orchestration_risk" ||
              governance.riskClassification === "replay_risk"
                ? "critical" as const
                : "medium" as const,
            label: "Governance review signal",
            rationale: `Governance classified the metadata as ${governance.riskClassification}.`,
            evidenceReferenceIds: governance.policyTags.map((tag) =>
              createRuntimeBridgeId("runtime-bridge-policy-tag", tag),
            ),
            metadataOnly: true as const,
          },
        ]
      : [];

  return [...governanceRisk, ...insightRisks].sort(
    (left, right) => severityScore(right.severity) - severityScore(left.severity),
  );
};

export const collectRuntimeBridgeOpportunityIndicators = (
  narrative: RuntimeBridgeNarrativeSequence,
): ReadonlyArray<RuntimeBridgeOpportunityIndicator> =>
  narrative.insights
    .filter((insight) => insight.theme === "advisory" || insight.theme === "evidence")
    .map((insight) => ({
      opportunityId: createRuntimeBridgeId("runtime-bridge-opportunity", insight.insightId),
      priority: insight.priority,
      label: insight.label,
      rationale: insight.summary,
      evidenceReferenceIds: insight.evidenceReferenceIds,
      metadataOnly: true as const,
    }))
    .sort((left, right) => priorityScore(right.priority) - priorityScore(left.priority));

export const summarizeRuntimeBridgeBusinessImpact = ({
  narrative,
  severity,
}: {
  readonly narrative: RuntimeBridgeNarrativeSequence;
  readonly severity: RuntimeBridgeInsightSeverity;
}): RuntimeBridgeBusinessImpact => {
  const themes = collectRuntimeBridgeInterpretationThemes(narrative);
  const evidenceReferenceIds = uniqueStable(
    narrative.insights.flatMap((insight) => insight.evidenceReferenceIds),
  );

  return {
    impactId: createRuntimeBridgeId("runtime-bridge-business-impact", narrative.subjectId),
    theme: themes[0] || "operational",
    severity,
    label: "Runtime bridge business interpretation",
    summary: `Bridge metadata suggests ${severity} descriptive business relevance across ${themes.length} interpretation themes.`,
    evidenceReferenceIds,
    metadataOnly: true,
  };
};

export const prioritizeRuntimeBridgeRecommendations = ({
  narrative,
  risks,
  opportunities,
}: {
  readonly narrative: RuntimeBridgeNarrativeSequence;
  readonly risks: ReadonlyArray<RuntimeBridgeRiskIndicator>;
  readonly opportunities: ReadonlyArray<RuntimeBridgeOpportunityIndicator>;
}): ReadonlyArray<RuntimeBridgeRecommendationSummary> => {
  const riskRecommendations = risks.map((risk) => ({
    recommendationId: createRuntimeBridgeId("runtime-bridge-recommendation", risk.riskId),
    priority: risk.severity === "critical" || risk.severity === "high" ? "high" as const : "medium" as const,
    label: `Review ${risk.label}`,
    summary: "Review the related metadata before future runtime bridge integration.",
    relatedInsightIds: narrative.insights
      .filter((insight) =>
        insight.evidenceReferenceIds.some((evidenceId) => risk.evidenceReferenceIds.includes(evidenceId)),
      )
      .map((insight) => insight.insightId),
    evidenceReferenceIds: risk.evidenceReferenceIds,
    metadataOnly: true as const,
  }));
  const opportunityRecommendations = opportunities.map((opportunity) => ({
    recommendationId: createRuntimeBridgeId("runtime-bridge-recommendation", opportunity.opportunityId),
    priority: opportunity.priority,
    label: `Preserve ${opportunity.label}`,
    summary: "Preserve the related evidence metadata for future human review.",
    relatedInsightIds: narrative.insights
      .filter((insight) =>
        insight.evidenceReferenceIds.some((evidenceId) =>
          opportunity.evidenceReferenceIds.includes(evidenceId),
        ),
      )
      .map((insight) => insight.insightId),
    evidenceReferenceIds: opportunity.evidenceReferenceIds,
    metadataOnly: true as const,
  }));

  return [...riskRecommendations, ...opportunityRecommendations].sort(
    (left, right) => priorityScore(right.priority) - priorityScore(left.priority),
  );
};

export const buildRuntimeBridgeInterpretationTimeline = (
  narrative: RuntimeBridgeNarrativeSequence,
): RuntimeBridgeNarrativeTimeline => ({
  timelineId: createRuntimeBridgeId("runtime-bridge-interpretation-timeline", narrative.subjectId),
  subjectId: narrative.subjectId,
  insightIds: narrative.insights.map((insight) => insight.insightId),
  observationIds: narrative.observations.map((observation) => observation.observationId),
  metadataOnly: true,
});

export const summarizeRuntimeBridgeOperationalNarrative = ({
  interpretationId,
  severity,
  themes,
  signalCount,
  riskCount,
  opportunityCount,
}: {
  readonly interpretationId: string;
  readonly severity: RuntimeBridgeInsightSeverity;
  readonly themes: ReadonlyArray<RuntimeBridgeInterpretationTheme>;
  readonly signalCount: number;
  readonly riskCount: number;
  readonly opportunityCount: number;
}) =>
  `Interpretation "${interpretationId}" describes ${severity} metadata relevance across ${themes.length} themes, ${signalCount} operational signals, ${riskCount} risk indicators, and ${opportunityCount} opportunity indicators.`;

export const interpretRuntimeBridgeInsights = ({
  snapshot,
  nodeId,
  narrative,
  governance,
}: {
  readonly snapshot?: RuntimeBridgeSnapshot;
  readonly nodeId?: string;
  readonly narrative?: RuntimeBridgeNarrativeSequence;
  readonly governance?: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
}): RuntimeBridgeInsightInterpretation => {
  const resolvedNarrative =
    narrative ||
    (snapshot && nodeId
      ? generateRuntimeBridgeNarrative({
          snapshot,
          nodeId,
          governance: governance || summarizeRuntimeBridgeGovernance(snapshot),
        })
      : null);

  if (!resolvedNarrative) {
    const fallbackId = createRuntimeBridgeId("runtime-bridge-interpretation", "missing-narrative");
    return {
      interpretationId: fallbackId,
      subjectId: "missing-narrative",
      severity: "low",
      themes: [],
      operationalSignals: [],
      businessImpact: {
        impactId: createRuntimeBridgeId("runtime-bridge-business-impact", "missing-narrative"),
        theme: "operational",
        severity: "low",
        label: "Runtime bridge business interpretation",
        summary: "No narrative metadata was supplied for interpretation.",
        evidenceReferenceIds: [],
        metadataOnly: true,
      },
      riskIndicators: [],
      opportunityIndicators: [],
      recommendations: [],
      timeline: {
        timelineId: createRuntimeBridgeId("runtime-bridge-interpretation-timeline", "missing-narrative"),
        subjectId: "missing-narrative",
        insightIds: [],
        observationIds: [],
        metadataOnly: true,
      },
      operationalNarrative: "No narrative metadata was supplied for interpretation.",
      metadataOnly: true,
    };
  }

  const resolvedGovernance = governance || (snapshot ? summarizeRuntimeBridgeGovernance(snapshot) : undefined);
  const severity = summarizeRuntimeBridgeInsightSeverity(resolvedNarrative, resolvedGovernance);
  const operationalSignals = classifyRuntimeBridgeOperationalSignals(resolvedNarrative);
  const riskIndicators = collectRuntimeBridgeRiskIndicators({
    narrative: resolvedNarrative,
    governance: resolvedGovernance,
  });
  const opportunityIndicators = collectRuntimeBridgeOpportunityIndicators(resolvedNarrative);
  const recommendations = prioritizeRuntimeBridgeRecommendations({
    narrative: resolvedNarrative,
    risks: riskIndicators,
    opportunities: opportunityIndicators,
  });
  const themes = collectRuntimeBridgeInterpretationThemes(resolvedNarrative);
  const interpretationId = createRuntimeBridgeId(
    "runtime-bridge-insight-interpretation",
    resolvedNarrative.subjectId,
  );

  return {
    interpretationId,
    subjectId: resolvedNarrative.subjectId,
    severity,
    themes,
    operationalSignals,
    businessImpact: summarizeRuntimeBridgeBusinessImpact({
      narrative: resolvedNarrative,
      severity,
    }),
    riskIndicators,
    opportunityIndicators,
    recommendations,
    timeline: buildRuntimeBridgeInterpretationTimeline(resolvedNarrative),
    operationalNarrative: summarizeRuntimeBridgeOperationalNarrative({
      interpretationId,
      severity,
      themes,
      signalCount: operationalSignals.length,
      riskCount: riskIndicators.length,
      opportunityCount: opportunityIndicators.length,
    }),
    metadataOnly: true,
  };
};
