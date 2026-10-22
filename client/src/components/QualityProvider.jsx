import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { qualityService, normalizeQualityReading } from '../services/qualityService';
import { createTelemetryMonitor, hardwareStatus } from '../services/module02Telemetry';

const QualityContext = createContext(null);

export function QualityProvider({ children, service = qualityService }) {
  // Operational dashboard: use stored backend records only.
  const demoEnabled = false;
  const [remote, setRemote] = useState({ status: 'loading', samples: [], error: '' });
  const [selectedId, setSelectedId] = useState('');
  const [revision, setRevision] = useState(0);
  const [detailState, setDetailState] = useState({status:'idle',error:''});
  const monitor = useMemo(() => createTelemetryMonitor(service), [service]);
  const telemetry = useSyncExternalStore(monitor.subscribe, monitor.getSnapshot, monitor.getSnapshot);
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
  const selectedBase = samples.find(sample => sample.id === selectedId) || samples[0] || null;

  const activeId = selectedBase?.id;
  useEffect(() => {monitor.selectSample(activeId); return () => monitor.dispose();}, [monitor, activeId]);
  const hardware = hardwareStatus(telemetry, activeId);
  const selected = useMemo(() => {
    if (!selectedBase || telemetry.sampleId !== selectedBase.id) return selectedBase;
    const records = new Map(selectedBase.records.map(row => [row.id || row._id || row.timestamp, row]));
    let additions = 0;
    for (const row of telemetry.observations) {
      if (!records.has(row._id)) additions++;
      records.set(row._id, normalizeQualityReading(row, selectedBase));
    }
    return {...selectedBase, records: [...records.values()].sort((a,b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
      || String(a.id || '').localeCompare(String(b.id || ''))).slice(-200),
      historyTotal: (selectedBase.historyTotal || selectedBase.records.length) + additions,
      deviceStatus: telemetry.deviceStatus || selectedBase.deviceStatus};
  }, [selectedBase, telemetry]);
  useEffect(() => {
    if (demoEnabled || !activeId || remote.status !== 'ready') return;
    const controller = new AbortController();
    setDetailState({status:'loading',error:''});
    service.getSampleData(remote.samples.find(item=>item.id===activeId),{signal:controller.signal,skipLatest:true}).then(result=>{
      if(controller.signal.aborted) return;
      setRemote(previous=>({...previous,samples:previous.samples.map(item=>item.id===activeId?result:item)}));
      setDetailState({status:'ready',error:''});
    }).catch(error=>{if(!controller.signal.aborted) setDetailState({status:'error',error:error.message});});
    return ()=>controller.abort();
  }, [activeId,demoEnabled,remote.status,revision,service]);
  const deviceStatus = `ESP32-S3 ${hardware.esp32}`;

  async function registerSample(input, token) {
    const sample = await service.createSample(input,token);
    setRemote(previous=>({...previous,status:'ready',samples:[...previous.samples,sample]}));
    setSelectedId(sample.id);
    return sample;
  }

  return <QualityContext.Provider value={{
    demoEnabled, samples, selected, setSelectedId,
    status: demoEnabled ? 'demo' : remote.status === 'ready' && detailState.status === 'error' ? 'error' : remote.status === 'ready' && detailState.status === 'loading' ? 'loading' : remote.status,
    deviceStatus, hardware, telemetry, detailLoading: !demoEnabled && detailState.status === 'loading',
    error: remote.error || detailState.error, registerSample, refresh: () => setRevision(value => value + 1),
  }}>{children}</QualityContext.Provider>;
}

export function useQuality() {
  const context = useContext(QualityContext);
  if (!context) throw new Error('Quality components require QualityProvider.');
  return context;
}
