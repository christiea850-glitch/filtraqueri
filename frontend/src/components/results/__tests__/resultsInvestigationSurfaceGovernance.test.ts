import ResultsInvestigationSurface from "../ResultsInvestigationSurface";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type ResultsInvestigationSurfaceGovernanceFixtureReport = {
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

const report = (results: FixtureResult[]): ResultsInvestigationSurfaceGovernanceFixtureReport => ({
  results,
  passed: results.filter((result) => result.ok),
  failed: results.filter((result) => !result.ok),
});

const expect = (condition: boolean, message: string): string[] => (condition ? [] : [message]);

const surfaceSource = () => `${ResultsInvestigationSurface}`;

export const runResultsInvestigationSurfaceGovernanceFixtures =
  (): ResultsInvestigationSurfaceGovernanceFixtureReport => {
    const results = [
      fixture("Results owner mounts Investigation Workspace Surface", () =>
        expect(
          surfaceSource().includes("InvestigationWorkspaceSurface"),
          "ResultsInvestigationSurface must mount InvestigationWorkspaceSurface.",
        ),
      ),
      fixture("Results owner passes read-only Investigation Workspace context", () => {
        const source = surfaceSource();
        return [
          ...expect(source.includes("investigationWorkspacePlan"), "Expected investigation workspace plan handoff."),
          ...expect(source.includes("investigationReport"), "Expected investigation report handoff."),
          ...expect(source.includes("narrativeReport"), "Expected narrative report handoff."),
          ...expect(source.includes("explainabilityPreview"), "Expected explainability preview handoff."),
          ...expect(source.includes("resultsContext"), "Expected read-only results context handoff."),
        ];
      }),
      fixture("Results context supplies row-count and filter-sort presentation metadata", () => {
        const source = surfaceSource();
        return [
          ...expect(source.includes("rowCountLabel"), "Expected row-count presentation metadata."),
          ...expect(source.includes("resultRowsLabel"), "Expected row-count label to derive from result rows label."),
          ...expect(source.includes("filterSortLabel"), "Expected filter/sort presentation metadata."),
        ];
      }),
      fixture("Results review UI remains mounted alongside Investigation Workspace", () => {
        const source = surfaceSource();
        return [
          ...expect(source.includes("results-review-strip"), "Expected Results review strip to remain operational."),
          ...expect(source.includes("results-operational-shell"), "Expected Human-mode Results review shell."),
          ...expect(source.includes("results-review-facts"), "Expected supporting result facts to remain visible."),
          ...expect(source.includes("ResultsInsightDetailPage"), "Expected Results detail route surface to remain wired."),
        ];
      }),
      fixture("Results owner does not introduce backend provider persistence or execution behavior", () => {
        const source = surfaceSource();
        const bannedTokens = [
          "fetch(",
          "XMLHttpRequest",
          "localStorage",
          "sessionStorage",
          "indexedDB",
          "provider",
          "executeWorkspaceQuery",
          "applyCleaningRecipe",
          "getCleaningRecipePreview",
        ];
        return bannedTokens.flatMap((token) =>
          expect(!source.includes(token), `Results owner should not contain ${token}.`),
        );
      }),
    ];

    return report(results);
  };
