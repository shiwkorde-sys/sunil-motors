import { useSyncExternalStore } from 'react';

const KEY = 'sunil.muted';
const subs = new Set<() => void>();
let muted = false; // sound is ON by default

try {
  muted = localStorage.getItem(KEY) === '1';
} catch {
  /* private mode: fine */
}

export const isMuted = () => muted;

/** Mute / unmute the automatic read-aloud. Muting also stops anything being spoken right now. */
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (m) {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* audio not supported */
    }
  }
  subs.forEach((f) => f());
}

export const useMuted = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    () => muted,
  );
