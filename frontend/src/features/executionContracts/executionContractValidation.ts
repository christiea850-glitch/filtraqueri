import type {
  ExecutionContract,
  ExecutionContractValidationMessage,
  ExecutionContractValidationResult,
} from "./executionContractTypes";

const addMessage = (
  messages: ExecutionContractValidationMessage[],
  severity: ExecutionContractValidationMessage["severity"],
  message: string,
) => {
  messages.push({ severity, message });
};

export const validateExecutionContract = (
  contract: ExecutionContract,
): ExecutionContractValidationResult => {
  const messages: ExecutionContractValidationMessage[] = [];
  const stageIds = new Set(contract.stages.map((stage) => stage.stageId));

  contract.dependencies.forEach((dependency) => {
    if (!stageIds.has(dependency.sourceStageId)) {
      addMessage(messages, "error", `${dependency.label} references a missing source stage.`);
    }
    if (!stageIds.has(dependency.targetStageId)) {
      addMessage(messages, "error", `${dependency.label} references a missing target stage.`);
    }
  });

  if (!contract.safety.metadataOnly || !contract.safety.executionLocked) {
    addMessage(messages, "error", "Execution contracts must remain metadata-only and execution-locked.");
  }
  if (contract.stages.length === 0) addMessage(messages, "warning", "Execution contract has no stages.");
  if (contract.outputs.length === 0) addMessage(messages, "warning", "Execution contract has no projected outputs.");

  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages,
  };
};
