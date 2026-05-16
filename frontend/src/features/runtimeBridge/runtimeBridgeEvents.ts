import type {
  RuntimeBridgeConfidence,
  RuntimeBridgeContinuationReference,
  RuntimeBridgeEvent,
  RuntimeBridgeExplanationReference,
  RuntimeBridgeSourceModuleReference,
} from "./runtimeBridgeTypes";
import { createBridgeReferenceId } from "./runtimeBridgeIds";

export type RuntimeBridgeExpandedEvent = RuntimeBridgeEvent & {
  readonly relatedNodeIds: ReadonlyArray<string>;
  readonly confidenceReferenceIds: ReadonlyArray<string>;
  readonly explanationReferenceIds: ReadonlyArray<string>;
  readonly continuationReferenceIds: ReadonlyArray<string>;
};

export type RuntimeBridgeEventBuildInput = {
  readonly type: RuntimeBridgeEvent["eventType"];
  readonly createdAt: string;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly summary: string;
  readonly relatedNodeIds?: ReadonlyArray<string>;
  readonly relatedReferenceIds?: ReadonlyArray<string>;
  readonly confidenceReferenceIds?: ReadonlyArray<string>;
  readonly explanationReferenceIds?: ReadonlyArray<string>;
  readonly continuationReferenceIds?: ReadonlyArray<string>;
};

export const createRuntimeBridgeEvent = ({
  type,
  createdAt,
  sourceModule,
  summary,
  relatedNodeIds = [],
  relatedReferenceIds = [],
  confidenceReferenceIds = [],
  explanationReferenceIds = [],
  continuationReferenceIds = [],
}: RuntimeBridgeEventBuildInput): RuntimeBridgeExpandedEvent => ({
  eventId: createBridgeReferenceId(
    "event",
    `${type}:${createdAt}:${relatedReferenceIds.join(":")}:${relatedNodeIds.join(":")}`,
  ),
  eventType: type,
  createdAt,
  sourceModule,
  relatedNodeIds,
  relatedReferenceIds,
  confidenceReferenceIds,
  explanationReferenceIds,
  continuationReferenceIds,
  summary,
  metadataOnly: true,
});

export const createRuntimeBridgeEvents = ({
  createdAt,
  sourceModule,
  relatedNodeIds,
  confidence,
  explanations,
  continuations,
  artifactIds,
}: {
  readonly createdAt: string;
  readonly sourceModule: RuntimeBridgeSourceModuleReference;
  readonly relatedNodeIds: ReadonlyArray<string>;
  readonly confidence: ReadonlyArray<RuntimeBridgeConfidence>;
  readonly explanations: ReadonlyArray<RuntimeBridgeExplanationReference>;
  readonly continuations: ReadonlyArray<RuntimeBridgeContinuationReference>;
  readonly artifactIds: ReadonlyArray<string>;
}): ReadonlyArray<RuntimeBridgeExpandedEvent> => [
  createRuntimeBridgeEvent({
    type: "bridge_created",
    createdAt,
    sourceModule,
    summary: "Runtime bridge snapshot metadata created.",
    relatedNodeIds,
    relatedReferenceIds: relatedNodeIds,
    confidenceReferenceIds: confidence.map((item) => item.confidenceId),
    explanationReferenceIds: explanations.map((item) => item.explanationId),
    continuationReferenceIds: continuations.map((item) => item.continuationId),
  }),
  createRuntimeBridgeEvent({
    type: "artifact_attached",
    createdAt,
    sourceModule,
    summary: "Runtime bridge artifact metadata attached.",
    relatedNodeIds,
    relatedReferenceIds: artifactIds,
    confidenceReferenceIds: confidence.map((item) => item.confidenceId),
    explanationReferenceIds: explanations.map((item) => item.explanationId),
    continuationReferenceIds: continuations.map((item) => item.continuationId),
  }),
];
