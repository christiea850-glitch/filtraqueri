/**
 * T-12C — Explicit dialect draft conversion preview fixtures.
 *
 * These fixtures exercise the pure deterministic helper only. They verify the
 * helper can produce a safe preview for supported row-limit conversions without
 * mutating editor state, running queries, or touching any API behavior.
 */

import { getDialectDraftConversion } from "../sqlDialectDraftConversion";

type DialectDraftConversionFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type DialectDraftConversionFixtureReport = {
  results: DialectDraftConversionFixtureResult[];
  passed: DialectDraftConversionFixtureResult[];
  failed: DialectDraftConversionFixtureResult[];
};

const expect = (
  condition: boolean,
  failureReason: string,
  failureReasons: string[],
) => {
  if (!condition) failureReasons.push(failureReason);
};


const expectComplexRefusal = (
  sql: string,
  toDialect: "oracle" | "duckdb" | "mariadb",
  failureReasons: string[],
) => {
  const conversion = getDialectDraftConversion({
    sql,
    fromDialect: toDialect === "oracle" ? "duckdb" : "oracle",
    toDialect,
  });

  expect(!conversion.canConvert, "Expected complex SQL to be rejected.", failureReasons);
  expect(
    conversion.warnings.includes("Complex SQL is not converted automatically yet."),
    "Expected complex SQL refusal to include the complexity warning.",
    failureReasons,
  );
};

const runFixture = (
  name: string,
  fixture: () => string[],
): DialectDraftConversionFixtureResult => {
  const failureReasons = fixture();
  return {
    name,
    ok: failureReasons.length === 0,
    failureReasons,
  };
};

