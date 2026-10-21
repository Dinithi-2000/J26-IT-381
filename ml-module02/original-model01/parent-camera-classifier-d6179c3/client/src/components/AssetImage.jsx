import { useState } from 'react';
import Icon from './Icon';

// Local photos are presentation assets. Sample photographs retain their own data source.
export default function AssetImage({ src, alt, className = '', loading = 'lazy', fallback = '/cinnamon.svg', ...props }) {
  const [failure, setFailure] = useState({ src: null, count: 0 });
  const failed = failure.src === src ? failure.count : 0;
  if (failed > 1 || (failed && !fallback)) return <span className={`image-unavailable ${className}`} role="img" aria-label={`${alt} — preview unavailable`}><Icon name="image" size={40} /><span>Image preview unavailable</span></span>;
  return <img src={failed ? fallback : src} alt={failed ? `${alt} — botanical illustration fallback` : alt}
    className={className} loading={loading} decoding="async"
    onError={() => setFailure(previous => ({ src, count: previous.src === src ? previous.count + 1 : 1 }))} {...props} />;
}
