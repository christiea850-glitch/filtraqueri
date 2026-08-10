import { useCallback, useState } from "react";

export type CleanPrepareStep = "review" | "decide" | "apply";

const cleanPrepareSteps: CleanPrepareStep[] = ["review", "decide", "apply"];

const isCleanPrepareStep = (value: string): value is CleanPrepareStep =>
  cleanPrepareSteps.includes(value as CleanPrepareStep);

export function useCleanPrepareStep() {
  const [step, setStep] = useState<CleanPrepareStep>("review");

  const goToStep = useCallback((nextStep: CleanPrepareStep) => {
    if (!isCleanPrepareStep(nextStep)) return;
    setStep(nextStep);
  }, []);

  const goToReview = useCallback(() => goToStep("review"), [goToStep]);
  const goToDecide = useCallback(() => goToStep("decide"), [goToStep]);
  const goToApply = useCallback(() => goToStep("apply"), [goToStep]);

  return {
    step,
    goToStep,
    goToReview,
    goToDecide,
    goToApply,
  };
}

export { cleanPrepareSteps };
