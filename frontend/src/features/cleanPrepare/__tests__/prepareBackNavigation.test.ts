import type { CleanPrepareStep } from "../useCleanPrepareStep";
import {
  getPrepareBackDestination,
  getPrepareBackHash,
  getPrepareBackLabel,
  getPrepareBackTransition,
  getStructuralApplyNavigationBlockMessage,
  invokeStructuralApplyNavigation,
  invokePrepareBackTransition,
  isStructuralApplyNavigationBlocked,
  normalizeBlockedApplyStep,
  type PrepareBackDestination,
  type PrepareTab,
} from "../prepareBackNavigation";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type PrepareBackNavigationFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const fixture = (name: string, assert: () => string[]): FixtureResult => {
  const failureReasons = assert();
  return {
    name,
    ok: failureReasons.length === 0,
    failureReasons,
  };
};

const report = (results: FixtureResult[]): PrepareBackNavigationFixtureReport => ({
  results,
  passed: results.filter((result) => result.ok),
  failed: results.filter((result) => !result.ok),
});

const expect = (condition: boolean, message: string): string[] => condition ? [] : [message];

const dispatchedActions = (transition: ReturnType<typeof getPrepareBackTransition>) => {
  const calls = {
    data: 0,
    review: 0,
    decide: 0,
  };
  invokePrepareBackTransition(transition, {
    onBackToData: () => {
      calls.data += 1;
    },
    goToReview: () => {
      calls.review += 1;
    },
    goToDecide: () => {
      calls.decide += 1;
    },
  });
  return calls;
};

const structuralCases: Array<{
  step: CleanPrepareStep;
  destination: PrepareBackDestination;
  label: string;
  hash: "#review" | "#decide" | null;
}> = [
  {
    step: "review",
    destination: "data",
    label: "Back to Data",
    hash: null,
  },
  {
    step: "decide",
    destination: "review",
    label: "Back to Review",
    hash: "#review",
  },
  {
    step: "apply",
    destination: "decide",
    label: "Back to Decide",
    hash: "#decide",
  },
];

const nonStructuralCases: Array<{
  tab: PrepareTab;
  step: CleanPrepareStep;
}> = [
  { tab: "transformations", step: "review" },
  { tab: "transformations", step: "decide" },
  { tab: "transformations", step: "apply" },
  { tab: "sql-cleaning", step: "review" },
  { tab: "sql-cleaning", step: "decide" },
  { tab: "sql-cleaning", step: "apply" },
];

const unresolvedReadiness = {
  canContinueToApply: false,
  blockingMessage: "2 recommendations still need a decision. Resolve or explicitly defer them before continuing.",
};

const readyReadiness = {
  canContinueToApply: true,
  blockingMessage: null,
};

