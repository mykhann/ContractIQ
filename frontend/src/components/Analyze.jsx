import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAnalysis } from '../hooks/useAnalysis';
import { checkHealth } from '../api/api';
import Report from './Report';
import './styles.css';

const Analyze = ({ onBackToHome }) => {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [contractName, setContractName] = useState('');
  const [perspective, setPerspective] = useState('reviewing party');
  const [useN8N, setUseN8N] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  const { loading, error, step, report, gdocUrl, analyze, reset } = useAnalysis();

  const API_URL = import.meta.env.VITE_API_URL;
  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

  useEffect(() => {
    checkHealthStatus();
    const interval = setInterval(checkHealthStatus, 15000);
    return () => clearInterval(interval);
  }, [API_URL]);

  const checkHealthStatus = async () => {
    try {
      const status = await checkHealth();
      setIsOnline(status);
    } catch {
      setIsOnline(false);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      if (!contractName) setContractName(f.name.replace(/\.[^.]+$/, ''));
    }
  }, [contractName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize: 10485760,
    multiple: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file && text.trim().length < 50) {
      alert('Upload a file or paste at least 50 characters of contract text.');
      return;
    }

    const formData = {
      file,
      text: text.trim(),
      contract_name: contractName.trim() || 'Unnamed Contract',
      party_perspective: perspective,
    };

    await analyze(formData, {
      useN8N,
      n8nUrl: N8N_WEBHOOK_URL,
    });
  };

  const clearFile = () => setFile(null);

  if (report) {
    return <Report report={report} onReset={reset} gdocUrl={gdocUrl} />;
  }

  return (
    <div className="analyze-container">
      <div className="page-inner">

        {/* Back Button */}
        <button className="btn-back-home" onClick={onBackToHome}>
          ← Back to Home
        </button>

        <div className="hero">
          <h1>Know what you're <span>signing</span> before you sign</h1>
          <p>Upload any contract — get clause-level risk scores, red flags, and negotiation tactics in under a minute.</p>
        </div>

        <div className={`route-badge ${useN8N ? 'via-n8n' : ''}`}>
          {useN8N ? '🔄 Routing via n8n' : '⚡ Direct API'}
        </div>

        {error && (
          <div className="error-box">
            <strong>⚠️ Analysis failed</strong>
            <span>{error}</span>
          </div>
        )}

        {step > 0 && (
          <div className="progress-panel">
            <div className="progress-title">Analyzing your contract…</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div {...getRootProps()} className={`drop-zone ${isDragActive ? 'drag-over' : ''}`}>
            <input {...getInputProps()} />
            <div className="drop-icon">📄</div>
            <h3>Drop your contract here</h3>
          </div>

          {file && (
            <div className="file-chip">
              📎 {file.name}
              <span onClick={clearFile}>✕</span>
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste contract text..."
          />

          <input
            value={contractName}
            onChange={(e) => setContractName(e.target.value)}
            placeholder="Contract name"
          />

          <select
            value={perspective}
            onChange={(e) => setPerspective(e.target.value)}
          >
            <option value="reviewing party">Reviewing Party</option>
            <option value="client">Client</option>
            <option value="vendor">Vendor</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze Contract'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Analyze;