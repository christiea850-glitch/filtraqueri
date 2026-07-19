import type { SchemaColumn } from "../../dataset/datasetTypes";
import {
  createBlockedTransformationStep,
  createEmptyTransformationPipeline,
  createPipelineId,
  createStepId,
  createTransformationStep,
  getSupportedTransformationsForColumn,
  getTransformationPipelineReadiness,
  isTransformationStepSupportedForColumn,
  summarizeTransformationPipeline,
  summarizeTransformationStep,
  type TransformationBlocker,
  type TransformationPipeline,
  type TransformationStep,
  type TransformationStepKind,
} from "../transformationPipeline";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type TransformationPipelineFixtureReport = {
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

const numericColumn = column("amount", "numeric");
const categoricalColumn = column("status", "categorical");
const textColumn = column("customer_name", "text");
const dateColumn = column("invoice_date", "date");
const booleanColumn = column("is_active", "boolean");

const pipelineInput = {
  worksheetId: "worksheet:alpha",
  sourceTableName: "alpha_table",
  sourceType: "original" as const,
  seed: "dataset:alpha:worksheet:alpha",
};

const validStep = (
  kind: TransformationStepKind,
  targetColumn: SchemaColumn,
  sequenceIndex = 0,
): TransformationStep =>
  createTransformationStep({
    pipelineId: createPipelineId(pipelineInput.seed),
    sequenceIndex,
    kind,
    targetColumn,
    parameters:
      kind === "fill_missing_custom"
        ? { kind, customValue: "n/a" }
        : kind === "cap_outliers_percentile"
          ? { kind, lowerPercentile: 5, upperPercentile: 95 }
          : kind === "ordinal_encode"
            ? { kind, order: ["low", "medium", "high"] }
            : kind === "days_since"
              ? { kind, anchorDate: "2026-01-01" }
              : { kind } as never,
  });

const report = (results: FixtureResult[]): TransformationPipelineFixtureReport => ({
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

const expect = (condition: boolean, message: string) => (condition ? [] : [message]);

const expectArray = <T>(actual: T[], expected: T[], label: string): string[] => {
  const actualValue = actual.join(",");
  const expectedValue = expected.join(",");
  return actualValue === expectedValue ? [] : [`${label}: expected ${expectedValue}, got ${actualValue}`];
};

const sqlKeywordPattern = /\b(SELECT|WHERE|UPDATE|DELETE|INSERT|ALTER|DROP)\b/i;

const assertNoSqlKeywords = (value: string, label: string): string[] =>
  sqlKeywordPattern.test(value) ? [`${label} emitted a blocked SQL keyword: ${value}`] : [];

const assertPipelineSafety = (pipeline: TransformationPipeline): string[] => {
  const flags = [
    "noSqlExecution",
    "noDuckDbExecution",
    "noBackendCall",
    "noProviderCall",
    "noNetworkCall",
    "noPersistence",
    "noRowMutation",
    "noWorkbookMutation",
    "noAutoRun",
    "noEditorMutation",
  ] as const;
  return flags.flatMap((flag) =>
    pipeline.safety[flag] === true ? [] : [`Safety flag ${flag} was not literal true.`],
  );
};

const createPipelineWithSteps = (steps: TransformationStep[]): TransformationPipeline =>
  createEmptyTransformationPipeline({
    ...pipelineInput,
    steps,
  });

export const runTransformationPipelineFixtures = (): TransformationPipelineFixtureReport => {
  const pipelineId = createPipelineId(pipelineInput.seed);
  const emptyPipeline = createEmptyTransformationPipeline(pipelineInput);
  const blockedStep = createBlockedTransformationStep({
    pipelineId,
    sequenceIndex: 2,
    kind: "uppercase",
    targetColumn: textColumn,
    blocker: {
      code: "unsupported_kind_for_type",
      message: "Fixture blocker.",
    } satisfies TransformationBlocker,
  });
  const validSteps = [
    validStep("fill_missing_mean", numericColumn, 0),
    validStep("trim_whitespace", textColumn, 1),
  ];
  const validPipeline = createPipelineWithSteps(validSteps);
  const blockedPipeline = createPipelineWithSteps([validStep("uppercase", textColumn, 0), blockedStep]);
  const sqlStep = createTransformationStep({
    pipelineId,
    sequenceIndex: 3,
    kind: "sql_select_transform",
    targetColumn: textColumn,
    parameters: { kind: "sql_select_transform", sqlDraft: "select placeholder" },
  });

  const results = [
    fixture("empty pipeline", () => [
      ...expect(emptyPipeline.status === "empty", "Empty pipeline should have empty status."),
      ...expect(emptyPipeline.steps.length === 0, "Empty pipeline should not create steps."),
      ...expect(emptyPipeline.readiness.previewReady === false, "Empty pipeline preview should be false."),
      ...expect(emptyPipeline.readiness.applyReady === false, "Empty pipeline apply should be false."),
      ...expect(
        emptyPipeline.readiness.reasons.includes("empty_pipeline"),
        "Empty pipeline should include empty_pipeline reason.",
      ),
    ]),
    fixture("numeric supported operations", () =>
      expectArray(getSupportedTransformationsForColumn(numericColumn), [
        "fill_missing_mean",
        "fill_missing_median",
        "fill_missing_mode",
        "fill_missing_zero",
        "fill_missing_custom",
        "cap_outliers_percentile",
        "log_transform",
        "z_score_scale",
        "min_max_scale",
      ], "numeric operations"),
    ),
    fixture("categorical supported operations", () =>
      expectArray(getSupportedTransformationsForColumn(categoricalColumn), [
        "fill_missing_mode",
        "fill_missing_unknown",
        "one_hot_encode",
        "ordinal_encode",
        "frequency_encode",
      ], "categorical operations"),
    ),
    fixture("text supported operations", () =>
      expectArray(getSupportedTransformationsForColumn(textColumn), [
        "fill_missing_unknown",
        "trim_whitespace",
        "lowercase",
        "uppercase",
      ], "text operations"),
    ),
    fixture("date supported operations", () =>
      expectArray(getSupportedTransformationsForColumn(dateColumn), [
        "extract_year",
        "extract_month",
        "extract_quarter",
        "extract_day_of_week",
        "days_since",
      ], "date operations"),
    ),
    fixture("boolean supported operations", () =>
      expectArray(getSupportedTransformationsForColumn(booleanColumn), [
        "boolean_to_integer",
        "fill_missing_true",
        "fill_missing_false",
      ], "boolean operations"),
    ),
    fixture("unsupported operation returns false and blocked", () => {
      const step = createTransformationStep({
        pipelineId,
        sequenceIndex: 4,
        kind: "log_transform",
        targetColumn: textColumn,
      });
      return [
        ...expect(
          isTransformationStepSupportedForColumn("log_transform", textColumn) === false,
          "Text column should not support log_transform.",
        ),
        ...expect(step.status === "blocked", "Unsupported step should be blocked."),
        ...expect(
          step.blockers.some((item) => item.code === "unsupported_kind_for_type"),
          "Unsupported step should include unsupported_kind_for_type.",
        ),
      ];
    }),
    fixture("missing parameters and invalid percentile ranges block steps", () => {
      const missingCustom = createTransformationStep({
        pipelineId,
        sequenceIndex: 5,
        kind: "fill_missing_custom",
        targetColumn: numericColumn,
      });
      const invalidPercentile = createTransformationStep({
        pipelineId,
        sequenceIndex: 6,
        kind: "cap_outliers_percentile",
        targetColumn: numericColumn,
        parameters: { kind: "cap_outliers_percentile", lowerPercentile: 90, upperPercentile: 10 },
      });
      return [
        ...expect(missingCustom.status === "blocked", "Missing custom value should block the step."),
        ...expect(
          missingCustom.blockers.some((item) => item.code === "missing_parameter"),
          "Missing custom value should include missing_parameter.",
        ),
        ...expect(invalidPercentile.status === "blocked", "Invalid percentile range should block the step."),
        ...expect(
          invalidPercentile.blockers.some((item) => item.code === "invalid_percentile_range"),
          "Invalid percentile range should include invalid_percentile_range.",
        ),
      ];
    }),
    fixture("deterministic pipeline ids", () => [
      ...expect(
        createPipelineId("same-seed") === createPipelineId("same-seed"),
        "Pipeline id should be stable for the same seed.",
      ),
      ...expect(
        createPipelineId("same-seed") !== createPipelineId("other-seed"),
        "Pipeline id should vary by seed.",
      ),
    ]),
    fixture("deterministic step ids", () => [
      ...expect(
        createStepId(pipelineId, 1) === createStepId(pipelineId, 1),
        "Step id should be stable for the same pipeline and sequence.",
      ),
      ...expect(
        createStepId(pipelineId, 1) !== createStepId(pipelineId, 2),
        "Step id should vary by sequence.",
      ),
    ]),
    fixture("deterministic summaries", () => {
      const first = summarizeTransformationStep(validStep("fill_missing_zero", numericColumn, 5));
      const second = summarizeTransformationStep(validStep("fill_missing_zero", numericColumn, 5));
      return [
        ...expect(first === second, "Step summaries should be deterministic."),
        ...expect(
          summarizeTransformationPipeline(validPipeline) === summarizeTransformationPipeline(validPipeline),
          "Pipeline summaries should be deterministic.",
        ),
      ];
    }),
    fixture("empty pipeline readiness blocked", () => {
      const readiness = getTransformationPipelineReadiness(emptyPipeline);
      return [
        ...expect(readiness.previewReady === false, "Empty readiness preview should be false."),
        ...expect(readiness.applyReady === false, "Empty readiness apply should be false."),
        ...expect(readiness.reasons.includes("empty_pipeline"), "Empty readiness should name empty pipeline."),
      ];
    }),
    fixture("pipeline with blocked step blocked", () => [
      ...expect(blockedPipeline.status === "blocked", "Blocked pipeline should have blocked status."),
      ...expect(blockedPipeline.readiness.previewReady === false, "Blocked pipeline preview should be false."),
      ...expect(blockedPipeline.readiness.applyReady === false, "Blocked pipeline apply should be false."),
      ...expect(
        blockedPipeline.readiness.reasons.includes("pipeline_has_blocked_step"),
        "Blocked pipeline should include pipeline_has_blocked_step.",
      ),
    ]),
    fixture("all valid steps previewReady true but applyReady false", () => [
      ...expect(validPipeline.readiness.previewReady === true, "Valid pipeline preview should be true."),
      ...expect(validPipeline.readiness.applyReady === false, "Valid pipeline apply should remain false."),
      ...expect(validPipeline.status === "draft", "Valid pipeline should stay draft in this slice."),
    ]),
    fixture("sql_select_transform blocked with sql_execution_disabled", () => [
      ...expect(sqlStep.status === "blocked", "Scripted cleaning step should be blocked."),
      ...expect(sqlStep.executionDisabled === true, "Scripted cleaning execution should be disabled."),
      ...expect(
        sqlStep.blockers.some((item) => item.code === "sql_execution_disabled"),
        "Scripted cleaning step should include sql_execution_disabled.",
      ),
      ...expect(
        createPipelineWithSteps([sqlStep]).readiness.previewReady === false,
        "Pipeline with scripted cleaning should not be preview-ready.",
      ),
    ]),
    fixture("no SQL keywords emitted from summaries", () => [
      ...assertNoSqlKeywords(sqlStep.summary, "step summary"),
      ...assertNoSqlKeywords(emptyPipeline.summary, "empty pipeline summary"),
      ...assertNoSqlKeywords(validPipeline.summary, "valid pipeline summary"),
      ...assertNoSqlKeywords(blockedPipeline.summary, "blocked pipeline summary"),
    ]),
    fixture("safety literals present on every pipeline", () => [
      ...assertPipelineSafety(emptyPipeline),
      ...assertPipelineSafety(validPipeline),
      ...assertPipelineSafety(blockedPipeline),
    ]),
    fixture("no backend/API/provider/SQL execution imports", () => {
      const sourceMarkers = [
        createPipelineId.toString(),
        createEmptyTransformationPipeline.toString(),
        createTransformationStep.toString(),
        summarizeTransformationPipeline.toString(),
      ].join("\n");
      const forbidden = [
        "fetch(",
        "XMLHttpRequest",
        "localStorage",
        "sessionStorage",
        "document.cookie",
        "execute",
        "provider",
      ];
      return forbidden.flatMap((token) =>
        sourceMarkers.includes(token) ? [`Contract helper source includes forbidden token ${token}.`] : [],
      );
    }),
  ];

  return report(results);
};
