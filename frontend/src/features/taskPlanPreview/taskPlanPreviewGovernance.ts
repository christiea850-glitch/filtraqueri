import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const taskPlanPreviewGovernance = {
  mode: "advisory",
  contractId: "task-plan-preview",
  label: "Task plan preview",
  description:
    "Advisory task preview planning, validation, selectors, and non-executing preview summaries.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["plan", "summary", "readiness", "recommendation"],
} satisfies AdvisoryBoundaryContract;
