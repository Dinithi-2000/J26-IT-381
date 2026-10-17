import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

const steps = [
  { title: 'Monitor & dehydrate', icon: 'sun', label: '01 / Adaptive dehydration', heading: 'Precision begins with the process.',
    description: 'Explore the planned chamber workflow: observe moisture and environmental conditions, predict remaining drying time, and work toward adaptive heater and fan control.',
    output: 'Drying conditions → RDT research → adaptive control', route: '/module-01' },
  { title: 'Understand & preserve', icon: 'shield', label: '02 / Stored quality', heading: 'Follow quality beyond the drying chamber.',
    description: 'Study stored cinnamon through weight, color, gas resistance, environmental histories, and visual observations. Explore the interface with explicitly enabled demo data.',
    output: 'Stored samples → multi-signal observations → future risk', route: '/module-02' },
  { title: 'Grade in the field', icon: 'mobile', label: '03 / Mobile edge AI', heading: 'Bring grading closer to the grower.',
    description: 'The team’s mobile research explores offline quill grade classification and thickness estimation on a smartphone. This website provides the integration-ready overview.',
    output: 'Quill image → on-device analysis → grade & thickness', route: '/module-03' },
  { title: 'Forecast & plan', icon: 'map', label: '04 / GIS & market value', heading: 'Connect local decisions to a wider view.',
    description: 'Explore the existing price prediction interface and the planned expansion toward satellite, climate, and district-level yield forecasting. GIS and yield models are not connected.',
    output: 'Spatial & historical inputs → future yield & value forecasts', route: '/module-04' },
];

export default function ResearchWorkflow() {
  const [active, setActive] = useState(0);
  const selected = steps[active];
  return <section className="workflow section" id="workflow">
    <div className="section-top"><div><p className="eyebrow">THE CONNECTED RESEARCH JOURNEY</p><h2>From nature.<br /><em>To informed decisions.</em></h2></div>
      <p>Four specialized contributions.<br />One shared research direction.</p></div>
    <div className="workflow-interactive">
      <div className="workflow-steps" role="group" aria-label="Explore research stages">
        {steps.map((step, index) => <button key={step.title} className={active === index ? 'workflow-step selected' : 'workflow-step'}
          aria-pressed={active === index} aria-controls="workflow-detail" onClick={() => setActive(index)}>
          <span className="step-number">0{index + 1}</span><Icon name={step.icon} /><span>{step.title}</span><Icon name="chevron" size={16} />
        </button>)}
      </div>
      <div className="workflow-detail" id="workflow-detail" aria-live="polite" aria-atomic="true">
        <span className="workflow-emblem"><Icon name={selected.icon} size={34} /></span><p className="eyebrow light">{selected.label}</p>
        <h3>{selected.heading}</h3><p>{selected.description}</p><div className="workflow-output">{selected.output}</div>
        <Link className="text-link" to={selected.route}>Explore this module <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
    <p className="workflow-note">Research interfaces are independent. Shared sample and batch identifiers are planned for future integration.</p>
  </section>;
}
