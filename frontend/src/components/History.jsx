import React, { useState, useEffect } from 'react';
import { getHistory, getStats, deleteScan } from '../api/api';
import './styles.css';

const History = ({ onViewReport }) => {
  const [scans, setScans] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyData, statsData] = await Promise.all([
        getHistory(50),
        getStats()
      ]);
      setScans(historyData.scans || []);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this scan? This cannot be undone.')) return;
    try {
      await deleteScan(id);
      await loadData();
    } catch (err) {
      alert('Could not delete: ' + err.message);
    }
  };

  const getRiskColor = (level) => {
    const colors = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#ea580c', CRITICAL: '#dc2626' };
    return colors[level] || '#7a7f8a';
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return iso?.split('T')[0] || '—';
    }
  };

  if (loading) return <div className="loading-state">Loading history...</div>;

  return (
    <div className="history-container">
      <div className="page-inner">
        {stats && (
          <div className="stats-row">
            {[
              { label: 'Total Scans', value: stats.total_scans || 0 },
              { label: 'Avg Risk Score', value: stats.avg_risk_score || '—' },
              { label: 'Critical', value: stats.critical_count || 0, color: '#dc2626' },
              { label: 'High Risk', value: stats.high_count || 0, color: '#ea580c' },
              { label: 'Medium Risk', value: stats.medium_count || 0, color: '#d97706' },
              { label: 'Low Risk', value: stats.low_count || 0, color: '#16a34a' },
            ].map((item) => (
              <div key={item.label} className="stat-card">
                <div className="stat-num" style={{ color: item.color }}>{item.value}</div>
                <div className="stat-label">{item.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="history-controls">
          <h3>Past Scans</h3>
          <button className="btn-secondary" onClick={loadData}>↺ Refresh</button>
        </div>

        {error && <div className="error-box"><span>{error}</span></div>}

        <div className="history-table">
          <div className="ht-head">
            <span>Contract</span><span>Date</span><span>Risk Score</span><span>Clauses</span><span>Flags</span><span></span>
          </div>
          {scans.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <p>No scans yet. Analyze a contract to get started.</p>
            </div>
          ) : (
            scans.map((scan) => (
              <div key={scan.id} className="ht-row" onClick={() => onViewReport(scan.id)}>
                <div className="ht-name" title={scan.contract_name}>{scan.contract_name}</div>
                <div className="ht-date">{formatDate(scan.created_at)}</div>
                <div className="ht-score" style={{ color: getRiskColor(scan.overall_risk_level) }}>
                  {scan.overall_risk_score}/10
                  <span className="ht-level">{scan.overall_risk_level}</span>
                </div>
                <div>{scan.clause_count}</div>
                <div style={{ color: '#dc2626' }}>{scan.red_flag_count}</div>
                <div className="ht-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-danger" onClick={(e) => handleDelete(scan.id, e)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default History;