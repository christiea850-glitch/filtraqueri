import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const kpiGovernance = {
  mode: "advisory",
  contractId: "kpi-intelligence",
  label: "KPI intelligence",
  description:
    "Advisory KPI metadata, validation, selector output, and deterministic KPI readiness guidance.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["summary", "recommendation", "readiness", "diagnostic"],
} satisfies AdvisoryBoundaryContract;
