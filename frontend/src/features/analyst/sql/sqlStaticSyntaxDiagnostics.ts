export type SqlStaticSyntaxDiagnostic = {
  id: string;
  message: string;
  start: number;
  end: number;
};

type SqlSyntaxToken = {
  text: string;
  upper: string;
  start: number;
  end: number;
  depth: number;
  kind: "word" | "punctuation" | "operator" | "literal";
};

type SqlClauseToken = {
  name: "SELECT" | "FROM" | "WHERE" | "GROUP BY" | "HAVING" | "ORDER BY" | "LIMIT";
  start: number;
  end: number;
  tokenIndex: number;
  order: number;
};

const clauseOrder: Record<SqlClauseToken["name"], number> = {
  SELECT: 1,
  FROM: 2,
  WHERE: 3,
  "GROUP BY": 4,
  HAVING: 5,
  "ORDER BY": 6,
  LIMIT: 7,
};

const clauseNames = new Set<SqlClauseToken["name"]>([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "LIMIT",
]);

const mark = (id: string, message: string, start: number, end: number): SqlStaticSyntaxDiagnostic => ({
  id,
  message,
  start: Math.max(0, start),
  end: Math.max(Math.max(0, start) + 1, end),
});

const isIdentifierStart = (character: string) => /[A-Za-z_]/.test(character);
const isIdentifierPart = (character: string) => /[A-Za-z0-9_$]/.test(character);
const isWhitespace = (character: string) => /\s/.test(character);

const scanBalancedSyntax = (sql: string): SqlStaticSyntaxDiagnostic[] => {
  const diagnostics: SqlStaticSyntaxDiagnostic[] = [];
  const parentheses: number[] = [];
  let quote: "'" | '"' | null = null;
  let quoteStart = -1;

  for (let index = 0; index < sql.length; index += 1) {
    const current = sql[index];
    const next = sql[index + 1];

    if (!quote && current === "-" && next === "-") {
      const newline = sql.indexOf("\n", index + 2);
      index = newline === -1 ? sql.length : newline;
      continue;
    }

    if (!quote && current === "/" && next === "*") {
      const commentEnd = sql.indexOf("*/", index + 2);
      index = commentEnd === -1 ? sql.length : commentEnd + 1;
      continue;
    }

    if (quote) {
      if (current === quote) {
        if (next === quote) {
          index += 1;
          continue;
        }
        quote = null;
        quoteStart = -1;
      }
      continue;
    }

    if (current === "'" || current === '"') {
      quote = current;
      quoteStart = index;
      continue;
    }

    if (current === "(") {
      parentheses.push(index);
      continue;
    }

    if (current === ")") {
      const opening = parentheses.pop();
      if (opening === undefined) {
        diagnostics.push(
          mark(
            `static-unmatched-closing-paren-${index}`,
            "Unmatched closing parenthesis.",
            index,
            index + 1,
          ),
        );
      }
    }
  }

  if (quote) {
    diagnostics.push(
      mark(
        `static-unmatched-${quote === "'" ? "single" : "double"}-quote-${quoteStart}`,
        quote === "'" ? "Unmatched single quote." : "Unmatched double quote.",
        quoteStart,
        Math.min(sql.length, quoteStart + 1),
      ),
    );
  }

  parentheses.forEach((opening) => {
    diagnostics.push(
      mark(
        `static-unmatched-opening-paren-${opening}`,
        "Unmatched opening parenthesis.",
        opening,
        opening + 1,
      ),
    );
  });

  return diagnostics;
};

