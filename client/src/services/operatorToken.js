import { useSyncExternalStore } from 'react';

// One operator token shared by every Module 02 form. It is kept in sessionStorage,
// so it survives page refreshes but is forgotten when the browser tab is closed.
const KEY = 'cinnasense.module02.operatorToken';

// On this computer (localhost) the backend accepts requests without a token when
// MODULE02_LOCAL_NO_TOKEN=true, so the token boxes are hidden there.
export const TOKEN_OPTIONAL = ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname);
const listeners = new Set();

function read() {
  try { return globalThis.sessionStorage?.getItem(KEY) || ''; } catch { return ''; }
}

let current = read();

export function getOperatorToken() { return current; }

export function setOperatorToken(value) {
  current = value || '';
  try {
    if (current) globalThis.sessionStorage?.setItem(KEY, current);
    else globalThis.sessionStorage?.removeItem(KEY);
  } catch { /* storage unavailable: keep the token in memory only */ }
  listeners.forEach(listener => listener());
}

function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }

export function useOperatorToken() {
  const token = useSyncExternalStore(subscribe, getOperatorToken, () => '');
  // On this computer no token is sent, so a stale remembered token cannot cause a 401.
  return [TOKEN_OPTIONAL ? '' : token, setOperatorToken];
}
