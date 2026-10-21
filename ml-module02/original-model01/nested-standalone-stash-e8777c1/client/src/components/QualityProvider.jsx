import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { demoSamples } from '../data/demoQuality';
import { qualityService } from '../services/qualityService';

const QualityContext = createContext(null);

export function QualityProvider({ children, service = qualityService }) {
  // Explicit opt-in for this mounted session. Never enable demo mode implicitly.
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [localSamples, setLocalSamples] = useState(demoSamples);
  const [remote, setRemote] = useState({ status: 'loading', samples: [], error: '' });
  const [selectedId, setSelectedId] = useState(demoSamples[0].id);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const request = ++requestId.current;
    if (!demoEnabled) {
      setRemote({ status: 'loading', samples: [], error: '' });
      service.getSamples({ signal: controller.signal }).then(samples => {
        if (!controller.signal.aborted && request === requestId.current) {
          setRemote({ status: samples.length ? 'ready' : 'empty', samples, error: '' });
        }
      }).catch(error => {
        if (!controller.signal.aborted && request === requestId.current) {
          setRemote({ status: error.code === 'DISCONNECTED' ? 'disconnected' : 'error', samples: [], error: error.message });
        }
      });
    }
    return () => controller.abort();
  }, [demoEnabled, revision, service]);

  const samples = demoEnabled ? localSamples : remote.samples;
  const selected = samples.find(sample => sample.id === selectedId) || samples[0] || null;

  function registerSample(input) {
    if (!demoEnabled) throw new Error('Enable demo mode to create a local demonstration sample.');
    if (localSamples.some(sample => sample.id.toLowerCase() === input.id.toLowerCase())) {
      throw new Error('A sample with this ID already exists.');
    }
    const sample = { ...input, records: [], images: [] };
    setLocalSamples(previous => [...previous, sample]);
    setSelectedId(sample.id);
    return sample;
  }

  return <QualityContext.Provider value={{
    demoEnabled, setDemoEnabled, samples, selected, setSelectedId,
    status: demoEnabled ? 'demo' : remote.status,
    error: remote.error, registerSample, refresh: () => setRevision(value => value + 1),
  }}>{children}</QualityContext.Provider>;
}

export function useQuality() {
  const context = useContext(QualityContext);
  if (!context) throw new Error('Quality components require QualityProvider.');
  return context;
}
