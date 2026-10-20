import { createContext, useContext, useEffect, useState } from 'react';
import { demoTelemetry, demoDryingRecords, demoDryingSessions, demoDryingEvents } from '../data/demoDehydration';
import { dehydrationService } from '../services/dehydrationService';

const DehydrationContext = createContext(null);
const empty = { telemetry: null, records: [], sessions: [], events: [], predictionConnected: false };

export function DehydrationProvider({ children, service = dehydrationService }) {
  const [demoEnabled, setDemo] = useState(false);
  const [demoControls, setDemoControls] = useState({});
  const [controlEvents, setControlEvents] = useState([]);
  const [remote, setRemote] = useState({ ...empty, status: 'loading', error: '' });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (demoEnabled) return;
    const controller = new AbortController();
    let timeout;
    setRemote({ ...empty, status: 'loading', error: '' });
    async function refresh() {
      try {
        const data = await service.getWorkspace({ signal: controller.signal });
        if (!controller.signal.aborted) setRemote({ ...empty, ...data, status: data?.telemetry ? 'ready' : 'disconnected', error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setRemote({ ...empty, status: 'error', error: error.message });
      } finally {
        if (!controller.signal.aborted) {
          setNow(Date.now());
          timeout = setTimeout(refresh, 5000);
        }
      }
    }
    refresh();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { controller.abort(); clearTimeout(timeout); clearInterval(clock); };
  }, [demoEnabled, service]);

  function setDemoEnabled(enabled) {
    if (!enabled) setRemote({ ...empty, status: 'loading', error: '' });
    setDemo(enabled);
    setDemoControls({});
    setControlEvents([]);
  }
  function simulateControl(key, value) {
    if (!demoEnabled) return;
    setDemoControls(previous => ({ ...previous, [key]: value }));
    setControlEvents(previous => [{
      id: globalThis.crypto.randomUUID(), timestamp: new Date().toISOString(),
      name: `${({ heaterState: 'Heater', fanState: 'Fan', controlMode: 'Control mode', maxTemperature: 'Maximum temperature', targetMoisture: 'Target moisture' })[key]} set to ${value}`,
      description: 'Demo control only. No command sent to hardware.', icon: 'info',
    }, ...previous]);
  }
  const telemetry = demoEnabled ? {
    ...demoTelemetry, ...demoControls,
    targetWeight: 650 / (1 - (demoControls.targetMoisture ?? demoTelemetry.targetMoisture) / 100),
    temperatureProtection: demoTelemetry.temperature >= (demoControls.maxTemperature ?? demoTelemetry.maxTemperature) ? 'Heater limited' : 'Normal',
    heaterState: demoTelemetry.temperature >= (demoControls.maxTemperature ?? demoTelemetry.maxTemperature) ? 'OFF' : (demoControls.heaterState ?? demoTelemetry.heaterState),
  } : remote.telemetry;
  const data = demoEnabled ? {
    telemetry, records: demoDryingRecords,
    sessions: [{ ...demoDryingSessions[0], ...telemetry, events: [...controlEvents, ...demoDryingEvents] }, ...demoDryingSessions.slice(1)],
    events: [...controlEvents, ...demoDryingEvents], predictionConnected: false, status: 'demo', error: '',
  } : remote;
  const timestamp = telemetry?.updatedAt || telemetry?.createdAt;
  const age = timestamp ? now - new Date(timestamp).getTime() : NaN;
  const liveConnected = !demoEnabled && Number.isFinite(age) && age >= 0 && age < 120000;
  const predictionConnected = liveConnected && telemetry?.mlStatus === 'ONLINE';
  return <DehydrationContext.Provider value={{ ...data, liveConnected, predictionConnected, demoEnabled, setDemoEnabled, simulateControl }}>{children}</DehydrationContext.Provider>;
}

export function useDehydration() {
  const context = useContext(DehydrationContext);
  if (!context) throw new Error('Dehydration components require DehydrationProvider.');
  return context;
}