export const runPrepareBackNavigationFixtures = (): PrepareBackNavigationFixtureReport => {
  const results = [
    fixture("structural review returns to Data", () => {
      const transition = getPrepareBackTransition("structural", "review");
      return [
        ...expect(transition.destination === "data", "Review should exit to Data."),
        ...expect(transition.label === "Back to Data", "Review label should say Back to Data."),
        ...expect(transition.hash === null, "Review-to-Data should not claim a Prepare hash."),
      ];
    }),
    fixture("structural decide backs up to Review", () => {
      const transition = getPrepareBackTransition("structural", "decide");
      return [
        ...expect(transition.destination === "review", "Decide should back up to Review."),
        ...expect(transition.label === "Back to Review", "Decide label should say Back to Review."),
        ...expect(transition.hash === "#review", "Decide back should target #review."),
      ];
    }),
    fixture("structural apply backs up to Decide", () => {
      const transition = getPrepareBackTransition("structural", "apply");
      return [
        ...expect(transition.destination === "decide", "Apply should back up to Decide."),
        ...expect(transition.label === "Back to Decide", "Apply label should say Back to Decide."),
        ...expect(transition.hash === "#decide", "Apply back should target #decide."),
      ];
    }),
    fixture("Review back invokes the Data exit callback only", () => {
      const calls = dispatchedActions(getPrepareBackTransition("structural", "review"));
      return [
        ...expect(calls.data === 1, "Review back should call Data exit once."),
        ...expect(calls.review === 0, "Review back should not call Review transition."),
        ...expect(calls.decide === 0, "Review back should not call Decide transition."),
      ];
    }),
    fixture("Decide back invokes Review and never exits to Data", () => {
      const calls = dispatchedActions(getPrepareBackTransition("structural", "decide"));
      return [
        ...expect(calls.review === 1, "Decide back should call Review once."),
        ...expect(calls.data === 0, "Decide back should not call Data exit."),
        ...expect(calls.decide === 0, "Decide back should not call Decide transition."),
      ];
    }),
    fixture("Apply back invokes Decide and never exits to Data", () => {
      const calls = dispatchedActions(getPrepareBackTransition("structural", "apply"));
      return [
        ...expect(calls.decide === 1, "Apply back should call Decide once."),
        ...expect(calls.data === 0, "Apply back should not call Data exit."),
        ...expect(calls.review === 0, "Apply back should not call Review transition."),
      ];
    }),
    fixture("labels and hashes agree with destinations", () =>
      structuralCases.flatMap((item) => [
        ...expect(
          getPrepareBackLabel(item.destination) === item.label,
          `${item.destination} should have the expected label.`,
        ),
        ...expect(
          getPrepareBackHash(item.destination) === item.hash,
          `${item.destination} should have the expected hash target.`,
        ),
      ]),
    ),
    fixture("non-structural tabs return directly to Data from every step", () =>
      nonStructuralCases.flatMap((item) => {
        const transition = getPrepareBackTransition(item.tab, item.step);
        return [
          ...expect(
            transition.destination === "data",
            `${item.tab}/${item.step} should return to Data.`,
          ),
          ...expect(
            transition.label === "Back to Data",
            `${item.tab}/${item.step} should keep the Data label.`,
          ),
          ...expect(
            transition.hash === null,
            `${item.tab}/${item.step} should not claim a structural hash.`,
          ),
        ];
      }),
    ),
    fixture("Decide and Apply never map directly to Data on the structural tab", () =>
      (["decide", "apply"] as CleanPrepareStep[]).flatMap((step) =>
        expect(
          getPrepareBackDestination("structural", step) !== "data",
          `${step} should use chronological structural back navigation.`,
        ),
      ),
    ),
    fixture("Next Apply is blocked when structural readiness is unresolved", () => [
      ...expect(
        isStructuralApplyNavigationBlocked("structural", unresolvedReadiness) === true,
        "Unresolved structural readiness should block Apply.",
      ),
      ...expect(
        getStructuralApplyNavigationBlockMessage("structural", "decide", unresolvedReadiness) ===
          unresolvedReadiness.blockingMessage,
        "Decide should expose the readiness blocking message.",
      ),
    ]),
    fixture("Next Apply is available when structural readiness is ready", () => [
      ...expect(
        isStructuralApplyNavigationBlocked("structural", readyReadiness) === false,
        "Handled structural readiness should allow Apply.",
      ),
      ...expect(
        getStructuralApplyNavigationBlockMessage("structural", "decide", readyReadiness) === null,
        "Ready structural navigation should not expose a blocker.",
      ),
    ]),
    fixture("Next Apply does not invoke goToApply while blocked", () => {
      let calls = 0;
      const invoked = invokeStructuralApplyNavigation("structural", unresolvedReadiness, () => {
        calls += 1;
      });
      return [
        ...expect(invoked === false, "Blocked Apply navigation should report no invocation."),
        ...expect(calls === 0, "Blocked Apply navigation should not call goToApply."),
      ];
    }),
    fixture("Next Apply invokes goToApply once when ready", () => {
      let calls = 0;
      const invoked = invokeStructuralApplyNavigation("structural", readyReadiness, () => {
        calls += 1;
      });
      return [
        ...expect(invoked === true, "Ready Apply navigation should report invocation."),
        ...expect(calls === 1, "Ready Apply navigation should call goToApply once."),
      ];
    }),
    fixture("non-structural tabs do not use structural Apply gate", () =>
      (["transformations", "sql-cleaning"] as PrepareTab[]).flatMap((tab) =>
        expect(
          isStructuralApplyNavigationBlocked(tab, unresolvedReadiness) === false,
          `${tab} should not be gated by structural decisions.`,
        ),
      ),
    ),
    fixture("direct apply hash with unresolved decisions normalizes to Decide", () =>
      expect(
        normalizeBlockedApplyStep("structural", "apply", unresolvedReadiness) === "decide",
        "Blocked direct #apply should normalize to Decide.",
      ),
    ),
    fixture("direct apply hash remains Apply when decisions are ready", () =>
      expect(
        normalizeBlockedApplyStep("structural", "apply", readyReadiness) === "apply",
        "Ready direct #apply should remain Apply.",
      ),
    ),
    fixture("Apply back to Decide preserves readiness model", () =>
      expect(
        normalizeBlockedApplyStep("structural", "decide", readyReadiness) === "decide",
        "Returning to Decide should not mutate readiness.",
      ),
    ),
    fixture("Prepare Data tab switching preserves gate interpretation", () =>
      expect(
        normalizeBlockedApplyStep("transformations", "apply", unresolvedReadiness) === "apply",
        "Switching away from Structural fixes should not rewrite local structural state.",
      ),
    ),
    fixture("back-navigation helper has no storage, SQL, network, or time side effects", () => {
      const source =
        `${getPrepareBackDestination}` +
        `${getPrepareBackLabel}` +
        `${getPrepareBackHash}` +
        `${getPrepareBackTransition}` +
        `${invokePrepareBackTransition}` +
        `${isStructuralApplyNavigationBlocked}` +
        `${getStructuralApplyNavigationBlockMessage}` +
        `${normalizeBlockedApplyStep}` +
        `${invokeStructuralApplyNavigation}`;
      const bannedTokens = [
        "fetch(",
        "XMLHttpRequest",
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "provider",
        "execute",
        "DuckDB",
        "Date.now",
        "Math.random",
      ];
      return bannedTokens.flatMap((token) =>
        expect(!source.includes(token), `Helper should not contain ${token}.`),
      );
    }),
  ];

  return report(results);
};
