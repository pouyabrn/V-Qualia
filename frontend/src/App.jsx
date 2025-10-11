import { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HomePage from './components/pages/HomePage';
import AnalyzePage from './components/pages/AnalyzePage';
import PredictPage from './components/pages/PredictPage';
import CarsPage from './components/pages/CarsPage';
import TracksPage from './components/pages/TracksPage';
import ComparePage from './components/pages/ComparePage';
import LivePage from './components/pages/LivePage';
import LiveStandalone from './components/pages/LiveStandalone';
import LapReplay from './components/pages/LapReplay';
import LapReplayViewer from './components/pages/LapReplayViewer';
import ErrorBoundary from './components/common/ErrorBoundary';
import { parseCSV } from './utils/csvParser';

function App() {
  // ALL HOOKS MUST BE AT THE TOP - React Rules of Hooks!
  const [activeTab, setActiveTab] = useState('home');
  const [isStandalone, setIsStandalone] = useState(false);
  const [telemetryData, setTelemetryData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [rawCsvText, setRawCsvText] = useState('');
  
  // Check for standalone mode and lap replay
  useEffect(() => {
    const checkStandalone = () => {
      const hash = window.location.hash;
      setIsStandalone(
        hash === '#/live-standalone' || 
        hash === '#/lap-replay' || 
        hash.startsWith('#/lap-replay-viewer')
      );
    };
    
    checkStandalone();
    window.addEventListener('hashchange', checkStandalone);
    
    return () => window.removeEventListener('hashchange', checkStandalone);
  }, []);

  // EARLY RETURN AFTER ALL HOOKS - Now it's safe!
  if (isStandalone) {
    const hash = window.location.hash;
    console.log('Rendering standalone mode:', hash);
    
    if (hash === '#/lap-replay') {
      return <LapReplay />;
    }
    
    if (hash.startsWith('#/lap-replay-viewer')) {
      // LapReplayViewer will load CSV from URL parameters or localStorage
      return <LapReplayViewer />;
    }
    
    return <LiveStandalone />;
  }

  // Handle telemetry file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setRawCsvText(text); // Store raw CSV
        const data = parseCSV(text);
        setTelemetryData(data);
        setActiveTab('analyze');
      };
      reader.readAsText(file);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-gray-200">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="container mx-auto px-6 py-8">
          {activeTab === 'home' && <HomePage setActiveTab={setActiveTab} />}

          {activeTab === 'analyze' && (
            <AnalyzePage
              telemetryData={telemetryData}
              fileName={fileName}
              onFileUpload={handleFileUpload}
              rawCsvText={rawCsvText}
            />
          )}

          {activeTab === 'compare' && <ComparePage />}

          {activeTab === 'predict' && <PredictPage />}

          {activeTab === 'live' && <LivePage />}

          {activeTab === 'cars' && <CarsPage />}

          {activeTab === 'tracks' && <TracksPage />}
        </main>

        <Footer />
      </div>
    </ErrorBoundary>
  );
}

export default App;

