import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { QualityProvider, useQuality } from './QualityProvider';
import Icon from './Icon';
import Module02HardwareStatus from './Module02HardwareStatus';

const links = [
  ['/module-02', 'Quality overview', 'overview'], ['/module-02/samples', 'Cinnamon records', 'sample'],
  ['/module-02/images', 'Image analysis', 'image'], ['/module-02/predictions', 'AI predictions', 'sparkles'],
];
function QualityShell() {
  const { demoEnabled, status, samples, hardware, selected } = useQuality();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const drawer = useRef(null);
  const drawerTrigger = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)');
    const change = event => { setIsMobile(event.matches); setMobileOpen(false); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...drawer.current.querySelectorAll('a, button')];
    const initialFocus = requestAnimationFrame(() => focusable()[0]?.focus());
    function handleKey(event) {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab') return;
      const elements = focusable(), first = elements[0], last = elements.at(-1);
      if (!drawer.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(initialFocus);
      document.removeEventListener('keydown', handleKey);
      drawerTrigger.current?.focus();
    };
  }, [isMobile, mobileOpen]);
  const stateLabel = demoEnabled ? 'DEMO DATA' : status === 'loading' ? 'Checking availability' : status === 'error' ? 'Data unavailable' : status === 'ready' ? 'Historical records' : 'Offline workspace';
  return <main className={`quality-page quality-workspace${collapsed ? ' sidebar-collapsed' : ''}`}>
    {mobileOpen && isMobile && <button className="sidebar-backdrop" tabIndex="-1" aria-label="Close research sidebar" onClick={() => setMobileOpen(false)} />}
    <aside id="quality-sidebar" ref={drawer} className={`quality-sidebar${mobileOpen ? ' is-open' : ''}`}
      role={isMobile && mobileOpen ? 'dialog' : undefined} aria-modal={isMobile && mobileOpen ? true : undefined}
      aria-label="Quality research sidebar" inert={isMobile && !mobileOpen ? true : undefined}>
      <div className="sidebar-heading"><span className="sidebar-emblem"><Icon name="leaf" size={24} /></span><div className="sidebar-copy"><strong>Quality workspace</strong><span>MODULE 02 / STORED CINNAMON</span></div>
        <button className="sidebar-collapse" title={isMobile ? 'Close sidebar' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isMobile ? 'Close research sidebar' : collapsed ? 'Expand research sidebar' : 'Collapse research sidebar'}
          aria-expanded={isMobile ? mobileOpen : !collapsed} aria-controls="quality-sidebar-navigation"
          onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(!collapsed)}><Icon name={isMobile ? 'close' : 'sidebar'} size={19} /></button>
      </div>
      <p className="sidebar-section-label sidebar-copy">RESEARCH WORKSPACE</p>
      <nav className="quality-nav" id="quality-sidebar-navigation" aria-label="Stored quality navigation">
        {links.map(([to, label, icon], index) => <NavLink key={to} to={to} end={index === 0} title={label} aria-label={label}>
          <Icon name={icon} size={20} /><span className="sidebar-copy">{label}</span>{index === 1 && <span className="sidebar-count sidebar-copy">{samples.length}</span>}
        </NavLink>)}
      </nav>
      <Module02HardwareStatus hardware={hardware} sampleId={selected?.id} />
      <div className="sidebar-research-note sidebar-copy"><span className="sidebar-note-icon"><Icon name="shield" size={24} /></span><strong>Evidence before inference.</strong><p>Quality indicators inform research. Validated models must come before predictions.</p><Link to="/module-02/predictions">Model availability <Icon name="external" size={14} /></Link></div>
      <Link className="sidebar-back" to="/"><Icon name="arrow" size={17} /><span className="sidebar-copy">Back to CinnaSense</span></Link>
    </aside>
    <div className="quality-content" inert={isMobile && mobileOpen ? true : undefined}>
      <div className="workspace-topbar"><div><button className="workspace-mobile-button" ref={drawerTrigger} onClick={() => setMobileOpen(true)} aria-label="Open research sidebar" aria-expanded={mobileOpen} aria-controls="quality-sidebar"><Icon name="menu" size={19} /></button><Link to="/">Platform</Link><span>/</span><span>Stored cinnamon quality</span></div><span className={`data-badge ${demoEnabled ? 'demo' : 'offline'}`}><span className="connection-dot" />{stateLabel}</span></div>
      <div className="dashboard-heading"><div><p className="eyebrow">MODULE 02 / QUALITY INTELLIGENCE</p><h1>Stored quality, <em>in focus.</em></h1><p className="lead">Cinnamon quality, sensor insights, and storage intelligence.</p></div><span className="workspace-heading-icon"><Icon name="sample" size={34} /></span></div>
      <Outlet />
    </div>
  </main>;
}
export default function QualityLayout() {
  return <QualityProvider><QualityShell /></QualityProvider>;
}
