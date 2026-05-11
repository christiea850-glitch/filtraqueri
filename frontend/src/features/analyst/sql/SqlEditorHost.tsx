import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
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

function SqlEditorHost({ editor }: SqlEditorHostProps) {
  const [shouldUseFallback, setShouldUseFallback] = useState(false);
  const hasMountedMonacoRef = useRef(false);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      if (!hasMountedMonacoRef.current) setShouldUseFallback(true);
    }, 8000);

    return () => window.clearTimeout(fallbackTimer);
  }, []);

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

  const handleMount: OnMount = (monacoEditor) => {
    hasMountedMonacoRef.current = true;
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
              quickSuggestions: false,
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
