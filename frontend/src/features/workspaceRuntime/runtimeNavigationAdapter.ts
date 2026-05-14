import type { ActiveView, WorkspaceMode } from "../dataset/datasetTypes";
import type {
  ContextualInvestigationObject,
  InvestigationContinuation,
  WorkspaceRuntimeContext,
  WorkspaceRuntimePersistenceState,
  WorkspaceTrailItem,
} from "./runtimeTypes";

export type RuntimeNavigationRequest = {
  id: string;
  targetView: ActiveView;
  targetMode: WorkspaceMode;
};

export type RuntimeNavigationSelection = {
  targetView: ActiveView;
  targetMode: WorkspaceMode;
  persistence: WorkspaceRuntimePersistenceState;
};

export const getContextualObjectIdForView = (view: ActiveView) => {
  if (view === "results" || view === "history" || view === "export") return "context:result";
  if (view === "queryBuilder" || view === "filters") return "context:query-builder";
  if (view === "sqlWorkspace") return "context:sql-workspace";
  return "context:dataset";
};

const findTrailItemForTarget = (
  trail: WorkspaceTrailItem[],
  targetView: ActiveView,
  targetMode: WorkspaceMode,
) =>
  trail.find((item) => item.view === targetView && item.mode === targetMode) ||
  trail.find((item) => item.mode === targetMode && item.contextReference.view === targetView) ||
  null;

const findContextualObjectForTarget = (
  contextualObjects: ContextualInvestigationObject[],
  targetView: ActiveView,
) =>
  contextualObjects.find((item) => item.id === getContextualObjectIdForView(targetView)) || null;

const createContinuationMetadata = (continuation: InvestigationContinuation) => ({
  id: continuation.id,
  origin: continuation.origin,
  targetView: continuation.targetView,
  targetMode: continuation.targetMode,
  reference: continuation.originReference,
  relatedReferences: continuation.relatedReferences,
  continuationContext: continuation.continuationContext,
});

export const createRuntimeNavigationSelection = ({
  runtimeContext,
  currentPersistence,
  request,
}: {
  runtimeContext: WorkspaceRuntimeContext;
  currentPersistence: WorkspaceRuntimePersistenceState;
  request: RuntimeNavigationRequest;
}): RuntimeNavigationSelection => {
  const continuation =
    runtimeContext.continuations.find((item) => item.id === request.id) || null;
  const trailItem =
    runtimeContext.trail.find((item) => item.id === request.id) ||
    findTrailItemForTarget(runtimeContext.trail, request.targetView, request.targetMode);
  const contextualObject = findContextualObjectForTarget(
    runtimeContext.contextualObjects,
    request.targetView,
  );

  return {
    targetView: request.targetView,
    targetMode: request.targetMode,
    persistence: {
      ...currentPersistence,
      selectedTrailItemId: trailItem?.id || currentPersistence.selectedTrailItemId,
      selectedContextualObjectId:
        contextualObject?.id || currentPersistence.selectedContextualObjectId,
      returnContinuationId: continuation?.id || currentPersistence.returnContinuationId,
      continuationMetadata: continuation
        ? createContinuationMetadata(continuation)
        : currentPersistence.continuationMetadata,
    },
  };
};
