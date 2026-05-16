import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const investigationGovernance = {
  mode: "advisory",
  contractId: "investigation-intelligence",
  label: "Investigation intelligence",
  description:
    "Deterministic investigation context, explanations, follow-up questions, and advisory next steps.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["summary", "recommendation", "diagnostic", "continuation"],
} satisfies AdvisoryBoundaryContract;
