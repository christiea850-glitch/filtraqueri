import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeConfidenceExplanation,
  RuntimeBridgeExplanationSummary,
  RuntimeBridgeNarrativeSummary,
} from "./runtimeBridgeExplainability";
import {
  collectRuntimeBridgeConfidenceFactors,
  summarizeRuntimeBridgeExplanation,
  summarizeRuntimeBridgeNarrative,
} from "./runtimeBridgeExplainability";
import type {
  RuntimeBridgeGovernanceReport,
  RuntimeBridgeGovernanceSummary,
} from "./runtimeBridgeGovernance";
import { summarizeRuntimeBridgeGovernance } from "./runtimeBridgeGovernance";
import {
  findRuntimeBridgeAdvisoriesForNode,
  traceRuntimeBridgeLineage,
  type RuntimeBridgeRelationshipTrace,
} from "./runtimeBridgeLineage";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeConfidence,
  RuntimeBridgeSnapshot,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";

export type RuntimeBridgeNarrativeTheme =
  | "lineage"
  | "evidence"
  | "governance"
  | "confidence"
  | "advisory"
  | "relationship"
  | "quality"
  | (string & {});

export type RuntimeBridgeNarrativeSignal = {
  readonly signalId: string;
  readonly theme: RuntimeBridgeNarrativeTheme;
  readonly label: string;
  readonly strength: "low" | "medium" | "high";
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeNarrativeObservation = {
  readonly observationId: string;
  readonly theme: RuntimeBridgeNarrativeTheme;
  readonly label: string;
  readonly description: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly signalIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeNarrativeInsight = {
  readonly insightId: string;
  readonly priority: "low" | "medium" | "high";
  readonly theme: RuntimeBridgeNarrativeTheme;
  readonly label: string;
  readonly summary: string;
  readonly observationIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeNarrativeTimeline = {
  readonly timelineId: string;
  readonly subjectId: string;
  readonly insightIds: ReadonlyArray<string>;
  readonly observationIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeNarrativeSequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly summary: RuntimeBridgeNarrativeSummary;
  readonly themes: ReadonlyArray<RuntimeBridgeNarrativeTheme>;
  readonly signals: ReadonlyArray<RuntimeBridgeNarrativeSignal>;
  readonly observations: ReadonlyArray<RuntimeBridgeNarrativeObservation>;
  readonly insights: ReadonlyArray<RuntimeBridgeNarrativeInsight>;
  readonly timeline: RuntimeBridgeNarrativeTimeline;
  readonly metadataOnly: true;
};

export const runtimeBridgeNarrativeIntelligenceGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-narrative-intelligence",
  label: "Runtime bridge narrative intelligence",
  description:
    "Metadata-only narrative utilities for RuntimeBridge explainability, evidence, lineage, governance, confidence, and advisory metadata.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-narrative-sequence",
    "runtime-bridge-narrative-observation",
    "runtime-bridge-narrative-insight",
    "runtime-bridge-narrative-theme",
    "runtime-bridge-narrative-signal",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeNarrativeIntelligenceSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-narrative-intelligence",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeNarrativeIntelligence.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge narrative intelligence",
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

const priorityScore = (priority: RuntimeBridgeNarrativeInsight["priority"]) => {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const confidenceStrength = (
  confidence: RuntimeBridgeConfidenceExplanation["level"],
): RuntimeBridgeNarrativeSignal["strength"] => {
  if (confidence === "high") return "high";
  if (confidence === "medium") return "medium";
  return "low";
};

export const collectRuntimeBridgeNarrativeEvidence = (
  explanation: RuntimeBridgeExplanationSummary,
): ReadonlyArray<string> => explanation.evidenceReferenceIds;

export const collectRuntimeBridgeNarrativeRelationships = (
  trace: RuntimeBridgeRelationshipTrace,
): ReadonlyArray<string> =>
  uniqueStable([
    ...trace.ancestorNodeIds,
    ...trace.descendantNodeIds,
    ...trace.incomingEdgeIds,
    ...trace.outgoingEdgeIds,
    ...trace.relatedReferenceIds,
  ]);

export const summarizeRuntimeBridgeConfidenceNarrative = (
  confidenceFactors: ReadonlyArray<RuntimeBridgeConfidenceExplanation>,
): RuntimeBridgeNarrativeObservation => {
  const strongestConfidence = confidenceFactors.find((confidence) => confidence.level === "high");
  const weakestConfidence =
    confidenceFactors.find((confidence) => confidence.level === "low") ||
    confidenceFactors.find((confidence) => confidence.level === "unknown");

  return {
    observationId: createRuntimeBridgeId("runtime-bridge-confidence-observation", confidenceFactors.length),
    theme: "confidence",
    label: "Confidence context",
    description: weakestConfidence
      ? `Confidence metadata includes a ${weakestConfidence.level} factor for review.`
      : strongestConfidence
        ? "Confidence metadata includes high-support factors."
        : "Confidence metadata is limited or unavailable.",
    evidenceReferenceIds: confidenceFactors.flatMap((confidence) => confidence.factorReferenceIds),
    signalIds: confidenceFactors.map((confidence) =>
      createRuntimeBridgeId("runtime-bridge-confidence-signal", confidence.confidenceId),
    ),
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeGovernanceNarrative = (
  governance: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport,
): RuntimeBridgeNarrativeObservation => ({
  observationId: createRuntimeBridgeId("runtime-bridge-governance-observation", governance.subjectId),
  theme: "governance",
  label: "Governance context",
  description: `Governance metadata is classified as ${governance.capabilityClassification} with ${governance.riskClassification} risk.`,
  evidenceReferenceIds: governance.policyTags.map((tag) =>
    createRuntimeBridgeId("runtime-bridge-policy-tag", tag),
  ),
  signalIds: governance.policyTags.map((tag) =>
    createRuntimeBridgeId("runtime-bridge-governance-signal", tag),
  ),
  metadataOnly: true,
});

export const collectRuntimeBridgeNarrativeThemes = ({
  explanation,
  governance,
  trace,
}: {
  readonly explanation: RuntimeBridgeExplanationSummary;
  readonly governance: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
  readonly trace: RuntimeBridgeRelationshipTrace;
}): ReadonlyArray<RuntimeBridgeNarrativeTheme> =>
  uniqueStable([
    ...explanation.narrativeTags
      .map((tag): RuntimeBridgeNarrativeTheme | "" => {
        if (tag.includes("evidence")) return "evidence";
        if (tag.includes("lineage") || tag.includes("ancestor") || tag.includes("descendant")) {
          return "lineage";
        }
        if (tag.includes("governance") || tag.includes("review")) return "governance";
        return "";
      })
      .filter((theme): theme is RuntimeBridgeNarrativeTheme => Boolean(theme)),
    governance.riskClassification === "safe" ? "quality" : "governance",
    trace.relatedReferenceIds.length > 0 ? "relationship" : "",
    explanation.confidenceFactors.length > 0 ? "confidence" : "",
  ]);

export const collectRuntimeBridgeNarrativeSignals = ({
  explanation,
  governance,
  trace,
  advisories,
}: {
  readonly explanation: RuntimeBridgeExplanationSummary;
  readonly governance: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
  readonly trace: RuntimeBridgeRelationshipTrace;
  readonly advisories: ReadonlyArray<RuntimeBridgeAdvisoryReference>;
}): ReadonlyArray<RuntimeBridgeNarrativeSignal> => [
  {
    signalId: createRuntimeBridgeId("runtime-bridge-signal", explanation.subjectId, "evidence"),
    theme: "evidence",
    label: "Evidence availability",
    strength: explanation.evidenceReferenceIds.length >= 5 ? "high" : explanation.evidenceReferenceIds.length > 0 ? "medium" : "low",
    evidenceReferenceIds: explanation.evidenceReferenceIds,
    metadataOnly: true,
  },
  {
    signalId: createRuntimeBridgeId("runtime-bridge-signal", explanation.subjectId, "lineage"),
    theme: "lineage",
    label: "Lineage connectivity",
    strength:
      trace.ancestorNodeIds.length + trace.descendantNodeIds.length >= 3
        ? "high"
        : trace.ancestorNodeIds.length + trace.descendantNodeIds.length > 0
          ? "medium"
          : "low",
    evidenceReferenceIds: trace.lineageReferences.map((reference) => reference.referenceId),
    metadataOnly: true,
  },
  {
    signalId: createRuntimeBridgeId("runtime-bridge-signal", explanation.subjectId, "governance"),
    theme: "governance",
    label: "Governance posture",
    strength: governance.riskClassification === "safe" ? "high" : "medium",
    evidenceReferenceIds: governance.policyTags.map((tag) =>
      createRuntimeBridgeId("runtime-bridge-policy-tag", tag),
    ),
    metadataOnly: true,
  },
  ...advisories.map((advisory) => ({
    signalId: createRuntimeBridgeId("runtime-bridge-signal", advisory.advisoryId),
    theme: "advisory" as const,
    label: advisory.label,
    strength: advisory.evidenceReferenceIds.length > 0 ? "medium" as const : "low" as const,
    evidenceReferenceIds: advisory.evidenceReferenceIds,
    metadataOnly: true as const,
  })),
  ...explanation.confidenceFactors.map((confidence) => ({
    signalId: createRuntimeBridgeId("runtime-bridge-signal", confidence.confidenceId),
    theme: "confidence" as const,
    label: `Confidence ${confidence.level}`,
    strength: confidenceStrength(confidence.level),
    evidenceReferenceIds: confidence.factorReferenceIds,
    metadataOnly: true as const,
  })),
];

export const summarizeRuntimeBridgeObservations = ({
  explanation,
  governance,
  trace,
  advisories,
}: {
  readonly explanation: RuntimeBridgeExplanationSummary;
  readonly governance: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
  readonly trace: RuntimeBridgeRelationshipTrace;
  readonly advisories: ReadonlyArray<RuntimeBridgeAdvisoryReference>;
}): ReadonlyArray<RuntimeBridgeNarrativeObservation> => {
  const signals = collectRuntimeBridgeNarrativeSignals({ explanation, governance, trace, advisories });

  return [
    {
      observationId: createRuntimeBridgeId("runtime-bridge-observation", explanation.subjectId, "evidence"),
      theme: "evidence",
      label: "Evidence coverage",
      description: `Narrative evidence includes ${explanation.evidenceReferenceIds.length} metadata references.`,
      evidenceReferenceIds: explanation.evidenceReferenceIds,
      signalIds: signals.filter((signal) => signal.theme === "evidence").map((signal) => signal.signalId),
      metadataOnly: true,
    },
    {
      observationId: createRuntimeBridgeId("runtime-bridge-observation", explanation.subjectId, "relationships"),
      theme: "relationship",
      label: "Relationship coverage",
      description: `Relationship metadata includes ${trace.ancestorNodeIds.length} ancestors and ${trace.descendantNodeIds.length} descendants.`,
      evidenceReferenceIds: collectRuntimeBridgeNarrativeRelationships(trace),
      signalIds: signals.filter((signal) => signal.theme === "lineage").map((signal) => signal.signalId),
      metadataOnly: true,
    },
    summarizeRuntimeBridgeGovernanceNarrative(governance),
    summarizeRuntimeBridgeConfidenceNarrative(explanation.confidenceFactors),
    ...advisories.map((advisory) => ({
      observationId: createRuntimeBridgeId("runtime-bridge-observation", advisory.advisoryId),
      theme: "advisory" as const,
      label: advisory.label,
      description: `Advisory metadata is available from ${advisory.sourceModule.label}.`,
      evidenceReferenceIds: advisory.evidenceReferenceIds,
      signalIds: signals
        .filter((signal) => signal.signalId === createRuntimeBridgeId("runtime-bridge-signal", advisory.advisoryId))
        .map((signal) => signal.signalId),
      metadataOnly: true as const,
    })),
  ];
};

export const buildRuntimeBridgeObservationGroups = (
  observations: ReadonlyArray<RuntimeBridgeNarrativeObservation>,
): ReadonlyArray<{
  readonly groupId: string;
  readonly theme: RuntimeBridgeNarrativeTheme;
  readonly observationIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
}> =>
  uniqueStable(observations.map((observation) => observation.theme)).map((theme) => {
    const themeObservations = observations.filter((observation) => observation.theme === theme);

    return {
      groupId: createRuntimeBridgeId("runtime-bridge-observation-group", theme),
      theme,
      observationIds: themeObservations.map((observation) => observation.observationId),
      evidenceReferenceIds: uniqueStable(
        themeObservations.flatMap((observation) => observation.evidenceReferenceIds),
      ),
      metadataOnly: true,
    };
  });

export const prioritizeRuntimeBridgeInsights = (
  observations: ReadonlyArray<RuntimeBridgeNarrativeObservation>,
): ReadonlyArray<RuntimeBridgeNarrativeInsight> =>
  observations
    .map((observation) => {
      const priority: RuntimeBridgeNarrativeInsight["priority"] =
        observation.theme === "governance" && observation.description.includes("risk")
          ? "high"
          : observation.evidenceReferenceIds.length >= 5
            ? "high"
            : observation.evidenceReferenceIds.length > 0
              ? "medium"
              : "low";

      return {
        insightId: createRuntimeBridgeId("runtime-bridge-insight", observation.observationId),
        priority,
        theme: observation.theme,
        label: observation.label,
        summary: observation.description,
        observationIds: [observation.observationId],
        evidenceReferenceIds: observation.evidenceReferenceIds,
        metadataOnly: true as const,
      };
    })
    .sort((left, right) => priorityScore(right.priority) - priorityScore(left.priority));

export const buildRuntimeBridgeInsightTimeline = ({
  subjectId,
  insights,
  observations,
}: {
  readonly subjectId: string;
  readonly insights: ReadonlyArray<RuntimeBridgeNarrativeInsight>;
  readonly observations: ReadonlyArray<RuntimeBridgeNarrativeObservation>;
}): RuntimeBridgeNarrativeTimeline => ({
  timelineId: createRuntimeBridgeId("runtime-bridge-narrative-timeline", subjectId),
  subjectId,
  insightIds: insights.map((insight) => insight.insightId),
  observationIds: observations.map((observation) => observation.observationId),
  metadataOnly: true,
});

export const buildRuntimeBridgeNarrativeSequence = ({
  explanation,
  governance,
  trace,
  advisories,
}: {
  readonly explanation: RuntimeBridgeExplanationSummary;
  readonly governance: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
  readonly trace: RuntimeBridgeRelationshipTrace;
  readonly advisories: ReadonlyArray<RuntimeBridgeAdvisoryReference>;
}): RuntimeBridgeNarrativeSequence => {
  const signals = collectRuntimeBridgeNarrativeSignals({ explanation, governance, trace, advisories });
  const observations = summarizeRuntimeBridgeObservations({ explanation, governance, trace, advisories });
  const insights = prioritizeRuntimeBridgeInsights(observations);

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-narrative-sequence", explanation.subjectId),
    subjectId: explanation.subjectId,
    summary: summarizeRuntimeBridgeNarrative(explanation),
    themes: collectRuntimeBridgeNarrativeThemes({ explanation, governance, trace }),
    signals,
    observations,
    insights,
    timeline: buildRuntimeBridgeInsightTimeline({
      subjectId: explanation.subjectId,
      insights,
      observations,
    }),
    metadataOnly: true,
  };
};

export const generateRuntimeBridgeNarrative = ({
  snapshot,
  nodeId,
  governance = summarizeRuntimeBridgeGovernance(snapshot),
}: {
  readonly snapshot: RuntimeBridgeSnapshot;
  readonly nodeId: string;
  readonly governance?: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
}): RuntimeBridgeNarrativeSequence => {
  const explanation = summarizeRuntimeBridgeExplanation({ snapshot, nodeId, governance });
  const trace = traceRuntimeBridgeLineage(snapshot, nodeId);
  const advisories = findRuntimeBridgeAdvisoriesForNode(snapshot, nodeId);

  return buildRuntimeBridgeNarrativeSequence({
    explanation,
    governance,
    trace,
    advisories,
  });
};

export const summarizeRuntimeBridgeNarrativeFromConfidence = (
  confidenceReferences: ReadonlyArray<RuntimeBridgeConfidence>,
): RuntimeBridgeNarrativeObservation =>
  summarizeRuntimeBridgeConfidenceNarrative(
    collectRuntimeBridgeConfidenceFactors(confidenceReferences),
  );
