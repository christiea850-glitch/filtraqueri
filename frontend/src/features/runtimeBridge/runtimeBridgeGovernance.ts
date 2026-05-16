import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";

export const runtimeBridgeGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-schema",
  label: "Runtime bridge schema",
  description:
    "Metadata-only bridge contracts connecting runtime lineage, advisory intelligence, investigations, explanations, continuations, and active result references.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-node",
    "runtime-bridge-edge",
    "runtime-bridge-artifact",
    "runtime-bridge-continuation",
    "runtime-bridge-advisory",
    "runtime-bridge-investigation",
    "runtime-bridge-explanation",
    "runtime-bridge-result",
    "runtime-bridge-confidence",
    "runtime-bridge-event",
  ],
} satisfies MetadataOnlyBoundaryContract;