const tokenizeStaticSql = (sql: string): SqlSyntaxToken[] => {
  const tokens: SqlSyntaxToken[] = [];
  let index = 0;
  let depth = 0;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];

    if (isWhitespace(current)) {
      index += 1;
      continue;
    }

    if (current === "-" && next === "-") {
      const newline = sql.indexOf("\n", index + 2);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }

    if (current === "/" && next === "*") {
      const commentEnd = sql.indexOf("*/", index + 2);
      index = commentEnd === -1 ? sql.length : commentEnd + 2;
      continue;
    }

    if (current === "'" || current === '"') {
      const quote = current;
      const start = index;
      index += 1;
      while (index < sql.length) {
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      tokens.push({
        text: sql.slice(start, index),
        upper: "IDENTIFIER",
        start,
        end: index,
        depth,
        kind: "literal",
      });
      continue;
    }

    if (isIdentifierStart(current)) {
      const start = index;
      index += 1;
      while (index < sql.length && isIdentifierPart(sql[index])) index += 1;
      const text = sql.slice(start, index);
      tokens.push({ text, upper: text.toUpperCase(), start, end: index, depth, kind: "word" });
      continue;
    }

    if (/\d/.test(current)) {
      const start = index;
      index += 1;
      while (index < sql.length && /[\d.]/.test(sql[index])) index += 1;
      tokens.push({
        text: sql.slice(start, index),
        upper: "NUMBER",
        start,
        end: index,
        depth,
        kind: "literal",
      });
      continue;
    }

    if (current === "(") {
      tokens.push({ text: current, upper: current, start: index, end: index + 1, depth, kind: "punctuation" });
      depth += 1;
      index += 1;
      continue;
    }

    if (current === ")") {
      depth = Math.max(0, depth - 1);
      tokens.push({ text: current, upper: current, start: index, end: index + 1, depth, kind: "punctuation" });
      index += 1;
      continue;
    }

    tokens.push({
      text: current,
      upper: current,
      start: index,
      end: index + 1,
      depth,
      kind: [",", ";", "."].includes(current) ? "punctuation" : "operator",
    });
    index += 1;
  }

  return tokens;
};

const getClauseAt = (tokens: SqlSyntaxToken[], index: number): SqlClauseToken | null => {
  const token = tokens[index];
  if (!token || token.depth !== 0 || token.kind !== "word") return null;

  if (token.upper === "GROUP" && tokens[index + 1]?.upper === "BY") {
    return { name: "GROUP BY", start: token.start, end: tokens[index + 1].end, tokenIndex: index, order: clauseOrder["GROUP BY"] };
  }

  if (token.upper === "ORDER" && tokens[index + 1]?.upper === "BY") {
    return { name: "ORDER BY", start: token.start, end: tokens[index + 1].end, tokenIndex: index, order: clauseOrder["ORDER BY"] };
  }

  if (clauseNames.has(token.upper as SqlClauseToken["name"])) {
    const name = token.upper as SqlClauseToken["name"];
    return { name, start: token.start, end: token.end, tokenIndex: index, order: clauseOrder[name] };
  }

  return null;
};

const getTopLevelClauses = (tokens: SqlSyntaxToken[]): SqlClauseToken[] => {
  const clauses: SqlClauseToken[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const clause = getClauseAt(tokens, index);
    if (!clause) continue;
    clauses.push(clause);
    if (clause.name === "GROUP BY" || clause.name === "ORDER BY") index += 1;
  }

  return clauses;
};

const isExpressionToken = (token: SqlSyntaxToken) =>
  token.kind !== "punctuation" || ![",", ";", "(", ")"].includes(token.text);

const isTableReferenceToken = (token: SqlSyntaxToken) =>
  token.depth === 0 && (token.kind === "word" || token.kind === "literal");

const hasExpressionBetween = (tokens: SqlSyntaxToken[], startIndex: number, endIndex: number) =>
  tokens.slice(startIndex, endIndex).some((token) => token.depth === 0 && isExpressionToken(token));

