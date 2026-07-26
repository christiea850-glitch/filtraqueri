/**
 * T-13M - session-scoped Business SQL preview insert provenance fixtures.
 *
 * Pure fixture runner only. No UI component changes, Monaco/editor handler
 * calls, Run Query calls, backend/API calls, provider calls, network calls,
 * persistence, authentication, workbook mutation, or query execution.
 */

import {
  createBusinessSqlPreviewInsertProvenance,
  shouldShowBusinessSqlPreviewInsertProvenance,
  summarizeBusinessSqlPreviewInsertProvenance,
  type BusinessSqlPreviewInsertProvenance,
} from "../businessSqlPreviewProvenance";

type ProvenanceFixture = {
  name: string;
  assert: () => string[];
};

type ProvenanceFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type BusinessSqlPreviewProvenanceFixtureReport = {
  results: ProvenanceFixtureResult[];
  passed: ProvenanceFixtureResult[];
  failed: ProvenanceFixtureResult[];
};

const sqlText = [
  'SELECT "customers"."customer_id" AS "customer",',
  '  COUNT("orders"."order_id") AS "orders"',
  'FROM "customers"',
  'JOIN "orders" ON "customers"."customer_id" = "orders"."customer_id"',
  'GROUP BY "customers"."customer_id"',
].join("\n");

const provenance = createBusinessSqlPreviewInsertProvenance({
  activeTabId: "sql-tab:business-preview",
  planId: "business-sql-plan:orders-per-customer",
  sqlText,
});

const expectSessionScopedSafety = (
  model: BusinessSqlPreviewInsertProvenance,
): string[] => [
  ...(model.noPersistence ? [] : ["Provenance must remain session-scoped with no persistence."]),
  ...(model.noSqlExecution ? [] : ["Provenance must not execute SQL."]),
  ...(model.noDuckDbExecution ? [] : ["Provenance must not execute DuckDB."]),
  ...(model.noBackendCall && model.noProviderCall && model.noNetworkCall
    ? []
    : ["Provenance must not call backend/provider/network."]),
  ...(model.noAuthRequired ? [] : ["Provenance must not require or imply authentication."]),
];

