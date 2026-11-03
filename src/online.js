// Informazioni sul vino trovate online.
//  - Con chiave API di Claude: ricerca web mirata su quell'etichetta (uve, zona, note, abbinamenti, finestra di consumo, prezzo, fonti)
//  - Senza chiave: Wikipedia (gratis), a livello di denominazione o vitigno
import { getKey } from './ai.js';
import { findStyle } from './kb.js';
import { normName } from './importer.js';

const MODEL = 'claude-haiku-5-5';

async function getJson(url, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

const firstSentences = (s, max = 380) => {
  const parts = String(s).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(\s|$)/g) || [String(s)];
  let out = '';
  for (const p of parts) { if ((out + p).length > max && out) break; out += p; }
  return out.trim();
};

// Wikipedia in italiano: pagina della denominazione o del vitigno.
async function wiki({ name, producer }) {
  const style = findStyle(`${producer} ${name}`);
  const key = style ? style.keys[0] : '';
  const queries = [];
  if (key) queries.push(`${key} vino`);
  if (producer) queries.push(`${producer} cantina vino`);
  const want = new Set(normName(`${key} ${producer} ${name}`).split(' ').filter((t) => t.length >= 4));
  for (const q of queries) {
    const s = await getJson(`https://it.wikipedia.org/w/api.php?action=opensearch&limit=4&namespace=0&format=json&origin=*&search=${encodeURIComponent(q)}`);
    for (const title of (s && s[1]) || []) {
      if (![...normName(title).split(' ')].some((t) => want.has(t))) continue;
      const d = await getJson(`https://it.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (!d || !d.extract || !/vin|uva|vitign|cantina|vitivinic|DOC/i.test(d.extract)) continue;
      return {
        area: key ? title.replace(/\s*\(.*\)$/, '') : '',
        notes: firstSentences(d.extract),
        sources: [(d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page) || `https://it.wikipedia.org/wiki/${encodeURIComponent(title)}`],
        via: 'Wikipedia',
      };
    }
  }
  return null;
}

// Ricerca web con Claude (richiede la chiave API): usa solo ciò che trova nelle pagine.
async function aiResearch({ name, producer, vintage }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': getKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: `Cerca sul web informazioni SPECIFICHE su questa etichetta di vino, non generiche sulla denominazione.
Vino: ${name}${producer ? `\nProduttore: ${producer}` : ''}${vintage ? `\nAnnata: ${vintage}` : ''}

Usa solo ciò che trovi nelle pagine (sito del produttore, enoteche, guide, recensioni). Non inventare: lascia vuoto ciò che non trovi.
Rispondi SOLO con JSON in italiano: {"uve": "vitigni con percentuali se note", "zona": "regione, denominazione", "alcol": "es. 14%", "note": "2-3 frasi con dettagli di questo vino: vinificazione, affinamento, stile, profumi e sapori", "abbinamenti": ["4-5 piatti specifici"], "bere_da": "anno o vuoto", "bere_entro": "anno o vuoto", "prezzo_medio_eur": numero oppure null, "fonti": ["url"]}` }],
    }),
  });
  if (r.status === 401 || r.status === 403) throw new Error('BADKEY');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const txt = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const o = JSON.parse(m[0]);
  const yr = (v) => (/^(19|20)\d\d$/.test(String(v || '').trim()) ? String(v).trim() : '');
  const cites = (j.content || []).flatMap((c) => (c.citations || []).map((x) => x.url)).filter(Boolean);
  const sources = [...new Set([...(Array.isArray(o.fonti) ? o.fonti : []), ...cites])].slice(0, 4);
  const price = typeof o.prezzo_medio_eur === 'number' && o.prezzo_medio_eur > 0 ? o.prezzo_medio_eur : null;
  const out = {
    grapes: o.uve || '', area: o.zona || '', abv: o.alcol || '', notes: o.note || '',
    pairing: Array.isArray(o.abbinamenti) ? o.abbinamenti.join(', ') : '', drinkFrom: yr(o.bere_da), drinkTo: yr(o.bere_entro),
    marketPrice: price, sources, via: 'ricerca web',
  };
  return out.notes || out.grapes || out.pairing ? out : null;
}

// Restituisce i campi trovati oppure null.
export async function lookupOnline(w) {
  if (getKey()) {
    try { const r = await aiResearch(w); if (r) return r; } catch (e) { if (e.message === 'BADKEY') throw e; }
  }
  return wiki(w);
}
