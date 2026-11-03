// Importa un elenco di testo, una bottiglia per riga:
//   Nome del vino 2019 x3            (annata o NV, poi x e la quantità)
//   Nome del vino NV x2 [1,5L]       (formato facoltativo tra parentesi quadre)
// Le righe "== Nome ==" indicano la posizione in cantina delle righe che seguono.
import { findStyle, guessType } from './kb.js';

export const normName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function parseList(text) {
  const items = [], skipped = [];
  let location = '';
  for (const raw of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sec = line.match(/^=+\s*(.+?)\s*=+$/);
    if (sec) { location = sec[1]; continue; }
    const m = line.match(/^(.*?)\s+[x×]\s*(\d+)\s*(?:\[(.*?)\])?\s*$/i);
    if (!m || !+m[2]) { skipped.push(line); continue; }
    let name = m[1].trim(), vintage = '';
    const y = name.match(/^(.*?)\s+((?:19|20)\d\d|NV)$/i);
    if (y) { name = y[1].trim(); vintage = y[2].toUpperCase(); }
    if (!name) { skipped.push(line); continue; }
    items.push({ name, vintage, qty: +m[2], size: (m[3] || '').trim(), location, type: guessType(name, findStyle(name)) || 'Altro' });
  }
  return { items, skipped };
}