export const BUSINESS_SQL_PREVIEW_PROVENANCE_FIXTURES: ProvenanceFixture[] = [
  {
    name: "successful manual insert creates Business SQL preview provenance model",
    assert: () => [
      ...(provenance.source === "business_sql_preview" ? [] : ["Expected Business SQL preview source."]),
      ...(provenance.activeTabId === "sql-tab:business-preview" ? [] : ["Expected active SQL tab id."]),
      ...(provenance.planId === "business-sql-plan:orders-per-customer" ? [] : ["Expected plan id."]),
      ...(provenance.rendererTarget === "DuckDB" ? [] : ["Expected DuckDB target."]),
      ...(provenance.copy === "Inserted from Business SQL preview" ? [] : ["Expected provenance copy."]),
      ...(provenance.bannerCopy === "Inserted into editor. Review before running."
        ? []
        : ["Expected post-insert banner copy."]),
      ...(provenance.helperCopy === "Run Query remains manual."
        ? []
        : ["Expected Run Query manual helper copy."]),
      ...(provenance.insertedSqlSnapshot === sqlText ? [] : ["Expected inserted SQL snapshot."]),
      ...(provenance.insertedSqlFingerprint.startsWith("sql:")
        ? []
        : ["Expected deterministic SQL fingerprint."]),
      ...expectSessionScopedSafety(provenance),
    ],
  },
  {
    name: "provenance is visible only while editor SQL matches inserted snapshot",
    assert: () => [
      ...(shouldShowBusinessSqlPreviewInsertProvenance({
        provenance,
        activeTabId: "sql-tab:business-preview",
        currentSqlDraft: sqlText,
      })
        ? []
        : ["Expected provenance to show for exact inserted SQL."]),
      ...(shouldShowBusinessSqlPreviewInsertProvenance({
        provenance,
        activeTabId: "sql-tab:business-preview",
        currentSqlDraft: `${sqlText}\n-- user edit`,
      })
        ? ["Provenance must hide when editor SQL changes."]
        : []),
      ...(shouldShowBusinessSqlPreviewInsertProvenance({
        provenance,
        activeTabId: "sql-tab:other",
        currentSqlDraft: sqlText,
      })
        ? ["Provenance must hide when active tab changes."]
        : []),
    ],
  },
  {
    name: "provenance hides when editor is cleared",
    assert: () => [
      ...(shouldShowBusinessSqlPreviewInsertProvenance({
        provenance,
        activeTabId: "sql-tab:business-preview",
        currentSqlDraft: "",
      })
        ? ["Provenance must hide when editor is cleared."]
        : []),
      ...(shouldShowBusinessSqlPreviewInsertProvenance({
        provenance,
        activeTabId: "sql-tab:business-preview",
        currentSqlDraft: "   ",
      })
        ? ["Provenance must hide for whitespace-only editor drafts."]
        : []),
    ],
  },
  {
    name: "null provenance never displays",
    assert: () => [
      ...(shouldShowBusinessSqlPreviewInsertProvenance({
        provenance: null,
        activeTabId: "sql-tab:business-preview",
        currentSqlDraft: sqlText,
      })
        ? ["Null provenance must not display."]
        : []),
    ],
  },
  {
    name: "same input produces deterministic provenance",
    assert: () => {
      const second = createBusinessSqlPreviewInsertProvenance({
        activeTabId: "sql-tab:business-preview",
        planId: "business-sql-plan:orders-per-customer",
        sqlText,
      });
      return [
        ...(JSON.stringify(provenance) === JSON.stringify(second)
          ? []
          : ["Expected deterministic provenance model."]),
        ...(summarizeBusinessSqlPreviewInsertProvenance(provenance) ===
          summarizeBusinessSqlPreviewInsertProvenance(second)
          ? []
          : ["Expected deterministic provenance summary."]),
      ];
    },
  },
  {
    name: "optional clarification provenance remains backward compatible",
    assert: () => {
      const withoutClarification = createBusinessSqlPreviewInsertProvenance({
        activeTabId: "sql-tab:business-preview",
        planId: "business-sql-plan:orders-per-customer",
        sqlText,
      });
      const withClarification = createBusinessSqlPreviewInsertProvenance({
        activeTabId: "sql-tab:business-preview",
        planId: "business-sql-plan:orders-per-customer",
        sqlText,
        clarificationDecision: {
          ambiguityId: "ambiguity:metric",
          chosenOptionId: "option:orders",
          presentedOptionIds: ["option:orders", "option:revenue"],
        },
      });

      return [
        ...(withoutClarification.clarificationDecision === undefined
          ? []
          : ["Expected clarification provenance to remain optional."]),
        ...(withClarification.clarificationDecision?.ambiguityId === "ambiguity:metric"
          ? []
          : ["Expected clarification ambiguity id to pass through."]),
        ...(withClarification.clarificationDecision?.presentedOptionIds.join(",") ===
        "option:orders,option:revenue"
          ? []
          : ["Expected presented clarification options to pass through."]),
        ...expectSessionScopedSafety(withClarification),
      ];
    },
  },
  {
    name: "summary is metadata-only and does not imply account persistence",
    assert: () => {
      const summary = summarizeBusinessSqlPreviewInsertProvenance(provenance);
      return [
        ...(summary.includes("persistence=false") ? [] : ["Expected no-persistence summary."]),
        ...(summary.includes("execution=false") ? [] : ["Expected no-execution summary."]),
        ...(summary.includes("auth=false") ? [] : ["Expected no-auth summary."]),
        ...(summary.includes("account") || summary.includes("cloud")
          ? ["Summary must not imply account or cloud ownership."]
          : []),
      ];
    },
  },
];

export function runBusinessSqlPreviewProvenanceFixtures(): BusinessSqlPreviewProvenanceFixtureReport {
  const results = BUSINESS_SQL_PREVIEW_PROVENANCE_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert();
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
