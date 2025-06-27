import React, { useEffect, useState } from 'react';

const SwaggerFetcher = ({ swaggerUrl, onTry }) => {
  const [swaggerJson, setSwaggerJson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSwaggerJson = async () => {
      try {
        const response = await fetch(swaggerUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setSwaggerJson(data);
      } catch (err) {
        setError(err.message);
      }
    };
    if (swaggerUrl) fetchSwaggerJson();
  }, [swaggerUrl]);

  const renderFlatEndpoints = () => {
    if (!swaggerJson?.paths) return <p>No API paths found.</p>;

    const flatEndpoints = [];
    for (const [path, methods] of Object.entries(swaggerJson.paths)) {
      for (const [method, details] of Object.entries(methods)) {
        flatEndpoints.push({ path, method, details });
      }
    }

    return flatEndpoints.map(({ path, method, details }, index) => (
      <div key={`${method}-${path}-${index}`} style={styles.methodBlock}>
        <span style={{ ...styles.method, ...styles[method.toLowerCase()] }}>
          {method.toUpperCase()}
        </span>
        <span style={styles.pathSummary}>
          <strong>{details.operationId || 'Unnamed API'}</strong> — {path}
        </span>
        <button
          style={styles.tryButton}
          onClick={() => onTry({ path, method, details })}
        >
          Select
        </button>
      </div>
    ));
  };

  return (
    <div>
      <h3>Swagger API Endpoints</h3>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {swaggerJson ? (
        <div style={styles.scrollBox}>{renderFlatEndpoints()}</div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

const styles = {
  scrollBox: {
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    background: '#f9f9f9',
  },
  methodBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
    borderBottom: '1px solid #eee',
    paddingBottom: '6px',
  },
  method: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    color: '#fff',
    minWidth: '60px',
    textAlign: 'center',
  },
  pathSummary: {
    flex: 1,
    fontSize: '14px',
  },
  tryButton: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #007bff',
    background: '#007bff',
    color: '#fff',
    cursor: 'pointer',
  },
  get: { backgroundColor: '#28a745' },
  post: { backgroundColor: '#007bff' },
  put: { backgroundColor: '#ffc107' },
  delete: { backgroundColor: '#dc3545' },
  patch: { backgroundColor: '#6f42c1' },
};

export default SwaggerFetcher;
