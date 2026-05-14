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
          <p className="section-label">Home</p>
          {dataset ? (
            <>
              <h2>Continue where you left off</h2>
              <p>Your workspace is ready. Pick up the current investigation or open another file.</p>
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
              <h2>Open data</h2>
              <p>Start with a CSV or Excel workbook.</p>
              <div className="welcome-actions">
                <button type="button" className="primary-button" onClick={openFilePicker}>
                  {buttonLabel}
                </button>
              </div>
            </>
          )}

          {dataset && (
            <div className="welcome-actions">
              <button type="button" className="secondary-button" onClick={openFilePicker}>
                Open another file
              </button>
            </div>
          )}

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
