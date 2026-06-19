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
  const [apiUrl, setApiUrl] = useState('https://skimmer-ardently-sequel.ngrok-free.dev');
  const [n8nUrl, setN8nUrl] = useState('https://mykhann.app.n8n.cloud/webhook/analyze-contract');
  const [isOnline, setIsOnline] = useState(false);
  
  const { loading, error, step, report, gdocUrl, analyze, reset } = useAnalysis();

  // Health check (matches HTML version)
  useEffect(() => {
    checkHealthStatus();
    const interval = setInterval(checkHealthStatus, 15000);
    return () => clearInterval(interval);
  }, [apiUrl]);

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
      file: file,
      text: text.trim(),
      contract_name: contractName.trim() || 'Unnamed Contract',
      party_perspective: perspective,
    };

    // Pass the URLs and n8n flag to the hook
    await analyze(formData, { 
      useN8N: useN8N && n8nUrl.length > 0,
      n8nUrl: n8nUrl
    });
  };

  const clearFile = () => {
    setFile(null);
  };

  if (report) {
    return <Report report={report} onReset={reset} gdocUrl={gdocUrl} />;
  }

  return (
    <div className="analyze-container">
      <div className="page-inner">
        {/* Back Button */}
        <button className="btn-back-home" onClick={onBackToHome}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 8H1M1 8L8 15M1 8L8 1"/>
          </svg>
          Back to Home
        </button>

    

        <div className="hero">
          <h1>Know what you're <span>signing</span> before you sign</h1>
          <p>Upload any contract — get clause-level risk scores, red flags, and negotiation tactics in under a minute.</p>
        </div>

        {/* Route badge (matches HTML) */}
        <div className={`route-badge ${useN8N && n8nUrl ? 'via-n8n' : ''}`}>
          {useN8N && n8nUrl ? '🔄 Routing via n8n' : '⚡ Direct API'}
          {!useN8N && ' (no n8n)'}
        </div>

        {error && (
          <div className="error-box">
            <strong>⚠️ Analysis failed</strong>
            <span>{error}</span>
            <button className="error-close" onClick={() => window.location.reload()}>✕</button>
          </div>
        )}

        {gdocUrl && (
          <div className="gdoc-banner">
            📄 Full report saved to Google Docs — <a href={gdocUrl} target="_blank" rel="noopener noreferrer">open document</a>
          </div>
        )}

        {step > 0 && (
          <div className="progress-panel">
            <div className="progress-title">Analyzing your contract…</div>
            <div className="steps">
              {['Parsing document', 'Extracting clauses', 'Scoring risk', 'Building report'].map((label, i) => (
                <div key={i} className={`step ${i + 1 < step ? 'done' : i + 1 === step ? 'active' : ''}`}>
                  <div className="step-dot">{i + 1}</div>
                  <div>
                    <div className="step-label">{label}</div>
                    <div className="step-sub">{['Extracting text and structure', 'Identifying legally significant language', 'Evaluating each clause for exposure', 'Assembling recommendations and red flags'][i]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div {...getRootProps()} className={`drop-zone ${isDragActive ? 'drag-over' : ''}`}>
            <input {...getInputProps()} />
            <div className="drop-icon">📄</div>
            <h3>Drop your contract here</h3>
            <p>PDF, DOCX, or TXT · up to 10 MB</p>
          </div>

          {file && (
            <div className="file-chip">
              <span>📎</span>
              <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              <span className="file-chip-remove" onClick={clearFile}>✕</span>
            </div>
          )}

          <div className="divider">or paste contract text</div>

          <div className="form-group">
            <label className="form-label">Contract text</label>
            <textarea
              className="form-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full contract text here…"
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contract name</label>
              <input
                className="form-input"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="e.g. SaaS Service Agreement"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Your role</label>
              <select className="form-select" value={perspective} onChange={(e) => setPerspective(e.target.value)} disabled={loading}>
                <option value="reviewing party">Reviewing Party</option>
                <option value="client">Client</option>
                <option value="vendor">Vendor / Service Provider</option>
                <option value="employee">Employee</option>
                <option value="employer">Employer</option>
                <option value="landlord">Landlord</option>
                <option value="tenant">Tenant</option>
                <option value="investor">Investor</option>
                <option value="startup founder">Startup Founder</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            <div className={`spinner ${loading ? 'active' : ''}`}></div>
            <span>{loading ? 'Analyzing…' : '⚡ Analyze Contract'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Analyze;