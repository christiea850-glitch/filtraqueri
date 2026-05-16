import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const analysisPackageGovernance = {
  mode: "advisory",
  contractId: "analysis-packages",
  label: "Analysis packages",
  description:
    "Advisory analysis package readiness, artifact manifest, audit metadata, and package recommendations.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["summary", "recommendation", "readiness", "lineage_reference"],
} satisfies AdvisoryBoundaryContract;
