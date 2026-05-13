import type { ExecutionContract, ExecutionStageCategory } from "./executionContractTypes";

export const selectExecutionContractHumanSummary = (contract: ExecutionContract | null) =>
  contract?.humanSummary || "No execution contract summary is available yet.";

export const selectExecutionContractAnalystSummary = (contract: ExecutionContract | null) =>
  contract?.analystSummary || "No execution contract metadata is available yet.";

export const listExecutionStages = (contract: ExecutionContract | null) =>
  contract?.stages || [];

export const listBlockedExecutionStages = (contract: ExecutionContract | null) =>
  listExecutionStages(contract).filter((stage) => stage.lifecycleState !== "ready_for_execution");

export const listExecutionStagesByCategory = (
  contract: ExecutionContract | null,
  category: ExecutionStageCategory,
) => listExecutionStages(contract).filter((stage) => stage.category === category);

export const listCompatibleExecutionEngines = (contract: ExecutionContract | null) =>
  contract?.engines.filter((engine) => engine.compatible) || [];
