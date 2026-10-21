import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { demoGradingRecords } from '../data/demoGrading';
import { gradingService } from '../services/gradingService';

const GradingContext = createContext(null);

export function computeGradingStats(records = []) {
  const total = records.length;

  // Grade distribution counts
  const counts = {};
  for (const record of records) {
    if (record.grade) {
      counts[record.grade] = (counts[record.grade] || 0) + 1;
    }
  }

  // Top grade
  let topGrade = null;
  let maxCount = 0;
  for (const [grade, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      topGrade = grade;
    }
  }

  // Average AI confidence
  const withConfidence = records.filter(
    r => typeof r.confidence === 'number' && !Number.isNaN(r.confidence)
  );
  const avgConfidence = withConfidence.length
    ? Number((withConfidence.reduce((sum, r) => sum + r.confidence, 0) / withConfidence.length).toFixed(1))
    : null;

  // Recently graded samples (last 7 days or newest 5)
  const sortedByDate = [...records].sort(
    (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );
  const latestRecord = sortedByDate[0] || null;

  // Count in last 7 days relative to latest or current
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentCount = records.filter(r => {
    const time = new Date(r.timestamp).getTime();
    return !Number.isNaN(time) && time >= sevenDaysAgo;
  }).length;

  return {
    total,
    counts,
    topGrade,
    topGradeCount: maxCount,
    topGradePercentage: total > 0 ? Math.round((maxCount / total) * 100) : 0,
    avgConfidence,
    confidenceSampleCount: withConfidence.length,
    latestRecord,
    recentCount: recentCount || (total > 0 ? Math.min(total, 5) : 0),
  };
}

export function GradingProvider({ children, service = gradingService }) {
  // Explicit opt-in for this session. Never enable demo mode implicitly.
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [remote, setRemote] = useState({ status: 'loading', records: [], error: '' });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const currentRequestId = ++requestId.current;

    if (!demoEnabled) {
      setRemote({ status: 'loading', records: [], error: '' });
      service.getGradingRecords({ signal: controller.signal })
        .then(records => {
          if (!controller.signal.aborted && currentRequestId === requestId.current) {
            setRemote({
              status: records.length ? 'ready' : 'empty',
              records,
              error: '',
            });
          }
        })
        .catch(error => {
          if (!controller.signal.aborted && currentRequestId === requestId.current) {
            setRemote({
              status: error.code === 'DISCONNECTED' ? 'disconnected' : 'error',
              records: [],
              error: error.message || 'Unable to connect to mobile grading backend service.',
            });
          }
        });
    }

    return () => controller.abort();
  }, [demoEnabled, revision, service]);

  const records = demoEnabled ? demoGradingRecords : remote.records;
  const status = demoEnabled ? 'demo' : remote.status;
  const error = remote.error;

  // Derive all statistics dynamically from the currently loaded records
  const stats = useMemo(() => computeGradingStats(records), [records]);

  return (
    <GradingContext.Provider
      value={{
        demoEnabled,
        setDemoEnabled,
        records,
        status,
        error,
        selectedRecord,
        setSelectedRecord,
        stats,
        refresh: () => setRevision(v => v + 1),
      }}
    >
      {children}
    </GradingContext.Provider>
  );
}

export function useGrading() {
  const context = useContext(GradingContext);
  if (!context) {
    throw new Error('Grading components require GradingProvider.');
  }
  return context;
}
