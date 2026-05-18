export const runtimeBridgeConsumerReadonlyKind = "consumer-readonly" as const;

export type RuntimeBridgeConsumerReadonlyKind = typeof runtimeBridgeConsumerReadonlyKind;

export type RuntimeBridgeConsumerSourceDescriptor = {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourceDescriptorVersion: string;
};

export type RuntimeBridgeConsumerViewModelBase = {
  readonly viewModelSchemaVersion: string;
  readonly sourceDescriptorVersion: string;
  readonly generatedAt: string;
  readonly contentHash: string;
  readonly kind: RuntimeBridgeConsumerReadonlyKind;
};

export type RuntimeBridgeConsumerViewModelInput = {
  readonly viewModelSchemaVersion: string;
  readonly sourceDescriptorVersion: string;
  readonly generatedAt: string;
  readonly contentHash: string;
};

export const createRuntimeBridgeConsumerViewModelBase = ({
  viewModelSchemaVersion,
  sourceDescriptorVersion,
  generatedAt,
  contentHash,
}: RuntimeBridgeConsumerViewModelInput): RuntimeBridgeConsumerViewModelBase => ({
  viewModelSchemaVersion,
  sourceDescriptorVersion,
  generatedAt,
  contentHash,
  kind: runtimeBridgeConsumerReadonlyKind,
});

export const isRuntimeBridgeConsumerReadonlyKind = (
  kind: string,
): kind is RuntimeBridgeConsumerReadonlyKind => kind === runtimeBridgeConsumerReadonlyKind;

