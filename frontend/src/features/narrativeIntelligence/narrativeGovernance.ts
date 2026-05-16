import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const narrativeGovernance = {
  mode: "advisory",
  contractId: "narrative-intelligence",
  label: "Narrative intelligence",
  description:
    "Deterministic narrative scanning, readiness summaries, recommendations, and advisory timeline checkpoints.",
  confidence: "high",
  protectedSurfaces: ["narrativeIntelligence"],
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["summary", "recommendation", "readiness", "continuation"],
} satisfies AdvisoryBoundaryContract;
