import type { CleanPrepareStep } from "./useCleanPrepareStep";

export type PrepareTab = "structural" | "transformations" | "sql-cleaning";
export type PrepareBackDestination = "data" | "review" | "decide";

export type PrepareBackTransition = {
  destination: PrepareBackDestination;
  label: string;
  hash: "#review" | "#decide" | null;
};

export type PrepareBackHandlers = {
  onBackToData: () => void;
  goToReview: () => void;
  goToDecide: () => void;
};

export type PrepareApplyGateReadiness = {
  canContinueToApply: boolean;
  blockingMessage: string | null;
};

const prepareBackLabels: Record<PrepareBackDestination, string> = {
  data: "Back to Data",
  review: "Back to Review",
  decide: "Back to Decide",
};

const prepareBackHashes: Record<Exclude<PrepareBackDestination, "data">, "#review" | "#decide"> = {
  review: "#review",
  decide: "#decide",
};

export const getPrepareBackDestination = (
  activePrepareTab: PrepareTab,
  step: CleanPrepareStep,
): PrepareBackDestination => {
  if (activePrepareTab !== "structural") return "data";
  if (step === "apply") return "decide";
  if (step === "decide") return "review";
  return "data";
};

export const getPrepareBackLabel = (destination: PrepareBackDestination): string =>
  prepareBackLabels[destination];

export const getPrepareBackHash = (
  destination: PrepareBackDestination,
): PrepareBackTransition["hash"] =>
  destination === "data" ? null : prepareBackHashes[destination];

export const getPrepareBackTransition = (
  activePrepareTab: PrepareTab,
  step: CleanPrepareStep,
): PrepareBackTransition => {
  const destination = getPrepareBackDestination(activePrepareTab, step);
  return {
    destination,
    label: getPrepareBackLabel(destination),
    hash: getPrepareBackHash(destination),
  };
};

export const invokePrepareBackTransition = (
  transition: PrepareBackTransition,
  handlers: PrepareBackHandlers,
) => {
  if (transition.destination === "decide") {
    handlers.goToDecide();
    return;
  }
  if (transition.destination === "review") {
    handlers.goToReview();
    return;
  }
  handlers.onBackToData();
};

export const isStructuralApplyNavigationBlocked = (
  activePrepareTab: PrepareTab,
  readiness: PrepareApplyGateReadiness | null,
): boolean => activePrepareTab === "structural" && readiness?.canContinueToApply !== true;

export const getStructuralApplyNavigationBlockMessage = (
  activePrepareTab: PrepareTab,
  step: CleanPrepareStep,
  readiness: PrepareApplyGateReadiness | null,
): string | null => {
  if (step !== "decide" || !isStructuralApplyNavigationBlocked(activePrepareTab, readiness)) {
    return null;
  }
  return (
    readiness?.blockingMessage ||
    "Resolve or explicitly defer every recommendation before continuing."
  );
};

export const normalizeBlockedApplyStep = (
  activePrepareTab: PrepareTab,
  step: CleanPrepareStep,
  readiness: PrepareApplyGateReadiness | null,
): CleanPrepareStep => {
  if (
    activePrepareTab === "structural" &&
    step === "apply" &&
    readiness &&
    !readiness.canContinueToApply
  ) {
    return "decide";
  }
  return step;
};

export const invokeStructuralApplyNavigation = (
  activePrepareTab: PrepareTab,
  readiness: PrepareApplyGateReadiness | null,
  goToApply: () => void,
): boolean => {
  if (isStructuralApplyNavigationBlocked(activePrepareTab, readiness)) return false;
  goToApply();
  return true;
};
