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
      buttonLabel,
      context,
      dataset,
      recentDatasets = [],
      continueLabel = "Continue",
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
          <p className="section-label">FiltraQueri</p>
          {dataset ? (
            <>
              <h2>Welcome back.</h2>
              <p>What would you like to do with your current investigation?</p>
              <div className="home-continuation-surface">
                <div>
                  <span>Current workspace</span>
                  <strong>Investigation in progress</strong>
                </div>
                <button type="button" className="primary-button" onClick={onContinue}>
                  {continueLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Ask better questions of your data.</h2>
              <p>Start with a CSV or Excel workbook. FiltraQueri will help you understand what is inside and where to go next.</p>
            </>
          )}

          <div className="home-action-grid" aria-label="Primary actions">
            <button type="button" className="home-action-card is-primary" onClick={dataset ? onContinue : openFilePicker}>
              <span>{dataset ? "Continue" : "Start"}</span>
              <strong>{dataset ? continueLabel : buttonLabel}</strong>
              <small>{dataset ? "Return to your current work." : "Open a workbook or CSV."}</small>
            </button>
            <button type="button" className="home-action-card" onClick={openFilePicker}>
              <span>Data</span>
              <strong>Open another file</strong>
              <small>Begin a new investigation without changing the system.</small>
            </button>
          </div>

          {usefulRecentDatasets.length > 0 && (
            <div className="home-recent-list" aria-label="Recent investigations">
              <span>Recent investigations</span>
              {usefulRecentDatasets.map((session) => (
                <button
                  type="button"
                  key={session.dataset.dataset_id}
                  onClick={() => onRecentDatasetClick?.(session.dataset.dataset_id)}
                  title={session.dataset.original_filename}
                >
                  {session.dataset.original_filename}
                </button>
              ))}
            </div>
          )}

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
