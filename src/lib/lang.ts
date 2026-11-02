import { useSyncExternalStore } from 'react';

export type Lang = 'hi' | 'en';
const KEY = 'sunil.lang';
const subs = new Set<() => void>();
let cur: Lang = 'hi'; // Hindi by default

try {
  const v = localStorage.getItem(KEY);
  if (v === 'en' || v === 'hi') cur = v;
} catch {
  /* private mode: fine */
}

export const getLang = () => cur;

export function setLang(l: Lang) {
  cur = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

export const useLang = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    () => cur,
  );
