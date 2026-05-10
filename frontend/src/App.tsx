function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "20px",
          width: "500px",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "40px",
            marginBottom: "10px",
            color: "#111827",
          }}
        >
          FiltraQueri
        </h1>

        <p
          style={{
            color: "#6b7280",
            marginBottom: "30px",
            fontSize: "18px",
          }}
        >
          Ask Your Data Naturally
        </p>

        <div
          style={{
            border: "2px dashed #cbd5e1",
            padding: "40px",
            borderRadius: "16px",
            background: "#f8fafc",
          }}
        >
          <p
            style={{
              marginBottom: "20px",
              color: "#475569",
            }}
          >
            Upload CSV or Excel File
          </p>

          <input type="file" />
        </div>
      </div>
    </div>
  );
}

export default App;