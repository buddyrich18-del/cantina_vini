// Importa un elenco di testo, una bottiglia per riga:
//   Produttore, Nome del vino 2019 x3          (la virgola separa produttore e vino; l'annata può essere NV)
//   Produttore, Nome del vino NV x2 [1,5L]     (formato facoltativo tra parentesi quadre)
//   ... x1 | uve: ... | zona: ... | note: ... | abbinamenti: a, b | bere: 2025-2035 | prezzo: 35 | alcol: 14% | fonte: url ; url
// Le righe "== Nome ==" indicano la posizione in cantina delle righe che seguono.
// Senza virgola il nome resta intero (vecchio formato). I campi dopo "|" sono facoltativi.
import { findStyle, guessType } from './kb.js';

export const normName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const STOP = new Set(['di', 'del', 'della', 'dei', 'delle', 'd', 'de', 'la', 'il', 'lo', 'le', 'e', 'vino', 'vini', 'cantina', 'azienda', 'agricola']);
const toks = (s) => normName(s).split(' ').filter((t) => t && !STOP.has(t));

// Somiglianza tra due nomi (0-1), sulle parole significative.
export function nameSim(a, b) {
  const A = new Set(toks(a)), B = new Set(toks(b));
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i++;
  return i / (A.size + B.size - i);
}

const TYPES = ['Rosso', 'Bianco', 'Rosé', 'Spumante', 'Altro'];
const typeOf = (v) => {
  const n = normName(v);
  return TYPES.find((t) => normName(t) === n) || (n === 'rosato' ? 'Rosé' : '');
};

export function parseList(text) {
  const items = [], skipped = [];
  let location = '';
  for (const raw of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sec = line.match(/^=+\s*(.+?)\s*=+$/);
    if (sec) { location = sec[1]; continue; }
    const parts = line.split(/\s+\|\s+/);
    const m = parts[0].match(/^(.*?)\s+[x×]\s*(\d+)\s*(?:\[(.*?)\])?\s*$/i);
    if (!m || !+m[2]) { skipped.push(line); continue; }
    let full = m[1].trim(), vintage = '';
    const y = full.match(/^(.*?)\s+((?:19|20)\d\d|NV)$/i);
    if (y) { full = y[1].trim(); vintage = y[2].toUpperCase(); }
    let producer = '', name = full;
    const c = full.indexOf(',');
    if (c > 0) { producer = full.slice(0, c).trim(); name = full.slice(c + 1).trim(); }
    if (!name) { skipped.push(line); continue; }
    const it = { producer, name, vintage, qty: +m[2], size: (m[3] || '').trim(), location, type: '', grapes: '', area: '', notes: '', pairing: '', drinkFrom: '', drinkTo: '', marketPrice: null, abv: '', sources: [] };
    for (const p of parts.slice(1)) {
      const k = p.match(/^([A-Za-zÀ-ÿ]+)\s*:\s*(.*)$/);
      if (!k) continue;
      const key = k[1].toLowerCase(), val = k[2].trim();
      if (!val) continue;
      if (key === 'uve' || key === 'vitigni') it.grapes = val;
      else if (key === 'zona' || key === 'denominazione') it.area = val;
      else if (key === 'note') it.notes = val;
      else if (key === 'abbinamenti') it.pairing = val;
      else if (key === 'alcol') it.abv = val;
      else if (key === 'tipo') it.type = typeOf(val);
      else if (key === 'prezzo') { const n = parseFloat(val.replace(',', '.')); if (!isNaN(n) && n > 0) it.marketPrice = n; }
      else if (key === 'bere') { const r = val.match(/(\d{4})\s*[-–]\s*(\d{4})/); if (r) { it.drinkFrom = r[1]; it.drinkTo = r[2]; } else { const o = val.match(/\d{4}/); if (o) it.drinkTo = o[0]; } }
      else if (key === 'fonte' || key === 'fonti') it.sources = val.split(/\s*;\s*/).filter(Boolean);
    }
    if (!it.type) it.type = guessType(`${producer} ${name}`, findStyle(`${producer} ${name}`)) || 'Altro';
    items.push(it);
  }
  return { items, skipped };
}

// Elenco in JSON: { "bottiglie": [ { produttore, vino, annata, qta, formato, posizione, tipo, uve, zona, alcol, note,
//   abbinamenti[], bere_da, bere_entro, prezzo_eur, foto_url, fonti[] } ] }  (oppure direttamente l'array)
export function parseJsonList(d) {
  const arr = Array.isArray(d) ? d : Array.isArray(d && d.bottiglie) ? d.bottiglie : null;
  if (!arr) return null;
  const items = [], skipped = [];
  const s = (v) => (v == null ? '' : String(v).trim());
  for (const o of arr) {
    const name = s(o.vino || o.nome), producer = s(o.produttore);
    const qty = parseInt(o.qta ?? o.quantita ?? 1, 10);
    if (!name || !(qty > 0)) { skipped.push(JSON.stringify(o).slice(0, 60)); continue; }
    const vintage = s(o.annata).toUpperCase();
    const tipo = typeOf(o.tipo);
    const price = parseFloat(String(o.prezzo_eur ?? '').replace(',', '.'));
    items.push({
      producer, name, vintage: /^((19|20)\d\d|NV)$/.test(vintage) ? vintage : '', qty, size: s(o.formato).replace(/^\[|\]$/g, ''), location: s(o.posizione),
      type: tipo || guessType(`${producer} ${name}`, findStyle(`${producer} ${name}`)) || 'Altro',
      grapes: s(o.uve), area: s(o.zona), notes: s(o.note), abv: s(o.alcol),
      pairing: Array.isArray(o.abbinamenti) ? o.abbinamenti.join(', ') : s(o.abbinamenti),
      drinkFrom: s(o.bere_da), drinkTo: s(o.bere_entro), marketPrice: price > 0 ? price : null,
      sources: Array.isArray(o.fonti) ? o.fonti.filter(Boolean).map(String) : [], photoUrl: s(o.foto_url),
    });
  }
  return { items, skipped };
}
