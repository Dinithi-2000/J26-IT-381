import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { DehydrationProvider, useDehydration } from './DehydrationProvider';
import Icon from './Icon';
import '../styles/dehydration.css';

const links = [
  ['/module-01', 'Live monitoring', 'overview'], ['/module-01/sessions', 'Drying sessions', 'clock'],
  ['/module-01/rdt', 'RDT prediction', 'sparkles'], ['/module-01/analytics', 'Drying analytics', 'trend'],
  ['/module-01/controls', 'Chamber controls', 'cpu'],
];

function DehydrationSidebar({ drawer, isMobile, mobileOpen, collapsed, onToggle }) {
  return <aside id="dehydration-sidebar" ref={drawer} className={`quality-sidebar${mobileOpen ? ' is-open' : ''}`}
    role={isMobile && mobileOpen ? 'dialog' : undefined} aria-modal={isMobile && mobileOpen ? true : undefined}
    aria-label="Dehydration research sidebar" inert={isMobile && !mobileOpen ? true : undefined}>
    <div className="sidebar-heading"><span className="sidebar-emblem"><Icon name="sun" size={24} /></span>
      <div className="sidebar-copy"><strong>Adaptive drying</strong><span>MODULE 01 / DEHYDRATION</span></div>
      <button className="sidebar-collapse" onClick={onToggle} aria-controls="dehydration-navigation"
        aria-expanded={isMobile ? mobileOpen : !collapsed} aria-label={isMobile ? 'Close research sidebar' : collapsed ? 'Expand research sidebar' : 'Collapse research sidebar'}>
        <Icon name={isMobile ? 'close' : 'sidebar'} size={19} />
      </button>
    </div>
    <p className="sidebar-section-label sidebar-copy">RESEARCH WORKSPACE</p>
    <nav className="quality-nav" id="dehydration-navigation" aria-label="Dehydration navigation">
      {links.map(([to, label, icon], index) => <NavLink key={to} to={to} end={index === 0} title={label} aria-label={label}>
        <Icon name={icon} size={20} /><span className="sidebar-copy">{label}</span>
      </NavLink>)}
    </nav>
    <div className="sidebar-device-panel"><div className="sidebar-device-heading"><Icon name="offline" size={18} /><strong className="sidebar-copy">Chamber status</strong></div>
      <div className="sidebar-copy"><p>Hardware not connected</p>{['ESP32-S3', 'SHT30', 'Load cell', 'Heater relay', 'Fan relay'].map(device =>
        <div className="device-row" key={device}><span className="connection-dot offline" />{device}<span>Not connected</span></div>)}</div>
    </div>
    <div className="sidebar-research-note sidebar-copy"><span className="sidebar-note-icon"><Icon name="leaf" size={24} /></span>
      <strong>A measured approach.</strong><p>Follow the drying process. Build the evidence for Remaining Drying Time prediction.</p>
      <Link to="/module-01/rdt">Explore RDT research <Icon name="external" size={14} /></Link>
    </div>
    <Link className="sidebar-back" to="/"><Icon name="arrow" size={17} /><span className="sidebar-copy">Back to CinnaSense</span></Link>
  </aside>;
}

function ConnectionBanner() {
  const { demoEnabled, setDemoEnabled, status, error } = useDehydration();
  return <div className="demo-banner demo-controls">
    <div className="demo-banner-copy"><Icon name="info" size={20} /><div aria-live="polite">
      <strong>{demoEnabled ? 'DEMO DATA — an illustrative drying experiment' : status === 'error' ? 'Dehydration data is unavailable.' : 'Your dehydration workspace is ready. The chamber is not connected.'}</strong>
      <p>{demoEnabled ? 'Synthetic measurements and simulated predictions for UI exploration. The chamber and RDT service are not connected.' : status === 'error' ? error : 'Connect the ESP32-S3 to display live measurements and control status. Enable demo data to explore the dashboard interface.'}</p>
    </div></div>
    <label className="demo-switch"><input type="checkbox" checked={demoEnabled} onChange={event => setDemoEnabled(event.target.checked)} /><span className="switch-track" aria-hidden="true" /><span>Demo data</span></label>
  </div>;
}

function DehydrationShell() {
  const { demoEnabled, status } = useDehydration();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const drawer = useRef(null), drawerTrigger = useRef(null);
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
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...drawer.current.querySelectorAll('a, button')];
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
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
      document.body.style.overflow = overflow;
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
      drawerTrigger.current?.focus();
    };
  }, [isMobile, mobileOpen]);
  return <main className={`quality-page quality-workspace dehydration-workspace${collapsed ? ' sidebar-collapsed' : ''}`}>
    {mobileOpen && isMobile && <button className="sidebar-backdrop" tabIndex="-1" aria-label="Close research sidebar" onClick={() => setMobileOpen(false)} />}
    <DehydrationSidebar {...{ drawer, isMobile, mobileOpen, collapsed }} onToggle={() => isMobile ? setMobileOpen(false) : setCollapsed(!collapsed)} />
    <div className="quality-content" inert={isMobile && mobileOpen ? true : undefined}>
      <div className="workspace-topbar"><div>
        <button className="workspace-mobile-button" ref={drawerTrigger} onClick={() => setMobileOpen(true)} aria-label="Open research sidebar" aria-expanded={mobileOpen} aria-controls="dehydration-sidebar"><Icon name="menu" size={19} /></button>
        <Link to="/">Platform</Link><span>/</span><span>Adaptive dehydration</span>
      </div><span className={`data-badge ${demoEnabled ? 'demo' : 'offline'}`}><span className="connection-dot" />{demoEnabled ? 'DEMO DATA' : status === 'loading' ? 'Checking availability' : 'Offline workspace'}</span></div>
      <div className="dashboard-heading"><div><p className="eyebrow">MODULE 01 / ADAPTIVE DEHYDRATION</p><h1>Adaptive drying, <em>in focus.</em></h1>
        <p className="lead">Monitor chamber conditions, follow drying progress, and explore Remaining Drying Time prediction and adaptive control.</p>
      </div><span className="workspace-heading-icon"><Icon name="sun" size={34} /></span></div>
      <ConnectionBanner />
      <Outlet />
      <p className="drying-workspace-note"><Icon name="sample" size={16} /> Research prototype · Estimated moisture requires calibration against reference measurements.</p>
    </div>
  </main>;
}

export default function DehydrationLayout() {
  return <DehydrationProvider><DehydrationShell /></DehydrationProvider>;
}
