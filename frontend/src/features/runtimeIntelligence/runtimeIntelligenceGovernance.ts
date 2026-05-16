import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";

export const runtimeIntelligenceGovernance = {
  mode: "metadata_only",
  contractId: "runtime-intelligence",
  label: "Runtime intelligence",
  description:
    "Metadata-only runtime graph, lineage, continuation, confidence, event, and artifact contracts.",
  confidence: "high",
  protectedSurfaces: ["runtimeIntelligenceGraph"],
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-node",
    "runtime-edge",
    "runtime-artifact",
    "runtime-continuation",
    "runtime-confidence",
    "runtime-event",
  ],
} satisfies MetadataOnlyBoundaryContract;
