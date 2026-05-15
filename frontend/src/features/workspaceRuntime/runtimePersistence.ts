import type {
  InvestigationContinuationOrigin,
  RuntimeContextReference,
  WorkspaceRuntimePersistenceState,
} from "./runtimeTypes";
import type { ActiveView, WorkspaceMode } from "../dataset/datasetTypes";
import type { ResultTabKey } from "../results/resultTypes";

const RUNTIME_STORAGE_KEY = "filtraqueri.workspaceRuntime";

const defaultRuntimePersistenceState: WorkspaceRuntimePersistenceState = {
  selectedTrailItemId: null,
  isRuntimePanelCollapsed: true,
  selectedTaskId: null,
  selectedContextualObjectId: null,
  returnContinuationId: null,
  continuationMetadata: null,
};

const activeViews: ActiveView[] = [
  "welcome",
  "dataset",
  "filters",
  "queryBuilder",
  "results",
  "history",
  "export",
  "settings",
  "sqlWorkspace",
  "savedQueries",
  "queryExplain",
  "dataCleaning",
  "diagnostics",
  "normalization",
];

const workspaceModes: WorkspaceMode[] = ["human", "analyst"];
const resultTabs: ResultTabKey[] = ["preview", "filtered", "queried"];
const continuationOrigins: InvestigationContinuationOrigin[] = [
  "workspace-trail",
  "runtime-panel",
  "human-intent",
  "analyst-context",
  "metadata-summary",
];

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeStringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

const normalizeRuntimeReference = (value: unknown): RuntimeContextReference | null => {
  if (!isObjectRecord(value)) return null;
  const mode = value.mode;
  const view = value.view;
  const resultTab = value.resultTab;

  if (!workspaceModes.includes(mode as WorkspaceMode) || !activeViews.includes(view as ActiveView)) {
    return null;
  }

  return {
    datasetId: normalizeStringOrNull(value.datasetId),
    datasetName: normalizeStringOrNull(value.datasetName),
    workbookActiveWorksheetName: normalizeStringOrNull(value.workbookActiveWorksheetName),
    workbookWorksheetCount:
      typeof value.workbookWorksheetCount === "number" && Number.isFinite(value.workbookWorksheetCount)
        ? value.workbookWorksheetCount
        : 0,
    resultTab: resultTabs.includes(resultTab as ResultTabKey) ? (resultTab as ResultTabKey) : null,
    mode: mode as WorkspaceMode,
    view: view as ActiveView,
    activeExecutionId: normalizeStringOrNull(value.activeExecutionId),
  };
};

const normalizeContinuationMetadata = (
  value: unknown,
): WorkspaceRuntimePersistenceState["continuationMetadata"] => {
  if (!isObjectRecord(value) || typeof value.id !== "string") return null;

  const origin = value.origin;
  const targetView = value.targetView;
  const targetMode = value.targetMode;
  const reference = normalizeRuntimeReference(value.reference);
  const continuationContext = isObjectRecord(value.continuationContext)
    ? value.continuationContext
    : null;

  if (
    !continuationOrigins.includes(origin as InvestigationContinuationOrigin) ||
    !activeViews.includes(targetView as ActiveView) ||
    !workspaceModes.includes(targetMode as WorkspaceMode) ||
    !reference ||
    !continuationContext
  ) {
    return null;
  }

  const originatingMode = continuationContext.originatingMode;
  const originatingView = continuationContext.originatingView;
  const contextOrigin = continuationContext.origin;
  if (
    !continuationOrigins.includes(contextOrigin as InvestigationContinuationOrigin) ||
    !workspaceModes.includes(originatingMode as WorkspaceMode) ||
    !activeViews.includes(originatingView as ActiveView)
  ) {
    return null;
  }

  const relatedReferences = Array.isArray(value.relatedReferences)
    ? value.relatedReferences
        .map((relatedReference) => normalizeRuntimeReference(relatedReference))
        .filter((relatedReference): relatedReference is RuntimeContextReference =>
          Boolean(relatedReference),
        )
    : [];

  return {
    id: value.id,
    origin: origin as InvestigationContinuationOrigin,
    targetView: targetView as ActiveView,
    targetMode: targetMode as WorkspaceMode,
    reference,
    relatedReferences,
    continuationContext: {
      origin: contextOrigin as InvestigationContinuationOrigin,
      originatingDatasetId: normalizeStringOrNull(continuationContext.originatingDatasetId),
      originatingWorkbookWorksheetName: normalizeStringOrNull(
        continuationContext.originatingWorkbookWorksheetName,
      ),
      originatingResultTab: resultTabs.includes(
        continuationContext.originatingResultTab as ResultTabKey,
      )
        ? (continuationContext.originatingResultTab as ResultTabKey)
        : null,
      originatingMode: originatingMode as WorkspaceMode,
      originatingView: originatingView as ActiveView,
    },
  };
};

export const normalizeRuntimePersistenceState = (
  value: unknown,
): WorkspaceRuntimePersistenceState => {
  if (!isObjectRecord(value)) return defaultRuntimePersistenceState;

  const candidate = value as Partial<WorkspaceRuntimePersistenceState>;

  return {
    selectedTrailItemId:
      typeof candidate.selectedTrailItemId === "string" ? candidate.selectedTrailItemId : null,
    isRuntimePanelCollapsed: Boolean(candidate.isRuntimePanelCollapsed),
    selectedTaskId: typeof candidate.selectedTaskId === "string" ? candidate.selectedTaskId : null,
    selectedContextualObjectId:
      typeof candidate.selectedContextualObjectId === "string"
        ? candidate.selectedContextualObjectId
        : null,
    returnContinuationId:
      typeof candidate.returnContinuationId === "string" ? candidate.returnContinuationId : null,
    continuationMetadata: normalizeContinuationMetadata(candidate.continuationMetadata),
  };
};

export const loadRuntimePersistenceState = (): WorkspaceRuntimePersistenceState => {
  try {
    const storedValue = window.localStorage.getItem(RUNTIME_STORAGE_KEY);
    return normalizeRuntimePersistenceState(storedValue ? JSON.parse(storedValue) : null);
  } catch {
    return defaultRuntimePersistenceState;
  }
};

export const saveRuntimePersistenceState = (state: WorkspaceRuntimePersistenceState) => {
  window.localStorage.setItem(
    RUNTIME_STORAGE_KEY,
    JSON.stringify(normalizeRuntimePersistenceState(state)),
  );
};
