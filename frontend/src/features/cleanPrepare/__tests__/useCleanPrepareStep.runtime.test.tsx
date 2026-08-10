import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getPrepareBackTransition,
  invokePrepareBackTransition,
} from "../prepareBackNavigation";
import {
  cleanPrepareSteps,
  useCleanPrepareStep,
  type CleanPrepareStep,
} from "../useCleanPrepareStep";

function CleanPrepareStepHarness({
  instanceLabel = "primary",
}: {
  instanceLabel?: string;
}) {
  const { step, goToStep, goToReview, goToDecide, goToApply } = useCleanPrepareStep();
  const transition = getPrepareBackTransition("structural", step);

  return (
    <section aria-label={`Clean Prepare ${instanceLabel}`}>
      <output aria-label={`${instanceLabel} step`}>{step}</output>
      <button type="button" onClick={goToReview}>
        Review
      </button>
      <button type="button" onClick={goToDecide}>
        Decide
      </button>
      <button type="button" onClick={goToApply}>
        Apply
      </button>
      {cleanPrepareSteps.map((nextStep) => (
        <button type="button" key={nextStep} onClick={() => goToStep(nextStep)}>
          Go to {nextStep}
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          invokePrepareBackTransition(transition, {
            onBackToData: () => goToReview(),
            goToReview,
            goToDecide,
          })
        }
      >
        Back
      </button>
    </section>
  );
}

const stepText = (label: string) => screen.getByLabelText(label).textContent;

describe("useCleanPrepareStep runtime behavior", () => {
  it("starts on review and transitions through explicit actions", () => {
    render(<CleanPrepareStepHarness />);

    expect(stepText("primary step")).toBe("review");

    fireEvent.click(screen.getByRole("button", { name: "Decide" }));
    expect(stepText("primary step")).toBe("decide");

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(stepText("primary step")).toBe("apply");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(stepText("primary step")).toBe("review");
  });

  it("goToStep reaches every supported step with deterministic repeated transitions", () => {
    const { result } = renderHook(() => useCleanPrepareStep());

    for (const step of cleanPrepareSteps) {
      act(() => result.current.goToStep(step));
      expect(result.current.step).toBe(step);
    }

    act(() => {
      result.current.goToApply();
      result.current.goToApply();
      result.current.goToDecide();
      result.current.goToDecide();
      result.current.goToReview();
    });
    expect(result.current.step).toBe("review");
  });

  it("keeps separate hook instances isolated", () => {
    render(
      <>
        <CleanPrepareStepHarness instanceLabel="first" />
        <CleanPrepareStepHarness instanceLabel="second" />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]);

    expect(stepText("first step")).toBe("apply");
    expect(stepText("second step")).toBe("review");
  });

  it("remounting resets step state to review", () => {
    const { unmount } = render(<CleanPrepareStepHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(stepText("primary step")).toBe("apply");

    unmount();
    render(<CleanPrepareStepHarness />);

    expect(stepText("primary step")).toBe("review");
  });

  it("does not read or write hash/history ownership during transitions", () => {
    window.location.hash = "#sentinel";
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const pushSpy = vi.spyOn(window.history, "pushState");

    try {
      render(<CleanPrepareStepHarness />);

      fireEvent.click(screen.getByRole("button", { name: "Decide" }));
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
      fireEvent.click(screen.getByRole("button", { name: "Review" }));

      expect(window.location.hash).toBe("#sentinel");
      expect(replaceSpy).not.toHaveBeenCalled();
      expect(pushSpy).not.toHaveBeenCalled();
    } finally {
      replaceSpy.mockRestore();
      pushSpy.mockRestore();
      window.location.hash = "";
    }
  });

  it("keeps the user-facing structural Back transition on the intended step path", () => {
    render(<CleanPrepareStepHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(stepText("primary step")).toBe("apply");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(stepText("primary step")).toBe("decide");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(stepText("primary step")).toBe("review");
  });

  it("renders a button path for every clean prepare step", () => {
    render(<CleanPrepareStepHarness />);

    for (const step of cleanPrepareSteps satisfies CleanPrepareStep[]) {
      fireEvent.click(screen.getByRole("button", { name: `Go to ${step}` }));
      expect(stepText("primary step")).toBe(step);
    }
  });
});
