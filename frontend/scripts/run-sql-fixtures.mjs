import { createServer } from "vite";

const fixtures = [
  {
    label: "Ask FiltraQueri adapter",
    modulePath: "/src/features/analyst/sql/__tests__/sqlAskFiltraQueriAdapter.test.ts",
    exportName: "runSqlAskFiltraQueriAdapterFixtures",
  },
  {
    label: "Transformation pipeline contract",
    modulePath: "/src/features/dataPreparation/__tests__/transformationPipeline.test.ts",
    exportName: "runTransformationPipelineFixtures",
  },
  {
    label: "Single-table template adapter",
    modulePath: "/src/features/analyst/sql/__tests__/sqlSingleTableTemplateAdapter.test.ts",
    exportName: "runSqlSingleTableTemplateAdapterFixtures",
  },
  {
    label: "Adaptive template metadata",
    modulePath: "/src/features/analyst/sql/__tests__/sqlTemplateAdaptiveMetadata.test.ts",
    exportName: "runSqlTemplateAdaptiveMetadataFixtures",
  },
  {
    label: "Adaptive fit classifier",
    modulePath: "/src/features/analyst/sql/__tests__/sqlAdaptiveFitClassifier.test.ts",
    exportName: "runSqlAdaptiveFitClassifierFixtures",
  },
  {
    label: "Template recommender",
    modulePath: "/src/features/analyst/sql/__tests__/sqlTemplateRecommender.test.ts",
    exportName: "runSqlTemplateRecommenderFixtures",
  },
  {
    label: "Template runtime badges",
    modulePath: "/src/features/analyst/sql/__tests__/sqlTemplateRuntimeBadges.test.ts",
    exportName: "runSqlTemplateRuntimeBadgeFixtures",
  },
  {
    label: "Report runtime badges",
    modulePath: "/src/features/analyst/sql/__tests__/sqlReportRuntimeBadges.test.ts",
    exportName: "runSqlReportRuntimeBadgeFixtures",
  },
  {
    label: "Candidate grounding",
    modulePath: "/src/features/analyst/sql/__tests__/sqlCandidateGrounding.test.ts",
    exportName: "runSqlCandidateGroundingFixtures",
  },
  {
    label: "Source line adapter",
    modulePath: "/src/features/analyst/sql/__tests__/sqlSourceLineAdapter.test.ts",
    exportName: "runSqlSourceLineAdapterFixtures",
  },
  {
    label: "Worksheet scope adapter",
    modulePath: "/src/features/analyst/sql/__tests__/sqlWorksheetScopeAdapter.test.ts",
    exportName: "runSqlWorksheetScopeAdapterFixtures",
  },
  {
    label: "Resolve SQL tab source context",
    modulePath: "/src/features/analyst/sql/__tests__/resolveSqlTabSourceContext.test.ts",
    exportName: "runResolveSqlTabSourceContextFixtures",
  },
  {
    label: "Static SQL syntax diagnostics",
    modulePath: "/src/features/analyst/sql/__tests__/sqlStaticSyntaxDiagnostics.test.ts",
    exportName: "runSqlStaticSyntaxDiagnosticFixtures",
  },
  {
    label: "SQL error formatter",
    modulePath: "/src/features/analyst/sql/__tests__/sqlErrorFormatter.test.ts",
    exportName: "runSqlErrorFormatterFixtures",
  },
  {
    label: "Dialect execution guidance",
    modulePath: "/src/features/analyst/sql/__tests__/sqlDialectExecutionGuidance.test.ts",
    exportName: "runDialectExecutionGuidanceFixtures",
  },
  {
    label: "Dialect draft conversion",
    modulePath: "/src/features/analyst/sql/__tests__/sqlDialectDraftConversion.test.ts",
    exportName: "runDialectDraftConversionFixtures",
  },
  {
    label: "Result labeling",
    modulePath: "/src/features/analyst/sql/__tests__/resultLabeling.test.ts",
    exportName: "runResultLabelingFixtures",
  },
  {
    label: "Result narration",
    modulePath: "/src/features/analyst/sql/__tests__/resultNarration.test.ts",
    exportName: "runResultNarrationFixtures",
  },
  {
    label: "SQL result provenance",
    modulePath: "/src/features/analyst/sql/__tests__/sqlResultProvenance.test.ts",
    exportName: "runSqlResultProvenanceFixtures",
  },
  {
    label: "SQL workspace preview result",
    modulePath: "/src/features/analyst/sql/__tests__/useSqlWorkspacePreviewResult.test.ts",
    exportName: "runSqlWorkspacePreviewFixtures",
  },
  {
    label: "Relationship confirmation",
    modulePath: "/src/features/analyst/sql/__tests__/sqlRelationshipConfirmation.test.ts",
    exportName: "runSqlRelationshipConfirmationFixtures",
  },
  {
    label: "LLM privacy modes",
    modulePath: "/src/features/analyst/llm/__tests__/llmPrivacyModes.test.ts",
    exportName: "runLlmPrivacyModeFixtures",
  },
  {
    label: "LLM shadow data policy",
    modulePath: "/src/features/analyst/llm/__tests__/llmShadowDataPolicy.test.ts",
    exportName: "runLlmShadowDataPolicyFixtures",
  },
  {
    label: "LLM metadata payload builder",
    modulePath: "/src/features/analyst/llm/__tests__/llmMetadataPayloadBuilder.test.ts",
    exportName: "runLlmMetadataPayloadBuilderFixtures",
  },
  {
    label: "LLM shadow plan validator",
    modulePath: "/src/features/analyst/llm/__tests__/llmShadowPlanValidator.test.ts",
    exportName: "runLlmShadowPlanValidatorFixtures",
  },
  {
    label: "LLM consent disclosure",
    modulePath: "/src/features/analyst/llm/__tests__/llmConsentDisclosure.test.ts",
    exportName: "runLlmConsentDisclosureFixtures",
  },
  {
    label: "LLM deployment policy",
    modulePath: "/src/features/analyst/llm/__tests__/llmDeploymentPolicy.test.ts",
    exportName: "runLlmDeploymentPolicyFixtures",
  },
  {
    label: "Business intent grounding",
    modulePath: "/src/features/analyst/sql/__tests__/businessIntentGrounding.test.ts",
    exportName: "runBusinessIntentFixtures",
  },
  {
    label: "Semantic hint registry",
    modulePath: "/src/features/analyst/sql/__tests__/semanticHintRegistry.test.ts",
    exportName: "runSemanticHintRegistryFixtures",
  },
  {
    label: "Business SQL query plan",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlQueryPlan.test.ts",
    exportName: "runBusinessSqlQueryPlanFixtures",
  },
  {
    label: "Business SQL query planner",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlQueryPlanner.test.ts",
    exportName: "runBusinessSqlQueryPlannerFixtures",
  },
  {
    label: "Business SQL render readiness",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlRenderReadiness.test.ts",
    exportName: "runBusinessSqlRenderReadinessFixtures",
  },
  {
    label: "Business SQL renderer",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlRenderer.test.ts",
    exportName: "runBusinessSqlRendererFixtures",
  },
  {
    label: "Business SQL renderer preview UI adapter",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlRendererPreviewUiAdapter.test.ts",
    exportName: "runBusinessSqlRendererPreviewUiAdapterFixtures",
  },
  {
    label: "Business SQL renderer preview manual insert gate",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlRendererPreviewManualInsertGate.test.ts",
    exportName: "runBusinessSqlRendererPreviewManualInsertGateFixtures",
  },
  {
    label: "Business SQL preview provenance",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlPreviewProvenance.test.ts",
    exportName: "runBusinessSqlPreviewProvenanceFixtures",
  },
  {
    label: "Business SQL render preview",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlRenderPreview.test.ts",
    exportName: "runBusinessSqlRenderPreviewFixtures",
  },
  {
    label: "Business SQL render preview UI adapter",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlRenderPreviewUiAdapter.test.ts",
    exportName: "runBusinessSqlRenderPreviewUiAdapterFixtures",
  },
  {
    label: "Business SQL join path resolver",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlJoinPathResolver.test.ts",
    exportName: "runBusinessSqlJoinPathResolverFixtures",
  },
  {
    label: "Business SQL plan join resolution",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlQueryPlanJoinResolution.test.ts",
    exportName: "runBusinessSqlQueryPlanJoinResolutionFixtures",
  },
  {
    label: "Business SQL plan readiness",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlPlanReadiness.test.ts",
    exportName: "runBusinessSqlPlanReadinessFixtures",
  },
  {
    label: "Business SQL renderability gate",
    modulePath: "/src/features/analyst/sql/__tests__/businessSqlRenderabilityGate.test.ts",
    exportName: "runBusinessSqlRenderabilityGateFixtures",
  },
  {
    label: "Dataset summary result",
    modulePath: "/src/features/results/__tests__/computeDatasetSummary.test.ts",
    exportName: "runComputeDatasetSummaryFixtures",
  },
  {
    label: "Missing values result",
    modulePath: "/src/features/results/__tests__/computeMissingValuesSummary.test.ts",
    exportName: "runComputeMissingValuesSummaryFixtures",
  },
  {
    label: "Top categories result",
    modulePath: "/src/features/results/__tests__/computeTopCategoriesSummary.test.ts",
    exportName: "runComputeTopCategoriesSummaryFixtures",
  },
  {
    label: "Trends result",
    modulePath: "/src/features/results/__tests__/computeTrendsSummary.test.ts",
    exportName: "runComputeTrendsSummaryFixtures",
  },
];

