import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { GradingProvider, useGrading } from './GradingProvider';
import Icon from './Icon';
import '../styles/grading.css';

const navLinks = [
  ['/module-03', 'Grading dashboard', 'overview'],
];

function GradingSidebar({ drawer, isMobile, mobileOpen, collapsed, onToggle }) {
  const { stats, demoEnabled } = useGrading();

  return (
    <aside
      id="grading-sidebar"
      ref={drawer}
      className={`quality-sidebar${mobileOpen ? ' is-open' : ''}`}
      role={isMobile && mobileOpen ? 'dialog' : undefined}
      aria-modal={isMobile && mobileOpen ? true : undefined}
      aria-label="QuillGrade mobile research sidebar"
      inert={isMobile && !mobileOpen ? true : undefined}
    >
      <div className="sidebar-heading">
        <span className="sidebar-emblem">
          <Icon name="mobile" size={24} />
        </span>
        <div className="sidebar-copy">
          <strong>QuillGrade AI</strong>
          <span>MODULE 03 / MOBILE EDGE AI</span>
        </div>
        <button
          className="sidebar-collapse"
          onClick={onToggle}
          aria-controls="grading-navigation"
          aria-expanded={isMobile ? mobileOpen : !collapsed}
          aria-label={
            isMobile
              ? 'Close research sidebar'
              : collapsed
              ? 'Expand research sidebar'
              : 'Collapse research sidebar'
          }
        >
          <Icon name={isMobile ? 'close' : 'sidebar'} size={19} />
        </button>
      </div>

      <p className="sidebar-section-label sidebar-copy">RESEARCH WORKSPACE</p>

      <nav className="quality-nav" id="grading-navigation" aria-label="QuillGrade navigation">
        {navLinks.map(([to, label, icon], index) => (
          <NavLink key={to} to={to} end={index === 0} title={label} aria-label={label}>
            <Icon name={icon} size={20} />
            <span className="sidebar-copy">{label}</span>
            {stats.total > 0 && (
              <span className="sidebar-count sidebar-copy">{stats.total}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Mobile edge status panel */}
      <div className="sidebar-device-panel">
        <div className="sidebar-device-heading">
          <Icon name="mobile" size={18} />
          <strong className="sidebar-copy">Mobile Edge Status</strong>
        </div>
        <div className="sidebar-copy">
          <p>Smartphone on-device inference</p>
          <div className="device-row">
            <span className="connection-dot" style={{ background: '#22C55E' }} />
            TFLite Model
            <span>On-device</span>
          </div>
          <div className="device-row">
            <span className={`connection-dot ${demoEnabled ? '' : 'offline'}`} style={demoEnabled ? { background: '#F59E0B' } : undefined} />
            Cloud Sync
            <span>{demoEnabled ? 'Simulated' : 'Offline'}</span>
          </div>
          <div className="device-row">
            <span className="connection-dot neutral" />
            Flutter App
            <span>QuillGrade</span>
          </div>
        </div>
      </div>

      <div className="sidebar-research-note sidebar-copy">
        <span className="sidebar-note-icon">
          <Icon name="sparkles" size={24} />
        </span>
        <strong>Grading in the field.</strong>
        <p>
          Mobile Edge AI brings instant cinnamon classification to growers, reducing intermediary disputes with verified quality metrics.
        </p>
      </div>

      <Link className="sidebar-back" to="/">
        <Icon name="arrow" size={17} />
        <span className="sidebar-copy">Back to CinnaSense</span>
      </Link>
    </aside>
  );
}

function ConnectionBanner() {
  const { demoEnabled, setDemoEnabled, status, error } = useGrading();

  return (
    <div className="demo-banner demo-controls">
      <div className="demo-banner-copy">
        <Icon name="info" size={20} />
        <div aria-live="polite">
          <strong>
            {demoEnabled
              ? 'SIMULATED DEMO DATA — Illustrative Mobile Grading Samples'
              : status === 'error'
              ? 'Grading sync data is unavailable.'
              : 'Your grading workspace is ready. Mobile synchronization is not connected.'}
          </strong>
          <p>
            {demoEnabled
              ? 'Simulated grading evaluations across 4-Class Image-Only and 7-Class Hybrid models with captured photos, optional thickness measurements (not required for Image-Only), and sync statuses.'
              : status === 'error'
              ? error
              : 'The mobile app runs inference offline in the field. Enable demo data to preview active grading records, distribution charts, and the sample details modal.'}
          </p>
        </div>
      </div>
      <label className="demo-switch" htmlFor="grading-demo-checkbox">
        <input
          id="grading-demo-checkbox"
          type="checkbox"
          checked={demoEnabled}
          onChange={e => setDemoEnabled(e.target.checked)}
        />
        <span className="switch-track" aria-hidden="true" />
        <span>Demo data</span>
      </label>
    </div>
  );
}

function GradingShell() {
  const { demoEnabled, status } = useGrading();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const drawer = useRef(null);
  const drawerTrigger = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)');
    const change = event => {
      setIsMobile(event.matches);
      setMobileOpen(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Focus trapping and Esc key for mobile drawer
  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...drawer.current.querySelectorAll('a, button')];
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());

    function handleKey(event) {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!drawer.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = overflow;
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
      drawerTrigger.current?.focus();
    };
  }, [isMobile, mobileOpen]);

  return (
    <main
      className={`quality-page quality-workspace grading-workspace${
        collapsed ? ' sidebar-collapsed' : ''
      }`}
    >
      {mobileOpen && isMobile && (
        <button
          className="sidebar-backdrop"
          tabIndex={-1}
          aria-label="Close research sidebar"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <GradingSidebar
        drawer={drawer}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        collapsed={collapsed}
        onToggle={() => (isMobile ? setMobileOpen(false) : setCollapsed(!collapsed))}
      />

      <div className="quality-content grading-content" inert={isMobile && mobileOpen ? true : undefined}>
        {/* Topbar */}
        <div className="workspace-topbar">
          <div>
            <button
              className="workspace-mobile-button"
              ref={drawerTrigger}
              onClick={() => setMobileOpen(true)}
              aria-label="Open research sidebar"
              aria-expanded={mobileOpen}
              aria-controls="grading-sidebar"
            >
              <Icon name="menu" size={19} />
            </button>
            <Link to="/">Platform</Link>
            <span>/</span>
            <span>Mobile Cinnamon Grading (QuillGrade)</span>
          </div>
          <span className={`data-badge ${demoEnabled ? 'demo' : status === 'ready' ? 'ready' : 'offline'}`}>
            <span className="connection-dot" />
            {demoEnabled
              ? 'DEMO DATA'
              : status === 'loading'
              ? 'Checking availability'
              : status === 'ready'
              ? 'Historical records'
              : 'Sync offline'}
          </span>
        </div>

        {/* Heading */}
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">MODULE 03 / MOBILE EDGE AI</p>
            <h1>
              QuillGrade, <em>in the field.</em>
            </h1>
            <p className="lead">
              Offline smartphone grade classification (4-Class Image-Only & 7-Class Hybrid), quill thickness estimation, and synchronized field evaluation history.
            </p>
          </div>
          <span className="workspace-heading-icon">
            <Icon name="mobile" size={34} />
          </span>
        </div>

        {/* Demo banner */}
        <ConnectionBanner />

        {/* Page Content */}
        <Outlet />
      </div>
    </main>
  );
}

export default function GradingLayout() {
  return (
    <GradingProvider>
      <GradingShell />
    </GradingProvider>
  );
}
