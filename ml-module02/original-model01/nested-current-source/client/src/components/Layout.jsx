import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { modules } from '../data/modules';
import Icon from './Icon';
import Footer from './Footer';

export default function Layout() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef(null);
  const header = useRef(null);
  const { pathname, hash } = useLocation();
  useEffect(() => {
    setOpen(false);
    const scrollFrame = requestAnimationFrame(() => {
      if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
      else window.scrollTo(0, 0);
    });
    const module = modules.find(item => pathname === `/module-${item.id}` || pathname.startsWith(`/module-${item.id}/`));
    document.title = pathname === '/' ? 'CinnaSense AI | Nature Meets Intelligence' : `CinnaSense AI | ${module?.short || 'Page not found'}`;
    return () => cancelAnimationFrame(scrollFrame);
  }, [pathname, hash]);
  useEffect(() => {
    if (!open) return;
    const escape = event => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    const outside = event => { if (!header.current?.contains(event.target)) setOpen(false); };
    window.addEventListener('keydown', escape);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('pointerdown', outside); };
  }, [open]);
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header ref={header} className={`site-header${open ? ' menu-is-open' : ''}`}><div className="nav-inner">
      <Link to="/" className="brand" aria-label="CinnaSense AI home"><span className="brand-mark"><Icon name="leaf" size={25} /></span><span className="brand-wordmark">CinnaSense <b>AI</b><small>CINNAMON INTELLIGENCE</small></span></Link>
      <button ref={menuButton} className="menu-toggle" aria-label={open ? 'Close main navigation' : 'Open main navigation'} aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} size={20} /></button>
      <nav id="primary-navigation" className={open ? 'primary-nav open' : 'primary-nav'} aria-label="Main navigation">
        <NavLink to="/" end><Icon name="overview" size={16} /><span className="nav-link-copy">Home<small>Platform overview</small></span></NavLink>
        {modules.map((module, index) => <NavLink key={module.id} to={`/module-${module.id}`} aria-label={`Module ${module.id}: ${module.title}`} title={module.title}>
          <Icon name={['sun', 'shield', 'mobile', 'map'][index]} size={16} /><span className="nav-link-copy">{['Dehydration', 'Stored quality', 'Mobile grading', 'GIS & markets'][index]}<small>Research module {module.id}</small></span>
        </NavLink>)}
      </nav>
      <Link className="nav-workspace" to="/module-02" aria-label="Open quality workspace"><span>Open workspace</span><Icon name="external" size={16} /></Link>
    </div></header>
    <div id="main-content" tabIndex="-1"><Outlet /></div>
    <Footer />
  </>;
}
