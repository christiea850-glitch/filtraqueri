import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import { createRuntimeBridgeIntegrityReport, type RuntimeBridgeIntegrityReport } from "./runtimeBridgeIntegrity";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import { normalizeRuntimeBridgeSnapshot } from "./runtimeBridgeNormalize";
import type {
  RuntimeBridgeAdvisoryReference,
  RuntimeBridgeArtifactReference,
  RuntimeBridgeConfidence,
  RuntimeBridgeContinuationReference,
  RuntimeBridgeEdge,
  RuntimeBridgeEvent,
  RuntimeBridgeExplanationReference,
  RuntimeBridgeInvestigationReference,
  RuntimeBridgeNode,
  RuntimeBridgeResultReference,
  RuntimeBridgeSnapshot,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";

export type RuntimeBridgeCompositionSourceSummary = {
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly snapshotCount: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly artifactCount: number;
  readonly advisoryCount: number;
  readonly investigationCount: number;
  readonly explanationCount: number;
  readonly continuationCount: number;
  readonly resultCount: number;
  readonly confidenceCount: number;
  readonly eventCount: number;
  readonly metadataOnly: true;
};

export type RuntimeBridgeCompositionInput = {
  readonly bridgeId?: string;
  readonly createdAt: string;
  readonly sourceModule?: RuntimeBridgeSourceModuleReference;
  readonly snapshots?: ReadonlyArray<RuntimeBridgeSnapshot>;
  readonly nodes?: ReadonlyArray<RuntimeBridgeNode>;
  readonly edges?: ReadonlyArray<RuntimeBridgeEdge>;
  readonly artifacts?: ReadonlyArray<RuntimeBridgeArtifactReference>;
  readonly continuations?: ReadonlyArray<RuntimeBridgeContinuationReference>;
  readonly advisories?: ReadonlyArray<RuntimeBridgeAdvisoryReference>;
  readonly investigations?: ReadonlyArray<RuntimeBridgeInvestigationReference>;
  readonly explanations?: ReadonlyArray<RuntimeBridgeExplanationReference>;
  readonly results?: ReadonlyArray<RuntimeBridgeResultReference>;
  readonly confidence?: ReadonlyArray<RuntimeBridgeConfidence>;
  readonly events?: ReadonlyArray<RuntimeBridgeEvent>;
  readonly checkedAt?: string;
};

export type RuntimeBridgeCompositionResult = {
  readonly snapshot: RuntimeBridgeSnapshot;
  readonly sourceSummary: RuntimeBridgeCompositionSourceSummary;
  readonly integrityReport?: RuntimeBridgeIntegrityReport;
  readonly metadataOnly: true;
};

export const runtimeBridgeCompositionGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-composition",
  label: "Runtime bridge composition",
  description:
    "Metadata-only composition helpers that merge RuntimeBridge references into normalized snapshots.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-snapshot-composition",
    "runtime-bridge-snapshot-merge",
    "runtime-bridge-source-summary",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeCompositionSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-composition",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeComposition.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge composition",
};

const emptySnapshot = ({
  bridgeId,
  createdAt,
  sourceModule = runtimeBridgeCompositionSourceModule,
}: {
  readonly bridgeId: string;
  readonly createdAt: string;
  readonly sourceModule?: RuntimeBridgeSourceModuleReference;
}): RuntimeBridgeSnapshot => ({
  bridgeId,
  createdAt,
  sourceModule,
  nodes: [],
  edges: [],
  artifacts: [],
  continuations: [],
  advisories: [],
  investigations: [],
  explanations: [],
  results: [],
  confidence: [],
  events: [],
  metadataOnly: true,
});

const flattenSnapshots = (snapshots: ReadonlyArray<RuntimeBridgeSnapshot>) => ({
  nodes: snapshots.flatMap((snapshot) => snapshot.nodes),
  edges: snapshots.flatMap((snapshot) => snapshot.edges),
  artifacts: snapshots.flatMap((snapshot) => snapshot.artifacts),
  continuations: snapshots.flatMap((snapshot) => snapshot.continuations),
  advisories: snapshots.flatMap((snapshot) => snapshot.advisories),
  investigations: snapshots.flatMap((snapshot) => snapshot.investigations),
  explanations: snapshots.flatMap((snapshot) => snapshot.explanations),
  results: snapshots.flatMap((snapshot) => snapshot.results),
  confidence: snapshots.flatMap((snapshot) => snapshot.confidence),
  events: snapshots.flatMap((snapshot) => snapshot.events),
});

