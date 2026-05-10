import { type ChangeEvent, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

type SchemaColumn = {
  name: string;
  type: string;
};

type DatasetMetadata = {
  dataset_id: string;
  filename: string;
  original_filename: string;
  table_name: string;
  uploaded_at: string;
  row_count: number;
  column_count: number;
  schema: SchemaColumn[];
};

type UploadResponse = {
  dataset: DatasetMetadata;
  preview: Record<string, unknown>[];
};

function App() {
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsUploading(true);
    setErrorMessage("");
    setDataset(null);
    setData([]);
    setColumns([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/datasets/upload`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "Upload failed. Please try another CSV file.");
      }

      const uploadResult = payload as UploadResponse;
      setDataset(uploadResult.dataset);
      setData(uploadResult.preview);
      setColumns(uploadResult.dataset.schema.map((column) => column.name));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not upload that file. Please check the backend and try again.";

      setErrorMessage(message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="app">
      <div className="card">
        <header className="brand-header">
          <div className="brand-lockup" aria-label="FiltraQueri">
            <div className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" role="img">
                <path
                  className="mark-funnel"
                  d="M9 11h30L28 24.5v8.7l-8 4.3v-13L9 11Z"
                />
                <path className="mark-search" d="M30 29.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                <path className="mark-handle" d="m34.5 34.5 5 5" />
              </svg>
            </div>
            <h1>
              <span>Filtra</span>
              <span>Queri</span>
            </h1>
          </div>
          <p className="tagline">Simple Data Intelligence for Everyone</p>
          <p className="subtitle">Ask Your Data Naturally</p>
        </header>

        <div className="upload-box">
          <div className="upload-icon" aria-hidden="true">
            CSV
          </div>
          <div>
            <p className="upload-title">Upload your dataset</p>
            <p className="upload-helper">Upload a CSV file to begin exploring your data.</p>
          </div>
          <input type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
          {isUploading && <p className="status-message">Uploading and profiling your dataset...</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>

        {dataset && (
          <section className="dataset-summary" aria-label="Dataset metadata">
            <div className="summary-header">
              <div>
                <p className="section-label">Dataset ready</p>
                <h2>{dataset.original_filename}</h2>
              </div>
              <span className="dataset-id">ID: {dataset.dataset_id.slice(0, 8)}</span>
            </div>

            <div className="summary-grid">
              <div>
                <span>Rows</span>
                <strong>{dataset.row_count.toLocaleString()}</strong>
              </div>
              <div>
                <span>Columns</span>
                <strong>{dataset.column_count.toLocaleString()}</strong>
              </div>
              <div>
                <span>Table</span>
                <strong>{dataset.table_name}</strong>
              </div>
            </div>

            <div className="schema-list" aria-label="Detected schema">
              {dataset.schema.map((column) => (
                <span className="schema-pill" key={column.name}>
                  {column.name}
                  <small>{column.type}</small>
                </span>
              ))}
            </div>
          </section>
        )}

        {data.length > 0 && (
          <section className="preview-section" aria-label="Dataset preview">
            <div className="preview-heading">
              <p className="section-label">Preview</p>
              <p>Showing {data.length.toLocaleString()} backend-generated rows</p>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {data.map((row, index) => (
                    <tr key={index}>
                      {columns.map((column) => (
                        <td key={column}>{String(row[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
