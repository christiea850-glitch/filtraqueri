import type { DatasetMetadata } from "./datasetTypes";
import type {
  DatasetId,
  DatasetRegistryRecord,
  DatasetRegistryState,
  RegisterDatasetOptions,
} from "./datasetRegistryTypes";
import type { ResultTabKey } from "../results/resultTypes";

export const createEmptyDatasetRegistry = (): DatasetRegistryState => ({
  records: [],
  activeDatasetId: null,
});

export const createDatasetRegistryRecord = (
  dataset: DatasetMetadata,
  options: RegisterDatasetOptions,
): DatasetRegistryRecord => {
  const columnNames = dataset.schema.map((column) => column.name);

  return {
    datasetId: dataset.dataset_id,
    metadata: dataset,
    name: dataset.original_filename,
    sourceType: options.sourceType,
    schema: dataset.schema,
    rowCount: dataset.row_count,
    columnCount: dataset.column_count,
    visibleColumns: options.visibleColumns || columnNames,
    hiddenColumns: options.hiddenColumns || [],
    status: options.status || "ready",
    isActive: options.isActive ?? true,
    createdAt: options.createdAt || dataset.uploaded_at,
    restoration: options.restoration || null,
    lineage: options.lineage || null,
    activeResultId: options.activeResultId || null,
    executionIds: options.executionIds || [],
  };
};

export const registerDataset = (
  state: DatasetRegistryState,
  dataset: DatasetMetadata,
  options: RegisterDatasetOptions,
): DatasetRegistryState => {
  const nextRecord = createDatasetRegistryRecord(dataset, options);
  const shouldActivate = options.isActive ?? true;
  const records = [
    nextRecord,
    ...state.records
      .filter((record) => record.datasetId !== dataset.dataset_id)
      .map((record) => ({
        ...record,
        isActive: shouldActivate ? false : record.isActive,
      })),
  ];

  return {
    records,
    activeDatasetId: shouldActivate ? dataset.dataset_id : state.activeDatasetId,
  };
};

export const updateDatasetMetadata = (
  state: DatasetRegistryState,
  dataset: DatasetMetadata,
): DatasetRegistryState => ({
  ...state,
  records: state.records.map((record) =>
    record.datasetId === dataset.dataset_id
      ? {
          ...record,
          metadata: dataset,
          name: dataset.original_filename,
          schema: dataset.schema,
          rowCount: dataset.row_count,
          columnCount: dataset.column_count,
        }
      : record,
  ),
});

export const getDatasetById = (state: DatasetRegistryState, datasetId: DatasetId) =>
  state.records.find((record) => record.datasetId === datasetId) || null;

export const getActiveDataset = (state: DatasetRegistryState) =>
  state.activeDatasetId ? getDatasetById(state, state.activeDatasetId) : null;

export const setActiveDataset = (
  state: DatasetRegistryState,
  datasetId: DatasetId,
): DatasetRegistryState => ({
  records: state.records.map((record) => ({
    ...record,
    isActive: record.datasetId === datasetId,
  })),
  activeDatasetId: getDatasetById(state, datasetId) ? datasetId : state.activeDatasetId,
});

export const attachExecutionToDataset = (
  state: DatasetRegistryState,
  datasetId: DatasetId,
  executionId: string,
): DatasetRegistryState => ({
  ...state,
  records: state.records.map((record) =>
    record.datasetId === datasetId
      ? {
          ...record,
          executionIds: record.executionIds.includes(executionId)
            ? record.executionIds
            : [executionId, ...record.executionIds],
        }
      : record,
  ),
});

export const attachActiveResultToDataset = (
  state: DatasetRegistryState,
  datasetId: DatasetId,
  activeResultId: ResultTabKey,
): DatasetRegistryState => ({
  ...state,
  records: state.records.map((record) =>
    record.datasetId === datasetId ? { ...record, activeResultId } : record,
  ),
});

export const clearActiveDatasetSafely = (state: DatasetRegistryState): DatasetRegistryState => ({
  records: state.records.map((record) => ({ ...record, isActive: false })),
  activeDatasetId: null,
});

export const restoreDatasetState = (
  state: DatasetRegistryState,
  dataset: DatasetMetadata,
  sourceSessionId?: string,
  restoredAt = dataset.uploaded_at,
): DatasetRegistryState =>
  registerDataset(state, dataset, {
    sourceType: "session-restored",
    status: "restored",
    isActive: true,
    restoration: {
      restoredAt,
      sourceSessionId,
    },
  });

export const validateDatasetReferences = (state: DatasetRegistryState) => {
  const messages: string[] = [];
  const activeDatasetExists = !state.activeDatasetId || Boolean(getActiveDataset(state));

  if (!activeDatasetExists) messages.push("Active dataset reference is stale.");

  return {
    isValid: activeDatasetExists,
    messages,
  };
};

export const trimStaleDatasetReferences = (state: DatasetRegistryState): DatasetRegistryState => {
  if (!state.activeDatasetId || getActiveDataset(state)) return state;

  return {
    ...state,
    activeDatasetId: null,
    records: state.records.map((record) => ({ ...record, isActive: false })),
  };
};
