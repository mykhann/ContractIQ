import React from 'react';
import './TopBar.css';

const TopBar = ({ isOnline }) => {
  const [apiUrl, setApiUrl] = useState('https://skimmer-ardently-sequel.ngrok-free.dev');
  const [n8nUrl, setN8nUrl] = useState('https://mykhann.app.n8n.cloud/webhook-test/analyze-contract');

  return (
    <header className="topbar">
      <div className="logo">
        <div className="logo-dot"></div>
        ContractGuard
      </div>
      <div className="topbar-right">
        <div className="url-group">
          <span className="url-label">API</span>
          <input
            className="api-input"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="FastAPI URL"
          />
          <div className={`status-dot ${isOnline ? 'online' : ''}`} title="Backend status"></div>
        </div>
        <div className="url-group">
          <span className="url-label">n8n</span>
          <input
            className="api-input"
            value={n8nUrl}
            onChange={(e) => setN8nUrl(e.target.value)}
            placeholder="https://your.n8n.cloud/webhook/analyze-contract"
          />
        </div>
      </div>
    </header>
  );
};

export default TopBar;