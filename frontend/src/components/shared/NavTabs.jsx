import React from 'react';
import './NavTabs.css';

const NavTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'analyze', label: '⚡ Analyze' },
    { id: 'history', label: '📋 History' },
  ];

  return (
    <nav className="nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
};

export default NavTabs;