import type { Part } from './types';

export interface Query {
  vehicle: string; // manual "Vehicle Name" box
  part: string; // manual "Part Name" box
  any: string; // free text from voice or camera
}

export const emptyQuery: Query = { vehicle: '', part: '', any: '' };
export const isSearching = (q: Query) => Boolean(q.vehicle.trim() || q.part.trim() || q.any.trim());

const STOP = new Set(['for', 'the', 'of', 'a', 'an', 'and', 'my', 'me', 'need', 'want', 'show', 'find', 'part', 'parts']);

// Hindi words -> the English words used in the parts list, so Hindi speech or typing finds parts.
const HI: Record<string, string> = {
  'स्प्लेंडर': 'splendor', 'स्प्लेन्डर': 'splendor', 'एक्टिवा': 'activa', 'पल्सर': 'pulsar', 'शाइन': 'shine', 'क्लासिक': 'classic',
  'अपाचे': 'apache', 'एपाचे': 'apache', 'जुपिटर': 'jupiter', 'एक्सेस': 'access', 'हंटर': 'hunter', 'हिमालयन': 'himalayan',
  'प्लेटिना': 'platina', 'आईक्यूब': 'iqube', 'एथर': 'ather', 'होंडा': 'honda', 'हीरो': 'hero', 'बजाज': 'bajaj', 'टीवीएस': 'tvs',
  'सुजुकी': 'suzuki', 'रॉयल': 'royal', 'एनफील्ड': 'enfield', 'क्लच': 'clutch', 'प्लेट': 'plate', 'ब्रेक': 'brake', 'शू': 'shoe',
  'पैड': 'pad', 'फ्रंट': 'front', 'आगे': 'front', 'रियर': 'rear', 'पीछे': 'rear', 'बेल्ट': 'belt', 'फिल्टर': 'filter',
  'ऑयल': 'oil', 'तेल': 'oil', 'चेन': 'chain', 'शॉक': 'shock', 'स्विच': 'switch', 'केबल': 'cable', 'तार': 'cable',
  'सेंसर': 'sensor', 'बैटरी': 'battery', 'हेडलाइट': 'headlight', 'पिस्टन': 'piston', 'डिस्क': 'disc', 'रोटर': 'rotor',
  'रेडिएटर': 'radiator', 'फ्यूल': 'fuel', 'पंप': 'pump', 'इंजेक्टर': 'injector', 'सस्पेंशन': 'suspension', 'वाल्व': 'valve',
  'स्प्रोकेट': 'sprocket', 'फेंडर': 'fender', 'मडगार्ड': 'fender',
};
const HI_KEYS = Object.keys(HI).sort((a, b) => b.length - a.length);

function deva(s: string): string {
  let out = s.normalize('NFC').replace(/़/g, '');
  for (const k of HI_KEYS) out = out.split(k).join(' ' + HI[k] + ' ');
  return out;
}

const tokens = (s: string) =>
  deva(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));

const vehicleHay = (p: Part) => [p.company, ...p.compatible_models].join(' ').toLowerCase();
const partHay = (p: Part) => [p.name, p.category, p.sku].join(' ').toLowerCase(); // manual Part box: name, type, SKU only
const fullHay = (p: Part) => partHay(p) + ' ' + (p.description ?? '').toLowerCase(); // voice/photo text may also match the description

/** Word match that forgives endings: "brake" also finds "braking", "belts" finds "belt". */
const has = (hay: string, t: string) => {
  if (hay.includes(t)) return true;
  const stem = t.replace(/(ing|es|e|s)$/, '');
  return stem.length >= 4 && stem !== t && hay.includes(stem);
};

/** Every typed word must match (manual boxes). Free text from voice/camera is more forgiving. */
export function searchParts(parts: Part[], q: Query): Part[] {
  const v = tokens(q.vehicle);
  const n = tokens(q.part);
  const a = tokens(q.any);
  if (!v.length && !n.length && !a.length) return parts;

  const scored: { p: Part; score: number }[] = [];
  for (const p of parts) {
    const vh = vehicleHay(p);
    const ph = partHay(p);
    if (!v.every((t) => vh.includes(t))) continue;
    if (!n.every((t) => has(ph, t))) continue;
    let score = 0;
    if (a.length) {
      const all = vh + ' ' + fullHay(p);
      const hit = a.filter((t) => has(all, t)).length;
      if (hit < Math.max(1, Math.ceil(a.length * 0.6))) continue;
      score = hit;
    }
    scored.push({ p, score });
  }
  return scored.sort((x, y) => y.score - x.score || x.p.name.localeCompare(y.p.name)).map((s) => s.p);
}

export const stockState = (p: Part): 'out' | 'low' | 'ok' =>
  p.quantity_available === 0 ? 'out' : p.quantity_available <= p.min_stock ? 'low' : 'ok';
