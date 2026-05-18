import type { RuntimeBridgeConsumerViewModelBase } from "../runtimeBridgeConsumerTypes";

export type DatasetIntelligencePreviewViewModel = RuntimeBridgeConsumerViewModelBase & {
  readonly datasetLabel: string;
  readonly rowCountLabel: string;
  readonly columnCountLabel: string;
  readonly detectedDataShapeSummary: string;
  readonly opportunityPreview: string;
  readonly whyItMattersPreview: string;
  readonly readinessLabel: string;
};

export type DatasetIntelligencePreviewViewModelInput = {
  readonly sourceDescriptorVersion: string;
  readonly generatedAt: string;
  readonly datasetLabel: string;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly detectedDataShapeSummary: string;
  readonly opportunityPreview?: string | null;
  readonly whyItMattersPreview: string;
  readonly readinessLabel?: string | null;
};

