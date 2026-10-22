import { Link } from 'react-router-dom';
import { modules, researchTitle } from '../data/modules';
import AssetImage from '../components/AssetImage';
import Icon from '../components/Icon';
import ResearchWorkflow from '../components/ResearchWorkflow';

const technologies = [
  ['IoT', 'Connected observations', 'Chamber and storage sensing form the planned foundation for physical measurements.', 'cpu'],
  ['AI', 'Predictive research', 'Distinct models will investigate drying time, stored quality, and forecasting.', 'sparkles'],
  ['Computer Vision', 'Quality in focus', 'Standardized imagery supports visible-defect and quill analysis research.', 'camera'],
  ['Edge AI', 'Intelligence, offline', 'The mobile grading contribution explores inference directly on a smartphone.', 'mobile'],
  ['GIS', 'A wider perspective', 'Future spatial, climate, and production inputs support district-level planning.', 'map'],
];
const team = [
  ['Wijesooriya W.A.D.N.S.', 'IT23178090'], ['Gamage D.N.', 'IT23481244'],
  ['Senevirathna I.D.M.I.', 'IT23174344'], ['Fernando J.J.S.', 'IT23349506'],
];
const moduleVisuals = [
  { image: '/images/cinnamon-hero.jpg', icon: 'sun', category: 'PROCESS INTELLIGENCE', title: 'Adaptive dehydration & RDT prediction', alt: 'Close-up photograph of dried cinnamon bark' },
  { image: '/images/cinnamon-spices.jpg', icon: 'shield', category: 'STORED QUALITY', title: 'Multi-quality degradation prediction', alt: 'Cinnamon sticks among colorful culinary spices' },
  { image: '/images/cinnamon-hero.jpg', icon: 'mobile', category: 'MOBILE EDGE AI', title: 'Offline grading & thickness estimation', alt: 'Cinnamon quills illustrating the subject of grading research' },
  { image: '/images/cinnamon-botanical.jpg', icon: 'map', category: 'SPATIAL INTELLIGENCE', title: 'GIS yield & market value forecasting', alt: 'Botanical photograph of cinnamon foliage' },
];

