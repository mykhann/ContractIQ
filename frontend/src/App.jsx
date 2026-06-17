import React, { useState, useEffect } from 'react';
import Analyze from './components/Analyze';
import History from './components/History';
import LandingPage from './components/LandingPage';
import { getReport } from './api/api';
import './App.css';

const App = () => {
  const [isInApp, setIsInApp] = useState(false);
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

  const handleEnterApp = () => setIsInApp(true);
  const handleBackToHome = () => setIsInApp(false);

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

  if (!isInApp) {
    return <LandingPage onEnterApp={handleEnterApp} />;
  }

  return (
    <div className="app-headless">
      <main className="main-content-full">
        {tab === 'analyze' ? (
          <Analyze onBackToHome={handleBackToHome} />
        ) : (
          <History onViewReport={handleViewReport} onBackToHome={handleBackToHome} />
        )}
      </main>
    </div>
  );
};

export default App;