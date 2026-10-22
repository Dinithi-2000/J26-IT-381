import { Link } from 'react-router-dom';
import { modules } from '../data/modules';
import PriceDashboard from './PriceDashboard';

export default function ForecastingModule() {
  return <>
    <section className="page-shell forecast-intro">
      <Link className="breadcrumb" to="/">Home / Module 04</Link>
      <p className="eyebrow">MODULE 04 / DISTRICT-LEVEL PLANNING</p>
      <h1>{modules[3].title}</h1>
      <p className="lead">The existing price prediction interface is available below. GIS, yield forecasting, and broader planning insights are reserved for future integration.</p>
      <div className="overview-features">
        {[
          ['Satellite & climate context', 'Future satellite and climate information, NDVI, and soil moisture indicators.'],
          ['District-level yield forecasts', 'Future historical production records and validated yield forecasting.'],
          ['Planning charts & insights', 'Future interactive spatial and temporal comparisons alongside market forecasts.'],
        ].map(([title, description]) => <article className="panel" key={title}>
          <span className="small-badge">NOT INTEGRATED</span><h2>{title}</h2><p>{description}</p>
        </article>)}
      </div>
      <p className="preservation-note">Price prediction requires the existing Express API, MongoDB, and FastAPI model service. No GIS or yield results are fabricated.</p>
    </section>
    <div className="price-module"><PriceDashboard /></div>
  </>;
}
