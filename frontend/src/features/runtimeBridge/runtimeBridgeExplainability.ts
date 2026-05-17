import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeGovernanceReport,
  RuntimeBridgeGovernanceSummary,
} from "./runtimeBridgeGovernance";
import { summarizeRuntimeBridgeGovernance } from "./runtimeBridgeGovernance";
import {
  findRuntimeBridgeAdvisoriesForNode,
  findRuntimeBridgeArtifactsForNode,
  findRuntimeBridgeEventsForNode,
  summarizeRuntimeBridgeEvidence,
  summarizeRuntimeBridgeLineage,
  traceRuntimeBridgeLineage,
  type RuntimeBridgeEvidenceSummary,
  type RuntimeBridgeLineageSummary,
  type RuntimeBridgeRelationshipTrace,
} from "./runtimeBridgeLineage";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeConfidence,
  RuntimeBridgeSnapshot,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";

export type RuntimeBridgeReasoningStep = {
  readonly stepId: string;
  readonly label: string;
  readonly description: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeConfidenceExplanation = {
  readonly confidenceId: string;
  readonly level: RuntimeBridgeConfidence["level"];
  readonly score: number | null;
  readonly rationale: string;
  readonly factorReferenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeEvidenceExplanation = {
  readonly subjectId: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly artifactIds: ReadonlyArray<string>;
  readonly eventIds: ReadonlyArray<string>;
  readonly advisoryIds: ReadonlyArray<string>;
  readonly confidenceIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeRelationshipExplanation = {
  readonly rootNodeId: string;
  readonly ancestorNodeIds: ReadonlyArray<string>;
  readonly descendantNodeIds: ReadonlyArray<string>;
  readonly incomingEdgeIds: ReadonlyArray<string>;
  readonly outgoingEdgeIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExplanationSummary = {
  readonly subjectId: string;
  readonly label: string;
  readonly summary: string;
  readonly reasoningSteps: ReadonlyArray<RuntimeBridgeReasoningStep>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly confidenceFactors: ReadonlyArray<RuntimeBridgeConfidenceExplanation>;
  readonly narrativeTags: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export type RuntimeBridgeNarrativeSummary = {
  readonly subjectId: string;
  readonly headline: string;
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
  readonly reasoningStepIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly confidenceFactorIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
};

export const runtimeBridgeExplainabilityGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-explainability",
  label: "Runtime bridge explainability",
  description:
    "Metadata-only explanation helpers for RuntimeBridge snapshots, lineage, governance, confidence, and evidence references.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-explanation-summary",
    "runtime-bridge-evidence-explanation",
    "runtime-bridge-confidence-explanation",
    "runtime-bridge-relationship-explanation",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeExplainabilitySourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-explainability",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeExplainability.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge explainability",
};

const uniqueStable = (items: ReadonlyArray<string>): string[] => {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    values.push(item);
  }

  return values;
};

const getNodeConfidenceReferences = (snapshot: RuntimeBridgeSnapshot, nodeId: string) =>
  snapshot.nodes.find((node) => node.bridgeNodeId === nodeId)?.confidenceReferenceIds || [];

const findConfidenceForNode = (snapshot: RuntimeBridgeSnapshot, nodeId: string) => {
  const confidenceIds = new Set(getNodeConfidenceReferences(snapshot, nodeId));
  return snapshot.confidence.filter((confidence) => confidenceIds.has(confidence.confidenceId));
};

export const explainRuntimeBridgeConfidence = (
  confidence: RuntimeBridgeConfidence,
): RuntimeBridgeConfidenceExplanation => ({
  confidenceId: confidence.confidenceId,
  level: confidence.level,
  score: confidence.score,
  rationale: confidence.rationale,
  factorReferenceIds: confidence.evidenceReferenceIds,
  metadataOnly: true,
});

export const collectRuntimeBridgeConfidenceFactors = (
  confidenceReferences: ReadonlyArray<RuntimeBridgeConfidence>,
): ReadonlyArray<RuntimeBridgeConfidenceExplanation> =>
  confidenceReferences.map((confidence) => explainRuntimeBridgeConfidence(confidence));

export const collectRuntimeBridgeEvidenceReferences = ({
  snapshot,
  nodeId,
}: {
  readonly snapshot: RuntimeBridgeSnapshot;
  readonly nodeId: string;
}): ReadonlyArray<string> => summarizeRuntimeBridgeEvidence(snapshot, nodeId).evidenceReferenceIds;

export const explainRuntimeBridgeEvidence = ({
  snapshot,
  nodeId,
}: {
  readonly snapshot: RuntimeBridgeSnapshot;
  readonly nodeId: string;
}): RuntimeBridgeEvidenceExplanation => {
  const evidenceSummary = summarizeRuntimeBridgeEvidence(snapshot, nodeId);

  return {
    subjectId: nodeId,
    evidenceReferenceIds: evidenceSummary.evidenceReferenceIds,
    artifactIds: findRuntimeBridgeArtifactsForNode(snapshot, nodeId).map(
      (artifact) => artifact.artifactId,
    ),
    eventIds: findRuntimeBridgeEventsForNode(snapshot, nodeId).map((event) => event.eventId),
    advisoryIds: findRuntimeBridgeAdvisoriesForNode(snapshot, nodeId).map(
      (advisory) => advisory.advisoryId,
    ),
    confidenceIds: findConfidenceForNode(snapshot, nodeId).map(
      (confidence) => confidence.confidenceId,
    ),
    metadataOnly: true,
  };
};

export const explainRuntimeBridgeRelationships = (
  trace: RuntimeBridgeRelationshipTrace,
): RuntimeBridgeRelationshipExplanation => ({
  rootNodeId: trace.rootNodeId,
  ancestorNodeIds: trace.ancestorNodeIds,
  descendantNodeIds: trace.descendantNodeIds,
  incomingEdgeIds: trace.incomingEdgeIds,
  outgoingEdgeIds: trace.outgoingEdgeIds,
  summary: `Bridge node "${trace.rootNodeId}" has ${trace.ancestorNodeIds.length} ancestor references and ${trace.descendantNodeIds.length} descendant references.`,
  metadataOnly: true,
});

export const explainRuntimeBridgeLineage = ({
  trace,
  lineageSummary,
}: {
  readonly trace: RuntimeBridgeRelationshipTrace;
  readonly lineageSummary?: RuntimeBridgeLineageSummary;
}): RuntimeBridgeRelationshipExplanation => {
  const summary = lineageSummary || {
    rootNodeId: trace.rootNodeId,
    rootLabel: trace.rootNode?.label || null,
    ancestorCount: trace.ancestorNodeIds.length,
    descendantCount: trace.descendantNodeIds.length,
    incomingEdgeCount: trace.incomingEdgeIds.length,
    outgoingEdgeCount: trace.outgoingEdgeIds.length,
    relatedReferenceCount: trace.relatedReferenceIds.length,
    lineageReferenceCount: trace.lineageReferences.length,
    metadataOnly: true as const,
  };

  return {
    ...explainRuntimeBridgeRelationships(trace),
    summary: `Lineage for "${summary.rootLabel || summary.rootNodeId}" includes ${summary.ancestorCount} ancestors, ${summary.descendantCount} descendants, and ${summary.relatedReferenceCount} related metadata references.`,
  };
};

export const explainRuntimeBridgeGovernance = (
  governance: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport,
): RuntimeBridgeReasoningStep => ({
  stepId: createRuntimeBridgeId("runtime-bridge-governance-explanation", governance.subjectId),
  label: "Governance summary",
  description: `Governance classified this bridge metadata as ${governance.capabilityClassification} with ${governance.riskClassification} policy risk.`,
  evidenceReferenceIds: governance.policyTags.map((tag) =>
    createRuntimeBridgeId("runtime-bridge-policy-tag", tag),
  ),
  metadataOnly: true,
});

export const explainRuntimeBridgeAdvisories = (
  advisories: ReadonlyArray<RuntimeBridgeAdvisoryReference>,
): ReadonlyArray<RuntimeBridgeReasoningStep> =>
  advisories.map((advisory) => ({
    stepId: createRuntimeBridgeId("runtime-bridge-advisory-explanation", advisory.advisoryId),
    label: advisory.label,
    description: `Advisory reference "${advisory.advisoryId}" is ${advisory.advisoryType} metadata from ${advisory.sourceModule.label}.`,
    evidenceReferenceIds: advisory.evidenceReferenceIds,
    metadataOnly: true,
  }));

export const collectRuntimeBridgeReasoningSteps = ({
  snapshot,
  nodeId,
  governance,
}: {
  readonly snapshot: RuntimeBridgeSnapshot;
  readonly nodeId: string;
  readonly governance?: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
}): ReadonlyArray<RuntimeBridgeReasoningStep> => {
  const trace = traceRuntimeBridgeLineage(snapshot, nodeId);
  const lineageSummary = summarizeRuntimeBridgeLineage(snapshot, nodeId);
  const evidenceSummary = summarizeRuntimeBridgeEvidence(snapshot, nodeId);
  const advisories = findRuntimeBridgeAdvisoriesForNode(snapshot, nodeId);
  const steps = [
    {
      stepId: createRuntimeBridgeId("runtime-bridge-lineage-step", nodeId),
      label: "Lineage context",
      description: explainRuntimeBridgeLineage({ trace, lineageSummary }).summary,
      evidenceReferenceIds: trace.lineageReferences.map((reference) => reference.referenceId),
      metadataOnly: true as const,
    },
    {
      stepId: createRuntimeBridgeId("runtime-bridge-evidence-step", nodeId),
      label: "Evidence context",
      description: `Evidence summary includes ${evidenceSummary.artifactCount} artifacts, ${evidenceSummary.eventCount} events, and ${evidenceSummary.advisoryCount} advisories.`,
      evidenceReferenceIds: evidenceSummary.evidenceReferenceIds,
      metadataOnly: true as const,
    },
    ...explainRuntimeBridgeAdvisories(advisories),
  ];

  return governance ? [...steps, explainRuntimeBridgeGovernance(governance)] : steps;
};

export const collectRuntimeBridgeNarrativeTags = ({
  snapshot,
  nodeId,
  governance,
}: {
  readonly snapshot: RuntimeBridgeSnapshot;
  readonly nodeId: string;
  readonly governance?: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
}): ReadonlyArray<string> => {
  const trace = traceRuntimeBridgeLineage(snapshot, nodeId);
  const evidenceSummary = summarizeRuntimeBridgeEvidence(snapshot, nodeId);

  return uniqueStable([
    "metadata-only",
    "inspection-safe",
    trace.ancestorNodeIds.length > 0 ? "has-ancestors" : "",
    trace.descendantNodeIds.length > 0 ? "has-descendants" : "",
    evidenceSummary.evidenceReferenceIds.length > 0 ? "has-evidence" : "",
    ...(governance?.policyTags || []),
  ]);
};

export const summarizeRuntimeBridgeExplanation = ({
  snapshot,
  nodeId,
  governance = summarizeRuntimeBridgeGovernance(snapshot),
}: {
  readonly snapshot: RuntimeBridgeSnapshot;
  readonly nodeId: string;
  readonly governance?: RuntimeBridgeGovernanceSummary | RuntimeBridgeGovernanceReport;
}): RuntimeBridgeExplanationSummary => {
  const rootNode = snapshot.nodes.find((node) => node.bridgeNodeId === nodeId) || null;
  const reasoningSteps = collectRuntimeBridgeReasoningSteps({ snapshot, nodeId, governance });
  const confidenceFactors = collectRuntimeBridgeConfidenceFactors(findConfidenceForNode(snapshot, nodeId));
  const evidenceReferenceIds = uniqueStable([
    ...reasoningSteps.flatMap((step) => step.evidenceReferenceIds),
    ...confidenceFactors.flatMap((confidence) => confidence.factorReferenceIds),
  ]);

  return {
    subjectId: nodeId,
    label: rootNode?.label || nodeId,
    summary: `Bridge explanation for "${rootNode?.label || nodeId}" is descriptive metadata for human review.`,
    reasoningSteps,
    evidenceReferenceIds,
    confidenceFactors,
    narrativeTags: collectRuntimeBridgeNarrativeTags({ snapshot, nodeId, governance }),
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeNarrative = (
  explanation: RuntimeBridgeExplanationSummary,
): RuntimeBridgeNarrativeSummary => ({
  subjectId: explanation.subjectId,
  headline: explanation.label,
  summary: explanation.summary,
  tags: explanation.narrativeTags,
  reasoningStepIds: explanation.reasoningSteps.map((step) => step.stepId),
  evidenceReferenceIds: explanation.evidenceReferenceIds,
  confidenceFactorIds: explanation.confidenceFactors.map(
    (confidence) => confidence.confidenceId,
  ),
  metadataOnly: true,
});

export const summarizeRuntimeBridgeEvidenceNarrative = (
  evidenceSummary: RuntimeBridgeEvidenceSummary,
): RuntimeBridgeNarrativeSummary => ({
  subjectId: evidenceSummary.rootNodeId,
  headline: "Bridge evidence summary",
  summary: `Evidence metadata includes ${evidenceSummary.artifactCount} artifacts, ${evidenceSummary.eventCount} events, ${evidenceSummary.advisoryCount} advisories, and ${evidenceSummary.confidenceCount} confidence references.`,
  tags: ["metadata-only", "evidence-summary", "inspection-safe"],
  reasoningStepIds: [],
  evidenceReferenceIds: evidenceSummary.evidenceReferenceIds,
  confidenceFactorIds: [],
  metadataOnly: true,
});
