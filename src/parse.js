// Dal testo letto dall'etichetta (OCR) a nome, produttore, annata e tipo.
import { findStyle, guessType } from './kb.js';

const JUNK = /alc\.?\s*\d|% ?vol|\b\d+([.,]\d+)?\s?(ml|cl|l)\b|sulfit|solfit|contiene|contains|imbottigliat|bottled|prodotto in|product of|produced|www\.|@|\.com|\.it\b|lotto|\btel\b|\bl\d{2,}|consumare|gravidanza|pregnan|riciclabil|ambiente/i;
const YEAR = /\b(19[5-9]\d|20[0-3]\d)\b/g;
const NOT_VINTAGE = /\best\.?\b|\bsince\b|\bdal\b|fondat|dal\s?\d{4}|\banno\b/i;

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Di|Del|Della|Dei|Delle|D|De|E|Da)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase());
const nz = (x) => ' ' + String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
const tidy = (s) => s.replace(/[|_*~]+/g, ' ').replace(/\s+/g, ' ').trim();

// Accetta il testo semplice oppure il risultato completo di ML Kit (con le altezze delle righe).
export function parseLabel(res) {
  if (typeof res === 'string') res = { text: res, blocks: [] };
  const text = (res && res.text) || '';
  // righe con altezza del carattere (più alto = più in evidenza)
  let lines = [];
  for (const b of (res && res.blocks) || []) for (const l of b.lines || []) {
    const bb = l.boundingBox;
    lines.push({ text: tidy(l.text || ''), h: bb ? Math.abs(bb.bottom - bb.top) : 0 });
  }
  if (!lines.length) lines = text.split('\n').map((t) => ({ text: tidy(t), h: 0 }));
  lines = lines.filter((l) => l.text.length >= 3 && /\p{L}{3,}/u.test(l.text));

  // annata: la prima valida, dando la precedenza alla riga più alta
  const now = new Date().getFullYear();
  let vintage = '', vh = -1;
  for (const l of lines) {
    if (NOT_VINTAGE.test(l.text) || JUNK.test(l.text)) continue;
    for (const m of l.text.matchAll(YEAR)) if (+m[1] <= now && l.h > vh) { vintage = m[1]; vh = l.h; }
  }
  if (!vintage) {
    for (const l of text.split('\n')) {
      if (NOT_VINTAGE.test(l) || JUNK.test(l)) continue;
      const m = [...l.matchAll(YEAR)].find((x) => +x[1] <= now);
      if (m) { vintage = m[1]; break; }
    }
  }

  const cand = lines.filter((l) => !JUNK.test(l.text) && !/^\W*(d\.?o\.?c\.?g?|i\.?g\.?[tp]\.?)\W*$/i.test(l.text));
  cand.sort((a, b) => b.h - a.h);
  const strip = (s) => tidy(s.replace(YEAR, ' '));
  const clean = (s) => { const t = strip(s); return t === t.toUpperCase() ? titleCase(t) : t; };
  const top = cand.map((c) => clean(c.text)).filter((t) => t.length >= 3);
  const style = findStyle(text);
  const PROD = /^(tenut[ae]|cantin[ae]|azienda|fattoria|castello|podere|casa|vigneti|vitivinicol|domaine|ch[âa]teau|weingut|societ|agricola|poderi|marches[ei]|conti\b|conte\b|baron[ei]|princip[ei]|fratelli|f\.lli)/i;
  const prod = top.find((t) => PROD.test(t));
  // senza altezze delle righe, se riconosco la denominazione la riga che la contiene è il nome
  const hasH = lines.some((l) => l.h > 0);
  const inStyle = !hasH && style ? top.find((t) => t !== prod && style.keys.some((k) => nz(t).includes(nz(k)))) : '';
  const name = inStyle || top.find((t) => t !== prod) || '';
  return {
    name, producer: prod || top.find((t) => t !== name) || '', vintage,
    type: guessType(text, style), text, style: style ? style.keys[0] : '',
  };
}
