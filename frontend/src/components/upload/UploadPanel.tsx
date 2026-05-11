import { forwardRef, type ChangeEvent } from "react";

type UploadPanelProps = {
  uploading: boolean;
  errorMessage: string;
  selectedFileName?: string;
  buttonLabel: string;
  context: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

const UploadPanel = forwardRef<HTMLInputElement, UploadPanelProps>(
  ({ uploading, errorMessage, selectedFileName, buttonLabel, context, onFileChange }, ref) => {
    const openFilePicker = () => {
      if (ref && typeof ref !== "function") {
        ref.current?.click();
      }
    };

    return (
      <section className="welcome-screen">
        <div className="welcome-copy">
          <p className="section-label">Workspace</p>
          <h2>Welcome to FiltraQueri</h2>
          <p>Simple Data Intelligence for Everyone</p>
          <div className="welcome-actions">
            <button type="button" className="primary-button" onClick={openFilePicker}>
              {buttonLabel}
            </button>
            <button type="button" className="secondary-button">
              Open recent dataset
            </button>
            <button type="button" className="secondary-button">
              Try sample dataset
            </button>
          </div>
          <input
            ref={ref}
            className="sidebar-file-input"
            type="file"
            accept=".csv"
            onChange={onFileChange}
            disabled={uploading}
          />
          <p className="welcome-note">{context}</p>
          {selectedFileName && <p className="selected-file-name">Selected: {selectedFileName}</p>}
          {uploading && <p className="status-message">Uploading and profiling your dataset...</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>
      </section>
    );
  },
);

export default UploadPanel;
