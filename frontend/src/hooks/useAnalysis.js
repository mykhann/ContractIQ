import { useState, useCallback } from 'react';
import { analyzeText, analyzeFile, analyzeViaN8N, getReport } from '../api/api';

export const useAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [report, setReport] = useState(null);
  const [scanId, setScanId] = useState(null);
  const [gdocUrl, setGdocUrl] = useState(null);

  const analyze = useCallback(async (formData, options = {}) => {
    setLoading(true);
    setError(null);
    setStep(1);

    try {
      const { useN8N = false, n8nUrl = '' } = options;
      let result;

      if (useN8N && n8nUrl) {
      
        setStep(2);
        setStep(3);
        
        // Prepare payload matching HTML version
        let payload;
        if (formData.file) {
          // Convert file to base64
          const fileBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
          
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(formData.file);
          });
          
          payload = {
            file_base64: fileBase64,
            filename: formData.file.name,
            contract_name: formData.contract_name || 'Unnamed Contract',
            party_perspective: formData.party_perspective || 'reviewing party'
          };
        } else {
          payload = {
            contract_text: formData.text || '',
            contract_name: formData.contract_name || 'Unnamed Contract',
            party_perspective: formData.party_perspective || 'reviewing party'
          };
        }

        // Call n8n webhook directly (matching HTML fetch)
        const response = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.detail || errorData?.error || `n8n returned HTTP ${response.status}`);
        }

        const n8nResult = await response.json();

        // Show Google Doc link if present (matches HTML)
        if (n8nResult.google_doc_url) {
          setGdocUrl(n8nResult.google_doc_url);
        }

        // Get full report from FastAPI if scan_id is returned
        if (n8nResult.scan_id) {
          const reportData = await getReport(n8nResult.scan_id);
          result = { success: true, scan_id: n8nResult.scan_id, report: reportData.report };
        } else {
         
          result = n8nResult;
        }

      } else {
      
        setStep(2);
        setStep(3);

        if (formData.file) {
          const fd = new FormData();
          fd.append('file', formData.file);
          fd.append('contract_name', formData.contract_name || 'Unnamed Contract');
          fd.append('party_perspective', formData.party_perspective || 'reviewing party');
          result = await analyzeFile(fd);
        } else {
          result = await analyzeText({
            contract_text: formData.text || '',
            contract_name: formData.contract_name || 'Unnamed Contract',
            party_perspective: formData.party_perspective || 'reviewing party',
          });
        }
        setStep(3);
      }

      setStep(4);
      await new Promise(r => setTimeout(r, 500));

      if (!result.success || !result.report) {
        throw new Error(result.error || 'No report returned');
      }

      setReport(result.report);
      setScanId(result.scan_id);
      return result;

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Analysis failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setReport(null);
    setError(null);
    setStep(0);
    setScanId(null);
    setGdocUrl(null);
  }, []);

  return { loading, error, step, report, scanId, gdocUrl, analyze, reset };
};