export default function Home() {
  return <main className="home-page">
    <section className="home-hero" aria-labelledby="home-title">
      <AssetImage className="hero-photograph" src="/images/cinnamon-hero.jpg" alt="Macro photograph of cinnamon sticks on a dark surface" loading="eager" fetchPriority="high" />
      <div className="hero-shade" />
      <div className="hero-copy">
        <p className="hero-kicker"><span className="tiny-dot" /> THE FUTURE OF CINNAMON, ROOTED IN RESEARCH</p>
        <h1 id="home-title">Nature Meets<br /><em>Intelligence.</em></h1>
        <p className="hero-description">Smart dehydration. Deeper quality insights. Offline mobile grading. A wider view through GIS forecasting. One connected vision for cinnamon.</p>
        <div className="hero-actions"><Link className="button cream" to="/module-02">Explore the research platform <Icon name="arrow" size={18} /></Link>
          <a className="hero-secondary" href="#research">Meet the four modules <Icon name="external" size={16} /></a></div>
        <div className="hero-tagline">Monitor <span>•</span> Dehydrate <span>•</span> Preserve <span>•</span> Predict</div>
      </div>
      <div className="hero-field-note"><span className="field-note-icon"><Icon name="leaf" size={25} /></span><div><span>INSPIRED BY NATURE</span><strong>Cinnamon, understood.</strong></div><span className="field-note-line" /></div>
      <div className="hero-bottom"><span>J26-IT-381 / FINAL-YEAR RESEARCH</span><a href="#introduction">A closer look <span>↓</span></a><span>FOUR CONTRIBUTIONS. ONE VISION.</span></div>
    </section>
    <section className="intro-strip" id="introduction">
      <div className="intro-heading"><p className="eyebrow">A MORE INFORMED CINNAMON JOURNEY</p><h2>Better processing.<br /><em>Lasting possibility.</em></h2></div>
      <div className="intro-description"><p>CinnaSense AI brings sensing, imaging, and predictive research together across cinnamon processing and storage, from the drying chamber to field grading and district-level planning.</p><a className="inline-link" href="#about">About the research <Icon name="external" size={15} /></a></div>
      <div className="intro-stats"><div><strong>04</strong><span>Research modules</span></div><div><strong>01</strong><span>Connected vision</span></div></div>
    </section>
    <section className="section research-section" id="research">
      <div className="section-top"><div><p className="eyebrow">THE RESEARCH ECOSYSTEM</p><h2>Four perspectives.<br /><em>A smarter whole.</em></h2></div><p>Explore each contribution, from intelligent<br />processing to informed decisions.</p></div>
      <div className="module-grid">{modules.map((module, index) => {
        const visual = moduleVisuals[index];
        return <Link className={`module-card module-card-${module.id}`} key={module.id} to={`/module-${module.id}`} aria-label={`Explore Module ${module.id}: ${module.title}`}>
          <div className="module-card-image"><AssetImage src={visual.image} alt={visual.alt} /><span className="module-photo-number">0{index + 1}</span><span className="module-photo-icon"><Icon name={visual.icon} size={22} /></span></div>
          <div className="module-card-content"><span className="module-category">{visual.category}</span><h3>{visual.title}</h3><p>{module.description}</p>
            <div className="module-card-bottom"><span>{index === 1 ? 'Explore quality workspace' : index === 3 ? 'Explore forecasting' : 'Explore research'}</span><span className="round-arrow"><Icon name="external" size={17} /></span></div>
          </div>
        </Link>;
      })}</div>
      <p className="research-disclosure"><Icon name="info" size={15} /> Research in progress. Each module clearly identifies available interfaces, demo data, and future integrations.</p>
    </section>
    <ResearchWorkflow />
    <section className="section technology-section"><div className="section-top"><div><p className="eyebrow">PURPOSEFUL TECHNOLOGY</p><h2>Connected by science.<br /><em>Grounded in possibility.</em></h2></div><p>Complementary technologies, selected<br />for distinct research questions.</p></div>
      <div className="technology-tiles">{technologies.map(([technology, title, description, icon]) => <article key={technology}>
        <span className="technology-icon"><Icon name={icon} size={27} /></span><span className="technology-name">{technology}</span><h3>{title}</h3><p>{description}</p>
      </article>)}</div>
    </section>
    <section className="objectives section"><div className="objectives-intro"><p className="eyebrow">OUR RESEARCH AMBITION</p><h2>Build evidence.<br /><em>Improve decisions.</em></h2><p>Investigating practical questions across the cinnamon value chain.</p></div>
      <div className="objectives-grid">{[
        ['Consistent dehydration', 'Study drying time and target moisture with sensor-informed chamber control.'],
        ['Stored quality, understood', 'Investigate multiple quality signals and validate degradation risk over storage time.'],
        ['Accessible field grading', 'Explore offline, image-based grade and thickness estimation on mobile devices.'],
        ['Informed forward planning', 'Study district-level yield and market value through spatial and historical inputs.'],
      ].map(([title, description], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
    </section>
    <section className="section team-section"><div className="section-top"><div><p className="eyebrow">THE PEOPLE BEHIND THE RESEARCH</p><h2>Different expertise.<br /><em>Shared curiosity.</em></h2></div><p>A four-member final-year team.<br />Research project J26-IT-381.</p></div>
      <div className="team-grid">{team.map(([name, id], index) => <article key={id}><span className="team-index">0{index + 1}</span><span className="team-initial" aria-hidden="true">{name.charAt(0)}</span><h3>{name}</h3><p>{id}</p><span className="team-role">Research team member</span></article>)}</div>
    </section>
    <section className="about section" id="about"><div><p className="eyebrow light">SMART PROCESSING. THOUGHTFUL RESEARCH.</p><h2>Rooted in cinnamon.<br /><em>Reaching further.</em></h2><Link className="button cream" to="/module-02">Step inside the platform <Icon name="arrow" size={18} /></Link></div>
      <div><span className="about-project-id">J26-IT-381</span><p className="research-title">{researchTitle}</p><p>Exploring IoT, AI, computer vision, edge intelligence, and GIS to support quality preservation and more informed cinnamon processing decisions.</p><span className="outline-chip">Research in progress · Frontend platform</span></div>
    </section>
  </main>;
}
