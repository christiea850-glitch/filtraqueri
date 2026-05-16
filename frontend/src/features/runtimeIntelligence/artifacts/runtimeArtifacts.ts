import type { RuntimeConfidenceSummary } from "../confidence/runtimeConfidence";

export type RuntimeArtifactKind =
  | "result_snapshot"
  | "narrative_snapshot"
  | "optimization_summary"
  | "recommendation_snapshot"
  | "scenario_snapshot"
  | "investigation_summary"
  | (string & {});

export type RuntimeArtifactLineage = {
  sourceNodeIds: string[];
  sourceArtifactIds: string[];
  evidenceReferenceIds: string[];
};

export type RuntimeArtifactSnapshot = {
  artifactId: string;
  kind: RuntimeArtifactKind;
  label: string;
  summary: string;
  hash: string;
  createdAt: string;
  lineage: RuntimeArtifactLineage;
  confidenceSummary?: RuntimeConfidenceSummary;
  immutable: true;
  metadataOnly: true;
};
