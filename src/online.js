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

// Il modello può scrivere testo prima/dopo il JSON: provo i possibili oggetti { ... } fino a trovarne uno valido.
function extractJson(txt) {
  const ends = [];
  for (let i = txt.length - 1; i >= 0; i--) if (txt[i] === '}') ends.push(i);
  for (let a = txt.indexOf('{'); a >= 0 && a < txt.length; a = txt.indexOf('{', a + 1)) {
    for (const b of ends) {
      if (b <= a) break;
      try { const o = JSON.parse(txt.slice(a, b + 1)); if (o && typeof o === 'object' && ('note' in o || 'uve' in o || 'zona' in o || 'abbinamenti' in o)) return o; } catch { /* prossimo tentativo */ }
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
      model: MODEL, max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: `Cerca sul web informazioni SPECIFICHE su questa etichetta di vino, non generiche sulla denominazione.
Vino: ${name}${producer ? `\nProduttore: ${producer}` : ''}${vintage ? `\nAnnata: ${vintage}` : ''}

Usa solo ciò che trovi nelle pagine (sito del produttore, enoteche, guide, recensioni). Non inventare: lascia vuoto ciò che non trovi.
Rispondi SOLO con JSON in italiano: {"uve": "vitigni con percentuali se note", "zona": "regione, denominazione", "alcol": "es. 14%", "note": "2-3 frasi con dettagli di questo vino: vinificazione, affinamento, stile, profumi e sapori", "abbinamenti": ["4-5 piatti specifici"], "bere_da": "anno o vuoto", "bere_entro": "anno o vuoto", "prezzo_medio_eur": numero oppure null, "fonti": ["url"]}` }],
    }),
  });
  if (r.status === 401 || r.status === 403) throw new Error('BADKEY');
  if (!r.ok) {
    let m = '';
    try { const e = await r.json(); m = (e && e.error && e.error.message) || ''; } catch { /* nessun dettaglio */ }
    throw new Error(`API ${r.status}${m ? ': ' + m.slice(0, 140) : ''}`);
  }
  const j = await r.json();
  const txt = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('');
  const o = extractJson(txt);
  if (!o) throw new Error('API: la risposta non contiene i dati richiesti');
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
  let warn = '';
  if (getKey()) {
    try { const r = await aiResearch(w); if (r) return r; warn = 'API: nessuna informazione trovata'; }
    catch (e) { if (e.message === 'BADKEY') throw e; warn = String(e.message || 'API: errore'); if (!/^API/.test(warn)) warn = 'API: ' + warn; }
  }
  const r = await wiki(w);
  if (r) return warn ? { ...r, warn } : r;
  if (warn) throw new Error(warn);
  return null;
}

// ---------- foto della bottiglia trovate online ----------
// Restituisce fino a ~10 candidati [{ url, thumb, src }]. L'utente sceglie quella giusta.
const tk = (s) => normName(s).split(' ').filter((t) => t.length >= 3);
export async function searchPhotos({ name, producer, vintage, barcode }) {
  const q = [producer, name].filter(Boolean).join(' ').trim();
  const want = new Set(tk(q));
  const out = [];
  const add = (url, thumb, src) => { if (url && /^https?:/.test(url) && !out.some((o) => o.url === url)) out.push({ url, thumb: thumb || url, src }); };

  // 1) Open Food Facts: per codice a barre, poi per nome
  if (barcode) {
    const d = await getJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=image_front_url,image_front_small_url`);
    const p = d && d.product;
    if (p) add(p.image_front_url, p.image_front_small_url, 'Open Food Facts');
  }
  const off = await getJson(`https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=12&fields=product_name,brands,image_front_url,image_front_small_url&search_terms=${encodeURIComponent(q)}`);
  for (const p of (off && off.products) || []) {
    const hay = new Set(tk(`${p.brands || ''} ${p.product_name || ''}`));
    if ([...want].some((t) => hay.has(t))) add(p.image_front_url, p.image_front_small_url, 'Open Food Facts');
  }

  // 2) Wikimedia Commons
  const cm = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(q + ' bottle')}&prop=imageinfo&iiprop=url&iiurlwidth=500`);
  for (const pg of Object.values((cm && cm.query && cm.query.pages) || {})) {
    const ii = pg.imageinfo && pg.imageinfo[0];
    const hay = new Set(tk(pg.title || ''));
    if (ii && /\.(jpe?g|png|webp)$/i.test(pg.title || '') && [...want].some((t) => hay.has(t))) add(ii.thumburl || ii.url, ii.thumburl, 'Wikimedia Commons');
  }

  // 3) Con la chiave API: ricerca web mirata sulle pagine dei negozi/produttori
  if (getKey() && out.length < 4) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': getKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 2000,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
          messages: [{ role: 'user', content: `Trova URL DIRETTI di foto della bottiglia di questo vino (immagine del prodotto con l'etichetta), da pagine di negozi, enoteche o del produttore. Vino: ${q}${vintage ? ' ' + vintage : ''}.
Usa solo URL di immagini che compaiono realmente nelle pagine (meta og:image o immagine del prodotto), mai inventati. Rispondi SOLO con JSON: {"immagini": ["url1", "url2", "url3"]}` }],
        }),
      });
      if (r.status === 401 || r.status === 403) throw new Error('BADKEY');
      if (r.ok) {
        const j = await r.json();
        const txt = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('');
        const m = txt.match(/\{[\s\S]*\}/);
        const o = m ? JSON.parse(m[0]) : null;
        for (const u of (o && o.immagini) || []) add(String(u), '', 'ricerca web');
      }
    } catch (e) { if (e.message === 'BADKEY') throw e; }
  }
  return out.slice(0, 10);
}
