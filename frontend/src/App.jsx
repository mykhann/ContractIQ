import React, { useState, useEffect } from 'react';
import Analyze from './components/Analyze';
import History from './components/History';
import LandingPage from './components/LandingPage';
import { getReport } from './api/api';
import './App.css';

const App = () => {
  const [isInApp, setIsInApp] = useState(false); // Track if user is in the app
  const [tab, setTab] = useState('analyze');
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/health`);
      setIsOnline(res.status === 200);
    } catch {
      setIsOnline(false);
    }
  };

  const handleEnterApp = () => {
    setIsInApp(true);
  };

  const handleViewReport = async (scanId) => {
    try {
      const data = await getReport(scanId);
      if (data.report) {
        alert(`Report for ${data.report.contract_name} - Score: ${data.report.overall_risk_score}/10`);
      }
    } catch (err) {
      alert('Could not load report: ' + err.message);
    }
  };

  // Show Landing Page if not in app
  if (!isInApp) {
    return <LandingPage onEnterApp={handleEnterApp} />;
  }

  // Show Main App
  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <div className="logo-dot"></div>
          ContractGuard
        </div>
        <div className="status">
          <span className={`status-dot ${isOnline ? 'online' : ''}`}></span>
          <span className="status-label">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </header>

      <nav className="nav-tabs">
        <button 
          className={`nav-tab ${tab === 'analyze' ? 'active' : ''}`} 
          onClick={() => setTab('analyze')}
        >
          ⚡ Analyze
        </button>
        <button 
          className={`nav-tab ${tab === 'history' ? 'active' : ''}`} 
          onClick={() => setTab('history')}
        >
          📋 History
        </button>
      </nav>

      <main className="main-content">
        {tab === 'analyze' ? (
          <Analyze />
        ) : (
          <History onViewReport={handleViewReport} />
        )}
      </main>
    </div>
  );
};

export default App;