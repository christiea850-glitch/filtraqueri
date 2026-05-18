import { createStableRuntimeBridgeConsumerContentHash } from "../runtimeBridgeConsumerHash";
import { createRuntimeBridgeConsumerViewModelBase } from "../runtimeBridgeConsumerTypes";
import type {
  DatasetIntelligencePreviewViewModel,
  DatasetIntelligencePreviewViewModelInput,
} from "./datasetIntelligenceViewModel.types";

export const datasetIntelligencePreviewViewModelSchemaVersion =
  "s5-1b-dataset-intelligence-preview-v1";

const fallbackText = (value: string | null | undefined, fallback: string): string => {
  const trimmedValue = value?.trim();
  return trimmedValue || fallback;
};

const formatCount = (value: number): string =>
  Number.isFinite(value) ? value.toLocaleString() : "0";

export const createDatasetIntelligencePreviewViewModel = ({
  sourceDescriptorVersion,
  generatedAt,
  datasetLabel,
  rowCount,
  columnCount,
  detectedDataShapeSummary,
  opportunityPreview,
  whyItMattersPreview,
  readinessLabel,
}: DatasetIntelligencePreviewViewModelInput): DatasetIntelligencePreviewViewModel => {
  const viewModelPayload = {
    datasetLabel: fallbackText(datasetLabel, "Dataset"),
    rowCountLabel: formatCount(rowCount),
    columnCountLabel: formatCount(columnCount),
    detectedDataShapeSummary: fallbackText(detectedDataShapeSummary, "Data profile"),
    opportunityPreview: fallbackText(opportunityPreview, "Review the detected data profile."),
    whyItMattersPreview: fallbackText(
      whyItMattersPreview,
      "Column labels and workbook structure are prepared for review.",
    ),
    readinessLabel: fallbackText(readinessLabel, "Preview only"),
  };
  const contentHash = createStableRuntimeBridgeConsumerContentHash({
    viewModelSchemaVersion: datasetIntelligencePreviewViewModelSchemaVersion,
    sourceDescriptorVersion,
    generatedAt,
    ...viewModelPayload,
  });

  return {
    ...createRuntimeBridgeConsumerViewModelBase({
      viewModelSchemaVersion: datasetIntelligencePreviewViewModelSchemaVersion,
      sourceDescriptorVersion,
      generatedAt,
      contentHash,
    }),
    ...viewModelPayload,
  };
};

