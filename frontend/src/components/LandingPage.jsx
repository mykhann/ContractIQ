import React, { useState } from 'react';
import './LandingPage.css';

const LandingPage = ({ onEnterApp }) => {
  return (
    <div className="landing-container">
      {/* Background Gradients */}
      <div className="glow-sphere sphere-1"></div>
      <div className="glow-sphere sphere-2"></div>

      {/* Navbar */}
      <header className="landing-navbar">
        <div className="landing-logo">
          <div className="logo-pulse"></div>
          <span>ContractGuard</span>
          <span className="tech-badge">AI v1.0</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#architecture">Architecture</a>
          <a href="#endpoints">API Specs</a>
          <button className="btn-secondary" onClick={onEnterApp}>
            Launch App ⚡
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="status-pill">
            <span className="pulse-dot"></span> Powered by Groq & LLaMA 4 Scout / 3.3 70B
          </div>
          <h1>
            Automated Contract Risk <br />
            <span className="text-gradient">Analysis Engine</span>
          </h1>
          <p className="hero-subtitle">
            An enterprise-grade, asynchronous legal pipeline that extracts clauses, evaluates risk profile liabilities from specified party perspectives, and triggers automated downstream workflows.
          </p>
          <div className="hero-cta-group">
            <button className="btn-primary" onClick={onEnterApp}>
              Try Live Scanner
            </button>
            <a href="#architecture" className="btn-outline">
              View n8n Pipeline
            </a>
          </div>
        </div>

        {/* Hero Image Container displaying your n8n Workflow */}
        <div className="hero-image-wrapper">
          <div className="glass-card image-card">
            <div className="card-header-mac">
              <span className="dot close"></span>
              <span className="dot minimize"></span>
              <span className="dot expand"></span>
              <span className="window-title">n8n Asynchronous Core Workflow</span>
            </div>
            <div className="workflow-image-container">
              <img 
                src="https://res.cloudinary.com/dsdbty95v/image/upload/v1781721482/Screenshot_2026-06-17_233708_wztqkh.png" 
                alt="n8n Automated Workflow Pipeline" 
                className="workflow-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Metric Highlights */}
      <section className="metrics-bar">
        <div className="metric-item">
          <h3>&lt; 3.0s</h3>
          <p>Analysis Speed via Groq</p>
        </div>
        <div className="metric-item">
          <h3>70B</h3>
          <p>LLaMA Deep Reasoning Parameters</p>
        </div>
        <div className="metric-item">
          <h3>100%</h3>
          <p>Asynchronous & Event-Driven</p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section features-section">
        <h2 className="section-title">Engine Features</h2>
        <div className="grid-3">
          <div className="glass-card feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Multi-Format Text Extraction</h3>
            <p>Parses complex document structures seamlessly from unstructured text, binary PDFs (via PyMuPDF), and Microsoft Word files natively.</p>
          </div>
          <div className="glass-card feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Perspective-Based Scoring</h3>
            <p>Dynamic assessment modeling logic metrics adjust liability flags based on whether you are the reviewing party or opposing entity.</p>
          </div>
          <div className="glass-card feature-card">
            <div className="feature-icon">🚀</div>
            <h3>Webhook Notification Engine</h3>
            <p>Fire-and-forget execution queues cleanly pass parsed legal payloads downstream to custom external automation webhooks asynchronously.</p>
          </div>
        </div>
      </section>

      {/* Deep-Dive Technical Architecture Breakdown */}
      <section id="architecture" className="section architecture-section">
        <h2 className="section-title">Pipeline Architecture</h2>
        <p className="section-subtitle">How raw files map smoothly into deterministic database summaries and event triggers.</p>
        
        <div className="architecture-flow">
          <div className="flow-step">
            <div className="step-num">01</div>
            <h4>Ingestion & Processing</h4>
            <p>FastAPI routes process payloads via multi-part file uploads or Base64 encoded payload schemas inside JSON payloads.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">02</div>
            <h4>LLM Clause Extraction</h4>
            <p>Context parsed maps into text clauses, handled by Groq-accelerated models enforcing strict retry backoffs against rate-limits.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">03</div>
            <h4>Persistence & Sync</h4>
            <p>Stores analysis objects instantly inside an optimized SQLite instance using WAL (Write-Ahead Logging) for safe concurrent reads.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">04</div>
            <h4>Automated n8n Trigger</h4>
            <p>App dispatches an background non-blocking execution task firing complete statistical structured reports downstream immediately.</p>
          </div>
        </div>
      </section>

      {/* Recruiter API Documentation View */}
      <section id="endpoints" className="section endpoints-section">
        <h2 className="section-title">Backend REST Documentation</h2>
        <div className="glass-card api-card">
          <div className="api-header">
            <span className="badge post">POST</span>
            <code>/analyze/upload</code>
            <span className="api-desc">Primary Frontend Client Parsing Ingestion Endpoint</span>
          </div>
          <pre className="code-block">
{`// Multipart Form Payload Schema
{
  "file": UploadFile (PDF / DOCX / TXT),
  "contract_name": "NDA_Vendor_2026.pdf",
  "party_perspective": "reviewing party"
}`}
          </pre>
        </div>

        <div className="glass-card api-card">
          <div className="api-header">
            <span className="badge post">POST</span>
            <code>/decode-file</code>
            <span className="api-desc">n8n Native Helper: Base64 Decryption to Plaintext</span>
          </div>
        </div>

        <div className="glass-card api-card">
          <div className="api-header">
            <span className="badge get">GET</span>
            <code>/history/stats</code>
            <span className="api-desc">Aggregates system database records for dashboard graphs</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>ContractGuard Portfolio Project — Built by Muhammad Yousaf</p>
        <div className="footer-tags">
          <span>FastAPI</span>
          <span>React.js</span>
          <span>n8n Core</span>
          <span>Groq Inference</span>
          <span>SQLite WAL</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;