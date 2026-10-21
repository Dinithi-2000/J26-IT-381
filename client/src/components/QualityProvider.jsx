import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { qualityService } from '../services/qualityService';

const QualityContext = createContext(null);

export function QualityProvider({ children, service = qualityService }) {
  // Operational dashboard: use stored backend records only.
  const demoEnabled = false;
  const [remote, setRemote] = useState({ status: 'loading', samples: [], error: '' });
  const [selectedId, setSelectedId] = useState('');
  const [revision, setRevision] = useState(0);
  const [detailState, setDetailState] = useState({status:'idle',error:''});
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer=setInterval(()=>setClock(Date.now()),30000); return ()=>clearInterval(timer); }, []);
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

  const samples = remote.samples;
  const selected = samples.find(sample => sample.id === selectedId) || samples[0] || null;

  const activeId = selected?.id;
  useEffect(() => {
    if (demoEnabled || !activeId || remote.status !== 'ready') return;
    const controller = new AbortController();
    setClock(Date.now());
    setDetailState({status:'loading',error:''});
    service.getSampleData(remote.samples.find(item=>item.id===activeId),{signal:controller.signal}).then(result=>{
      if(controller.signal.aborted) return;
      setRemote(previous=>({...previous,samples:previous.samples.map(item=>item.id===activeId?result:item)}));
      setDetailState({status:'ready',error:''});
    }).catch(error=>{if(!controller.signal.aborted) setDetailState({status:'error',error:error.message});});
    return ()=>controller.abort();
  }, [activeId,demoEnabled,remote.status,revision,service]);
  const readingTime = selected?.records.at(-1)?.timestamp;
  const threshold = selected?.deviceStatus?.offlineAfterSeconds || 300;
  const deviceStatus = demoEnabled ? 'Demo - no live device' : selected?.dataOrigin === 'DEMO_DATA' ? 'Stored illustrative records - hardware not connected' : readingTime && clock-Date.parse(readingTime)<=threshold*1000 ? 'Recent telemetry - not a live stream' : 'Offline - no recent telemetry';

  async function registerSample(input, token) {
    const sample = await service.createSample(input,token);
    setRemote(previous=>({...previous,status:'ready',samples:[...previous.samples,sample]}));
    setSelectedId(sample.id);
    return sample;
  }

  return <QualityContext.Provider value={{
    demoEnabled, samples, selected, setSelectedId,
    status: demoEnabled ? 'demo' : remote.status === 'ready' && detailState.status === 'error' ? 'error' : remote.status === 'ready' && detailState.status === 'loading' ? 'loading' : remote.status,
    deviceStatus, detailLoading: !demoEnabled && detailState.status === 'loading',
    error: remote.error || detailState.error, registerSample, refresh: () => setRevision(value => value + 1),
  }}>{children}</QualityContext.Provider>;
}

export function useQuality() {
  const context = useContext(QualityContext);
  if (!context) throw new Error('Quality components require QualityProvider.');
  return context;
}
