import { buildNarrativeReport } from "./narrativeBuilder";
import { runNarrativeDetectors } from "./narrativeDetectors";
import type { NarrativeReport, NarrativeScanContext, NarrativeScannerInput } from "./narrativeTypes";

const sampleRows = (rows: Record<string, unknown>[], limit = 120) => {
  if (rows.length <= limit) return rows;

  const stride = Math.max(1, Math.floor(rows.length / limit));
  return rows.filter((_, index) => index % stride === 0).slice(0, limit);
};

export const scanNarrativeIntelligence = ({
  dataset,
  activeResultModel,
  businessSemanticReport = null,
  investigationReport = null,
}: NarrativeScannerInput): NarrativeReport => {
  if (!dataset || !activeResultModel) {
    return buildNarrativeReport({
      datasetId: dataset?.dataset_id || null,
      sourceResultId: null,
      insights: [],
    });
  }

  const context: NarrativeScanContext = {
    dataset,
    activeResultModel,
    rows: activeResultModel.rows,
    visibleRows: activeResultModel.visibleRows,
    sampledRows: sampleRows(activeResultModel.visibleRows.length ? activeResultModel.visibleRows : activeResultModel.rows),
    columns: dataset.schema,
    businessSemanticReport,
    investigationReport,
  };

  return buildNarrativeReport({
    datasetId: dataset.dataset_id,
    sourceResultId: activeResultModel.sourceTab,
    insights: runNarrativeDetectors(context),
  });
};
