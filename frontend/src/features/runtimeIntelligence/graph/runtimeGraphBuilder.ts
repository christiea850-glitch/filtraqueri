import type { RuntimeEdge, RuntimeGraphSnapshot, RuntimeNodeMetadataSnapshot } from "../contracts/runtimeContracts";
import { createMetadataHash, createRuntimeId } from "../helpers/runtimeIds";

export const createRuntimeMetadataSnapshot = ({
  snapshotId,
  capturedAt,
  summary,
  properties,
}: {
  snapshotId: string;
  capturedAt: string;
  summary: string;
  properties: RuntimeNodeMetadataSnapshot["properties"];
}): RuntimeNodeMetadataSnapshot => ({
  snapshotId,
  capturedAt,
  summary,
  immutable: true,
  properties,
});

export const createRuntimeEdge = ({
  type,
  fromNodeId,
  toNodeId,
  createdAt,
  lineageReason,
}: Omit<RuntimeEdge, "id" | "metadataSnapshot" | "metadataOnly">): RuntimeEdge => ({
  id: createRuntimeId("runtime-edge", type, fromNodeId, toNodeId),
  type,
  fromNodeId,
  toNodeId,
  createdAt,
  lineageReason,
  metadataOnly: true,
  metadataSnapshot: createRuntimeMetadataSnapshot({
    snapshotId: createRuntimeId("runtime-edge-snapshot", type, fromNodeId, toNodeId),
    capturedAt: createdAt,
    summary: lineageReason,
    properties: {
      hash: createMetadataHash({ type, fromNodeId, toNodeId, lineageReason }),
    },
  }),
});

export const createRuntimeGraphSnapshot = ({
  graphId,
  createdAt,
  nodes,
  edges,
}: Omit<RuntimeGraphSnapshot, "metadataOnly">): RuntimeGraphSnapshot => ({
  graphId,
  createdAt,
  nodes,
  edges,
  metadataOnly: true,
});
