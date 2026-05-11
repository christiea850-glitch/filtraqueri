import type { SqlEditorInterface } from "./sqlTypes";

type SqlEditorHostProps = {
  editor: SqlEditorInterface;
};

function SqlEditorHost({ editor }: SqlEditorHostProps) {
  return (
    <div className="sql-editor-host" data-editor-host="monaco-ready">
      <textarea
        className="sql-editor-input"
        value={editor.value}
        onChange={(event) => editor.onChange(event.target.value)}
        spellCheck={false}
        aria-label="SQL query text"
      />
    </div>
  );
}

export default SqlEditorHost;
