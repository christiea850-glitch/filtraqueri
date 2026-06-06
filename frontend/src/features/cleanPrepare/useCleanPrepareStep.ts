import { useCallback, useEffect, useState } from "react";

export type CleanPrepareStep = "review" | "decide" | "apply";

const cleanPrepareSteps: CleanPrepareStep[] = ["review", "decide", "apply"];

const isCleanPrepareStep = (value: string): value is CleanPrepareStep =>
  cleanPrepareSteps.includes(value as CleanPrepareStep);

const readStepFromHash = (): CleanPrepareStep => {
  if (typeof window === "undefined") return "review";
  const hashValue = window.location.hash.replace(/^#/, "");
  return isCleanPrepareStep(hashValue) ? hashValue : "review";
};

const writeStepHash = (step: CleanPrepareStep) => {
  if (typeof window === "undefined") return;
  const nextHash = `#${step}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", nextHash);
};

export function useCleanPrepareStep() {
  const [step, setStep] = useState<CleanPrepareStep>(() => readStepFromHash());

  const goToStep = useCallback((nextStep: CleanPrepareStep) => {
    setStep(nextStep);
    writeStepHash(nextStep);
  }, []);

  const goToReview = useCallback(() => goToStep("review"), [goToStep]);
  const goToDecide = useCallback(() => goToStep("decide"), [goToStep]);
  const goToApply = useCallback(() => goToStep("apply"), [goToStep]);

  useEffect(() => {
    const handleHashChange = () => setStep(readStepFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return {
    step,
    goToStep,
    goToReview,
    goToDecide,
    goToApply,
  };
}

export { cleanPrepareSteps };