const findDanglingClauseDiagnostics = (
  sql: string,
  tokens: SqlSyntaxToken[],
  clauses: SqlClauseToken[],
): SqlStaticSyntaxDiagnostic[] => {
  const diagnostics: SqlStaticSyntaxDiagnostic[] = [];
  const expressionRequired = new Set<SqlClauseToken["name"]>([
    "WHERE",
    "GROUP BY",
    "HAVING",
    "ORDER BY",
    "LIMIT",
  ]);

  clauses.forEach((clause, clausePosition) => {
    const nextClause = clauses[clausePosition + 1];
    const expressionStartIndex = clause.name === "GROUP BY" || clause.name === "ORDER BY"
      ? clause.tokenIndex + 2
      : clause.tokenIndex + 1;
    const expressionEndIndex = nextClause?.tokenIndex ?? tokens.length;

    if (clause.name === "FROM") {
      const nextToken = tokens[expressionStartIndex];
      const hasTable = Boolean(
        nextToken &&
          isTableReferenceToken(nextToken) &&
          !getClauseAt(tokens, expressionStartIndex),
      );
      if (!hasTable) {
        diagnostics.push(
          mark(
            `static-from-missing-table-${clause.start}`,
            "FROM needs a table name after it.",
            clause.start,
            nextClause?.start ?? Math.max(clause.end, sql.trimEnd().length),
          ),
        );
      }
      return;
    }

    if (!expressionRequired.has(clause.name)) return;

    if (!hasExpressionBetween(tokens, expressionStartIndex, expressionEndIndex)) {
      diagnostics.push(
        mark(
          `static-dangling-${clause.name.toLowerCase().replace(/\s+/g, "-")}-${clause.start}`,
          `${clause.name} needs an expression after it.`,
          clause.start,
          nextClause?.start ?? Math.max(clause.end, sql.trimEnd().length),
        ),
      );
    }
  });

  return diagnostics;
};

export const getStaticSqlSyntaxDiagnostics = (sql: string): SqlStaticSyntaxDiagnostic[] => {
  if (!sql.trim()) return [];

  const diagnostics: SqlStaticSyntaxDiagnostic[] = [...scanBalancedSyntax(sql)];
  const tokens = tokenizeStaticSql(sql);
  const clauses = getTopLevelClauses(tokens);
  const multiStatementSeparators = tokens.filter(
    (token, index) => token.text === ";" && tokens.slice(index + 1).some((nextToken) => nextToken.text !== ";"),
  );

  tokens.forEach((token, index) => {
    if (token.text !== ",") return;
    const nextClause = getClauseAt(tokens, index + 1);
    if (!nextClause || !["FROM", "WHERE", "GROUP BY", "ORDER BY", "LIMIT", "HAVING"].includes(nextClause.name)) {
      return;
    }
    diagnostics.push(
      mark(
        `static-trailing-comma-${token.start}`,
        `Remove the trailing comma before ${nextClause.name}.`,
        token.start,
        token.end,
      ),
    );
  });

  const selectClause = clauses.find((clause) => clause.name === "SELECT");
  const fromClause = clauses.find((clause) => clause.name === "FROM");
  if (selectClause && fromClause && selectClause.tokenIndex < fromClause.tokenIndex) {
    const hasSelectExpression = hasExpressionBetween(tokens, selectClause.tokenIndex + 1, fromClause.tokenIndex);
    if (!hasSelectExpression) {
      diagnostics.push(
        mark(
          `static-select-missing-expression-${selectClause.start}`,
          "SELECT needs at least one column or expression before FROM.",
          fromClause.start,
          fromClause.end,
        ),
      );
    }
  }

  diagnostics.push(...findDanglingClauseDiagnostics(sql, tokens, clauses));

  if (multiStatementSeparators.length === 0) {
    let highestSeen: SqlClauseToken | null = null;
    clauses.forEach((clause) => {
      if (!highestSeen || clause.order >= highestSeen.order) {
        highestSeen = clause;
        return;
      }

      diagnostics.push(
        mark(
          `static-invalid-clause-order-${clause.start}`,
          `${clause.name} is out of order after ${highestSeen.name}; move clauses into standard SELECT/FROM/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT order.`,
          clause.start,
          clause.end,
        ),
      );
    });
  }

  multiStatementSeparators.forEach((token) => {
    diagnostics.push(
      mark(
        `static-multiple-statements-${token.start}`,
        "Only one SQL statement can be inspected at a time.",
        token.start,
        token.end,
      ),
    );
  });

  return diagnostics;
};
