import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import SqlEditorHost from "./SqlEditorHost";
import type {
  SqlEditorInterface,
  SqlDialectContext,
  SqlExecutionStatus,
  SqlGuidanceCard,
  SqlValidationSummary,
} from "./sqlTypes";

type SqlEditorPanelProps = {
  editor: SqlEditorInterface;
  executionStatus: SqlExecutionStatus;
  characterCount: number;
  canRunQuery: boolean;
  canOpenResultPreview: boolean;
  onOpenResultPreview: () => void;
  onOpenSavedDrafts: () => void;
  onInsertSql: (sql: string) => void;
  dialectContext: SqlDialectContext;
};

const statusLabels: Record<SqlExecutionStatus, string> = {
  idle: "Ready",
  "draft-saved": "Query saved to Saved Drafts",
  "explain-ready": "Explain placeholder ready",
  running: "Running query",
  success: "Query complete",
  error: "Query failed",
};

function SqlHelpersPopup({
  editor,
  onInsertSql,
  onClose,
}: {
  editor: SqlEditorInterface;
  onInsertSql: (sql: string) => void;
  onClose: () => void;
}) {
  type SqlHelperItem = {
    id: string;
    label: string;
    helper: string;
    category: string;
    sql: string;
    kind: "template" | "keyword";
  };

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const helperItems = useMemo<SqlHelperItem[]>(
    () =>
      [
        ...editor.templates.map((template) => ({
          id: `template:${template.id}`,
          label: template.label,
          helper: template.description,
          category: template.category,
          sql: template.sql,
          kind: "template" as const,
        })),
        ...editor.keywordSuggestions.map((keyword) => ({
          id: `keyword:${keyword}`,
          label: keyword,
          helper: "Insert SQL keyword",
          category: "keyword",
          sql: keyword,
          kind: "keyword" as const,
        })),
      ].filter((item) =>
        [item.label, item.helper, item.category, item.sql, item.kind]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [editor.keywordSuggestions, editor.templates, normalizedQuery],
  );
  const groupedItems = useMemo(
    () => ({
      templates: helperItems.filter((item) => item.kind === "template"),
      keywords: helperItems.filter((item) => item.kind === "keyword"),
    }),
    [helperItems],
  );
  const insertSql = (sql: string) => {
    onInsertSql(sql);
    onClose();
  };
  const insertActiveItem = () => {
    const activeItem = helperItems[activeIndex];
    if (activeItem) insertSql(activeItem.sql);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(helperItems.length - 1, 0)),
    );
  }, [helperItems.length]);

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        helperItems.length === 0 ? 0 : Math.min(currentIndex + 1, helperItems.length - 1),
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      insertActiveItem();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  let itemIndex = -1;

  return (
    <div className="sql-helper-popover" role="dialog" aria-label="SQL helpers">
      <div className="sql-helper-popover-head">
        <div>
          <span>SQL helpers</span>
          <strong>Templates and keywords</strong>
        </div>
        <button type="button" className="sqlw-dock-x" onClick={onClose} aria-label="Close SQL helpers">
          Close
        </button>
      </div>
      <label className="sql-helper-search">
        <span>Search helpers</span>
        <input
          ref={inputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Template, keyword, or SQL pattern"
        />
      </label>
      <div className="sql-helper-popover-body">
        {helperItems.length === 0 ? (
          <p className="sql-helper-empty">No helpers match your search.</p>
        ) : (
          <>
            {groupedItems.templates.length > 0 && (
              <section className="sql-helper-picker-section">
                <div className="sql-helper-section-label">
                  <span>Templates</span>
                </div>
                <div className="sql-helper-command-list">
                  {groupedItems.templates.map((item) => {
                    itemIndex += 1;
                    const currentIndex = itemIndex;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={currentIndex === activeIndex ? "is-active" : ""}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => insertSql(item.sql)}
                      >
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.helper}</small>
                        </span>
                        <em>{item.category}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            {groupedItems.keywords.length > 0 && (
              <section className="sql-helper-picker-section">
                <div className="sql-helper-section-label">
                  <span>Keywords</span>
                </div>
                <div className="sql-helper-command-list is-keyword-list">
                  {groupedItems.keywords.map((item) => {
                    itemIndex += 1;
                    const currentIndex = itemIndex;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={currentIndex === activeIndex ? "is-active" : ""}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        onClick={() => insertSql(item.sql)}
                      >
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.helper}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <div className="sql-helper-popover-foot" aria-hidden="true">
        <span>Up/down navigate</span>
        <span>Enter insert</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}

function SqlEditorPanel({
  editor,
  executionStatus,
  characterCount,
  canRunQuery,
  canOpenResultPreview,
  onOpenResultPreview,
  onOpenSavedDrafts,
  onInsertSql,
  dialectContext,
}: SqlEditorPanelProps) {
  const [isHelperOpen, setIsHelperOpen] = useState(false);

  return (
    <section className="sql-editor-panel" aria-label="SQL editor">
      <div className="sql-editor-toolbar">
        <div className="sql-actions">
          <label className="sql-dialect-selector">
            <span>Dialect</span>
            <select
              value={dialectContext.selectedDialect}
              onChange={(event) =>
                dialectContext.onDialectChange(event.target.value as SqlDialectContext["selectedDialect"])
              }
              aria-label="SQL dialect context"
            >
              {dialectContext.dialectOptions.map((dialect) => (
                <option key={dialect.id} value={dialect.id}>
                  {dialect.displayName}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary-button" onClick={editor.onRun} disabled={!canRunQuery}>
            Run query
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onOpenResultPreview}
            disabled={!canOpenResultPreview}
          >
            Result Preview
          </button>
          <button type="button" className="secondary-button" onClick={editor.onSaveDraft}>
            Save Query
          </button>
          <button type="button" className="secondary-button" onClick={onOpenSavedDrafts}>
            Saved Drafts
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsHelperOpen((currentValue) => !currentValue)}
            aria-expanded={isHelperOpen}
          >
            SQL helpers
          </button>
          <button type="button" className="text-button" onClick={editor.onClear}>
            Clear
          </button>
        </div>
        {isHelperOpen && (
          <SqlHelpersPopup
            editor={editor}
            onInsertSql={onInsertSql}
            onClose={() => setIsHelperOpen(false)}
          />
        )}
      </div>

      <SqlEditorHost editor={editor} />

      <div className="sql-editor-footer">
        <span>{statusLabels[executionStatus]}</span>
        <span>{characterCount.toLocaleString()} characters</span>
      </div>
    </section>
  );
}

type SqlGuidancePanelProps = {
  diagnostics: SqlEditorInterface["diagnostics"];
  guidanceCards: SqlGuidanceCard[];
  dialectContext: Pick<SqlDialectContext, "selectedDialectProfile">;
  validation: SqlValidationSummary;
};

export function SqlGuidancePanel({
  diagnostics,
  guidanceCards,
  dialectContext,
  validation,
}: SqlGuidancePanelProps) {
  const visibleDiagnostics = diagnostics.slice(0, 4);
  const functionCount = diagnostics.filter((diagnostic) => diagnostic.source === "function").length;
  const conceptCount = diagnostics.filter((diagnostic) => diagnostic.source === "concept").length;
  const safetyCount = validation.diagnostics.filter(
    (diagnostic) => diagnostic.category === "safety",
  ).length;

  return (
    <section className="sql-draft-panel" aria-label="SQL guidance">
      <div className="sql-draft-list" aria-label="SQL guidance notes">
        <div className="builder-block-header">
          <span>SQL guidance</span>
          <small>{diagnostics.length} notes</small>
        </div>
        <div className="sql-guidance-context">
          <strong>{dialectContext.selectedDialectProfile.displayName}</strong>
          <span>
            {functionCount} functions | {conceptCount} concepts | {safetyCount} safety
          </span>
        </div>
        {visibleDiagnostics.length === 0 && guidanceCards.length === 0 ? (
          <p>No SQL guidance yet.</p>
        ) : (
          <>
            {visibleDiagnostics.map((diagnostic) => (
              <article key={diagnostic.id}>
                <strong>{diagnostic.title}</strong>
                <span>{diagnostic.message}</span>
              </article>
            ))}
            {guidanceCards.map((card) => (
              <article key={card.id}>
                <strong>{card.title}</strong>
                <span>{card.detail || card.summary}</span>
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

export default SqlEditorPanel;
