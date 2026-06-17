import React, { useState, useEffect } from 'react';
import './App.css';
import TopBar from './components/Layout/TopBar';
import NavTabs from './components/Shared/NavTabs';
import AnalyzePage from './components/Analyze/AnalyzePage';
import HistoryPage from './components/History/HistoryPage';
import Modal from './components/Shared/Modal';
import { checkHealth } from './api/api';

function App() {
  const [activeTab, setActiveTab] = useState('analyze');
  const [isOnline, setIsOnline] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    checkHealthStatus();
    const interval = setInterval(checkHealthStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const checkHealthStatus = async () => {
    const status = await checkHealth();
    setIsOnline(status);
  };

  const openModal = (content) => {
    setModalContent(content);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

  return (
    <div className="app">
      <TopBar isOnline={isOnline} />
      <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="app-content">
        {activeTab === 'analyze' && <AnalyzePage openModal={openModal} />}
        {activeTab === 'history' && <HistoryPage openModal={openModal} />}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {modalContent}
      </Modal>
    </div>
  );
}

export default App;