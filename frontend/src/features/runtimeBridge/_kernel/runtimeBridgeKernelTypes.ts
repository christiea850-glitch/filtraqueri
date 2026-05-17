import type { MetadataOnlyBoundaryContract } from "../../governance/boundaryTypes";
import type { RuntimeBridgeSourceModuleReference } from "../runtimeBridgeTypes";

export type RuntimeBridgeKernelPriority = "critical" | "high" | "medium" | "low" | (string & {});

export type RuntimeBridgeMetadataOnlyCapabilityFlags = {
  readonly canExecute: false;
  readonly canMutateWorkspace: false;
  readonly canCallBackend: false;
};

export type RuntimeBridgeKernelBundleDescriptor<
  TTheme extends string = string,
  TPriority extends RuntimeBridgeKernelPriority = RuntimeBridgeKernelPriority,
> = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly theme: TTheme;
  readonly priority: TPriority;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeKernelSourceModuleInput = {
  readonly moduleId: string;
  readonly modulePath: string;
  readonly label: string;
};

export type RuntimeBridgeKernelGovernanceInput = {
  readonly contractId: string;
  readonly label: string;
  readonly description: string;
  readonly lineageRefs: ReadonlyArray<string>;
};

export type RuntimeBridgeKernelSourceModuleDescriptor = RuntimeBridgeSourceModuleReference;

export type RuntimeBridgeKernelGovernanceDescriptor = MetadataOnlyBoundaryContract;
