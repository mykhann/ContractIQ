import React, { useState } from 'react';
import './AnalyzePage.css';
import UploadForm from './UploadForm';
import ProgressPanel from './ProgressPanel';
import ReportSection from './ReportSection';
import ErrorBox from '../Shared/ErrorBox';
import GdocBanner from '../Shared/GdocBanner';
import { analyzeContract, analyzeUpload, analyzeViaN8N, getReport } from '../../api/api';

const AnalyzePage = ({ openModal }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gdocUrl, setGdocUrl] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [report, setReport] = useState(null);

  const runAnalysis = async (formData) => {
    setError(null);
    setGdocUrl(null);
    setShowProgress(true);
    setCurrentStep(1);
    setIsLoading(true);

    try {
      let result;

      // Check if n8n is configured (you can add logic to check)
      const useN8N = false; // You can make this configurable

      if (useN8N) {
        // Route through n8n
        setCurrentStep(2);
        setCurrentStep(3);
        
        const n8nResult = await analyzeViaN8N(formData);
        
        if (n8nResult.google_doc_url) {
          setGdocUrl(n8nResult.google_doc_url);
        }

        if (n8nResult.scan_id) {
          const reportData = await getReport(n8nResult.scan_id);
          result = { success: true, scan_id: n8nResult.scan_id, report: reportData.report };
        } else {
          result = n8nResult;
        }
      } else {
        // Route directly to FastAPI
        setCurrentStep(2);
        setCurrentStep(3);

        if (formData.file) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', formData.file);
          uploadFormData.append('contract_name', formData.contract_name || 'Unnamed Contract');
          uploadFormData.append('party_perspective', formData.party_perspective || 'reviewing party');
          
          result = await analyzeUpload(uploadFormData);
        } else {
          result = await analyzeContract({
            contract_text: formData.contract_text,
            contract_name: formData.contract_name || 'Unnamed Contract',
            party_perspective: formData.party_perspective || 'reviewing party',
          });
        }
      }

      setCurrentStep(4);
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!result.success || !result.report) {
        throw new Error(result.error || 'No report returned');
      }

      setReport(result.report);
      setShowProgress(false);
      
      return result;

    } catch (err) {
      setError(err.message || 'Unknown error — is the backend running?');
      setShowProgress(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = (reportData) => {
    setReport(reportData);
  };

  const handleReset = () => {
    setReport(null);
    setError(null);
    setGdocUrl(null);
    setCurrentStep(0);
  };

  return (
    <div className="analyze-page">
      <div className="page-inner">
        <div className="upload-hero">
          <h1>Know what you're<br/><span>signing</span> before you sign</h1>
          <p>Upload any contract — get clause-level risk scores, red flags, and negotiation tactics in under a minute.</p>
        </div>

        <ErrorBox error={error} onClose={() => setError(null)} />
        <GdocBanner url={gdocUrl} />

        {!report && (
          <UploadForm 
            onSubmit={runAnalysis} 
            isLoading={isLoading}
          />
        )}

        <ProgressPanel 
          show={showProgress} 
          currentStep={currentStep} 
        />

        {report && (
          <ReportSection 
            report={report} 
            onReset={handleReset}
            openModal={openModal}
          />
        )}
      </div>
    </div>
  );
};

export default AnalyzePage;