import React, { useState } from 'react';
import './styles.css';

const Report = ({ report, onReset, gdocUrl }) => {
  const [filter, setFilter] = useState('ALL');

  const getColor = (level) => {
    const colors = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#ea580c', CRITICAL: '#dc2626' };
    return colors[level] || '#7a7f8a';
  };

  const getLevelText = (level) => ({ LOW: 'Low Risk', MEDIUM: 'Moderate Risk', HIGH: 'High Risk', CRITICAL: 'Critical Risk' }[level] || level);

  const renderBreakdown = () => {
    const items = [
      { name: 'Payment', value: report.risk_breakdown.payment_risk },
      { name: 'Liability', value: report.risk_breakdown.liability_risk },
      { name: 'Deadline', value: report.risk_breakdown.deadline_risk },
      { name: 'Termination', value: report.risk_breakdown.termination_risk },
      { name: 'Confidentiality', value: report.risk_breakdown.confidentiality_risk },
      { name: 'IP', value: report.risk_breakdown.ip_risk },
    ];

    return items.map((item) => {
      const level = item.value <= 3 ? 'LOW' : item.value <= 5.5 ? 'MEDIUM' : item.value <= 7.5 ? 'HIGH' : 'CRITICAL';
      return (
        <div key={item.name} className="risk-row">
          <span className="risk-name">{item.name}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${item.value * 10}%`, background: getColor(level) }} />
          </div>
          <span className="risk-val" style={{ color: getColor(level) }}>{item.value}</span>
        </div>
      );
    });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${report.contract_name.replace(/\s+/g, '_')}_report.json`;
    a.click();
  };

  const filteredClauses = filter === 'ALL' ? report.clauses : report.clauses.filter(c => c.clause_type === filter);
  const types = ['ALL', ...new Set(report.clauses.map(c => c.clause_type))];

  return (
    <div className="report-container">
      <div className="page-inner">
        {gdocUrl && (
          <div className="gdoc-banner">
            📄 Full report saved to Google Docs — <a href={gdocUrl} target="_blank" rel="noopener noreferrer">open document</a>
          </div>
        )}

        <div className="report-topbar">
          <div>
            <h2>{report.contract_name}</h2>
            <div className="report-meta">
              {report.contract_word_count} words · {report.clauses.length} clauses · Confidence: {report.analysis_confidence}
            </div>
          </div>
          <div className="report-actions">
            <button className="btn-secondary" onClick={exportJSON}>⬇ Export JSON</button>
            <button className="btn-secondary" onClick={onReset}>← New Scan</button>
          </div>
        </div>

        <div className="score-card">
          <div className="ring-wrap">
            <svg viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="#e2e4ea" strokeWidth="9"/>
              <circle
                cx="55" cy="55" r="46" fill="none"
                stroke={getColor(report.overall_risk_level)}
                strokeWidth="9" strokeLinecap="round"
                strokeDasharray="289.03"
                strokeDashoffset={289.03 * (1 - report.overall_risk_score / 10)}
                transform="rotate(-90 55 55)"
                style={{ transition: 'stroke-dashoffset 1.2s ease' }}
              />
              <text x="55" y="51" textAnchor="middle" className="ring-score">{report.overall_risk_score.toFixed(1)}</text>
              <text x="55" y="64" textAnchor="middle" className="ring-label">/ 10</text>
            </svg>
          </div>
          <div>
            <div className="score-level" style={{ color: getColor(report.overall_risk_level) }}>
              {getLevelText(report.overall_risk_level)}
            </div>
            <p className="score-summary">{report.contract_summary}</p>
            <div className="pills">
              {Object.entries(report.risk_breakdown).map(([key, value]) => {
                const level = value <= 3 ? 'LOW' : value <= 5.5 ? 'MEDIUM' : value <= 7.5 ? 'HIGH' : 'CRITICAL';
                return (
                  <span key={key} className={`pill pill-${level}`}>
                    {key.replace('_risk', '').charAt(0).toUpperCase() + key.replace('_risk', '').slice(1)} {value}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="info-card">
            <div className="card-label">Risk Breakdown</div>
            {renderBreakdown()}
          </div>
          <div className="info-card">
            <div className="card-label">Red Flags</div>
            {report.red_flags.length > 0 ? (
              report.red_flags.map((flag, i) => (
                <div key={i} className="flag">
                  <div className="flag-title">{flag.title}</div>
                  <div className="flag-desc">{flag.description}</div>
                  {flag.clause_reference && <div className="flag-ref">{flag.clause_reference}</div>}
                </div>
              ))
            ) : (
              <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>No critical red flags detected.</span>
            )}
          </div>
        </div>

        <div className="grid-2">
          <div className="info-card">
            <div className="card-label">Top Recommendations</div>
            {report.top_recommendations.map((rec, i) => (
              <div key={i} className="rec">
                <div className="rec-num">{i + 1}</div>
                <div className="rec-text">{rec}</div>
              </div>
            ))}
          </div>
          <div className="info-card">
            <div className="card-label">Missing Clauses</div>
            {report.missing_clauses.length > 0 ? (
              report.missing_clauses.map((m, i) => (
                <span key={i} className="miss-tag">⚠ {m}</span>
              ))
            ) : (
              <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>No critical missing clauses detected.</span>
            )}
          </div>
        </div>

        <div className="clause-wrap">
          <div className="clause-head">
            <h3>Clause Analysis</h3>
            <span className="clause-badge">{report.clauses.length} total</span>
          </div>
          <div className="clause-filters">
            {types.map(t => (
              <button key={t} className={`filt ${t === filter ? 'on' : ''}`} onClick={() => setFilter(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="clause-list">
            {filteredClauses.map((clause, i) => (
              <div key={i} className="cl-item" onClick={() => {
                const detail = document.getElementById(`cd-${i}`);
                if (detail) detail.classList.toggle('open');
              }}>
                <div className="cl-top">
                  <span className={`rbadge rbadge-${clause.risk_level}`}>{clause.risk_level}</span>
                  <span className="cl-type">{clause.clause_type}</span>
                  {clause.location_hint && <span className="cl-loc">{clause.location_hint}</span>}
                  <span className="cl-score" style={{ color: getColor(clause.risk_level) }}>{clause.risk_score}/10</span>
                </div>
                <div className="cl-preview">"{clause.clause_text.substring(0, 220)}{clause.clause_text.length > 220 ? '…' : ''}"</div>
                <div className="cl-detail" id={`cd-${i}`}>
                  <div className="detail-grid">
                    <div className="dbox"><div className="dbox-label">Risk Reason</div><div className="dbox-text">{clause.risk_reason}</div></div>
                    <div className="dbox"><div className="dbox-label">Recommendation</div><div className="dbox-text">{clause.recommendation}</div></div>
                    <div className="dbox" style={{ gridColumn: 'span 2' }}><div className="dbox-label">Negotiation Leverage</div><div className="dbox-text">{clause.negotiation_leverage}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;