import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL 
const N8N_URL = import.meta.env.VITE_N8N_URL 

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Health check
export const checkHealth = async () => {
  try {
    const res = await api.get('/health', { timeout: 3000 });
    return res.status === 200;
  } catch {
    return false;
  }
};

// Analyze text
export const analyzeText = async (data) => {
  const res = await api.post('/analyze', data);
  return res.data;
};

// Analyze file upload
export const analyzeFile = async (formData) => {
  const res = await api.post('/analyze/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// Analyze via n8n
export const analyzeViaN8N = async (data) => {
  if (!N8N_URL) throw new Error('N8N webhook URL not configured');
  const res = await axios.post(N8N_URL, data, { timeout: 60000 });
  return res.data;
};

// Get report
export const getReport = async (scanId) => {
  const res = await api.get(`/report/${scanId}`);
  return res.data;
};

// Get history
export const getHistory = async (limit = 50) => {
  const res = await api.get(`/history?limit=${limit}`);
  return res.data;
};

// Get stats
export const getStats = async () => {
  const res = await api.get('/history/stats');
  return res.data;
};

// Delete scan
export const deleteScan = async (scanId) => {
  const res = await api.delete(`/report/${scanId}`);
  return res.data;
};

export default api;