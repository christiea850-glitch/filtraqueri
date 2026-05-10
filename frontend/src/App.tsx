import { useState } from "react";
import Papa from "papaparse";
import "./App.css";

function App() {
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);

  const handleFileUpload = (event: any) => {
    const file = event.target.files[0];

    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log(results.data);

        setData(results.data as any[]);

        if (results.data.length > 0) {
          setColumns(Object.keys(results.data[0] as object));
        }
      },
    });
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
          <input type="file" accept=".csv" onChange={handleFileUpload} />
        </div>

        {data.length > 0 && (
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
                {data.slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column}>{row[column]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
