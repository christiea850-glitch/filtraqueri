import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Editor, { type BeforeMount, type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor, Position } from "monaco-editor";
import type { SqlEditorInterface } from "./sqlTypes";

type SqlEditorHostProps = {
  editor: SqlEditorInterface;
};

type MonacoErrorBoundaryProps = {
  fallback: ReactNode;
  children: ReactNode;
};

type MonacoErrorBoundaryState = {
  hasError: boolean;
};

class MonacoErrorBoundary extends Component<MonacoErrorBoundaryProps, MonacoErrorBoundaryState> {
  state: MonacoErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;

    return this.props.children;
  }
}

function SqlTextareaFallback({ editor }: SqlEditorHostProps) {
  return (
    <textarea
      className="sql-editor-input"
      value={editor.value}
      onChange={(event) => editor.onChange(event.target.value)}
      spellCheck={false}
      aria-label="SQL query text"
    />
  );
}

const keywordHelp: Record<string, string> = {
  SELECT: "Choose the columns or calculations you want to return.",
  FROM: "Choose the dataset table to read from.",
  WHERE: "Filter rows before results are returned.",
  "GROUP BY": "Group rows by one or more columns before summarizing.",
  "ORDER BY": "Sort the result rows by a column or expression.",
  LIMIT: "Limit how many rows are returned.",
  COUNT: "Count rows or non-empty values.",
  SUM: "Add numeric values together.",
  AVG: "Calculate an average for numeric values.",
  MIN: "Find the smallest value.",
  MAX: "Find the largest value.",
  "CASE WHEN": "Create conditional logic inside a query.",
};

const keywordInsertText: Record<string, string> = {
  SELECT: "SELECT ",
  FROM: "FROM ",
  WHERE: "WHERE ",
  "GROUP BY": "GROUP BY ",
  "ORDER BY": "ORDER BY ",
  LIMIT: "LIMIT ",
  COUNT: "COUNT(${1:*})",
  SUM: "SUM(${1:column})",
  AVG: "AVG(${1:column})",
  MIN: "MIN(${1:column})",
  MAX: "MAX(${1:column})",
  "CASE WHEN": "CASE WHEN ${1:condition} THEN ${2:value} ELSE ${3:other_value} END",
};

const snippetKeywords = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX", "CASE WHEN"]);

const markdownEscape = (value: string) => value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");

