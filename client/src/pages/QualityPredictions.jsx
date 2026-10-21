import {useQuality} from '../components/QualityProvider';
import {Panel, SampleSelector, DataState} from '../components/QualityUI';
import RiskPredictionPanel from '../components/RiskPredictionPanel';

export default function QualityPredictions() {
  const {selected} = useQuality();
  return <>
    <DataState />
    <SampleSelector />
    <RiskPredictionPanel />
    <Panel title="Existing forecast history" eyebrow="SEPARATE HISTORICAL FORECAST RECORDS">
      <p>These records belong to the original forecast workflow. Their stored horizons are historical metadata and do not describe Model 02?s synthetic risk output.</p>
      {selected?.predictionTotal > 200 && <p>Showing the latest 200 of {selected.predictionTotal} forecasts. Older records remain available through the existing API.</p>}
      {!selected?.predictions?.length ? <p>No existing forecast records for this sample.</p> : <div className="table-wrap" tabIndex="0" role="region" aria-label="Existing forecast history"><table>
        <thead><tr><th scope="col">Timestamp</th><th scope="col">Model</th><th scope="col">Stored horizon</th><th scope="col">Risk</th></tr></thead>
        <tbody>{selected.predictions.map(row => <tr key={row._id}><td>{row.predictedAt}</td><td>{row.modelVersion}</td><td>{row.horizonDays} days</td><td>{row.riskCategory}</td></tr>)}</tbody>
      </table></div>}
    </Panel>
  </>;
}