export function runDialectDraftConversionFixtures(): DialectDraftConversionFixtureReport {
  const results = [
    runFixture("LIMIT 100 converts to Oracle FETCH FIRST", () => {
      const failureReasons: string[] = [];
      const sourceSql = 'SELECT * FROM "ws_1_managers" LIMIT 100;';
      const conversion = getDialectDraftConversion({
        sql: sourceSql,
        fromDialect: "duckdb",
        toDialect: "oracle",
      });

      expect(conversion.canConvert, "Expected LIMIT syntax to be convertible for Oracle.", failureReasons);
      expect(
        conversion.convertedSql === 'SELECT * FROM "ws_1_managers" FETCH FIRST 100 ROWS ONLY;',
        "Expected Oracle FETCH FIRST syntax with row count preserved.",
        failureReasons,
      );
      expect(
        sourceSql === 'SELECT * FROM "ws_1_managers" LIMIT 100;',
        "Expected helper preview to leave the original SQL string unchanged.",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Oracle FETCH FIRST converts to DuckDB LIMIT", () => {
      const failureReasons: string[] = [];
      const conversion = getDialectDraftConversion({
        sql: 'SELECT * FROM "ws_1_managers" FETCH FIRST 100 ROWS ONLY;',
        fromDialect: "oracle",
        toDialect: "duckdb",
      });

      expect(conversion.canConvert, "Expected FETCH FIRST syntax to be convertible for DuckDB.", failureReasons);
      expect(
        conversion.convertedSql === 'SELECT * FROM "ws_1_managers" LIMIT 100;',
        "Expected DuckDB LIMIT syntax with row count preserved.",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Oracle FETCH FIRST converts to MariaDB LIMIT", () => {
      const failureReasons: string[] = [];
      const conversion = getDialectDraftConversion({
        sql: 'SELECT * FROM "ws_1_managers" FETCH FIRST 100 ROWS ONLY;',
        fromDialect: "oracle",
        toDialect: "mariadb",
      });

      expect(conversion.canConvert, "Expected FETCH FIRST syntax to be convertible for MariaDB.", failureReasons);
      expect(
        conversion.convertedSql === 'SELECT * FROM "ws_1_managers" LIMIT 100;',
        "Expected MariaDB LIMIT syntax with row count preserved.",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Semicolon is preserved when present and omitted when absent", () => {
      const failureReasons: string[] = [];
      const withSemicolon = getDialectDraftConversion({
        sql: "SELECT * FROM uploaded_dataset LIMIT 100;",
        fromDialect: "duckdb",
        toDialect: "oracle",
      });
      const withoutSemicolon = getDialectDraftConversion({
        sql: "SELECT * FROM uploaded_dataset LIMIT 100",
        fromDialect: "duckdb",
        toDialect: "oracle",
      });

      expect(
        withSemicolon.convertedSql.endsWith("ROWS ONLY;"),
        "Expected conversion to preserve an existing semicolon.",
        failureReasons,
      );
      expect(
        withoutSemicolon.convertedSql.endsWith("ROWS ONLY"),
        "Expected conversion not to add a semicolon when the draft has none.",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Empty SQL is not converted", () => {
      const failureReasons: string[] = [];
      const conversion = getDialectDraftConversion({
        sql: "   ",
        fromDialect: "duckdb",
        toDialect: "oracle",
      });

      expect(!conversion.canConvert, "Expected empty SQL to be rejected.", failureReasons);
      return failureReasons;
    }),
    runFixture("Multiple statements are not converted", () => {
      const failureReasons: string[] = [];
      const conversion = getDialectDraftConversion({
        sql: "SELECT * FROM first_table LIMIT 100; SELECT * FROM second_table LIMIT 10;",
        fromDialect: "duckdb",
        toDialect: "oracle",
      });

      expect(!conversion.canConvert, "Expected multiple statements to be rejected.", failureReasons);
      return failureReasons;
    }),
    runFixture("WITH CTE LIMIT SQL is refused as complex", () => {
      const failureReasons: string[] = [];
      expectComplexRefusal(
        "WITH latest AS (SELECT * FROM uploaded_dataset) SELECT * FROM latest LIMIT 10;",
        "oracle",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Parenthesized SELECT with trailing LIMIT is refused as complex", () => {
      const failureReasons: string[] = [];
      expectComplexRefusal(
        "SELECT * FROM (SELECT * FROM uploaded_dataset) nested_rows LIMIT 10;",
        "oracle",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("UNION with trailing LIMIT is refused as complex", () => {
      const failureReasons: string[] = [];
      expectComplexRefusal(
        "SELECT * FROM first_table UNION SELECT * FROM second_table LIMIT 10;",
        "oracle",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("INTERSECT and EXCEPT SQL is refused as complex", () => {
      const failureReasons: string[] = [];
      expectComplexRefusal(
        "SELECT id FROM first_table INTERSECT SELECT id FROM second_table LIMIT 10;",
        "oracle",
        failureReasons,
      );
      expectComplexRefusal(
        "SELECT id FROM first_table EXCEPT SELECT id FROM second_table LIMIT 10;",
        "oracle",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Multiple LIMIT clauses are refused as complex", () => {
      const failureReasons: string[] = [];
      expectComplexRefusal(
        "SELECT * FROM uploaded_dataset LIMIT 100 LIMIT 10;",
        "oracle",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Multiple FETCH FIRST clauses are refused as complex", () => {
      const failureReasons: string[] = [];
      expectComplexRefusal(
        "SELECT * FROM uploaded_dataset FETCH FIRST 100 ROWS ONLY FETCH FIRST 10 ROWS ONLY;",
        "duckdb",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Nested FETCH FIRST SQL is refused as complex", () => {
      const failureReasons: string[] = [];
      expectComplexRefusal(
        "SELECT * FROM (SELECT * FROM uploaded_dataset FETCH FIRST 100 ROWS ONLY) nested_rows FETCH FIRST 10 ROWS ONLY;",
        "duckdb",
        failureReasons,
      );
      return failureReasons;
    }),
    runFixture("Unsupported SQL is not converted", () => {
      const failureReasons: string[] = [];
      const conversion = getDialectDraftConversion({
        sql: "SELECT * FROM uploaded_dataset ORDER BY created_at DESC;",
        fromDialect: "duckdb",
        toDialect: "oracle",
      });

      expect(!conversion.canConvert, "Expected unsupported SQL to produce no apply preview.", failureReasons);
      return failureReasons;
    }),
    runFixture("Helper only returns a preview and does not auto-apply conversion", () => {
      const failureReasons: string[] = [];
      const editorDraft = "SELECT * FROM uploaded_dataset LIMIT 100;";
      const conversion = getDialectDraftConversion({
        sql: editorDraft,
        fromDialect: "duckdb",
        toDialect: "oracle",
      });

      expect(conversion.canConvert, "Expected a conversion preview to be available.", failureReasons);
      expect(
        editorDraft === "SELECT * FROM uploaded_dataset LIMIT 100;",
        "Expected caller-owned draft text to remain unchanged until an explicit apply action.",
        failureReasons,
      );
      return failureReasons;
    }),
  ];

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const dialectDraftConversionFixturesPass = () =>
  runDialectDraftConversionFixtures().failed.length === 0;