const getEditorPosition = (text: string, offset: number) => {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const beforeOffset = text.slice(0, safeOffset);
  const lines = beforeOffset.split("\n");

  return {
    lineNumber: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
};

function SqlEditorHost({ editor }: SqlEditorHostProps) {
  const [shouldUseFallback, setShouldUseFallback] = useState(false);
  const [isMonacoReady, setIsMonacoReady] = useState(false);
  const hasMountedMonacoRef = useRef(false);
  const monacoRef = useRef<Monaco | null>(null);
  const providerDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      if (!hasMountedMonacoRef.current) setShouldUseFallback(true);
    }, 8000);

    return () => window.clearTimeout(fallbackTimer);
  }, []);

  useEffect(
    () => () => {
      providerDisposablesRef.current.forEach((provider) => provider.dispose());
      providerDisposablesRef.current = [];
      monacoRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !isMonacoReady || shouldUseFallback) return undefined;

    providerDisposablesRef.current.forEach((provider) => provider.dispose());
    providerDisposablesRef.current = [];

    const completionProvider = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [" ", "\n", "\"", "."],
      provideCompletionItems: (model: MonacoEditor.ITextModel, position: Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const keywordCompletions = editor.keywordSuggestions.map((keyword) => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keywordInsertText[keyword] || `${keyword} `,
          insertTextRules:
            snippetKeywords.has(keyword)
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
          detail: "SQL keyword",
          documentation: keywordHelp[keyword] || "SQL keyword.",
          range,
        }));
        const columnCompletions = editor.suggestions.map((suggestion) => {
          const schemaColumn = editor.schema.find((column) => column.name === suggestion.label);

          return {
            label: suggestion.label,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: suggestion.sql,
            detail: schemaColumn
              ? `${schemaColumn.inferred_type} column`
              : suggestion.description,
            documentation: {
              value: [
                `**${markdownEscape(suggestion.label)}**`,
                "",
                suggestion.description,
                schemaColumn
                  ? `Nulls: ${schemaColumn.null_count.toLocaleString()} | Unique values: ${schemaColumn.unique_count.toLocaleString()}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
            range,
          };
        });
        const templateCompletions = editor.templates.map((template) => ({
          label: template.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: template.sql,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: `${template.category} template`,
          documentation: {
            value: `**${markdownEscape(template.label)}**\n\n${template.description}`,
          },
          range,
        }));

        return {
          suggestions: [...keywordCompletions, ...columnCompletions, ...templateCompletions],
        };
      },
    });

    const hoverProvider = monaco.languages.registerHoverProvider("sql", {
      provideHover: (model: MonacoEditor.ITextModel, position: Position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const rawWord = word.word.replace(/^"|"$/g, "");
        const keyword = editor.keywordSuggestions.find(
          (keywordSuggestion) => keywordSuggestion === rawWord.toUpperCase(),
        );

        if (keyword) {
          return {
            contents: [
              { value: `**${keyword}**` },
              { value: keywordHelp[keyword] || "SQL keyword." },
            ],
          };
        }

        const schemaColumn = editor.schema.find((column) => column.name === rawWord);
        if (schemaColumn) {
          return {
            contents: [
              { value: `**${markdownEscape(schemaColumn.name)}**` },
              { value: `${schemaColumn.inferred_type} column` },
              {
                value: `Nulls: ${schemaColumn.null_count.toLocaleString()} | Unique values: ${schemaColumn.unique_count.toLocaleString()}`,
              },
            ],
          };
        }

        const template = editor.templates.find(
          (sqlTemplate) => sqlTemplate.label.toLowerCase() === rawWord.toLowerCase(),
        );
        if (template) {
          return {
            contents: [
              { value: `**${markdownEscape(template.label)}**` },
              { value: template.description },
            ],
          };
        }

        return null;
      },
    });

    providerDisposablesRef.current = [completionProvider, hoverProvider];

    return () => {
      providerDisposablesRef.current.forEach((provider) => provider.dispose());
      providerDisposablesRef.current = [];
    };
  }, [
    editor.keywordSuggestions,
    editor.schema,
    editor.suggestions,
    editor.templates,
    isMonacoReady,
    shouldUseFallback,
  ]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !isMonacoReady || shouldUseFallback) return undefined;

    const models = monaco.editor.getModels();
    const model = models.find((editorModel: MonacoEditor.ITextModel) => editorModel.getLanguageId() === "sql");
    if (!model) return undefined;

    const markers = editor.diagnostics.map((diagnostic) => {
      const start = getEditorPosition(editor.value, diagnostic.start);
      const end = getEditorPosition(editor.value, diagnostic.end);

      return {
        severity:
          diagnostic.severity === "error"
            ? monaco.MarkerSeverity.Error
            : diagnostic.severity === "warning"
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
        message: diagnostic.message,
        source: "FiltraQueri SQL Intelligence",
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: Math.max(end.column, start.column + 1),
      };
    });

    monaco.editor.setModelMarkers(model, "filtraqueri-sql-intelligence", markers);

    return () => {
      monaco.editor.setModelMarkers(model, "filtraqueri-sql-intelligence", []);
    };
  }, [editor.diagnostics, editor.value, isMonacoReady, shouldUseFallback]);

  const configureMonaco: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("filtraqueri-sql-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword.sql", foreground: "93c5fd", fontStyle: "bold" },
        { token: "string.sql", foreground: "a7f3d0" },
        { token: "number.sql", foreground: "fcd34d" },
        { token: "comment.sql", foreground: "94a3b8", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "#0f172a",
        "editor.foreground": "#e5eefb",
        "editorLineNumber.foreground": "#64748b",
        "editorCursor.foreground": "#bfdbfe",
        "editor.selectionBackground": "#1d4ed866",
        "editor.lineHighlightBackground": "#1e293b88",
      },
    });
  };

  const handleMount: OnMount = (monacoEditor, monaco) => {
    hasMountedMonacoRef.current = true;
    monacoRef.current = monaco;
    setIsMonacoReady(true);
    monacoEditor.layout();
  };

  return (
    <div className="sql-editor-host" data-editor-host="monaco-ready">
      {shouldUseFallback ? (
        <SqlTextareaFallback editor={editor} />
      ) : (
        <MonacoErrorBoundary fallback={<SqlTextareaFallback editor={editor} />}>
          <Editor
            className="sql-monaco-editor"
            height="100%"
            defaultLanguage="sql"
            language="sql"
            theme="filtraqueri-sql-dark"
            value={editor.value}
            beforeMount={configureMonaco}
            onMount={handleMount}
            onChange={(value) => editor.onChange(value || "")}
            loading={<SqlTextareaFallback editor={editor} />}
            options={{
              automaticLayout: true,
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
              fontSize: 14,
              lineHeight: 24,
              minimap: { enabled: false },
              padding: { top: 16, bottom: 16 },
              quickSuggestions: true,
              readOnly: false,
              renderLineHighlight: "line",
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: "on",
            }}
          />
        </MonacoErrorBoundary>
      )}
    </div>
  );
}

export default SqlEditorHost;
