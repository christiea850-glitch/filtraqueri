import type { SchemaColumn } from "../../dataset/datasetTypes";
import {
  createEmptyTransformationPipeline,
  createPipelineId,
  createTransformationStep,
  type TransformationPipeline,
  type TransformationStep,
  type TransformationStepKind,
} from "../transformationPipeline";
import {
  isTransformationPreviewStepSupported,
  previewTransformationPipeline,
  type PreviewRow,
  type TransformationPipelinePreview,
} from "../previewTransformationPipeline";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type TransformationPreviewFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const column = (
  name: string,
  inferredType: SchemaColumn["inferred_type"],
): SchemaColumn => ({
  name,
  type: inferredType,
  inferred_type: inferredType,
  null_count: 0,
  unique_count: 3,
  sample_values: [],
});

const numericColumn = column("salary", "numeric");
const textColumn = column("email", "text");
const categoricalColumn = column("status", "categorical");
const booleanColumn = column("is_active", "boolean");
const dateColumn = column("hire_date", "date");

const pipelineInput = {
  worksheetId: "worksheet:preview",
  sourceTableName: "preview_table",
  sourceType: "original" as const,
  seed: "dataset:preview:worksheet:preview",
};

const pipelineId = createPipelineId(pipelineInput.seed);

const report = (results: FixtureResult[]): TransformationPreviewFixtureReport => ({
  results,
  passed: results.filter((result) => result.ok),
  failed: results.filter((result) => !result.ok),
});

const fixture = (name: string, assert: () => string[]): FixtureResult => {
  const failureReasons = assert();
  return {
    name,
    ok: failureReasons.length === 0,
    failureReasons,
  };
};

const expect = (condition: boolean, message: string): string[] => (condition ? [] : [message]);

const expectClose = (actual: unknown, expected: number, label: string): string[] =>
  typeof actual === "number" && Math.abs(actual - expected) < 0.000001
    ? []
    : [`${label}: expected ${expected}, got ${String(actual)}`];

const step = (
  kind: TransformationStepKind,
  targetColumn: SchemaColumn,
  sequenceIndex = 0,
  outputColumn?: string,
): TransformationStep =>
  createTransformationStep({
    pipelineId,
    sequenceIndex,
    kind,
    targetColumn,
    outputColumn,
    parameters:
      kind === "fill_missing_custom"
        ? { kind, customValue: "n/a" }
        : kind === "cap_outliers_percentile"
          ? { kind, lowerPercentile: 25, upperPercentile: 75 }
          : kind === "ordinal_encode"
            ? { kind, order: ["low", "medium", "high"] }
            : kind === "days_since"
              ? { kind, anchorDate: "2026-01-10" }
              : kind === "sql_select_transform"
                ? { kind, sqlDraft: "select placeholder" }
                : { kind } as never,
  });

const pipelineWithSteps = (steps: TransformationStep[]): TransformationPipeline =>
  createEmptyTransformationPipeline({
    ...pipelineInput,
    steps,
  });

const preview = (
  rows: PreviewRow[],
  steps: TransformationStep[],
  schema: SchemaColumn[] = [numericColumn, textColumn, categoricalColumn, booleanColumn, dateColumn],
): TransformationPipelinePreview =>
  previewTransformationPipeline({
    rows,
    pipeline: pipelineWithSteps(steps),
    schema,
  });

const sourceRows = [
  { salary: null, email: " A@EXAMPLE.COM ", status: "low", is_active: true, hire_date: "2026-01-08" },
  { salary: 10, email: "B@EXAMPLE.COM ", status: "medium", is_active: false, hire_date: "2026-01-09" },
  { salary: 30, email: null, status: "low", is_active: null, hire_date: "bad-date" },
];

