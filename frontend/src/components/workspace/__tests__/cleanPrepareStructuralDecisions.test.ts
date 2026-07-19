import {
  areStructuralDecisionReadinessEqual,
  getStructuralDecisionReadiness,
  getSuggestedFixCleaningPlan,
  getSuggestedFixDecision,
  getSuggestedFixDecisionProgress,
  getSuggestedFixKeepOriginalLabel,
  getSuggestedFixRecommendationLabel,
  type SuggestedFix,
  type SuggestedFixDecision,
} from "../CleanPrepareReviewPanel";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type CleanPrepareStructuralDecisionFixtureReport = {
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

const report = (results: FixtureResult[]): CleanPrepareStructuralDecisionFixtureReport => ({
  results,
  passed: results.filter((result) => result.ok),
  failed: results.filter((result) => !result.ok),
});

const expect = (condition: boolean, message: string): string[] => condition ? [] : [message];

const fixes: SuggestedFix[] = [
  {
    id: "sparse_layout_gap",
    title: "Ignore layout separator rows",
    detail: "Sheet A, rows 4-6: Sparse layout gaps appear between populated worksheet regions.",
  },
  {
    id: "side_note_region_candidate",
    title: "Exclude side-note columns",
    detail: "Sheet A, columns J-K: A separated right-side region may contain notes.",
  },
  {
    id: "dataset:missing-values",
    title: "Review blank cells before filling values",
    detail: "2 fields contain blank values.",
  },
];

const decisions = (
  values: Record<string, SuggestedFixDecision>,
): Record<string, SuggestedFixDecision> => values;

export const runCleanPrepareStructuralDecisionFixtures =
  (): CleanPrepareStructuralDecisionFixtureReport => {
    const results = [
      fixture("recommendation with no saved decision initializes unresolved", () => [
        ...expect(
          getSuggestedFixDecision("sparse_layout_gap", decisions({})) === "unresolved",
          "Missing structural decision should be unresolved.",
        ),
      ]),
      fixture("unresolved is not an apply decision", () => {
        const plan = getSuggestedFixCleaningPlan([fixes[0]], decisions({}));
        return expect(plan.length === 0, "Unresolved decision should not appear in cleaning plan.");
      }),
      fixture("existing saved decide-later remains decide-later", () => [
        ...expect(
          getSuggestedFixDecision("sparse_layout_gap", decisions({ sparse_layout_gap: "decide_later" })) === "decide_later",
          "Saved decide_later should remain explicit defer.",
        ),
      ]),
      fixture("existing saved accepted recommendation remains accepted", () => [
        ...expect(
          getSuggestedFixDecision("sparse_layout_gap", decisions({ sparse_layout_gap: "use_recommendation" })) === "use_recommendation",
          "Saved accepted recommendation should remain accepted.",
        ),
      ]),
      fixture("existing saved keep-original remains preserved", () => [
        ...expect(
          getSuggestedFixDecision("sparse_layout_gap", decisions({ sparse_layout_gap: "keep_original" })) === "keep_original",
          "Saved keep_original should remain preserved.",
        ),
      ]),
      fixture("selecting recommendation changes unresolved to accepted", () => {
        const current = decisions({});
        const next = { ...current, sparse_layout_gap: "use_recommendation" as const };
        return expect(
          getSuggestedFixDecision("sparse_layout_gap", next) === "use_recommendation",
          "Recommendation selection should become accepted.",
        );
      }),
      fixture("selecting keep-original changes unresolved to resolved", () => {
        const progress = getSuggestedFixDecisionProgress([fixes[0]], decisions({ sparse_layout_gap: "keep_original" }));
        return expect(progress.resolved === 1 && progress.unresolved === 0, "Keep original should count as resolved.");
      }),
      fixture("selecting decide-later changes unresolved to deferred", () => {
        const progress = getSuggestedFixDecisionProgress([fixes[0]], decisions({ sparse_layout_gap: "decide_later" }));
        return expect(progress.deferred === 1 && progress.unresolved === 0, "Decide later should count as deferred.");
      }),
      fixture("progress counts distinguish states", () => {
        const progress = getSuggestedFixDecisionProgress(
          fixes,
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "decide_later",
          }),
        );
        return [
          ...expect(progress.total === 3, "Progress total should include every recommendation."),
          ...expect(progress.resolved === 1, "Progress should count accepted decisions as resolved."),
          ...expect(progress.unresolved === 1, "Progress should count untouched decisions as unresolved."),
          ...expect(progress.deferred === 1, "Progress should count explicit deferrals."),
        ];
      }),
      fixture("cleaning-plan summary includes accepted actions", () => {
        const plan = getSuggestedFixCleaningPlan([fixes[0]], decisions({ sparse_layout_gap: "use_recommendation" }));
        return expect(
          plan.includes("Exclude layout separator rows from the cleaned copy"),
          "Accepted recommendation should add direct action to plan.",
        );
      }),
      fixture("cleaning-plan summary includes keep-original decisions", () => {
        const plan = getSuggestedFixCleaningPlan([fixes[0]], decisions({ sparse_layout_gap: "keep_original" }));
        return expect(plan.includes("Keep layout separator rows"), "Keep original should add preservation action.");
      }),
      fixture("cleaning-plan summary counts deferred decisions", () => {
        const plan = getSuggestedFixCleaningPlan(
          fixes,
          decisions({
            sparse_layout_gap: "decide_later",
            side_note_region_candidate: "decide_later",
          }),
        );
        return expect(plan.includes("2 recommendations deferred"), "Plan should summarize deferred count.");
      }),
      fixture("unresolved values are not included in apply plan", () => {
        const plan = getSuggestedFixCleaningPlan(fixes, decisions({ "dataset:missing-values": "use_recommendation" }));
        return [
          ...expect(plan.length === 1, "Only explicit decisions should appear."),
          ...expect(!plan.includes("unresolved"), "Unresolved should never be emitted."),
        ];
      }),
      fixture("no unsupported unresolved strategy reaches backend-shaped decisions", () => {
        const explicitDecisions = Object.values(
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "keep_original",
            "dataset:missing-values": "decide_later",
          }),
        );
        return expect(
          !explicitDecisions.includes("unresolved"),
          "Explicit decision values should not include unresolved.",
        );
      }),
      fixture("next apply local gating model blocks unresolved", () => {
        const readiness = getStructuralDecisionReadiness(fixes, decisions({ sparse_layout_gap: "use_recommendation" }));
        return [
          ...expect(readiness.canContinueToApply === false, "Unresolved count should block Apply."),
          ...expect(readiness.unresolvedCount === 2, "Two recommendations should still be unresolved."),
        ];
      }),
      fixture("next apply local gating model allows resolved or deferred", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "keep_original",
            "dataset:missing-values": "decide_later",
          }),
        );
        return [
          ...expect(readiness.canContinueToApply === true, "No unresolved recommendations should allow Apply."),
          ...expect(readiness.deferredCount === 1, "Explicit deferral should remain counted."),
        ];
      }),
      fixture("all unresolved decisions cannot continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(fixes, decisions({}));
        return [
          ...expect(readiness.canContinueToApply === false, "Untouched recommendations should block Apply."),
          ...expect(readiness.unresolvedCount === 3, "All three recommendations should be unresolved."),
        ];
      }),
      fixture("accepted plus unresolved decisions cannot continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({ sparse_layout_gap: "use_recommendation" }),
        );
        return expect(readiness.canContinueToApply === false, "Remaining unresolved decisions should block.");
      }),
      fixture("accepted plus keep-original plus unresolved cannot continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "keep_original",
          }),
        );
        return expect(readiness.canContinueToApply === false, "One unresolved recommendation should block.");
      }),
      fixture("all accepted decisions can continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "use_recommendation",
            "dataset:missing-values": "use_recommendation",
          }),
        );
        return expect(readiness.canContinueToApply === true, "Accepted recommendations should count as handled.");
      }),
      fixture("all keep-original decisions can continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "keep_original",
            side_note_region_candidate: "keep_original",
            "dataset:missing-values": "keep_original",
          }),
        );
        return expect(readiness.canContinueToApply === true, "Keep-original decisions should count as handled.");
      }),
      fixture("all decide-later decisions can continue with deferred count equal total", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "decide_later",
            side_note_region_candidate: "decide_later",
            "dataset:missing-values": "decide_later",
          }),
        );
        return [
          ...expect(readiness.canContinueToApply === true, "Explicit deferrals should allow Apply."),
          ...expect(readiness.deferredCount === readiness.totalCount, "Deferred count should equal total."),
        ];
      }),
      fixture("empty recommendation list can continue explicitly", () => {
        const readiness = getStructuralDecisionReadiness([], decisions({}));
        return [
          ...expect(readiness.canContinueToApply === true, "No recommendations should not block Apply."),
          ...expect(readiness.blockingMessage === null, "No recommendations should have no blocker."),
        ];
      }),
      fixture("blocking message includes unresolved count", () => {
        const readiness = getStructuralDecisionReadiness(fixes, decisions({ sparse_layout_gap: "keep_original" }));
        return expect(
          readiness.blockingMessage?.includes("2 recommendations") === true,
          "Blocking message should include unresolved count.",
        );
      }),
      fixture("parent readiness callback model updates only on meaningful changes", () => {
        const first = getStructuralDecisionReadiness(fixes, decisions({}));
        const duplicate = getStructuralDecisionReadiness(fixes, decisions({}));
        const changed = getStructuralDecisionReadiness(
          fixes,
          decisions({ sparse_layout_gap: "use_recommendation" }),
        );
        let current = null as ReturnType<typeof getStructuralDecisionReadiness> | null;
        let updateCount = 0;
        [first, duplicate, changed].forEach((next) => {
          if (!areStructuralDecisionReadinessEqual(current, next)) {
            current = next;
            updateCount += 1;
          }
        });
        return expect(updateCount === 2, "Only meaningful readiness changes should update parent state.");
      }),
      fixture("direct action labels match recommendation", () => [
        ...expect(
          getSuggestedFixRecommendationLabel(fixes[0]) === "Exclude layout separator rows from the cleaned copy",
          "Layout recommendation should be direct.",
        ),
        ...expect(
          getSuggestedFixRecommendationLabel(fixes[1]) === "Exclude side-note columns from the cleaned copy",
          "Side-note recommendation should be direct.",
        ),
        ...expect(
          getSuggestedFixKeepOriginalLabel(fixes[2]) === "Keep blanks as-is",
          "Blank-cell keep-original wording should match current behavior.",
        ),
      ]),
      fixture("existing storage key and scope remain external to structural decisions", () => {
        const sourceMarkers = [
          getSuggestedFixDecision.toString(),
          getSuggestedFixDecisionProgress.toString(),
          getSuggestedFixCleaningPlan.toString(),
          getStructuralDecisionReadiness.toString(),
          areStructuralDecisionReadinessEqual.toString(),
        ].join("\n");
        return [
          ...expect(!sourceMarkers.includes("localStorage"), "Structural helpers should not introduce storage."),
          ...expect(!sourceMarkers.includes("filtraqueri:"), "Structural helpers should not introduce a storage key."),
        ];
      }),
      fixture("static safety scan contains no forbidden markers", () => {
        const sourceMarkers = [
          getSuggestedFixDecision.toString(),
          getSuggestedFixDecisionProgress.toString(),
          getSuggestedFixCleaningPlan.toString(),
          getSuggestedFixRecommendationLabel.toString(),
          getSuggestedFixKeepOriginalLabel.toString(),
          getStructuralDecisionReadiness.toString(),
          areStructuralDecisionReadinessEqual.toString(),
        ].join("\n");
        const forbidden = [
          "fetch(",
          "XMLHttpRequest",
          "sessionStorage",
          "indexedDB",
          "provider",
          "SQL execution",
          "DuckDB",
          "Date.now",
          "Math.random",
        ];
        return forbidden.flatMap((token) =>
          sourceMarkers.includes(token) ? [`Structural decision helper includes forbidden token ${token}.`] : [],
        );
      }),
    ];

    return report(results);
  };
