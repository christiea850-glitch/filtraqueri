import { forwardRef, type ChangeEvent } from "react";
import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";

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
  onRecentDatasetClick?: (datasetId: string) => void;
};

const UploadPanel = forwardRef<HTMLInputElement, UploadPanelProps>(
  (
    {
      uploading,
      errorMessage,
      selectedFileName,
      context,
      dataset,
      recentDatasets = [],
      onFileChange,
      onContinue,
      onRecentDatasetClick,
    },
    ref,
  ) => {
    const openFilePicker = () => {
      if (ref && typeof ref !== "function") {
        ref.current?.click();
      }
    };
    const usefulRecentDatasets = recentDatasets
      .filter((session) => session?.dataset)
      .filter((session) => session.dataset.dataset_id !== dataset?.dataset_id)
      .slice(0, 4);

    return (
      <section className="welcome-screen">
        <div className="welcome-copy">
          <p className="section-label">Home</p>
          <h2>Good morning, Christie</h2>
          <p>What would you like to do?</p>

          <div className="home-action-grid" aria-label="Primary actions">
            <button type="button" className="home-action-card is-primary" onClick={openFilePicker}>
              <span>Data</span>
              <strong>Open data</strong>
              <small>Upload a CSV or workbook.</small>
            </button>
            <button type="button" className="home-action-card" onClick={onContinue}>
              <span>Investigation</span>
              <strong>Continue investigation</strong>
              <small>{dataset ? "Return to the active workspace." : "Open data to begin."}</small>
            </button>
            <button type="button" className="home-action-card" onClick={onContinue}>
              <span>Analyze</span>
              <strong>Ask a question</strong>
              <small>Start with guided analysis.</small>
            </button>
            <button type="button" className="home-action-card" onClick={onContinue}>
              <span>Insights</span>
              <strong>View insights</strong>
              <small>Review findings and next steps.</small>
            </button>
            <button type="button" className="home-action-card" onClick={openFilePicker}>
              <span>Library</span>
              <strong>Browse datasets</strong>
              <small>Choose from recent work.</small>
            </button>
            <button type="button" className="home-action-card">
              <span>Support</span>
              <strong>Guides & help</strong>
              <small>Learn investigation workflows.</small>
            </button>
          </div>

          <div className="home-recent-list" aria-label="Recent work">
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
              ) : (
                <span className="home-empty-recent">No recent investigations yet.</span>
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
          {!dataset && <p className="welcome-note">{context}</p>}
          {selectedFileName && <p className="selected-file-name">Selected: {selectedFileName}</p>}
          {uploading && <p className="status-message">Uploading dataset...</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>
      </section>
    );
  },
);

export default UploadPanel;
