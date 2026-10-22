import { useDehydration } from '../components/DehydrationProvider';

import {
  ControlStatusCard,
  ProcessInformation,
  ProcessTrendPanel,
  RDTCard,
  StatusBadge,
  SystemLog,
  TelemetryCard
} from '../components/DehydrationUI';

import {
  formatDuration,
  formatDryingTime
} from '../data/demoDehydration';

export default function DehydrationDashboard() {
  const { telemetry: data, demoEnabled, records, events, liveConnected, status, error: liveError } = useDehydration();
  const isLoading = status === 'loading';

  // =====================================================
  // STATUS BADGE
  // =====================================================

  let statusText = 'Chamber offline';
  let statusTone = 'offline';


  if (demoEnabled) {

    statusText = 'Demo session · drying';
    statusTone = 'demo';

  } else if (isLoading) {

    statusText = 'Connecting to chamber...';
    statusTone = 'offline';

  } else if (liveConnected) {

    statusText = 'Chamber connected';
    statusTone = 'online';

  } else if (data) {

    statusText = 'Last reading · stale';
    statusTone = 'offline';

  }


  // =====================================================
  // PAGE
  // =====================================================

  return (
    <>

      <div className="drying-section-heading">

        <div>

          <p className="eyebrow">
            OBSERVE / UNDERSTAND / ADAPT
          </p>

          <h2>
            Live monitoring
          </h2>

          <p>

            {data
              ? `Batch ${data.batchId} · snapshot ${
                  formatDryingTime(
                    data.updatedAt || data.createdAt
                  )
                }`
              : 'Waiting for the first chamber observation.'
            }

          </p>

        </div>


        <StatusBadge tone={statusTone}>
          {statusText}
        </StatusBadge>

      </div>


      {/* ===============================================
          CONNECTION ERROR
          =============================================== */}

      {!demoEnabled && liveError && (

        <div className="drying-notice">

          Live chamber data is currently unavailable.

        </div>

      )}


      {/* ===============================================
          PRIMARY TELEMETRY
          =============================================== */}

      <section
        className="metrics-grid drying-telemetry"
        aria-label={
          demoEnabled
            ? 'DEMO DATA telemetry'
            : 'Chamber telemetry'
        }
      >

        <TelemetryCard
          label="Current moisture"
          value={
            Number.isFinite(data?.estimatedMoisture)
              ? data.estimatedMoisture.toFixed(1)
              : null
          }
          unit="% estimated"
          symbol="droplet"
          demoEnabled={demoEnabled}
        />


        <TelemetryCard
          label="Chamber temperature"
          value={
            Number.isFinite(data?.temperature)
              ? data.temperature.toFixed(1)
              : null
          }
          unit="°C"
          symbol="thermometer"
          demoEnabled={demoEnabled}
        />


        <TelemetryCard
          label="Chamber humidity"
          value={
            Number.isFinite(data?.humidity)
              ? data.humidity.toFixed(1)
              : null
          }
          unit="% RH"
          symbol="wind"
          demoEnabled={demoEnabled}
        />


        <TelemetryCard
          label="Elapsed time"
          value={
            data
              ? formatDuration(data.elapsedTime)
              : null
          }
          symbol="clock"
          demoEnabled={demoEnabled}
        />

      </section>


      {/* ===============================================
          RDT / CONTROL / GRAPH / EVENTS
          =============================================== */}

      <div className="drying-main-grid">

        <RDTCard />

        <ControlStatusCard />

        <ProcessTrendPanel
          records={records}
          demoEnabled={demoEnabled}
        />

        <SystemLog
          events={events}
          demoEnabled={demoEnabled}
        />

      </div>


      {/* ===============================================
          PROCESS INFORMATION
          =============================================== */}

      <div className="drying-section-gap">

        <ProcessInformation
          data={data}
          demoEnabled={demoEnabled}
        />

      </div>

    </>
  );
}