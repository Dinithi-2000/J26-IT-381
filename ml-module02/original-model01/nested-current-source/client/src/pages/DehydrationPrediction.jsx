import { useDehydration } from '../components/DehydrationProvider';
import { DetailList, Panel, RDTCard, StatusBadge, reading } from '../components/DehydrationUI';
import { formatDuration, formatDryingTime } from '../data/demoDehydration';
import Icon from '../components/Icon';

export default function DehydrationPrediction() {
  const { telemetry: data, demoEnabled, predictionConnected } = useDehydration();
  return <>
    <div className="drying-section-heading"><div><p className="eyebrow">RESEARCH / EXPERIMENTAL MODEL</p><h2>Remaining Drying Time Prediction</h2><p>The RDT model estimates how much drying time remains based on the current drying state and recorded process variables.</p></div></div>
    <div className="drying-service-note"><Icon name="sparkles" size={22} /><div><strong>{predictionConnected ? 'Experimental prediction integration' : 'Prediction service not connected.'}</strong><p>{demoEnabled ? 'The time shown below is a fixed, simulated example. No trained or validated model is running.' : 'Current prediction and model outputs remain unavailable until a model service is integrated.'}</p></div><StatusBadge tone="offline">{predictionConnected ? 'Experimental' : 'Planned integration'}</StatusBadge></div>
    <div className="drying-two-grid"><RDTCard /><Panel title="Model inputs" eyebrow="PROCESS VARIABLES" badge={demoEnabled ? 'DEMO DATA' : 'UNAVAILABLE'}>
      <DetailList items={[
        ['Elapsed time', formatDuration(data?.elapsedTime)], ['Temperature', reading(data?.temperature, '°C')], ['Humidity', reading(data?.humidity, '% RH')],
        ['Current weight', reading(data?.currentWeight, 'g')], ['Estimated moisture', reading(data?.estimatedMoisture, '%')],
        ['Initial moisture', reading(data?.initialMoisture, '%')], ['Target moisture', reading(data?.targetMoisture, '%')],
      ]} />
    </Panel></div>
    <div className="drying-section-gap"><Panel title="Prediction record" eyebrow="STATUS / MODEL EVALUATION">
      <DetailList items={[
        ['Current prediction', demoEnabled || predictionConnected ? formatDuration(data?.remainingDryingTime) : '--'],
        ['Prediction status', demoEnabled ? 'Simulated prediction · demo only' : predictionConnected ? 'Experimental' : 'RDT prediction pending'],
        ['Last prediction update', demoEnabled || predictionConnected ? formatDryingTime(data?.updatedAt, true) : '--'],
      ]} />
      <div className="drying-evaluation">{[['MAE', 'Mean absolute error'], ['RMSE', 'Root mean squared error'], ['R²', 'Coefficient of determination']].map(([name, detail]) => <div key={name}><span>{name}</span><strong>Not available</strong><small>{detail}</small></div>)}</div>
      <p className="panel-caption">Evaluation metrics require genuine experimental results. No accuracy, confidence, or model validation is inferred from demo data.</p>
    </Panel></div>
  </>;
}
