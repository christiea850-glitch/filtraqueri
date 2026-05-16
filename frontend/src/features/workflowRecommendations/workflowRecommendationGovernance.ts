import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const workflowRecommendationGovernance = {
  mode: "advisory",
  contractId: "workflow-recommendations",
  label: "Workflow recommendations",
  description:
    "Deterministic workflow guidance derived from data profile and dialect recommendation metadata.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["recommendation", "readiness", "diagnostic"],
} satisfies AdvisoryBoundaryContract;
