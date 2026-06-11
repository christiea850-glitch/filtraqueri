/**
 * T-11D-H1 — deterministic SQL static syntax diagnostic fixtures.
 *
 * These fixtures exercise the lightweight static syntax checks without
 * requiring Monaco, backend execution, or a browser test runner.
 */

import {
  getStaticSqlSyntaxDiagnostics,
  type SqlStaticSyntaxDiagnostic,
} from "../sqlStaticSyntaxDiagnostics";

type StaticSyntaxFixtureExpectation =
  | {
      kind: "none";
    }
  | {
      kind: "diagnostic";
      idPrefix: string;
      messagePattern: RegExp;
      rangeText: string;
    };

type StaticSyntaxFixture = {
  name: string;
  sql: string;
  expectation: StaticSyntaxFixtureExpectation;
};

type StaticSyntaxFixtureResult = {
  name: string;
  ok: boolean;
  diagnosticIds: string[];
  failureReasons: string[];
};

export type SqlStaticSyntaxDiagnosticFixtureReport = {
  results: StaticSyntaxFixtureResult[];
  passed: StaticSyntaxFixtureResult[];
  failed: StaticSyntaxFixtureResult[];
};

const SQL_STATIC_SYNTAX_FIXTURES: StaticSyntaxFixture[] = [
  {
    name: "empty SQL returns no diagnostics",
    sql: "   \n\t  ",
    expectation: { kind: "none" },
  },
  {
    name: "valid SQL returns no diagnostics",
    sql: "SELECT order_id, customer_id FROM orders WHERE status = 'paid' GROUP BY order_id, customer_id ORDER BY order_id LIMIT 10;",
    expectation: { kind: "none" },
  },
  {
    name: "trailing comma before FROM is detected",
    sql: "SELECT order_id, FROM orders;",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-trailing-comma-",
      messagePattern: /trailing comma before FROM/i,
      rangeText: ",",
    },
  },
  {
    name: "SELECT * FROM with no table is detected",
    sql: "SELECT * FROM",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-from-missing-table-",
      messagePattern: /FROM needs a table name/i,
      rangeText: "FROM",
    },
  },
  {
    name: "unmatched double quote is detected",
    sql: 'SELECT "name FROM orders;',
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-unmatched-double-quote-",
      messagePattern: /unmatched double quote/i,
      rangeText: '"',
    },
  },
  {
    name: "unmatched single quote is detected",
    sql: "SELECT 'name FROM orders;",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-unmatched-single-quote-",
      messagePattern: /unmatched single quote/i,
      rangeText: "'",
    },
  },
  {
    name: "unmatched parenthesis is detected",
    sql: "SELECT (order_id FROM orders;",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-unmatched-opening-paren-",
      messagePattern: /unmatched opening parenthesis/i,
      rangeText: "(",
    },
  },
  {
    name: "dangling WHERE is detected",
    sql: "SELECT * FROM orders WHERE",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-dangling-where-",
      messagePattern: /WHERE needs an expression/i,
      rangeText: "WHERE",
    },
  },
  {
    name: "dangling GROUP BY is detected",
    sql: "SELECT COUNT(*) FROM orders GROUP BY",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-dangling-group-by-",
      messagePattern: /GROUP BY needs an expression/i,
      rangeText: "GROUP BY",
    },
  },
  {
    name: "dangling ORDER BY is detected",
    sql: "SELECT * FROM orders ORDER BY",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-dangling-order-by-",
      messagePattern: /ORDER BY needs an expression/i,
      rangeText: "ORDER BY",
    },
  },
  {
    name: "dangling LIMIT is detected",
    sql: "SELECT * FROM orders LIMIT",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-dangling-limit-",
      messagePattern: /LIMIT needs an expression/i,
      rangeText: "LIMIT",
    },
  },
  {
    name: "multiple statements are detected",
    sql: "SELECT * FROM orders; SELECT * FROM customers;",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-multiple-statements-",
      messagePattern: /only one SQL statement/i,
      rangeText: ";",
    },
  },
  {
    name: "obvious invalid clause order is detected",
    sql: "SELECT * FROM orders ORDER BY order_id WHERE status = 'paid';",
    expectation: {
      kind: "diagnostic",
      idPrefix: "static-invalid-clause-order-",
      messagePattern: /WHERE is out of order after ORDER BY/i,
      rangeText: "WHERE",
    },
  },
  {
    name: "unknown column/table names are not reported as static syntax errors",
    sql: "SELECT missing_col FROM missing_table;",
    expectation: { kind: "none" },
  },
];

const expect = (
  condition: boolean,
  failureReason: string,
  failureReasons: string[],
) => {
  if (!condition) failureReasons.push(failureReason);
};

const findExpectedDiagnostic = (
  diagnostics: SqlStaticSyntaxDiagnostic[],
  expectation: Extract<StaticSyntaxFixtureExpectation, { kind: "diagnostic" }>,
) => diagnostics.find((diagnostic) => diagnostic.id.startsWith(expectation.idPrefix));

const rangeText = (sql: string, diagnostic: SqlStaticSyntaxDiagnostic) =>
  sql.slice(diagnostic.start, diagnostic.end);

export function runSqlStaticSyntaxDiagnosticFixtures(): SqlStaticSyntaxDiagnosticFixtureReport {
  const results = SQL_STATIC_SYNTAX_FIXTURES.map((fixture) => {
    const diagnostics = getStaticSqlSyntaxDiagnostics(fixture.sql);
    const failureReasons: string[] = [];

    if (fixture.expectation.kind === "none") {
      expect(
        diagnostics.length === 0,
        `Expected no diagnostics, received: ${diagnostics.map((diagnostic) => diagnostic.id).join(", ") || "none"}.`,
        failureReasons,
      );
    } else {
      const diagnostic = findExpectedDiagnostic(diagnostics, fixture.expectation);

      expect(
        Boolean(diagnostic),
        `Expected diagnostic id starting with ${fixture.expectation.idPrefix}, received: ${diagnostics.map((candidate) => candidate.id).join(", ") || "none"}.`,
        failureReasons,
      );

      if (diagnostic) {
        expect(
          fixture.expectation.messagePattern.test(diagnostic.message),
          `Expected message to match ${fixture.expectation.messagePattern}, received: ${diagnostic.message}.`,
          failureReasons,
        );
        expect(
          rangeText(fixture.sql, diagnostic) === fixture.expectation.rangeText,
          `Expected range to target ${JSON.stringify(fixture.expectation.rangeText)}, received ${JSON.stringify(rangeText(fixture.sql, diagnostic))} at ${diagnostic.start}-${diagnostic.end}.`,
          failureReasons,
        );
      }
    }

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      diagnosticIds: diagnostics.map((diagnostic) => diagnostic.id),
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allSqlStaticSyntaxDiagnosticFixturesPass(): boolean {
  return runSqlStaticSyntaxDiagnosticFixtures().failed.length === 0;
}
