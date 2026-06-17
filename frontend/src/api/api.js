import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://skimmer-ardently-sequel.ngrok-free.dev';
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_URL || 'https://mykhann.app.n8n.cloud/webhook-test/analyze-contract';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const checkHealth = async () => {
  try {
    const response = await api.get('/health', { timeout: 3000 });
    return response.status === 200;
  } catch {
    return false;
  }
};

export const analyzeContract = async (data) => {
  const response = await api.post('/analyze', data);
  return response.data;
};

export const analyzeUpload = async (formData) => {
  const response = await api.post('/analyze/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const analyzeViaN8N = async (data) => {
  const response = await axios.post(N8N_WEBHOOK_URL, data, {
    timeout: 60000,
  });
  return response.data;
};

export const getReport = async (scanId) => {
  const response = await api.get(`/report/${scanId}`);
  return response.data;
};

export const getHistory = async (limit = 50) => {
  const response = await api.get(`/history?limit=${limit}`);
  return response.data;
};

export const getStats = async () => {
  const response = await api.get('/history/stats');
  return response.data;
};

export const deleteScan = async (scanId) => {
  const response = await api.delete(`/report/${scanId}`);
  return response.data;
};

export default api;