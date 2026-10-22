import { useSyncExternalStore } from 'react';

// One operator token shared by every Module 02 form. It is kept in sessionStorage,
// so it survives page refreshes but is forgotten when the browser tab is closed.
const KEY = 'cinnasense.module02.operatorToken';
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
  return [token, setOperatorToken];
}
