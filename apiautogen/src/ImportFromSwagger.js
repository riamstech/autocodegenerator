// ImportFromSwagger.js
import React, { useState } from 'react';
import SwaggerFetcher from './SwaggerFetcher';

const ImportFromSwagger = ({onData}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [swaggerUrl, setSwaggerUrl] = useState('');
  const [submittedUrl, setSubmittedUrl] = useState(null);

  const handleOpenPopup = () => {
    setShowPopup(true);
    setSwaggerUrl('');
    setSubmittedUrl(null);
  };

  const handleSubmit = () => {
    if (swaggerUrl.trim() !== '') {
      setSubmittedUrl(swaggerUrl.trim());
    }
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    setSwaggerUrl('');
    setSubmittedUrl(null);
  };

  const handleTryClick = (endpoint) => {
    onData(endpoint)
    setShowPopup(false);
  };

  return (
    <div>
      <button onClick={handleOpenPopup}>Import from Swagger</button>

      {showPopup && (
        <div style={styles.overlay}>
          <div style={styles.popup}>
            <button onClick={handleClosePopup} style={styles.closeButton}>
            &times;
            </button>
            <h3>Enter Swagger URL</h3>
            <input
              type="text"
              value={swaggerUrl}
              onChange={(e) => setSwaggerUrl(e.target.value)}
              style={styles.input}
              placeholder="https://example.com/swagger.json"
            />
            <div style={styles.buttonGroup}>
              <button onClick={handleSubmit}>Submit</button>
            </div>

            {submittedUrl && (
              <div style={styles.resultContainer}>
                <SwaggerFetcher swaggerUrl={submittedUrl} onTry={handleTryClick} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Simple styling
const styles = {
  overlay: {
    position: 'fixed',
    textAlign: 'left',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 1000,
  },
  closeButton: {
    position: 'absolute',
    top: '10px',
    right: '15px',
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    fontWeight: 'bold',
    cursor: 'pointer',
    color: '#333',
  },
  popup: {
    position: 'relative', 
    background: '#fff',
    padding: '20px',
    borderRadius: '8px',
    width: '900px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },  
  input: {
    width: '100%',
    padding: '8px',
    marginBottom: '10px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
  },
  resultContainer: {
    borderTop: '1px solid #ccc',
    marginTop: '15px',
    paddingTop: '10px',
  },
};

export default ImportFromSwagger;
