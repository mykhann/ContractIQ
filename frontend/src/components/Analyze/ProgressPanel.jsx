import React from 'react';
import './ProgressPanel.css';

const ProgressPanel = ({ show, currentStep }) => {
  if (!show) return null;

  const steps = [
    { id: 1, label: 'Parsing document', sub: 'Extracting text and structure' },
    { id: 2, label: 'Extracting clauses', sub: 'Identifying legally significant language' },
    { id: 3, label: 'Scoring risk', sub: 'Evaluating each clause for exposure' },
    { id: 4, label: 'Building report', sub: 'Assembling recommendations and red flags' },
  ];

  return (
    <div className="progress-panel">
      <div className="progress-title">Analyzing your contract…</div>
      <div className="steps">
        {steps.map((step) => {
          let status = 'pending';
          if (step.id < currentStep) status = 'done';
          else if (step.id === currentStep) status = 'active';

          return (
            <div key={step.id} className={`step ${status}`}>
              <div className="step-dot">{step.id}</div>
              <div className="step-body">
                <div className="step-label">{step.label}</div>
                <div className="step-sub">{step.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressPanel;