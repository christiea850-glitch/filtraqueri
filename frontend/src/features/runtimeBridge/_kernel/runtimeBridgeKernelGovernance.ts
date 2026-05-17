import type {
  RuntimeBridgeKernelGovernanceDescriptor,
  RuntimeBridgeKernelGovernanceInput,
  RuntimeBridgeKernelSourceModuleDescriptor,
  RuntimeBridgeKernelSourceModuleInput,
  RuntimeBridgeMetadataOnlyCapabilityFlags,
} from "./runtimeBridgeKernelTypes";

export const runtimeBridgeMetadataOnlyCapabilityFlags: RuntimeBridgeMetadataOnlyCapabilityFlags = {
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
};

export const buildRuntimeBridgeSourceModuleDescriptor = ({
  moduleId,
  modulePath,
  label,
}: RuntimeBridgeKernelSourceModuleInput): RuntimeBridgeKernelSourceModuleDescriptor => ({
  moduleId,
  modulePath,
  capabilityMode: "metadata_only",
  label,
});

export const buildRuntimeBridgeMetadataOnlyGovernanceDescriptor = ({
  contractId,
  label,
  description,
  lineageRefs,
}: RuntimeBridgeKernelGovernanceInput): RuntimeBridgeKernelGovernanceDescriptor => ({
  mode: "metadata_only",
  contractId,
  label,
  description,
  confidence: "high",
  ...runtimeBridgeMetadataOnlyCapabilityFlags,
  lineageRefs,
});