export const collectRuntimeBridgeCompositionSources = (
  input: RuntimeBridgeCompositionInput,
): RuntimeBridgeSourceModuleReference[] => {
  const sourceModules = [
    input.sourceModule || runtimeBridgeCompositionSourceModule,
    ...(input.snapshots || []).map((snapshot) => snapshot.sourceModule),
  ];
  const seenModuleIds = new Set<string>();
  const collectedSources: RuntimeBridgeSourceModuleReference[] = [];

  for (const sourceModule of sourceModules) {
    if (seenModuleIds.has(sourceModule.moduleId)) continue;
    seenModuleIds.add(sourceModule.moduleId);
    collectedSources.push(sourceModule);
  }

  return collectedSources;
};

export const summarizeRuntimeBridgeComposition = (
  snapshot: RuntimeBridgeSnapshot,
  input: RuntimeBridgeCompositionInput,
): RuntimeBridgeCompositionSourceSummary => ({
  sourceId: createRuntimeBridgeId("runtime-bridge-composition-source", snapshot.bridgeId),
  sourceLabel: snapshot.sourceModule.label,
  sourceModule: snapshot.sourceModule,
  snapshotCount: input.snapshots?.length || 0,
  nodeCount: snapshot.nodes.length,
  edgeCount: snapshot.edges.length,
  artifactCount: snapshot.artifacts.length,
  advisoryCount: snapshot.advisories.length,
  investigationCount: snapshot.investigations.length,
  explanationCount: snapshot.explanations.length,
  continuationCount: snapshot.continuations.length,
  resultCount: snapshot.results.length,
  confidenceCount: snapshot.confidence.length,
  eventCount: snapshot.events.length,
  metadataOnly: true,
});

export const composeRuntimeBridgeSnapshot = (
  input: RuntimeBridgeCompositionInput,
): RuntimeBridgeCompositionResult => {
  const snapshots = input.snapshots || [];
  const flattened = flattenSnapshots(snapshots);
  const bridgeId = input.bridgeId || createRuntimeBridgeId("runtime-bridge-composition", input.createdAt);
  const sourceModule = input.sourceModule || runtimeBridgeCompositionSourceModule;
  const snapshot = normalizeRuntimeBridgeSnapshot({
    ...emptySnapshot({ bridgeId, createdAt: input.createdAt, sourceModule }),
    nodes: [...flattened.nodes, ...(input.nodes || [])],
    edges: [...flattened.edges, ...(input.edges || [])],
    artifacts: [...flattened.artifacts, ...(input.artifacts || [])],
    continuations: [...flattened.continuations, ...(input.continuations || [])],
    advisories: [...flattened.advisories, ...(input.advisories || [])],
    investigations: [...flattened.investigations, ...(input.investigations || [])],
    explanations: [...flattened.explanations, ...(input.explanations || [])],
    results: [...flattened.results, ...(input.results || [])],
    confidence: [...flattened.confidence, ...(input.confidence || [])],
    events: [...flattened.events, ...(input.events || [])],
  });
  const sourceSummary = summarizeRuntimeBridgeComposition(snapshot, input);

  return {
    snapshot,
    sourceSummary,
    integrityReport: input.checkedAt
      ? createRuntimeBridgeIntegrityReport({ snapshot, checkedAt: input.checkedAt })
      : undefined,
    metadataOnly: true,
  };
};

export const mergeRuntimeBridgeSnapshots = ({
  snapshots,
  bridgeId,
  createdAt,
  checkedAt,
  sourceModule = runtimeBridgeCompositionSourceModule,
}: {
  readonly snapshots: ReadonlyArray<RuntimeBridgeSnapshot>;
  readonly bridgeId?: string;
  readonly createdAt: string;
  readonly checkedAt?: string;
  readonly sourceModule?: RuntimeBridgeSourceModuleReference;
}): RuntimeBridgeCompositionResult =>
  composeRuntimeBridgeSnapshot({
    bridgeId,
    createdAt,
    checkedAt,
    sourceModule,
    snapshots,
  });
