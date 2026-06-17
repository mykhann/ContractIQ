import React, { useEffect, useRef } from 'react';

const ScoreRing = ({ score, level }) => {
  const ringRef = useRef(null);
  const circumference = 2 * Math.PI * 46;

  const getColor = (riskLevel) => {
    const colors = {
      LOW: '#16a34a',
      MEDIUM: '#d97706',
      HIGH: '#ea580c',
      CRITICAL: '#dc2626'
    };
    return colors[riskLevel] || '#7a7f8a';
  };

  useEffect(() => {
    if (ringRef.current) {
      const offset = circumference * (1 - score / 10);
      ringRef.current.style.strokeDashoffset = offset;
      ringRef.current.style.stroke = getColor(level);
    }
  }, [score, level, circumference]);

  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 110 110">
        <circle
          cx="55"
          cy="55"
          r="46"
          fill="none"
          stroke="#e2e4ea"
          strokeWidth="9"
        />
        <circle
          ref={ringRef}
          cx="55"
          cy="55"
          r="46"
          fill="none"
          stroke="#2563eb"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }}
        />
        <text x="55" y="51" textAnchor="middle" className="ring-score">
          {score ? score.toFixed(1) : '—'}
        </text>
        <text x="55" y="64" textAnchor="middle" className="ring-label">
          / 10
        </text>
      </svg>
    </div>
  );
};

export default ScoreRing;