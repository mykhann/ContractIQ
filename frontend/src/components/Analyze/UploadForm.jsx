import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import './UploadForm.css';

const UploadForm = ({ onSubmit, isLoading }) => {
  const [file, setFile] = useState(null);
  const [contractText, setContractText] = useState('');
  const [contractName, setContractName] = useState('');
  const [partyPerspective, setPartyPerspective] = useState('reviewing party');

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      if (!contractName) {
        setContractName(selectedFile.name.replace(/\.[^.]+$/, ''));
      }
    }
  }, [contractName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10485760, // 10 MB
    multiple: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file && contractText.trim().length < 50) {
      alert('Please upload a file or paste at least 50 characters of contract text.');
      return;
    }

    const formData = {
      file: file,
      contract_text: contractText.trim(),
      contract_name: contractName.trim() || 'Unnamed Contract',
      party_perspective: partyPerspective,
    };

    try {
      await onSubmit(formData);
    } catch (error) {
      // Error handling is done in parent
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      <div 
        {...getRootProps()} 
        className={`drop-zone ${isDragActive ? 'drag-over' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="drop-icon">📄</div>
        <h3>Drop your contract here</h3>
        <p>PDF, DOCX, or TXT &nbsp;·&nbsp; up to 10 MB</p>
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
          value={contractText}
          onChange={(e) => setContractText(e.target.value)}
          placeholder="Paste the full contract text here…"
          disabled={isLoading}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Contract name</label>
          <input
            className="form-input"
            value={contractName}
            onChange={(e) => setContractName(e.target.value)}
            placeholder="e.g. SaaS Service Agreement v2"
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Your role</label>
          <select
            className="form-select"
            value={partyPerspective}
            onChange={(e) => setPartyPerspective(e.target.value)}
            disabled={isLoading}
          >
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

      <button type="submit" className="btn-primary" disabled={isLoading}>
        <div className={`spinner ${isLoading ? 'active' : ''}`}></div>
        <span>{isLoading ? 'Analyzing…' : '⚡ Analyze Contract'}</span>
      </button>
    </form>
  );
};

export default UploadForm;