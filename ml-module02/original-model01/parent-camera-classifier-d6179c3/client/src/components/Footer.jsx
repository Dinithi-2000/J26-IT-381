import { Link } from 'react-router-dom';
import { modules, researchTitle } from '../data/modules';
import Icon from './Icon';

const moduleIcons = ['sun', 'shield', 'mobile', 'map'];

export default function Footer() {
  function backToTop() {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return <footer className="site-footer">
    <div className="footer-surface">
      <div className="footer-invitation">
        <div><p className="footer-eyebrow">FOUR CONTRIBUTIONS. ONE CONNECTED VISION.</p>
          <h2>Rooted in nature.<br /><em>Connected by research.</em></h2>
        </div>
        <Link className="footer-workspace" to="/module-02"><span>Explore the quality workspace</span><span className="footer-action-icon"><Icon name="external" size={20} /></span></Link>
      </div>

      <div className="footer-main">
        <div className="footer-brand-column">
          <Link className="brand footer-brand" to="/" aria-label="CinnaSense AI home"><span className="brand-mark"><Icon name="leaf" size={26} /></span>
            <span>CinnaSense <b>AI</b><small>CINNAMON INTELLIGENCE</small></span>
          </Link>
          <p>Smart Cinnamon Processing &amp;<br />Quality Intelligence Platform</p>
          <div className="footer-process" aria-label="Monitor, Dehydrate, Preserve, Predict">
            {['Monitor', 'Dehydrate', 'Preserve', 'Predict'].map(label => <span key={label}>{label}</span>)}
          </div>
        </div>

        <nav className="footer-module-nav" aria-label="Footer research modules">
          <h3>Explore the research</h3>
          {modules.map((module, index) => <Link key={module.id} to={`/module-${module.id}`} aria-label={`Module ${module.id}: ${module.title}`}>
            <span className="footer-link-icon"><Icon name={moduleIcons[index]} size={17} /></span>
            <span>{module.short}</span><Icon className="footer-link-arrow" name="external" size={14} />
          </Link>)}
        </nav>

        <div className="footer-project">
          <h3>The research project</h3>
          <p className="footer-research-title">{researchTitle}</p>
          <div className="footer-project-meta"><span>J26-IT-381</span><span>Final-year research</span></div>
          <span className="footer-research-status"><Icon name="sample" size={14} />Research in progress</span>
          <p className="footer-team-note">Four members. A shared direction.</p>
        </div>
      </div>

      <div className="footer-bottom">
        <span className="footer-copyright">© {new Date().getFullYear()} CinnaSense AI<span className="footer-bottom-separator">/</span>Research platform</span>
        <div className="footer-utility-links"><Link to="/">Home</Link><Link to="/#about">About the project</Link>
          <button type="button" className="footer-top-button" onClick={backToTop}>Back to top<Icon name="arrow" size={15} /></button>
        </div>
        <details className="footer-credits">
          <summary>Image credits<Icon name="chevron" size={13} /></summary>
          <div className="footer-credit-content">
            <p>Presentation photography is stock imagery, not captured research samples.</p>
            <div className="footer-credit-links">
              <a href="https://unsplash.com/photos/sQjNAZE-W6s" target="_blank" rel="noreferrer">Cinnamon · Neil P-A / Unsplash<Icon name="external" size={12} /></a>
              <a href="https://unsplash.com/photos/uaHShoIDGeo" target="_blank" rel="noreferrer">Spices · Marion Botella / Unsplash<Icon name="external" size={12} /></a>
              <a href="https://commons.wikimedia.org/wiki/File:Cinnamomum_verum1.jpg" target="_blank" rel="noreferrer">Cinnamon foliage · USDA / Wikimedia, public domain<Icon name="external" size={12} /></a>
              <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash License<Icon name="external" size={12} /></a>
            </div>
          </div>
        </details>
      </div>
    </div>
    <div className="footer-closing-note"><span className="footer-closing-rule" /><Icon name="leaf" size={14} /><span>Designed around nature. Driven by questions.</span><span className="footer-closing-rule" /></div>
  </footer>;
}
