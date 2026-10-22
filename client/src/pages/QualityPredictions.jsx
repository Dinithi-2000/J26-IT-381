import {useQuality} from '../components/QualityProvider';
import {Panel, SampleSelector, DataState} from '../components/QualityUI';
import RiskPredictionPanel from '../components/RiskPredictionPanel';

export default function QualityPredictions() {
  const {selected} = useQuality();
  return <>
    <DataState />
    <SampleSelector />
    <RiskPredictionPanel />
    {!!selected?.predictions?.length && <Panel title="Older forecasts" eyebrow="EARLIER FORECAST TOOL">
      <p>Records from the earlier forecast tool, separate from Model 02.</p>
      {selected.predictionTotal > 200 && <p>Showing the latest 200 of {selected.predictionTotal} forecasts.</p>}
      <div className="table-wrap" tabIndex="0" role="region" aria-label="Older forecasts"><table>
        <thead><tr><th scope="col">Timestamp</th><th scope="col">Model</th><th scope="col">Stored horizon</th><th scope="col">Risk</th></tr></thead>
        <tbody>{selected.predictions.map(row => <tr key={row._id}><td>{row.predictedAt}</td><td>{row.modelVersion}</td><td>{row.horizonDays} days</td><td>{row.riskCategory}</td></tr>)}</tbody>
      </table></div>
    </Panel>}
  </>;
}
