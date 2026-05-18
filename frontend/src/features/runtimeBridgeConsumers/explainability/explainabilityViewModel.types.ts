import type { RuntimeBridgeConsumerViewModelBase } from "../runtimeBridgeConsumerTypes";

export type ExplainabilityEvidenceFactViewModel = {
  readonly label: string;
  readonly value: string;
};

export type ExplainabilityPreviewViewModel = RuntimeBridgeConsumerViewModelBase & {
  readonly takeawaySentence: string;
  readonly confidenceLabel: string;
  readonly topEvidenceFact: ExplainabilityEvidenceFactViewModel;
  readonly whyItMattersPreview: string;
  readonly recommendationPreview: string;
};

export type ExplainabilityPreviewViewModelInput = {
  readonly sourceDescriptorVersion: string;
  readonly generatedAt: string;
  readonly takeawaySentence: string;
  readonly confidenceLabel: string;
  readonly topEvidenceFact?: Partial<ExplainabilityEvidenceFactViewModel> | null;
  readonly whyItMattersPreview: string;
  readonly recommendationPreview: string;
};

