import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const planningReadinessGovernance = {
  mode: "advisory",
  contractId: "planning-readiness",
  label: "Planning readiness",
  description:
    "Advisory readiness evaluation for planning workflows, prerequisites, and safe next-step guidance.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["readiness", "recommendation", "diagnostic"],
} satisfies AdvisoryBoundaryContract;