export const runTransformationPreviewFixtures = (): TransformationPreviewFixtureReport => {
  const results = [
    fixture("empty pipeline returns empty", () => {
      const result = previewTransformationPipeline({
        rows: sourceRows,
        pipeline: createEmptyTransformationPipeline(pipelineInput),
        schema: [numericColumn],
      });
      return [
        ...expect(result.status === "empty", "Empty pipeline should return empty."),
        ...expect(result.previewRowCount === sourceRows.length, "Empty preview should retain row count."),
      ];
    }),
    fixture("input rows are not mutated", () => {
      const rows = [{ salary: null }, { salary: 3 }];
      const before = JSON.stringify(rows);
      preview(rows, [step("fill_missing_zero", numericColumn)]);
      return expect(JSON.stringify(rows) === before, "Preview should not mutate input rows.");
    }),
    fixture("fill_missing_zero", () => {
      const result = preview([{ salary: null }, { salary: 4 }], [step("fill_missing_zero", numericColumn)]);
      return [
        ...expect(result.transformedRows[0].salary === 0, "Missing salary should become 0."),
        ...expect(result.transformedRows[1].salary === 4, "Present salary should be preserved."),
      ];
    }),
    fixture("fill_missing_custom", () => {
      const result = preview([{ salary: null }], [step("fill_missing_custom", numericColumn)]);
      return expect(result.transformedRows[0].salary === "n/a", "Missing salary should use custom value.");
    }),
    fixture("fill_missing_mean", () => {
      const result = preview([{ salary: null }, { salary: 2 }, { salary: 4 }], [step("fill_missing_mean", numericColumn)]);
      return expect(result.transformedRows[0].salary === 3, "Missing salary should use sample mean.");
    }),
    fixture("fill_missing_median with odd values", () => {
      const result = preview([{ salary: null }, { salary: 5 }, { salary: 1 }, { salary: 9 }], [step("fill_missing_median", numericColumn)]);
      return expect(result.transformedRows[0].salary === 5, "Missing salary should use odd median.");
    }),
    fixture("fill_missing_median with even values", () => {
      const result = preview([{ salary: null }, { salary: 2 }, { salary: 10 }], [step("fill_missing_median", numericColumn)]);
      return expect(result.transformedRows[0].salary === 6, "Missing salary should use even median average.");
    }),
    fixture("fill_missing_mode with deterministic tie-breaking", () => {
      const result = preview([{ status: null }, { status: "b" }, { status: "a" }, { status: "b" }, { status: "a" }], [step("fill_missing_mode", categoricalColumn)]);
      return expect(result.transformedRows[0].status === "b", "First value to reach tied mode should win.");
    }),
    fixture("fill_missing_unknown", () => {
      const result = preview([{ email: null }], [step("fill_missing_unknown", textColumn)]);
      return expect(result.transformedRows[0].email === "Unknown", "Missing text should become Unknown.");
    }),
    fixture("trim_whitespace", () => {
      const result = preview([{ email: " value " }, { email: 7 }], [step("trim_whitespace", textColumn)]);
      return [
        ...expect(result.transformedRows[0].email === "value", "String should be trimmed."),
        ...expect(result.transformedRows[1].email === 7, "Non-string should be preserved."),
      ];
    }),
    fixture("lowercase", () => {
      const result = preview([{ email: "ABC" }], [step("lowercase", textColumn)]);
      return expect(result.transformedRows[0].email === "abc", "String should be lowercased.");
    }),
    fixture("uppercase", () => {
      const result = preview([{ email: "abc" }], [step("uppercase", textColumn)]);
      return expect(result.transformedRows[0].email === "ABC", "String should be uppercased.");
    }),
    fixture("boolean_to_integer", () => {
      const result = preview([{ is_active: true }, { is_active: false }, { is_active: "yes" }], [step("boolean_to_integer", booleanColumn)]);
      return [
        ...expect(result.transformedRows[0].is_active === 1, "True should become 1."),
        ...expect(result.transformedRows[1].is_active === 0, "False should become 0."),
        ...expect(result.transformedRows[2].is_active === "yes", "Non-boolean should be preserved."),
        ...expect(result.warnings.length === 1, "Non-boolean preservation should warn."),
      ];
    }),
    fixture("extract_year", () => {
      const result = preview([{ hire_date: "2026-02-03" }], [step("extract_year", dateColumn, 0, "hire_date_year")]);
      return expect(result.transformedRows[0].hire_date_year === 2026, "Year should be extracted in UTC.");
    }),
    fixture("extract_month", () => {
      const result = preview([{ hire_date: "2026-02-03" }], [step("extract_month", dateColumn, 0, "hire_date_month")]);
      return expect(result.transformedRows[0].hire_date_month === 2, "Month should be 1 through 12.");
    }),
    fixture("extract_quarter", () => {
      const result = preview([{ hire_date: "2026-07-03" }], [step("extract_quarter", dateColumn, 0, "hire_date_quarter")]);
      return expect(result.transformedRows[0].hire_date_quarter === 3, "Quarter should be 1 through 4.");
    }),
    fixture("extract_day_of_week", () => {
      const result = preview([{ hire_date: "2026-01-08" }], [step("extract_day_of_week", dateColumn, 0, "hire_date_day_of_week")]);
      return expect(result.transformedRows[0].hire_date_day_of_week === "Thursday", "Weekday should use full English name.");
    }),
    fixture("days_since with valid dates", () => {
      const result = preview([{ hire_date: "2026-01-08" }], [step("days_since", dateColumn, 0, "hire_date_days_since")]);
      return expect(result.transformedRows[0].hire_date_days_since === 2, "Days since should be anchor date minus source date.");
    }),
    fixture("days_since with invalid anchor blocks", () => {
      const invalidStep = createTransformationStep({
        pipelineId,
        sequenceIndex: 0,
        kind: "days_since",
        targetColumn: dateColumn,
        outputColumn: "hire_date_days_since",
        parameters: { kind: "days_since", anchorDate: "not-a-date" },
      });
      const result = preview([{ hire_date: "2026-01-08" }], [invalidStep]);
      return [
        ...expect(result.status === "blocked", "Invalid anchor should block preview."),
        ...expect(result.stepResults[0].blockers[0].includes("valid anchor date"), "Blocker should name anchor date."),
      ];
    }),
    fixture("log_transform positive numbers", () => {
      const result = preview([{ salary: 1 }, { salary: Math.E }], [step("log_transform", numericColumn, 0, "salary_log")]);
      return [
        ...expectClose(result.transformedRows[0].salary_log, 0, "Log of 1"),
        ...expectClose(result.transformedRows[1].salary_log, 1, "Log of e"),
      ];
    }),
    fixture("log_transform invalid numbers become null plus warning", () => {
      const result = preview([{ salary: 0 }, { salary: -1 }, { salary: "5" }], [step("log_transform", numericColumn, 0, "salary_log")]);
      return [
        ...expect(result.transformedRows.every((row) => row.salary_log === null), "Invalid log inputs should become null."),
        ...expect(result.warnings.length === 1, "Invalid log inputs should warn."),
      ];
    }),
    fixture("z_score_scale", () => {
      const result = preview([{ salary: 10 }, { salary: 20 }, { salary: 30 }], [step("z_score_scale", numericColumn, 0, "salary_z")]);
      return [
        ...expectClose(result.transformedRows[1].salary_z, 0, "Middle z-score"),
        ...expect(result.status === "ready", "Z-score should be ready with distinct values."),
      ];
    }),
    fixture("z_score_scale blocks zero standard deviation", () => {
      const result = preview([{ salary: 5 }, { salary: 5 }], [step("z_score_scale", numericColumn, 0, "salary_z")]);
      return expect(result.status === "blocked", "Zero standard deviation should block.");
    }),
    fixture("min_max_scale", () => {
      const result = preview([{ salary: 10 }, { salary: 20 }, { salary: 30 }], [step("min_max_scale", numericColumn, 0, "salary_scaled")]);
      return [
        ...expect(result.transformedRows[0].salary_scaled === 0, "Minimum should scale to 0."),
        ...expect(result.transformedRows[2].salary_scaled === 1, "Maximum should scale to 1."),
      ];
    }),
    fixture("min_max_scale blocks equal min/max", () => {
      const result = preview([{ salary: 5 }, { salary: 5 }], [step("min_max_scale", numericColumn, 0, "salary_scaled")]);
      return expect(result.status === "blocked", "Equal min/max should block.");
    }),
    fixture("ordinal_encode with configured order", () => {
      const result = preview([{ status: "low" }, { status: "high" }, { status: "missing" }], [step("ordinal_encode", categoricalColumn, 0, "status_ordinal")]);
      return [
        ...expect(result.transformedRows[0].status_ordinal === 0, "Ordinal preview should use zero-based indexes."),
        ...expect(result.transformedRows[1].status_ordinal === 2, "High should map to index 2."),
        ...expect(result.transformedRows[2].status_ordinal === null, "Unmatched categories should become null."),
      ];
    }),
    fixture("frequency_encode", () => {
      const result = preview([{ status: "a" }, { status: "a" }, { status: "b" }, { status: null }], [step("frequency_encode", categoricalColumn, 0, "status_frequency")]);
      return [
        ...expect(result.transformedRows[0].status_frequency === 2 / 3, "Frequency should be relative to non-missing sample values."),
        ...expect(result.transformedRows[2].status_frequency === 1 / 3, "Single category should have one-third frequency."),
        ...expect(result.transformedRows[3].status_frequency === null, "Missing category frequency should be null."),
      ];
    }),
    fixture("cap_outliers_percentile uses linear interpolation", () => {
      const result = preview([{ salary: 0 }, { salary: 10 }, { salary: 20 }, { salary: 30 }, { salary: 40 }], [step("cap_outliers_percentile", numericColumn)]);
      return [
        ...expect(result.transformedRows[0].salary === 10, "25th percentile should cap low value to 10."),
        ...expect(result.transformedRows[4].salary === 30, "75th percentile should cap high value to 30."),
      ];
    }),
    fixture("unsupported one_hot_encode blocks preview", () => {
      const result = preview([{ status: "a" }], [step("one_hot_encode", categoricalColumn)]);
      return [
        ...expect(isTransformationPreviewStepSupported("one_hot_encode") === false, "One-hot should be unsupported."),
        ...expect(result.status === "blocked", "Unsupported one-hot should block."),
      ];
    }),
    fixture("pipeline order is respected", () => {
      const result = preview([{ email: " A " }], [
        step("trim_whitespace", textColumn, 0),
        step("lowercase", textColumn, 1),
      ]);
      return expect(result.transformedRows[0].email === "a", "Trim should run before lowercase.");
    }),
    fixture("blocked step prevents later steps from being applied", () => {
      const result = preview([{ salary: 5, email: "a" }], [
        step("z_score_scale", numericColumn, 0, "salary_z"),
        step("uppercase", textColumn, 1),
      ]);
      return [
        ...expect(result.status === "blocked", "Blocking first step should block preview."),
        ...expect(result.stepResults.length === 1, "Later steps should not be presented as applied."),
      ];
    }),
    fixture("new-column outputColumn is used", () => {
      const result = preview([{ salary: 10 }], [step("log_transform", numericColumn, 0, "custom_log")]);
      return expect(Object.prototype.hasOwnProperty.call(result.transformedRows[0], "custom_log"), "Derived step should use outputColumn.");
    }),
    fixture("derived source column remains unchanged", () => {
      const result = preview([{ salary: 10 }], [step("log_transform", numericColumn, 0, "salary_log")]);
      return expect(result.transformedRows[0].salary === 10, "Derived transform should not mutate source column.");
    }),
    fixture("multiple steps targeting same column run sequentially", () => {
      const result = preview([{ email: " A " }], [
        step("trim_whitespace", textColumn, 0),
        step("uppercase", textColumn, 1),
      ]);
      return expect(result.transformedRows[0].email === "A", "Same-column steps should run in order.");
    }),
    fixture("preview changes include before and after values", () => {
      const result = preview([{ email: " A " }], [step("trim_whitespace", textColumn)]);
      const change = result.changes[0];
      return [
        ...expect(change.beforeValue === " A ", "Change should include before value."),
        ...expect(change.afterValue === "A", "Change should include after value."),
      ];
    }),
    fixture("safety source scan contains no forbidden markers", () => {
      const sourceMarkers = [
        previewTransformationPipeline.toString(),
        isTransformationPreviewStepSupported.toString(),
      ].join("\n");
      const forbidden = [
        "fetch(",
        "XMLHttpRequest",
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "execute",
        "DuckDB",
        "provider",
        "Date.now",
        "Math.random",
      ];
      return forbidden.flatMap((token) =>
        sourceMarkers.includes(token) ? [`Preview helper source includes forbidden token ${token}.`] : [],
      );
    }),
  ];

  return report(results);
};
