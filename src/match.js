// Confronto approssimato tra il testo letto dall'etichetta (OCR, con errori) e le bottiglie già in cantina.
import { normName } from './importer.js';

const STOP = new Set(['del', 'della', 'dei', 'delle', 'the', 'vino', 'vini', 'cantina', 'azienda', 'agricola', 'rosso', 'bianco', 'brut', 'riserva', 'doc', 'docg', 'igt', 'igp', 'italia', 'italy']);
const toks = (s) => normName(s).split(' ').filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
// L'OCR confonde spesso cifre e lettere (0/o, 1/l, 5/s, 8/b): le riporto a lettere nelle parole miste.
const fixOcr = (t) => (/[a-z]/.test(t) ? t.replace(/0/g, 'o').replace(/1/g, 'l').replace(/5/g, 's').replace(/8/g, 'b') : t);

function lev(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length);

// Restituisce fino a 3 candidati [{ w, score }], dal migliore. score 0-1.
export function matchCellar(ocr, wines) {
  const T = [...new Set(toks(`${ocr.text || ''} ${ocr.producer || ''} ${ocr.name || ''}`).map(fixOcr))];
  if (!T.length) return [];
  const year = ocr.vintage || ((String(ocr.text || '').match(/\b(?:19|20)\d\d\b/) || [])[0]) || '';
  const out = [];
  for (const w of wines) {
    const W = toks(`${w.producer || ''} ${w.name}`);
    if (!W.length) continue;
    let hit = 0, tot = 0;
    for (const t of W) {
      tot += t.length;
      let best = 0;
      for (const o of T) { const s = o === t ? 1 : sim(o, t); if (s > best) best = s; }
      if (best >= (t.length >= 6 ? 0.72 : 0.8)) hit += t.length * best;
    }
    let score = hit / tot;
    if (year && w.vintage && w.vintage !== 'NV') score += String(w.vintage) === String(year) ? 0.1 : -0.12;
    if (score >= 0.5) out.push({ w, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

// Sicuro quando il primo è alto e distanziato dal secondo.
export const isClear = (c) => c.length > 0 && c[0].score >= 0.7 && (c.length === 1 || c[0].score - c[1].score >= 0.12);
