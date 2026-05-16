import type { RuntimeArtifactSnapshot } from "../artifacts/runtimeArtifacts";
import type { RuntimeConfidenceSummary } from "../confidence/runtimeConfidence";
import type { RuntimeContinuationReference } from "../continuations/runtimeContinuations";
import type { RuntimeEventReference } from "../events/runtimeEvents";

export type RuntimeNodeFamily =
  | "dataset"
  | "workbook"
  | "query"
  | "result"
  | "narrative"
  | "optimization"
  | "forecast"
  | "scenario"
  | "recommendation"
  | "validation"
  | "export"
  | "investigation"
  | (string & {});

export type RuntimeSourceReference = {
  sourceId: string;
  sourceType: RuntimeNodeFamily | "external" | (string & {});
  label: string;
  uri?: string | null;
};

export type RuntimeLineageReference = {
  nodeId: string;
  nodeType: RuntimeNodeFamily | (string & {});
  relation: "parent" | "source" | "derived" | "evidence" | "checkpoint" | (string & {});
};

export type RuntimeExecutionReference = {
  executionId: string;
  source: "preview" | "filtered" | "query-builder" | "sql" | "metadata" | (string & {});
  resultSourceId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rowCount: number | null;
  metadataOnly: boolean;
};

export type RuntimeNodeMetadataSnapshot = {
  snapshotId: string;
  capturedAt: string;
  summary: string;
  immutable: true;
  properties: Record<string, string | number | boolean | null>;
};

export type RuntimeNode = {
  id: string;
  family: RuntimeNodeFamily;
  nodeType: RuntimeNodeFamily | (string & {});
  label: string;
  createdAt: string;
  sourceReferences: RuntimeSourceReference[];
  lineageReferences: RuntimeLineageReference[];
  parentInvestigationReference: string | null;
  derivedFrom: string[];
  metadataSnapshot: RuntimeNodeMetadataSnapshot;
  artifactSnapshots: RuntimeArtifactSnapshot[];
  confidenceSummary?: RuntimeConfidenceSummary;
  continuationReferences: RuntimeContinuationReference[];
  advisoryEventReferences: RuntimeEventReference[];
  metadataOnly: true;
};

export type RuntimeEdgeType =
  | "derived_from"
  | "generated_from"
  | "recommended_by"
  | "validated_by"
  | "continued_from"
  | "replayed_from"
  | "supersedes"
  | (string & {});

export type RuntimeEdge = {
  id: string;
  type: RuntimeEdgeType;
  fromNodeId: string;
  toNodeId: string;
  createdAt: string;
  lineageReason: string;
  metadataSnapshot: RuntimeNodeMetadataSnapshot;
  metadataOnly: true;
};

export type RuntimeGraphSnapshot = {
  graphId: string;
  createdAt: string;
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
  metadataOnly: true;
};
