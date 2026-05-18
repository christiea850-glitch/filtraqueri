import { createStableRuntimeBridgeConsumerContentHash } from "../runtimeBridgeConsumerHash";
import { createRuntimeBridgeConsumerViewModelBase } from "../runtimeBridgeConsumerTypes";
import type {
  ExplainabilityEvidenceFactViewModel,
  ExplainabilityPreviewViewModel,
  ExplainabilityPreviewViewModelInput,
} from "./explainabilityViewModel.types";

export const explainabilityPreviewViewModelSchemaVersion = "s5-1-explainability-preview-v1";

const fallbackText = (value: string | null | undefined, fallback: string): string => {
  const trimmedValue = value?.trim();
  return trimmedValue || fallback;
};

const normalizeEvidenceFact = (
  evidenceFact: Partial<ExplainabilityEvidenceFactViewModel> | null | undefined,
): ExplainabilityEvidenceFactViewModel => ({
  label: fallbackText(evidenceFact?.label, "Evidence"),
  value: fallbackText(evidenceFact?.value, "No supporting fact available"),
});

export const createExplainabilityPreviewViewModel = ({
  sourceDescriptorVersion,
  generatedAt,
  takeawaySentence,
  confidenceLabel,
  topEvidenceFact,
  whyItMattersPreview,
  recommendationPreview,
}: ExplainabilityPreviewViewModelInput): ExplainabilityPreviewViewModel => {
  const viewModelPayload = {
    takeawaySentence: fallbackText(takeawaySentence, "No explainability preview available."),
    confidenceLabel: fallbackText(confidenceLabel, "Review only"),
    topEvidenceFact: normalizeEvidenceFact(topEvidenceFact),
    whyItMattersPreview: fallbackText(whyItMattersPreview, "Use this preview to decide what to inspect next."),
    recommendationPreview: fallbackText(recommendationPreview, "Review the result context before continuing."),
  };
  const contentHash = createStableRuntimeBridgeConsumerContentHash({
    viewModelSchemaVersion: explainabilityPreviewViewModelSchemaVersion,
    sourceDescriptorVersion,
    generatedAt,
    ...viewModelPayload,
  });

  return {
    ...createRuntimeBridgeConsumerViewModelBase({
      viewModelSchemaVersion: explainabilityPreviewViewModelSchemaVersion,
      sourceDescriptorVersion,
      generatedAt,
      contentHash,
    }),
    ...viewModelPayload,
  };
};

