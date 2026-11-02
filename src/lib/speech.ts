import { useCallback, useRef, useState } from 'react';
import { getLang, type Lang } from './lang';
import type { Part } from './types';

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

const Ctor: (new () => Recognition) | undefined =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

export const voiceSupported = Boolean(Ctor);

/** Voice search. If the browser can't do it (e.g. iOS Safari/Firefox) `error` explains and the UI falls back to typing. */
export function useVoiceSearch(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);

  const start = useCallback(() => {
    setError(null);
    if (!Ctor) {
      setError('Voice search is not supported on this browser. Please type the part name instead.');
      return;
    }
    try {
      const r = new Ctor();
      r.lang = getLang() === 'hi' ? 'hi-IN' : 'en-IN';
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => onText(e.results[0][0].transcript as string);
      r.onerror = (e) => {
        setError(
          e.error === 'not-allowed'
            ? 'Microphone permission is blocked. Allow it in browser settings, or type instead.'
            : e.error === 'no-speech'
              ? 'Did not hear anything. Tap the mic and try again.'
              : 'Voice search failed. Please type instead.',
        );
        setListening(false);
      };
      r.onend = () => setListening(false);
      rec.current = r;
      setListening(true);
      r.start();
    } catch {
      setListening(false);
      setError('Could not start the microphone. Please type instead.');
    }
  }, [onText]);

  const stop = useCallback(() => rec.current?.stop(), []);
  return { listening, error, start, stop };
}

const LETTERS: Record<string, string> = {
  A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ', G: 'जी', H: 'एच', I: 'आई', J: 'जे', K: 'के', L: 'एल', M: 'एम',
  N: 'एन', O: 'ओ', P: 'पी', Q: 'क्यू', R: 'आर', S: 'एस', T: 'टी', U: 'यू', V: 'वी', W: 'डब्ल्यू', X: 'एक्स', Y: 'वाई', Z: 'ज़ेड',
};

/** The sentence spoken for a part: stock count + shelf. */
export function stockSentence(p: Part, lang: Lang): string {
  const shelfRaw = (p.shelf_location ?? '').replace(/\d+/g, (d) => String(parseInt(d, 10)));
  if (lang === 'hi') {
    const shelf = shelfRaw.replace(/[A-Za-z]/g, (c) => ' ' + (LETTERS[c.toUpperCase()] ?? c) + ' ').replace(/-/g, ', ');
    return p.quantity_available
      ? `${p.name}. स्टॉक में ${p.quantity_available} पीस उपलब्ध हैं। शेल्फ लोकेशन, ${shelf}।`
      : `${p.name}. यह पार्ट अभी स्टॉक में नहीं है। शेल्फ लोकेशन, ${shelf}।`;
  }
  const shelf = shelfRaw.replace(/-/g, ', ').replace(/([A-Za-z])(\d)/g, '$1 $2');
  return `${p.name} ${p.quantity_available ? `has ${p.quantity_available} in stock` : 'is out of stock'}. Shelf location: ${shelf}.`;
}

/** Text-to-speech. `supported` false = no audio at all; `noVoice` true = device has no voice for that language. */
export function speak(text: string, lang: Lang): { supported: boolean; noVoice: boolean } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return { supported: false, noVoice: false };
  const tag = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const u = new SpeechSynthesisUtterance(text);
  u.lang = tag;
  u.rate = 0.92;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(tag.slice(0, 2)));
  if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return { supported: true, noVoice: !voice };
}
