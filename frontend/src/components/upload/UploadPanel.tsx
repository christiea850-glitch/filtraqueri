import { forwardRef, useRef, useState, type ChangeEvent } from "react";
import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";
import type { HumanIntent } from "../dataset/DatasetSummaryPanel";

type HomeIconName = "upload" | "question" | "chart" | "library" | "document";

function HomeIcon({ name, size = 20 }: { name: HomeIconName; size?: number }) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "upload") {
    return (
      <svg {...commonProps}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" x2="12" y1="3" y2="15" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...commonProps}>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    );
  }

  if (name === "library") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 4v16" />
        <path d="M11 8h6" />
        <path d="M11 12h6" />
      </svg>
    );
  }

  if (name === "document") {
    return (
      <svg {...commonProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.1-3 4" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

type UploadPanelProps = {
  uploading: boolean;
  errorMessage: string;
  selectedFileName?: string;
  buttonLabel: string;
  context: string;
  dataset?: DatasetMetadata | null;
  recentDatasets?: DatasetSession[];
  continueLabel?: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onContinue?: () => void;
  onAskQuestion?: (question: string) => void;
  onRecentDatasetClick?: (datasetId: string) => void;
  onSuggestionSelect?: (intent: HumanIntent) => void;
};

const UploadPanel = forwardRef<HTMLInputElement, UploadPanelProps>(
  (
    {
      uploading,
      errorMessage,
      dataset,
      recentDatasets = [],
      onFileChange,
      onContinue,
      onAskQuestion,
      onRecentDatasetClick,
      onSuggestionSelect,
    },
    ref,
  ) => {
    const [askPrompt, setAskPrompt] = useState("");
    const recentWorkRef = useRef<HTMLDivElement | null>(null);
    const openFilePicker = () => {
      if (ref && typeof ref !== "function") {
        ref.current?.click();
      }
    };
    const focusRecentWork = () => {
      recentWorkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      recentWorkRef.current?.focus({ preventScroll: true });
    };
    const usefulRecentDatasets = recentDatasets
      .filter((session) => session?.dataset)
      .filter((session) => session.dataset.dataset_id !== dataset?.dataset_id)
      .slice(0, 4);
    const suggestionChips: {
      label: string;
      intent: HumanIntent;
      icon: HomeIconName;
    }[] = [
      {
        label: "Summarize this dataset",
        intent: "summary",
        icon: "document",
      },
      {
        label: "Show missing values",
        intent: "missing_values",
        icon: "question",
      },
      {
        label: "Top categories",
        intent: "top_categories",
        icon: "chart",
      },
      {
        label: "Trends",
        intent: "trends",
        icon: "chart",
      },
    ];
    const datasetLabel = dataset?.original_filename || dataset?.table_name || null;
    const hasRecentHistory = usefulRecentDatasets.length > 0;
    const askEnabled = Boolean(dataset && (onAskQuestion || onContinue));
    const askCanSubmit = askEnabled && askPrompt.trim().length > 0;
    const showSuggestions = Boolean(dataset && onSuggestionSelect);

    return (
      <section className="welcome-screen">
        <div className="welcome-copy">
          <div className="home-greeting-region">
            <div className="home-greeting">
              <div>
                <p className="section-label">Home</p>
                <h2>Good morning, Christie</h2>
              </div>
              {datasetLabel && (
                <span className="home-active-dataset-chip">
                  <HomeIcon name="document" size={18} />
                  <span>Working with:</span>
                  <strong>{datasetLabel}</strong>
                </span>
              )}
            </div>
          </div>

          {dataset ? (
            <form
              className="home-ask-hero"
              aria-label="Ask FiltraQueri"
              onSubmit={(event) => {
                event.preventDefault();
                const question = askPrompt.trim();
                if (askCanSubmit && question) {
                  if (onAskQuestion) {
                    onAskQuestion(question);
                  } else {
                    onContinue?.();
                  }
                  return;
                }
              }}
            >
              <div className="home-ask-control">
                <HomeIcon name="question" size={24} />
                <input
                  id="home-ask-filtraqueri"
                  type="text"
                  aria-label="Ask FiltraQueri anything about your data"
                  value={askPrompt}
                  onChange={(event) => setAskPrompt(event.target.value)}
                  placeholder="Ask about your data — try 'Which properties have vacant units?'"
                />
                <button className="primary-button" type="submit" disabled={!askCanSubmit}>
                  Ask →
                </button>
              </div>

              {showSuggestions && (
                <div className="home-suggestion-strip" aria-label="Quick question ideas">
                  <span>Or try:</span>
                  <div>
                    {suggestionChips.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion.intent}
                        onClick={() => onSuggestionSelect?.(suggestion.intent)}
                      >
                        <HomeIcon name={suggestion.icon} size={16} />
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            <button
              type="button"
              className="home-ask-control is-upload-mode"
              aria-label="Upload data to start asking questions"
              onClick={openFilePicker}
            >
              <HomeIcon name="upload" size={24} />
              <span>Upload a CSV or workbook to start asking questions</span>
              <span className="primary-button" aria-hidden="true">
                Upload data
              </span>
            </button>
          )}

          <div className="home-secondary-actions" aria-label="Secondary actions">
            <span>Or:</span>
            <button type="button" className="home-secondary-action" onClick={openFilePicker}>
              <HomeIcon name="upload" size={16} />
              Upload data
            </button>
            <button
              type="button"
              className="home-secondary-action"
              onClick={focusRecentWork}
              disabled={!hasRecentHistory}
            >
              <HomeIcon name="library" size={16} />
              Open a recent dataset
            </button>
          </div>

          <div
            className="home-recent-list"
            aria-label="Recent work"
            ref={recentWorkRef}
            tabIndex={-1}
          >
            <div className="home-section-heading">
              <span>Recent work</span>
              <small>Pick up where you left off</small>
            </div>
            <div className="home-recent-card-grid">
              {usefulRecentDatasets.length > 0 ? (
                usefulRecentDatasets.map((session) => (
                  <button
                    type="button"
                    key={session.dataset.dataset_id}
                    onClick={() => onRecentDatasetClick?.(session.dataset.dataset_id)}
                    title={session.dataset.original_filename}
                  >
                    {session.dataset.original_filename}
                  </button>
                ))
              ) : dataset ? (
                <button
                  type="button"
                  className="home-current-dataset-card"
                  onClick={() => onContinue?.()}
                  title={dataset.original_filename || dataset.table_name}
                >
                  <span>Currently investigating</span>
                  <strong>{dataset.original_filename || dataset.table_name}</strong>
                </button>
              ) : (
                <div className="home-empty-recent">
                  <span className="home-empty-recent-icon">
                    <HomeIcon name="library" size={40} />
                  </span>
                  <div>
                    <strong>No recent investigations yet.</strong>
                    <small>Open a dataset to start your first workspace.</small>
                  </div>
                </div>
              )}
            </div>
          </div>

          <input
            ref={ref}
            className="sidebar-file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFileChange}
            disabled={uploading}
          />
          {uploading && <p className="status-message">Uploading dataset...</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>
      </section>
    );
  },
);

export default UploadPanel;
