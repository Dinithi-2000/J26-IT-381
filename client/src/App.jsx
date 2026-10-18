import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import QualityLayout from './components/QualityLayout';
import Home from './pages/Home';
import QualityDashboard from './pages/QualityDashboard';
import SampleManagement from './pages/SampleManagement';
import SampleDetails from './pages/SampleDetails';
import ImageAnalysis from './pages/ImageAnalysis';
import QualityPredictions from './pages/QualityPredictions';
import Placeholder from './pages/Placeholder';
import ForecastingModule from './pages/ForecastingModule';
import DehydrationLayout from './components/DehydrationLayout';
import DehydrationDashboard from './pages/DehydrationDashboard';
import DryingSessions, { DryingSessionDetails } from './pages/DryingSessions';
import DehydrationPrediction from './pages/DehydrationPrediction';
import DryingAnalytics from './pages/DryingAnalytics';
import ChamberControls from './pages/ChamberControls';

export default function App() {
  return <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="module-01" element={<DehydrationLayout />}>
          <Route index element={<DehydrationDashboard />} />
          <Route path="sessions" element={<DryingSessions />} />
          <Route path="sessions/:batchId" element={<DryingSessionDetails />} />
          <Route path="rdt" element={<DehydrationPrediction />} />
          <Route path="analytics" element={<DryingAnalytics />} />
          <Route path="controls" element={<ChamberControls />} />
        </Route>
        <Route path="module-02" element={<QualityLayout />}>
          <Route index element={<QualityDashboard />} />
          <Route path="samples" element={<SampleManagement />} />
          <Route path="samples/:id" element={<SampleDetails />} />
          <Route path="images" element={<ImageAnalysis />} />
          <Route path="predictions" element={<QualityPredictions />} />
        </Route>
        <Route path="module-03" element={<Placeholder id="03" />} />
        <Route path="module-04" element={<ForecastingModule />} />
        <Route path="*" element={<main className="page-shell not-found">
          <p className="eyebrow">404</p><h1>That page is still off the trail.</h1>
          <Link className="button" to="/">Back to home →</Link>
        </main>} />
      </Route>
    </Routes>
  </BrowserRouter>;
}
