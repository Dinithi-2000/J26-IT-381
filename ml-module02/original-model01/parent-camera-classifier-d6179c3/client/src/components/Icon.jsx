const paths = {
  leaf: <><path d="M20 4C11 2 3 6 5 14c1 4 7 6 11 2 3-3 4-8 4-12Z" /><path d="M4 21 16 9M9 16l-1-5m5 1h5" /></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  external: <><path d="M6 18 18 6M6 6h12v12" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <><path d="m6 6 12 12M6 18 18 6" /></>,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16m5-12-3 4 3 4" /></>,
  overview: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  sample: <><path d="M9 3h6m-5 0v7L5 19c-.5 1 0 2 1 2h12c1 0 1.5-1 1-2l-5-9V3M8 15h8" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 6-6 4 4 3-3 5 5" /></>,
  sparkles: <><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3ZM20 2v4m-2-2h4" /></>,
  offline: <><path d="m3 3 18 18M2 8a16 16 0 0 1 3-2m4-2a16 16 0 0 1 13 4M5 12a11 11 0 0 1 4-2m5 0a11 11 0 0 1 5 2m-11 4a6 6 0 0 1 8 0" /><circle cx="12" cy="20" r=".7" /></>,
  thermometer: <><path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0ZM12 8v10m0-11h3m-3 4h3" /></>,
  droplet: <path d="M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13ZM8 15a4 4 0 0 0 4 4" />,
  scale: <><rect x="3" y="4" width="18" height="17" rx="4" /><path d="M7 9a6 6 0 0 1 10 0l-5 5-5-5Zm5 0v5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wind: <><path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h6a3 3 0 1 1-3 3" /></>,
  trend: <><path d="M3 4v16h18M6 14l4-4 4 3 6-7" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" /></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" /></>,
  mobile: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4m-3 14h2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  camera: <><path d="m8 5 2-2h4l2 2h4a1 1 0 0 1 1 1v14H3V6a1 1 0 0 1 1-1h4Z" /><circle cx="12" cy="12" r="4" /></>,
};

export default function Icon({ name = 'leaf', size = 20, className = '', ...props }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {paths[name] || paths.leaf}
  </svg>;
}