const asCount = (value) => {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return value;
  return 0;
};

const resultName = (result, index) =>
  result?.name || result?.label || result?.id || `fixture ${index + 1}`;

const resultFailures = (result) => {
  if (!result) return [];
  if (Array.isArray(result.failureReasons)) return result.failureReasons;
  if (Array.isArray(result.failures)) return result.failures;
  if (Array.isArray(result.messages)) return result.messages;
  if (typeof result.failureReason === "string") return [result.failureReason];
  if (typeof result.message === "string" && result.ok === false) return [result.message];
  return [];
};

const normalizeReport = (report) => {
  if (typeof report === "boolean") {
    return {
      passedCount: report ? 1 : 0,
      failedCount: report ? 0 : 1,
      failedResults: report ? [] : [{ name: "boolean fixture result", failureReasons: ["Returned false."] }],
    };
  }

  if (!report || typeof report !== "object") {
    return {
      passedCount: 0,
      failedCount: 1,
      failedResults: [{ name: "fixture report", failureReasons: ["Runner did not return a report object."] }],
    };
  }

  const results = Array.isArray(report.results) ? report.results : [];
  const failedResults = Array.isArray(report.failed)
    ? report.failed
    : results.filter((result) => result?.ok === false);
  const passedCount = Array.isArray(report.passed)
    ? report.passed.length
    : typeof report.passed === "number"
      ? report.passed
      : typeof report.ok === "boolean"
        ? report.ok ? 1 : 0
        : results.filter((result) => result?.ok !== false).length;
  const failedCount = Array.isArray(report.failed)
    ? report.failed.length
    : typeof report.failed === "number"
      ? report.failed
      : typeof report.ok === "boolean"
        ? report.ok ? 0 : 1
        : failedResults.length;

  return {
    passedCount: asCount(passedCount),
    failedCount: asCount(failedCount),
    failedResults,
  };
};

