import { Link } from 'react-router-dom';
import { modules } from '../data/modules';
import Icon from '../components/Icon';

export default function Placeholder({ id }) {
  const module = modules.find(item => item.id === id);
  const isDrying = id === '01';
  return <main className="page-shell placeholder">
    <Link className="breadcrumb" to="/">Home / Research modules</Link>
    <p className="eyebrow">MODULE {id} · INTEGRATION-READY OVERVIEW</p>
    <h1>{module.title}</h1><p className="lead">{module.description}</p>
    <div className="module-overview-hero">
      <div><span className="module-icon"><Icon name={isDrying ? 'sun' : 'mobile'} size={26} /></span>
        <h2>{isDrying ? 'A more intelligent drying journey.' : 'Grading intelligence, in the field.'}</h2>
        <p>{isDrying
          ? 'This member’s future chamber implementation will combine drying observations with remaining drying time prediction and adaptive control.'
          : 'This member’s offline smartphone application is the intended grading experience. The web platform will provide an overview and future integration points.'}</p>
        <span className="demo-pill">{isDrying ? 'Chamber not connected' : 'Mobile application integration pending'}</span>
      </div>
      <div className="overview-path"><p className="eyebrow">PLANNED WORKFLOW</p>
        {(isDrying ? ['Sense moisture, temperature & humidity', 'Predict remaining drying time', 'Adjust heater & fan', 'Track progress toward target moisture']
          : ['Capture a cinnamon quill', 'Estimate scale and thickness', 'Classify grade on the device', 'Save results offline; sync when available']).map((step, index) => <div key={step}><span>0{index + 1}</span><strong>{step}</strong></div>)}
      </div>
    </div>
    <div className="section-heading-local"><div><p className="eyebrow">RESEARCH CAPABILITIES</p><h2>Ready for the member’s implementation.</h2></div></div>
    <div className="overview-features">{module.features.map((feature, index) => <article className="panel" key={feature}>
      <span className="eyebrow">0{index + 1} / PLANNED</span><h3>{feature}</h3><p>{isDrying ? 'Reserved for chamber data and validated control integration.' : 'Reserved for the offline smartphone workflow and its future shared outputs.'}</p>
    </article>)}</div>
    <div className="demo-banner"><strong>{isDrying ? 'No live readings or controls.' : 'A companion web overview.'}</strong>{' '}
      {isDrying ? 'Temperature, moisture, humidity, RDT, actuator state, progress, and automatic control remain unavailable until this member’s implementation is connected.'
        : 'No mobile grade classifier, thickness estimator, or offline inference model is implemented on this website. This page does not replace the smartphone application.'}
    </div>
    <Link className="button" to="/module-02">Explore stored quality →</Link>
  </main>;
}
