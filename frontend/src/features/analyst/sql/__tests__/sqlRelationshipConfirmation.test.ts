/**
 * T-23B - Relationship confirmation type fixtures.
 *
 * Pure fixture runner only. This does not render SQL, insert SQL into Monaco,
 * execute queries, call providers, call backend APIs, or mutate app state.
 */

import {
  SQL_RELATIONSHIP_CONFIRMATION_SAFETY_FLAGS,
  createEmptySqlRelationshipConfirmationState,
  createSqlRelationshipId,
  isSqlConfirmedRelationshipActive,
  isSqlRelationshipSchemaBacked,
  type SqlConfirmedWorksheetRelationship,
} from "../sqlRelationshipConfirmation";

type RelationshipConfirmationFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type RelationshipConfirmationFixtureReport = {
  results: RelationshipConfirmationFixtureResult[];
  passed: RelationshipConfirmationFixtureResult[];
  failed: RelationshipConfirmationFixtureResult[];
};

const confirmedRelationship = (
  overrides: Partial<SqlConfirmedWorksheetRelationship> = {},
): SqlConfirmedWorksheetRelationship => ({
  relationshipId: "sql-relationship:worksheet_units:units:unit_id::worksheet_access_codes:access_codes:unit_id",
  fromWorksheetId: "worksheet:units",
  fromWorksheetLabel: "Units",
  fromTableName: "units",
  fromColumn: "unit_id",
  toWorksheetId: "worksheet:access_codes",
  toWorksheetLabel: "Access Codes",
  toTableName: "access_codes",
  toColumn: "unit_id",
  cardinality: "one_to_many",
  confidence: 0.92,
  status: "confirmed",
  confirmedAt: "2026-01-01T00:00:00.000Z",
  confirmedByUser: true,
  scope: "workbook",
  source: "inferred_then_confirmed",
  acceptedFromCandidateId: "candidate:units-access-codes",
  workbookId: "workbook:property",
  datasetId: "dataset:property",
  ...SQL_RELATIONSHIP_CONFIRMATION_SAFETY_FLAGS,
  ...overrides,
});

const fixtures: Array<{
  name: string;
  run: () => string[];
}> = [
  {
    name: "confirmed relationship type supports workbook scope",
    run: () => {
      const relationship = confirmedRelationship();
      return [
        ...(relationship.scope === "workbook" ? [] : ["Expected workbook scope."]),
        ...(relationship.status === "confirmed" ? [] : ["Expected confirmed status."]),
        ...(relationship.confirmedByUser ? [] : ["Expected user confirmation flag."]),
      ];
    },
  },
  {
    name: "rejected relationship supports rejectedAt and is not active",
    run: () => {
      const relationship = confirmedRelationship({
        status: "rejected",
        confirmedAt: undefined,
        rejectedAt: "2026-01-02T00:00:00.000Z",
      });
      return [
        ...(relationship.rejectedAt ? [] : ["Expected rejectedAt timestamp."]),
        ...(!isSqlConfirmedRelationshipActive(relationship)
          ? []
          : ["Rejected relationship must not be active."]),
      ];
    },
  },
  {
    name: "deterministic relationship id is stable and direction independent",
    run: () => {
      const from = {
        worksheetId: "worksheet:units",
        tableName: "Units",
        column: "unit_id",
      };
      const to = {
        worksheetId: "worksheet:access_codes",
        tableName: "Access Codes",
        column: "unit_id",
      };
      const first = createSqlRelationshipId(from, to);
      const second = createSqlRelationshipId(to, from);
      return [
        ...(first === second ? [] : ["Expected relationship id to be direction independent."]),
        ...(first === createSqlRelationshipId(from, to) ? [] : ["Expected stable relationship id."]),
      ];
    },
  },
  {
    name: "schema-backed check returns true when both endpoint columns exist",
    run: () =>
      isSqlRelationshipSchemaBacked({
        fromColumn: "unit_id",
        fromColumns: ["unit_id", "unit_number"],
        toColumn: "unit_id",
        toColumns: [{ name: "unit_id" }, { name: "access_code" }],
      })
        ? []
        : ["Expected schema-backed relationship."],
  },
  {
    name: "schema-backed check returns false when either endpoint column is missing",
    run: () =>
      !isSqlRelationshipSchemaBacked({
        fromColumn: "tenant_id",
        fromColumns: ["unit_id", "unit_number"],
        toColumn: "unit_id",
        toColumns: ["unit_id", "access_code"],
      }) &&
      !isSqlRelationshipSchemaBacked({
        fromColumn: "unit_id",
        fromColumns: ["unit_id", "unit_number"],
        toColumn: "tenant_id",
        toColumns: ["unit_id", "access_code"],
      })
        ? []
        : ["Expected missing endpoint columns to fail schema-backed check."],
  },
  {
    name: "safety flags prohibit SQL generation, Run Query, backend calls, and allow removal",
    run: () => {
      const relationship = confirmedRelationship();
      return [
        ...(relationship.noSqlGeneratedOnConfirm ? [] : ["Expected no SQL generation flag."]),
        ...(relationship.noRunQueryOnConfirm ? [] : ["Expected no Run Query flag."]),
        ...(relationship.noBackendCallOnConfirm ? [] : ["Expected no backend call flag."]),
        ...(relationship.userCanRemove ? [] : ["Expected user removable flag."]),
        ...(relationship.schemaBackedColumns ? [] : ["Expected schema-backed flag."]),
        ...(relationship.invalidatedWhenWorksheetMissing
          ? []
          : ["Expected worksheet invalidation flag."]),
      ];
    },
  },
  {
    name: "empty confirmation state has no confirmed relationships or rejected suggestions",
    run: () => {
      const state = createEmptySqlRelationshipConfirmationState();
      return [
        ...(state.confirmedRelationships.length === 0
          ? []
          : ["Expected no confirmed relationships."]),
        ...(state.rejectedSuggestions.length === 0 ? [] : ["Expected no rejected suggestions."]),
        ...(Object.keys(state.invalidatedRelationshipIds).length === 0
          ? []
          : ["Expected no invalidated relationships."]),
      ];
    },
  },
  {
    name: "helpers are metadata-only and do not emit SQL or side-effect capabilities",
    run: () => {
      const id = createSqlRelationshipId(
        { worksheetId: "worksheet:units", tableName: "units", column: "unit_id" },
        {
          worksheetId: "worksheet:access_codes",
          tableName: "access_codes",
          column: "unit_id",
        },
      );
      const state = createEmptySqlRelationshipConfirmationState();
      const serialized = JSON.stringify({ id, state, flags: SQL_RELATIONSHIP_CONFIRMATION_SAFETY_FLAGS });
      const forbidden = ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "fetch(", "XMLHttpRequest"];
      return forbidden.some((token) => serialized.includes(token))
        ? ["Expected helpers to avoid SQL/backend/API capability output."]
        : [];
    },
  },
];

export function runSqlRelationshipConfirmationFixtures(): RelationshipConfirmationFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.run();
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
