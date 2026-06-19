import { useState, useCallback } from 'react';
import { analyzeText, analyzeFile, getReport } from '../api/api';

export const useAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [report, setReport] = useState(null);
  const [scanId, setScanId] = useState(null);
  const [gdocUrl, setGdocUrl] = useState(null);

  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

  const analyze = useCallback(async (formData, options = {}) => {
    setLoading(true);
    setError(null);
    setStep(1);

    try {
      const useN8N = options?.useN8N;

      let result;

      // ─────────────────────────────────────────
      // 🔁 N8N PIPELINE ROUTE
      // ─────────────────────────────────────────
      if (useN8N && N8N_WEBHOOK_URL) {
        setStep(2);
        setStep(3);

        let payload;

        // Convert file → base64 if file exists
        if (formData.file) {
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
            party_perspective: formData.party_perspective || 'reviewing party',
          };
        } else {
          payload = {
            contract_text: formData.text || '',
            contract_name: formData.contract_name || 'Unnamed Contract',
            party_perspective: formData.party_perspective || 'reviewing party',
          };
        }

        const response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            err?.detail || err?.error || `n8n error HTTP ${response.status}`
          );
        }

        const n8nResult = await response.json();

        // Google Docs link
        if (n8nResult.google_doc_url) {
          setGdocUrl(n8nResult.google_doc_url);
        }

        // If scan_id returned → fetch full report from backend
        if (n8nResult.scan_id) {
          const reportData = await getReport(n8nResult.scan_id);
          result = {
            success: true,
            scan_id: n8nResult.scan_id,
            report: reportData.report,
          };
        } else {
          result = n8nResult;
        }
      }

      // ─────────────────────────────────────────
      // ⚡ DIRECT API ROUTE (FASTAPI)
      // ─────────────────────────────────────────
      else {
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
      }

      setStep(4);
      await new Promise((r) => setTimeout(r, 400));

      if (!result?.report) {
        throw new Error(result?.error || 'No report returned');
      }

      setReport(result.report);
      setScanId(result.scan_id || null);

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

  return {
    loading,
    error,
    step,
    report,
    scanId,
    gdocUrl,
    analyze,
    reset,
  };
};