const printFailures = (failedResults) => {
  failedResults.forEach((result, index) => {
    console.error(`    - ${resultName(result, index)}`);
    const failures = resultFailures(result);
    if (failures.length === 0) {
      console.error("      Fixture failed without detailed failure messages.");
      return;
    }
    failures.forEach((failure) => console.error(`      ${failure}`));
  });
};

const run = async () => {
  const server = await createServer({
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
  });

  let totalPassed = 0;
  let totalFailed = 0;
  let missingExports = 0;

  try {
    console.log("Running SQL fixture modules");
    console.log("");

    for (const fixture of fixtures) {
      const loadedModule = await server.ssrLoadModule(fixture.modulePath);
      const runner = loadedModule[fixture.exportName];

      if (typeof runner !== "function") {
        missingExports += 1;
        totalFailed += 1;
        console.error(`${fixture.label}: missing export ${fixture.exportName}`);
        continue;
      }

      const report = await runner();
      const normalized = normalizeReport(report);
      totalPassed += normalized.passedCount;
      totalFailed += normalized.failedCount;

      const status = normalized.failedCount === 0 ? "PASS" : "FAIL";
      console.log(
        `${status} ${fixture.label}: ${normalized.passedCount} passed, ${normalized.failedCount} failed`,
      );

      if (normalized.failedCount > 0) {
        printFailures(normalized.failedResults);
      }
    }
  } finally {
    await server.close();
  }

  console.log("");
  console.log(`Modules: ${fixtures.length}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);

  if (missingExports > 0) {
    console.error(`Missing runner exports: ${missingExports}`);
  }

  if (totalFailed > 0 || missingExports > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("SQL fixture runner failed before completing.");
  console.error(error);
  process.exitCode = 1;
});
