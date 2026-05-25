import { useMemo, useState } from "react";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";

type QuestionDraftStatus = "idle" | "drafted";

type WorkspaceQuestionDraft = {
  rawQuestion: string;
  draftStatus: QuestionDraftStatus;
  activeDatasetId: string | null;
  activeWorksheetName: string | null;
  createdAt: string | null;
};

type QuestionWorkspacePanelProps = {
  dataset: DatasetMetadata;
  sourceName: string;
};

const starterPrompts = [
  "Which realtor manages the most properties?",
  "What changed most recently?",
  "Which locations perform best?",
  "Which customers generate the most revenue?",
];

const createInitialDraft = (): WorkspaceQuestionDraft => ({
  rawQuestion: "",
  draftStatus: "idle",
  activeDatasetId: null,
  activeWorksheetName: null,
  createdAt: null,
});

function QuestionWorkspacePanel({ dataset, sourceName }: QuestionWorkspacePanelProps) {
  const [rawQuestion, setRawQuestion] = useState("");
  const [draft, setDraft] = useState<WorkspaceQuestionDraft>(createInitialDraft);

  const datasetContext = useMemo(
    () => [
      { label: "Dataset", value: dataset.original_filename },
      { label: "Source", value: sourceName || dataset.table_name },
      { label: "Fields", value: dataset.column_count.toLocaleString() },
      { label: "Rows", value: dataset.row_count.toLocaleString() },
    ],
    [dataset.column_count, dataset.original_filename, dataset.row_count, dataset.table_name, sourceName],
  );

  const prepareDraft = () => {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion) return;

    setDraft({
      rawQuestion: nextQuestion,
      draftStatus: "drafted",
      activeDatasetId: dataset.dataset_id,
      activeWorksheetName: sourceName || dataset.table_name,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <section className="question-workspace-panel" aria-label="Workspace question preparation">
      <div className="question-workspace-copy">
        <p className="section-label">Workspace</p>
        <h2>Ask a business question</h2>
        <p>
          Start with what you want to learn. FiltraQueri will prepare a reviewable analysis
          before anything runs.
        </p>
      </div>

      <div className="question-workspace-context" aria-label="Active dataset context">
        {datasetContext.map((item) => (
          <span key={item.label} title={item.value}>
            {item.label}
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>

      <label className="question-workspace-input">
        <span>Business question</span>
        <textarea
          value={rawQuestion}
          onChange={(event) => setRawQuestion(event.target.value)}
          placeholder="Ask about this dataset..."
          rows={3}
        />
      </label>

      <div className="question-workspace-starters" aria-label="Starter questions">
        {starterPrompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => setRawQuestion(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <div className="question-workspace-actions">
        <button
          type="button"
          className="primary-button"
          onClick={prepareDraft}
          disabled={!rawQuestion.trim()}
        >
          Prepare answer
        </button>
      </div>

      {draft.draftStatus === "drafted" && (
        <section className="question-workspace-review" aria-label="Question review shell">
          <div>
            <p className="section-label">Review shell</p>
            <h3>FiltraQueri will prepare an analysis plan here.</h3>
          </div>
          <dl>
            <div>
              <dt>Question</dt>
              <dd>{draft.rawQuestion}</dd>
            </div>
            <div>
              <dt>Dataset</dt>
              <dd>{dataset.original_filename}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{draft.activeWorksheetName || dataset.table_name}</dd>
            </div>
          </dl>
          <p>
            <strong>No query has run yet.</strong>
          </p>
          <p>Generated logic will appear in a later checkpoint.</p>
        </section>
      )}
    </section>
  );
}

export default QuestionWorkspacePanel;
