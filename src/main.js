import './style.css';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { all, put, del, clear, uid } from './db.js';
import { lookupProduct, marketPrice, fetchImageAsDataUrl } from './api.js';
import { scanBarcode, isNative } from './scanner.js';
import { describeWine, getKey, setKey } from './ai.js';
import { parseList, parseJsonList, normName, nameSim } from './importer.js';
import { lookupOnline } from './online.js';
import { matchCellar, isClear } from './match.js';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { parseLabel, identifyLabel } from './label.js';

const TYPES = ['Rosso', 'Bianco', 'Rosé', 'Spumante', 'Altro'];
const S = { tab: 'cantina', wines: [], moves: [], mode: 'carico', cont: false, q: '', type: '', showEmpty: false, disc: null };
const $app = document.getElementById('app');

// ---------- utilità ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => (n == null || isNaN(n) ? '—' : n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// Bicchiere colorato per tipo: rosso, giallo (bianco), rosa, oro con bollicine (spumante).
const GLASS_COL = { Rosso: '#B3203F', Bianco: '#E6C03A', 'Rosé': '#F08A9E', Spumante: '#EBD27A', Altro: '#9A9093' };
const glass = (type, h = 46) => {
  const c = GLASS_COL[type] || GLASS_COL.Altro;
  const bub = type === 'Spumante' ? '<circle cx="19" cy="24" r="1.3" fill="#fff"/><circle cx="25.5" cy="19" r="1.1" fill="#fff"/><circle cx="22" cy="29" r="1" fill="#fff"/>' : '';
  return `<svg viewBox="0 0 44 64" height="${h}" width="${Math.round(h * 44 / 64)}" aria-hidden="true"><path d="M9 4H35C35 24 30 36 22 36C14 36 9 24 9 4Z" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10.2 16H33.8C33 28 29 35 22 35C15 35 11 28 10.2 16Z" fill="${c}"/>${bub}<path d="M22 36V56M13 59H31" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
};
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

// Prezzo medio pagato (media ponderata dei carichi con prezzo).
function ownAvg(w) {
  let tot = 0, n = 0;
  for (const m of S.moves) if (m.wineId === w.id && m.delta > 0 && m.price != null) { tot += m.price * m.delta; n += m.delta; }
  return n ? tot / n : null;
}
// Prezzo mostrato: media di mercato se disponibile, altrimenti il prezzo medio pagato.
const shownPrice = (w) => (w.marketPrice != null ? w.marketPrice : ownAvg(w));

async function load() {
  [S.wines, S.moves] = await Promise.all([all('wines'), all('moves')]);
}
async function refresh() { await load(); render(); }

// ---------- foto ----------
function resizeFile(file, max = 800) {
  return new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = img.width * k; c.height = img.height * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.7));
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}
async function pickPhoto() {
  if (isNative) {
    try {
      const p = await Camera.getPhoto({
        quality: 65, width: 800, allowEditing: false, resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, promptLabelHeader: 'Foto bottiglia', promptLabelPhoto: 'Dalla galleria',
        promptLabelPicture: 'Scatta foto', promptLabelCancel: 'Annulla',
      });
      return p.dataUrl || '';
    } catch { return ''; }
  }
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*';
    i.onchange = async () => res(i.files[0] ? await resizeFile(i.files[0]) : '');
    i.click();
  });
}


// ---------- foto etichetta ----------
async function labelScan() {
  if (!isNative) { toast('La foto dell’etichetta funziona nell’app Android'); return null; }
  let p;
  try {
    p = await Camera.getPhoto({ quality: 75, width: 1600, correctOrientation: true, resultType: CameraResultType.Uri, source: CameraSource.Camera });
  } catch { return null; }
  toast('Leggo l’etichetta…');
  let photo = '';
  try {
    const blob = await (await fetch(p.webPath)).blob();
    photo = await resizeFile(new File([blob], 'etichetta.jpg', { type: blob.type || 'image/jpeg' }), 1000);
  } catch { /* la foto resta vuota */ }
  let r = null;
  if (getKey() && photo) { try { r = await identifyLabel(photo); } catch { r = null; } }
  if (!r) {
    try { const { text } = await TextRecognition.processImage({ path: p.path }); r = parseLabel(text); }
    catch { r = { name: '', producer: '', vintage: '', type: '', text: '' }; }
  }
  if (!r.name && !r.text) toast('Non riesco a leggere l’etichetta: scrivi il nome a mano');
  return { ...r, photo };
}

// ---------- scheda bottiglia / carico-scarico ----------
// ctx: { wine?, barcode?, fromScan?, mode?, lookup?, prefill?, defaultQty?, autoInfo? }
async function openSheet(ctx) {
  const w = ctx.wine || {};
  const isNew = !ctx.wine;
  const f = {
    photo: w.photo || '', name: w.name || '', producer: w.producer || '', vintage: w.vintage || '',
    type: w.type || 'Rosso', location: w.location || '', rating: w.rating || 0,
    drinkFrom: w.drinkFrom || '', drinkTo: w.drinkTo || '', notes: w.notes || '', pairing: w.pairing || '',
    grapes: w.grapes || '', area: w.area || '', abv: w.abv || '', sources: w.sources || [],
    marketPrice: w.marketPrice ?? null, marketN: w.marketN ?? 0, photoUrl: '',
    qty: ctx.fromScan || isNew || ctx.defaultQty ? '1' : '0', price: '',
  };
  if (ctx.prefill) {
    const p = ctx.prefill;
    f.name = p.name || ''; f.producer = p.producer || ''; f.vintage = p.vintage || '';
    f.photoUrl = p.photoUrl || ''; f.notes = p.notes || ''; f.pairing = p.pairing || '';
    if (p.type && TYPES.includes(p.type)) f.type = p.type;
  }
  let mode = ctx.mode || 'carico';
  const barcode = ctx.barcode || w.barcode || '';
  const vintages = [...new Set(S.wines.filter((x) => x.barcode && x.barcode === barcode).map((x) => x.vintage).filter(Boolean))];

  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  document.body.appendChild(bg);

  // Uscita: tasto ✕, tocco fuori dalla scheda, tasto indietro di Android.
  let closed = false;
  history.pushState({ sheet: true }, '');
  const onPop = () => { if (closed) return; closed = true; bg.remove(); };
  window.addEventListener('popstate', onPop);
  const close = () => {
    if (closed) return;
    closed = true; window.removeEventListener('popstate', onPop); bg.remove();
    if (history.state && history.state.sheet) history.back();
  };
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });

  const draw = () => {
    const hist = ctx.wine ? S.moves.filter((m) => m.wineId === ctx.wine.id).sort((a, b) => b.ts - a.ts).slice(0, 8) : [];
    bg.innerHTML = `<div class="sheet">
      <div class="sheet-head"><span class="sheet-title">${glass(f.type, 30)}<span style="overflow:hidden;text-overflow:ellipsis">${esc(f.name || 'Nuova bottiglia')}</span></span><button id="f-x" type="button" aria-label="Chiudi">✕</button></div>
      <div class="sheet-body">
      <div class="row" style="align-items:flex-start">
        <button class="photo" id="f-photo" style="flex:none;${f.photo || f.photoUrl ? `background-image:url('${esc(f.photo || f.photoUrl)}')` : ''}">${f.photo || f.photoUrl ? '' : '📷<br>Aggiungi foto'}</button>
        <div style="flex:1">
          <label style="margin-top:0">Nome</label><input id="f-name" value="${esc(f.name)}" placeholder="Es. Barolo Cannubi" />
          <label>Produttore</label><input id="f-producer" value="${esc(f.producer)}" />
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn ghost" id="f-web" type="button">🔎 Cerca info online</button>
        ${isNew ? '<button class="btn ghost" id="f-ocr" type="button">📷 Da etichetta</button>' : ''}
      </div>
      ${barcode ? `<div class="note">Codice ${esc(barcode)} · <span id="f-src">${esc(ctx.lookup || '')}</span></div>` : ''}
      <div class="row">
        <div><label>Annata</label><input id="f-vintage" inputmode="numeric" maxlength="4" list="vlist" value="${esc(f.vintage)}" /><datalist id="vlist">${vintages.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></div>
        <div><label>Tipo</label><select id="f-type">${TYPES.map((t) => `<option ${t === f.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
      <label>Posizione in cantina</label><input id="f-location" value="${esc(f.location)}" placeholder="Es. Scaffale 2, fila 3" />

      <h2>Movimento</h2>
      <div class="seg" id="f-mode"><button data-m="carico" class="${mode === 'carico' ? 'on' : ''}">Carico</button><button data-m="scarico" class="${mode === 'scarico' ? 'on' : ''}">Scarico</button></div>
      <div class="row" style="margin-top:10px;align-items:flex-end">
        <div><label>Bottiglie${ctx.wine ? ` (ora ${ctx.wine.qty})` : ''}</label>
          <div class="stepper"><button id="q-minus" type="button">−</button><input id="f-qty" inputmode="numeric" value="${esc(f.qty)}" /><button id="q-plus" type="button">+</button></div></div>
        <div id="price-box" style="${mode === 'carico' ? '' : 'display:none'}"><label>Prezzo pagato (€)</label><input id="f-price" inputmode="decimal" value="${esc(f.price)}" placeholder="${f.marketPrice != null ? String(f.marketPrice).replace('.', ',') : '0,00'}" /></div>
      </div>
      <div class="note" id="f-market">${f.marketPrice != null ? `Prezzo medio indicativo: <b>${eur(f.marketPrice)}</b> (${f.marketN ? f.marketN + ' rilevazioni' : 'stima da fonti online'})` : barcode ? 'Prezzo di mercato non disponibile per questo codice.' : ''}</div>

      <h2>Scheda</h2>
      <label>Uvaggio</label><input id="f-grapes" value="${esc(f.grapes)}" placeholder="Es. Nebbiolo 90%, Vespolina 10%" />
      <div class="row"><div style="flex:2"><label>Zona / denominazione</label><input id="f-area" value="${esc(f.area)}" placeholder="Es. Piemonte, Ghemme DOCG" /></div><div><label>Alcol</label><input id="f-abv" value="${esc(f.abv)}" placeholder="14%" /></div></div>
      <label>Valutazione</label>
      <div class="stars" id="f-stars">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-s="${i}" class="${i <= f.rating ? 'on' : ''}">★</button>`).join('')}</div>
      <div class="row"><div><label>Da bere dal</label><input id="f-from" inputmode="numeric" maxlength="4" value="${esc(f.drinkFrom)}" /></div><div><label>entro il</label><input id="f-to" inputmode="numeric" maxlength="4" value="${esc(f.drinkTo)}" /></div></div>
      <label>Note di degustazione</label><textarea id="f-notes" style="min-height:96px">${esc(f.notes)}</textarea>
      <label>Abbinamenti</label><input id="f-pairing" value="${esc(f.pairing)}" placeholder="Es. brasato, formaggi stagionati" />
      ${f.sources && f.sources.length ? `<div class="note">Fonti: ${f.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(' · ')}</div>` : ''}

      ${hist.length ? `<h2>Ultimi movimenti</h2>${hist.map((m) => `<div class="mv"><span>${new Date(m.ts).toLocaleDateString('it-IT')}</span><span class="${m.delta > 0 ? 'pos' : 'neg'}">${m.delta > 0 ? '+' : ''}${m.delta}${m.price != null ? ' · ' + eur(m.price) : ''}</span></div>`).join('')}` : ''}

      <div style="margin-top:18px" class="row"><button class="btn ghost" id="f-cancel">Annulla</button><button class="btn" id="f-save">${ctx.wine && !ctx.fromScan ? 'Salva' : 'Conferma'}</button></div>
      ${ctx.wine ? '<div style="margin-top:10px"><button class="btn danger" id="f-del">Elimina vino</button></div>' : ''}
    </div></div>`;
    wire();
  };

  const read = () => {
    const v = (id) => (bg.querySelector(id) ? bg.querySelector(id).value : null);
    const set = (k, id, trim = true) => { const x = v(id); if (x !== null) f[k] = trim ? x.trim() : x; };
    set('name', '#f-name'); set('producer', '#f-producer'); set('vintage', '#f-vintage'); set('type', '#f-type', false);
    set('location', '#f-location'); set('drinkFrom', '#f-from'); set('drinkTo', '#f-to'); set('notes', '#f-notes'); set('pairing', '#f-pairing');
    set('grapes', '#f-grapes'); set('area', '#f-area'); set('abv', '#f-abv'); set('qty', '#f-qty'); set('price', '#f-price');
  };

  // Info trovate online (solo nei campi ancora vuoti).
  let webBusy = false;
  async function runWeb(auto) {
    read();
    if (!f.name) { if (!auto) toast('Inserisci prima il nome del vino'); return; }
    if (webBusy) return;
    webBusy = true;
    if (!auto) toast('Cerco online…');
    let r = null;
    try { r = await lookupOnline({ name: f.name, producer: f.producer, vintage: f.vintage }); }
    catch (e) { webBusy = false; if (!auto) toast(e.message === 'BADKEY' ? 'Chiave API non valida' : 'Ricerca non riuscita'); return; }
    webBusy = false;
    if (closed) return;
    if (!r) { if (!auto) toast('Non ho trovato informazioni affidabili'); return; }
    read();
    for (const k of ['grapes', 'area', 'abv', 'notes', 'pairing', 'drinkFrom', 'drinkTo']) if (r[k] && !f[k]) f[k] = r[k];
    if (r.marketPrice != null && f.marketPrice == null) { f.marketPrice = r.marketPrice; f.marketN = 0; }
    f.sources = [...new Set([...(f.sources || []), ...(r.sources || [])])];
    draw();
    toast(`Info trovate (${r.via})`);
  }

  function wire() {
    const q = (s) => bg.querySelector(s);
    q('#f-x').onclick = close;
    q('#f-photo').onclick = async () => { read(); const p = await pickPhoto(); if (p) { f.photo = p; draw(); } };
    q('#f-web').onclick = () => runWeb(false);
    if (q('#f-ocr')) q('#f-ocr').onclick = async () => {
      read();
      const r = await labelScan();
      if (!r || closed) return;
      if (r.photo) f.photo = r.photo;
      if (!f.name && r.name) f.name = r.name;
      if (!f.producer && r.producer) f.producer = r.producer;
      if (!f.vintage && r.vintage) f.vintage = r.vintage;
      if (r.type && TYPES.includes(r.type)) f.type = r.type;
      draw();
      if (f.name) runWeb(true);
    };
    q('#f-mode').onclick = (e) => { const m = e.target.dataset.m; if (m) { read(); mode = m; draw(); } };
    q('#q-minus').onclick = () => { const i = q('#f-qty'); i.value = Math.max(0, (parseInt(i.value) || 0) - 1); };
    q('#q-plus').onclick = () => { const i = q('#f-qty'); i.value = (parseInt(i.value) || 0) + 1; };
    q('#f-stars').onclick = (e) => { const s = +e.target.dataset.s; if (s) { read(); f.rating = f.rating === s ? 0 : s; draw(); } };
    q('#f-cancel').onclick = close;
    if (q('#f-del')) q('#f-del').onclick = async () => {
      if (!confirm('Eliminare questo vino e il suo storico?')) return;
      await del('wines', ctx.wine.id);
      for (const m of S.moves.filter((m) => m.wineId === ctx.wine.id)) await del('moves', m.id);
      close(); await refresh(); toast('Vino eliminato');
    };
    q('#f-save').onclick = async () => {
      read();
      const qty = parseInt(f.qty) || 0;
      const price = num(f.price || '');
      if (!f.name) { toast('Inserisci il nome del vino'); return; }
      // scheda aperta da scansione: la chiave è codice + annata
      let target = ctx.fromScan ? S.wines.find((x) => x.barcode === barcode && (x.vintage || '') === f.vintage) : ctx.wine;
      if (mode === 'scarico' && qty > 0 && (!target || target.qty < qty)) {
        toast(target ? `In cantina ce ne sono solo ${target.qty}` : 'Bottiglia non presente in cantina'); return;
      }
      const now = Date.now();
      if (!target) target = { id: uid(), barcode, qty: 0, createdAt: now };
      Object.assign(target, {
        name: f.name, producer: f.producer, vintage: f.vintage, type: f.type, location: f.location,
        rating: f.rating, drinkFrom: f.drinkFrom, drinkTo: f.drinkTo, notes: f.notes, pairing: f.pairing,
        grapes: f.grapes, area: f.area, abv: f.abv, sources: f.sources || [], updatedAt: now,
      });
      target.photo = f.photo || target.photo || '';
      if (!target.photo && f.photoUrl) target.photo = (await fetchImageAsDataUrl(f.photoUrl)) || f.photoUrl;
      if (f.marketPrice != null) Object.assign(target, { marketPrice: f.marketPrice, marketN: f.marketN, marketAt: now });
      const delta = mode === 'carico' ? qty : -qty;
      target.qty += delta;
      await put('wines', target);
      if (delta) await put('moves', { id: uid(), wineId: target.id, ts: now, delta, price: delta > 0 ? (price ?? target.marketPrice ?? null) : null });
      close(); await refresh();
      if (delta) toast(`${delta > 0 ? 'Caricate' : 'Scaricate'} ${Math.abs(delta)} · ora ${target.qty} in cantina`);
      if (ctx.fromScan && S.cont) setTimeout(doScan, 350);
    };
  }
  draw();

  // Nuova bottiglia da scansione: cerca anagrafica e prezzo di mercato in parallelo.
  if (ctx.fromScan && barcode && (isNew || f.marketPrice == null)) {
    const needInfo = isNew;
    if (needInfo && bg.querySelector('#f-src')) bg.querySelector('#f-src').textContent = 'ricerca in corso…';
    const [info, mp] = await Promise.all([needInfo ? lookupProduct(barcode) : null, marketPrice(barcode)]);
    if (closed) return;
    read();
    if (info) {
      if (!f.name) f.name = info.name;
      if (!f.producer) f.producer = info.producer;
      if (!f.photo) f.photoUrl = info.photoUrl;
    }
    if (mp) { f.marketPrice = mp.price; f.marketN = mp.n; }
    ctx.lookup = needInfo ? (info ? `dati da ${info.source}` : 'non trovata online: inserisci i dati') : '';
    draw();
  }
  if (ctx.autoInfo && f.name) runWeb(true);
}

// ---------- foto etichetta: riconosce prima le bottiglie già in cantina ----------
function pickCandidate(cands) {
  return new Promise((res) => {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet"><div class="sheet-head"><span class="sheet-title">Quale bottiglia?</span><button id="pk-x" type="button" aria-label="Chiudi">✕</button></div><div class="sheet-body">
      ${cands.map((c, i) => `<div class="card" data-i="${i}"><div class="thumb">${glass(c.w.type, 46)}</div><div class="grow"><div class="ttl">${esc(c.w.name)}</div><div class="sub">${esc([c.w.producer, c.w.vintage].filter(Boolean).join(' · '))} · ${c.w.qty} bott.</div></div></div>`).join('')}
      <button class="btn ghost" id="pk-new" style="margin-top:10px" type="button">Nessuna: è una bottiglia nuova</button></div></div>`;
    document.body.appendChild(bg);
    const done = (v) => { bg.remove(); res(v); };
    bg.onclick = (e) => {
      const c = e.target.closest('.card');
      if (c) return done(cands[+c.dataset.i].w);
      if (e.target.id === 'pk-new') return done('new');
      if (e.target === bg || e.target.id === 'pk-x') done(null);
    };
  });
}
async function labelFlow() {
  const r = await labelScan();
  if (!r) return;
  const pool = S.mode === 'scarico' ? S.wines.filter((w) => w.qty > 0) : S.wines;
  const cands = matchCellar(r, pool);
  let owned = null;
  if (isClear(cands)) owned = cands[0].w;
  else if (cands.length) {
    const p = await pickCandidate(cands);
    if (p === null) return;
    if (p !== 'new') owned = p;
  }
  if (owned) return openSheet({ wine: owned, mode: S.mode, defaultQty: true });
  if (S.mode === 'scarico') { toast('Non trovo questa bottiglia in cantina: aprila dall’elenco'); return; }
  openSheet({ mode: 'carico', autoInfo: !!r.name, prefill: { name: r.name, producer: r.producer, vintage: r.vintage, type: r.type, photoUrl: r.photo } });
}

// ---------- scansione ----------
async function handleCode(code) {
  code = String(code).trim();
  if (!code) return;
  const matches = S.wines.filter((w) => w.barcode === code);
  if (!matches.length) {
    if (S.mode === 'scarico') { toast('Bottiglia non presente in cantina'); return; }
    return openSheet({ barcode: code, fromScan: true, mode: 'carico' });
  }
  const pick = S.mode === 'scarico'
    ? matches.filter((w) => w.qty > 0).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    : matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!pick) { toast('Nessuna bottiglia in cantina con questo codice'); return; }
  openSheet({ wine: pick, barcode: code, fromScan: true, mode: S.mode, lookup: 'già in cantina' });
}
async function doScan() {
  if (!isNative) { toast('Lo scanner funziona nell’app Android: qui usa il codice manuale'); return; }
  try {
    const code = await scanBarcode();
    if (code) handleCode(code);
  } catch (e) { toast('Scanner non disponibile: ' + (e.message || e)); }
}

// ---------- viste ----------
function viewCantina() {
  const q = S.q.toLowerCase();
  let list = S.wines.filter((w) => (S.showEmpty || w.qty > 0)
    && (!S.type || w.type === S.type)
    && (!q || [w.name, w.producer, w.vintage, w.location].join(' ').toLowerCase().includes(q)));
  list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it'));
  const bottles = S.wines.reduce((s, w) => s + w.qty, 0);
  return `<h1>La mia cantina <span style="color:var(--mute);font-weight:400;font-size:16px">· ${bottles} bott.</span></h1>
    <button class="btn" id="addman" style="margin-bottom:10px">+ Aggiungi bottiglia a mano</button>
    <input id="q" type="search" placeholder="Cerca nome, produttore, annata, posizione" value="${esc(S.q)}" />
    <div class="chips" id="chips">${['', ...TYPES].map((t) => `<button class="chip ${S.type === t ? 'on' : ''}" data-t="${t}">${t || 'Tutti'}</button>`).join('')}<button class="chip ${S.showEmpty ? 'on' : ''}" data-e="1">Esauriti</button></div>
    ${list.length ? list.map((w) => {
      const p = shownPrice(w);
      const win = w.drinkFrom || w.drinkTo ? ` · ${w.drinkFrom || '…'}–${w.drinkTo || '…'}` : '';
      return `<div class="card" data-id="${w.id}"><div class="thumb" style="${w.photo ? `background-image:url('${esc(w.photo)}')` : ''}">${w.photo ? '' : glass(w.type, 46)}</div>
        <div class="grow"><div class="ttl">${esc(w.name)}</div><div class="sub">${esc([w.producer, w.vintage, w.size].filter(Boolean).join(' · '))}</div>
        <div class="sub">${p != null ? eur(p) : 'prezzo n.d.'}${esc(win)}${w.location ? ' · ' + esc(w.location) : ''}</div></div><div class="qty">${w.qty}</div></div>`;
    }).join('') : `<div class="empty">${S.wines.length ? 'Nessun risultato.' : 'La cantina è vuota.<br>Scansiona una bottiglia o aggiungila a mano.'}</div>`}`;
}
function viewScan() {
  const recent = [...S.moves].sort((a, b) => b.ts - a.ts).slice(0, 5);
  return `<h1>Scansiona</h1>
    <div class="seg" id="mode"><button data-m="carico" class="${S.mode === 'carico' ? 'on' : ''}">Carico</button><button data-m="scarico" class="${S.mode === 'scarico' ? 'on' : ''}">Scarico</button></div>
    <button class="scanbtn" id="scan">${S.mode === 'carico' ? 'Scansiona<br>per caricare' : 'Scansiona<br>per scaricare'}</button>
    <label style="display:flex;gap:10px;align-items:center;font-size:15px;color:var(--ink)"><input type="checkbox" id="cont" style="width:auto" ${S.cont ? 'checked' : ''}/> Scansione continua (riapre lo scanner dopo ogni bottiglia)</label>
    <button class="btn ghost" id="lab2" style="margin-top:8px">Fotografa l’etichetta</button>
    <button class="btn ghost" id="addman2" style="margin-top:8px">Bottiglia senza codice: aggiungi a mano</button>
    <h2>Codice manuale</h2><div class="row"><input id="manual" inputmode="numeric" placeholder="EAN / codice a barre" style="flex:3"/><button class="btn" id="go" style="flex:1">Cerca</button></div>
    ${recent.length ? `<h2>Ultimi movimenti</h2>${recent.map((m) => { const w = S.wines.find((x) => x.id === m.wineId); return `<div class="mv"><span>${esc(w ? w.name : '—')}</span><span class="${m.delta > 0 ? 'pos' : 'neg'}">${m.delta > 0 ? '+' : ''}${m.delta}</span></div>`; }).join('')}` : ''}`;
}

// ---------- scopri: che vino è? ----------
const list = (a) => (Array.isArray(a) ? a : []).map((x) => `<li>${esc(x)}</li>`).join('');
function viewDisc() {
  const d = S.disc;
  const hasKey = !!getKey();
  let out = `<h1>Scopri un vino</h1><div class="note">Scansiona la bottiglia (anche quella del ristorante) per vedere che vino è, cosa dovresti sentire e con cosa abbinarlo.</div>
    <button class="btn" id="d-scan" style="margin:12px 0 8px">Scansiona codice a barre</button>
    <button class="btn ghost" id="d-lab" style="margin-bottom:12px">Fotografa l’etichetta</button>
    <div class="row"><input id="d-code" inputmode="numeric" placeholder="Codice a barre" style="flex:3"/><button class="btn ghost" id="d-go" style="flex:1">Cerca</button></div>
    <div class="row" style="margin-top:10px"><input id="d-nm" placeholder="Oppure nome del vino" style="flex:3" value="${esc(d && !d.code ? d.name : '')}"/><button class="btn ghost" id="d-gn" style="flex:1">Cerca</button></div>`;
  if (!d) return out;
  if (d.loading) return out + `<div class="empty">${esc(d.loading)}</div>`;
  out += `<div class="card" style="margin-top:16px"><div class="thumb" style="${d.photoUrl ? `background-image:url('${esc(d.photoUrl)}')` : ''}">${d.photoUrl ? '' : glass(d.labelType || 'Altro', 46)}</div>
    <div class="grow"><div class="ttl">${esc(d.name || 'Vino non identificato')}</div><div class="sub">${esc(d.producer || '')}</div>
    <div class="sub">${d.code ? 'Codice ' + esc(d.code) + ' · ' : ''}${esc(d.source || '')}${d.mp != null ? ' · ' + eur(d.mp) : ''}</div></div></div>`;
  if (!d.name) out += `<div class="note">Nome non riconosciuto: scrivilo qui sopra e tocca Cerca.</div>`;
  else {
    out += `<div class="row"><div><label>Annata</label><input id="d-vin" inputmode="numeric" maxlength="4" value="${esc(d.vintage || '')}"/></div><div style="align-self:flex-end"><button class="btn" id="d-gen">${d.result ? 'Rigenera' : 'Genera scheda'}</button></div></div>`;
    if (!hasKey) out += `<div class="note">Modalità gratuita: profilo tipico della denominazione o del vitigno, riconosciuto dal nome. Con una chiave API in <b>Altro</b> la scheda diventa più precisa.</div>`;
  }
  if (d.error) out += `<div class="note" style="color:var(--bad)">${esc(d.error)}</div>`;
  const r = d.result;
  if (r) {
    out += `<h2>Che vino è</h2><p style="margin:0">${esc(r.identita)}</p>
      <h2>Cosa dovresti sentire</h2>
      <div class="mv"><span>Vista</span><span style="text-align:right;max-width:70%">${esc(r.vista)}</span></div>
      <div class="mv"><span>Naso</span><span style="text-align:right;max-width:70%">${esc(r.naso)}</span></div>
      <div class="mv"><span>Bocca</span><span style="text-align:right;max-width:70%">${esc(r.bocca)}</span></div>
      <h2>Abbinamenti</h2><ul style="margin:0;padding-left:20px">${list(r.abbinamenti)}</ul>
      <h2>Servizio</h2><p style="margin:0">${esc(r.servizio)}</p>
      ${r.maturita ? `<p class="note">${esc(r.maturita)}</p>` : ''}
      <div class="note">Affidabilità: <b>${esc(r.confidenza || 'n.d.')}</b>. ${r.offline ? 'Profilo tipico della denominazione, non di questa bottiglia' : 'Profilo tipico generato da IA, non una degustazione di questa bottiglia'}: può non coincidere con quanto senti nel calice.</div>
      <div style="margin-top:12px"><button class="btn ghost" id="d-add">Aggiungi alla mia cantina</button></div>`;
  }
  return out;
}
async function discGenerate() {
  const d = S.disc;
  const v = document.getElementById('d-vin');
  if (v) d.vintage = v.value.trim();
  d.error = ''; d.loading = 'Preparo la scheda…'; render();
  try { d.result = await describeWine(d); }
  catch (e) {
    d.result = null;
    d.error = e.message === 'NOMATCH' ? 'Non riconosco denominazione o vitigno dal nome. Prova a scriverlo diverso (es. “Barolo”, “Chianti Classico”, “Vermentino”) oppure aggiungi la chiave API in Altro.' : e.message === 'NOKEY' ? 'Inserisci la chiave API in Altro.' : e.message === 'BADKEY' ? 'Chiave API non valida.' : 'Scheda non disponibile (controlla la connessione).';
  }
  d.loading = ''; render();
}
async function discIdentify(code, nameOnly) {
  const keep = nameOnly && S.disc && S.disc.source === 'dall’etichetta' ? S.disc.photoUrl : '';
  S.disc = { code: nameOnly ? '' : code, name: nameOnly ? code : '', producer: '', vintage: '', photoUrl: keep, loading: 'Cerco il vino…' };
  render();
  const d = S.disc;
  if (nameOnly) { d.loading = ''; d.source = 'inserito a mano'; render(); return discGenerate(); }
  const own = S.wines.find((w) => w.barcode === code);
  if (own) Object.assign(d, { name: own.name, producer: own.producer, vintage: own.vintage, photoUrl: own.photo, source: 'dalla tua cantina', mp: own.marketPrice ?? null });
  const [info, mp] = await Promise.all([own ? null : lookupProduct(code), marketPrice(code)]);
  if (info) Object.assign(d, { name: info.name, producer: info.producer, photoUrl: info.photoUrl, source: info.source });
  if (mp && d.mp == null) d.mp = mp.price;
  d.loading = ''; render();
  if (d.name && getKey()) discGenerate();
}
async function discLabel() {
  const r = await labelScan();
  if (!r) return;
  S.disc = { code: '', name: r.name, producer: r.producer, vintage: r.vintage, photoUrl: r.photo, source: 'dall’etichetta', text: r.text, labelType: r.type };
  render();
  if (r.name || r.text) discGenerate();
}
async function discScan() {
  if (!isNative) { toast('Lo scanner funziona nell’app Android: qui usa il codice manuale'); return; }
  try { const c = await scanBarcode(); if (c) discIdentify(c, false); } catch (e) { toast('Scanner non disponibile: ' + (e.message || e)); }
}

function viewStats() {
  const bottles = S.wines.reduce((s, w) => s + w.qty, 0);
  const value = S.wines.reduce((s, w) => s + w.qty * (shownPrice(w) || 0), 0);
  const spent = S.moves.filter((m) => m.delta > 0 && m.price != null).reduce((s, m) => s + m.delta * m.price, 0);
  const byType = TYPES.map((t) => [t, S.wines.filter((w) => w.type === t).reduce((s, w) => s + w.qty, 0)]).filter((x) => x[1] > 0);
  const max = Math.max(1, ...byType.map((x) => x[1]));
  const top = [...S.wines].filter((w) => w.qty > 0 && shownPrice(w)).sort((a, b) => shownPrice(b) - shownPrice(a)).slice(0, 5);
  const soon = S.wines.filter((w) => w.qty > 0 && w.drinkTo && +w.drinkTo <= new Date().getFullYear() + 1);
  return `<h1>Statistiche</h1>
    <div class="tiles"><div class="tile"><b>${bottles}</b><span>bottiglie</span></div><div class="tile"><b>${S.wines.filter((w) => w.qty > 0).length}</b><span>etichette</span></div>
    <div class="tile"><b>${eur(value)}</b><span>valore stimato</span></div><div class="tile"><b>${eur(spent)}</b><span>speso (con prezzo)</span></div></div>
    ${byType.length ? `<h2>Per tipo</h2>${byType.map(([t, n]) => `<div class="bar"><span style="width:78px">${t}</span><i style="width:${(n / max) * 55}%"></i><span>${n}</span></div>`).join('')}` : ''}
    ${soon.length ? `<h2>Da bere presto</h2>${soon.map((w) => `<div class="mv"><span>${esc(w.name)} ${esc(w.vintage)}</span><span>entro ${esc(w.drinkTo)}</span></div>`).join('')}` : ''}
    ${top.length ? `<h2>Più preziose</h2>${top.map((w) => `<div class="mv"><span>${esc(w.name)} ${esc(w.vintage)}</span><span>${eur(shownPrice(w))}</span></div>`).join('')}` : ''}`;
}
function viewMore() {
  return `<h1>Altro</h1>
    <div class="note">Il valore usa il prezzo medio di mercato (Open Prices) quando esiste, altrimenti la media di quanto hai pagato.</div>
    <div style="display:grid;gap:10px;margin-top:10px">
      <button class="btn" id="updi">🔎 Aggiorna info vini dal web</button>
      <button class="btn ghost" id="upd">Aggiorna prezzi di mercato</button>
      <button class="btn ghost" id="exj">Esporta backup (JSON, con foto)</button>
      <button class="btn ghost" id="exc">Esporta elenco (CSV)</button>
      <button class="btn ghost" id="imt">Importa elenco (TXT o JSON)</button>
      <button class="btn ghost" id="imp">Importa backup JSON</button>
    </div>
    <h2>Scheda sensoriale: chiave API (facoltativa)</h2>
    <div class="note">“Scopri” funziona gratis e offline con profili per denominazione e vitigno. Con una chiave API di Claude (console.anthropic.com) le schede sono più precise; resta solo su questo telefono e ogni scheda costa qualche centesimo.</div>
    <input id="key" type="password" placeholder="sk-ant-…" value="${esc(getKey())}" autocomplete="off"/>
    <div class="row" style="margin-top:8px"><button class="btn ghost" id="keysave">Salva chiave</button><button class="btn danger" id="keydel">Rimuovi</button></div>
    <div class="note" style="margin-top:20px">Dati bottiglia: Open Food Facts · Prezzi: Open Prices · Tutto resta sul telefono.</div>`;
}

function render() {
  const v = { cantina: viewCantina, scan: viewScan, disc: viewDisc, stats: viewStats, more: viewMore }[S.tab]();
  const nav = [['cantina', '🍷', 'Cantina'], ['scan', '▦', 'Scansiona'], ['disc', '🔎', 'Scopri'], ['stats', '📊', 'Statistiche'], ['more', '⋯', 'Altro']];
  $app.innerHTML = v + `<div class="nav">${nav.map(([k, i, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}"><b>${i}</b>${l}</button>`).join('')}</div>`;
  bind();
}

function bind() {
  $app.querySelector('.nav').onclick = (e) => { const b = e.target.closest('button'); if (b) { S.tab = b.dataset.tab; render(); } };
  const $ = (s) => $app.querySelector(s);
  if (S.tab === 'cantina') {
    $('#addman').onclick = () => openSheet({ mode: 'carico' });
    const qi = $('#q');
    qi.oninput = () => { S.q = qi.value; const pos = qi.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#chips').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.e) S.showEmpty = !S.showEmpty; else S.type = b.dataset.t; render(); };
    $app.querySelectorAll('.card').forEach((c) => (c.onclick = () => { const w = S.wines.find((x) => x.id === c.dataset.id); openSheet({ wine: w, mode: 'carico' }); }));
  }
  if (S.tab === 'scan') {
    $('#mode').onclick = (e) => { const m = e.target.dataset.m; if (m) { S.mode = m; render(); } };
    $('#cont').onchange = (e) => { S.cont = e.target.checked; };
    $('#scan').onclick = doScan;
    $('#addman2').onclick = () => openSheet({ mode: 'carico' });
    $('#lab2').onclick = labelFlow;
    const go = () => { const v = $('#manual').value; if (v.trim()) handleCode(v); };
    $('#go').onclick = go;
    $('#manual').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  }
  if (S.tab === 'disc') {
    $('#d-scan').onclick = discScan;
    $('#d-lab').onclick = discLabel;
    $('#d-go').onclick = () => { const v = $('#d-code').value.trim(); if (v) discIdentify(v, false); };
    $('#d-gn').onclick = () => { const v = $('#d-nm').value.trim(); if (v) discIdentify(v, true); };
    if ($('#d-gen')) $('#d-gen').onclick = discGenerate;
    if ($('#d-add')) $('#d-add').onclick = () => {
      const d = S.disc;
      openSheet({ barcode: d.code || '', fromScan: !!d.code, mode: 'carico', lookup: d.source || '',
        wine: undefined, prefill: { name: d.name, producer: d.producer, vintage: d.vintage, photoUrl: d.photoUrl, type: d.labelType, notes: d.result ? `${d.result.naso}. ${d.result.bocca}` : '', pairing: d.result ? (d.result.abbinamenti || []).join(', ') : '' } });
    };
  }
  if (S.tab === 'more') {
    $('#keysave').onclick = () => { setKey($('#key').value); toast('Chiave salvata'); };
    $('#keydel').onclick = () => { setKey(''); render(); toast('Chiave rimossa'); };
    $('#upd').onclick = updateAllPrices;
    $('#updi').onclick = updateAllInfo;
    $('#exj').onclick = exportJson;
    $('#exc').onclick = exportCsv;
    $('#imp').onclick = importJson;
    $('#imt').onclick = importTxt;
  }
}

// Cerca sul web (con chiave API: ricerca mirata; senza: Wikipedia) e completa le schede dei vini in cantina.
async function updateAllInfo() {
  const key = !!getKey();
  const list = S.wines.filter((w) => w.qty > 0 || true);
  if (!list.length) { toast('Nessun vino in cantina'); return; }
  const need = (w) => !w.grapes || !w.area || !w.notes || !w.pairing || w.marketPrice == null;
  const todo = list.filter(need);
  if (!todo.length) { toast('Tutte le schede sono già complete'); return; }
  const msg = key
    ? `Cerco online le info di ${todo.length} vini (ricerca web con la tua chiave API, circa ${(todo.length * 0.02).toFixed(2).replace('.', ',')} $).\nCompilo solo i campi vuoti; ciò che hai scritto non viene toccato.`
    : `Cerco online le info di ${todo.length} vini senza chiave API: uso Wikipedia, quindi solo informazioni generali sulla denominazione o sul vitigno (non sulla singola etichetta). Per dati specifici e prezzi serve la chiave API.\nCompilo solo i campi vuoti.`;
  if (!confirm(msg + '\n\nProcedere?')) return;
  let ok = 0, bad = false;
  for (let i = 0; i < todo.length; i++) {
    const w = todo[i];
    toast(`Info ${i + 1}/${todo.length}: ${w.name}`);
    let r = null;
    try { r = await lookupOnline({ name: w.name, producer: w.producer, vintage: w.vintage }); }
    catch (e) { if (e.message === 'BADKEY') { bad = true; break; } continue; }
    if (!r) continue;
    let changed = false;
    for (const k of ['grapes', 'area', 'abv', 'notes', 'pairing', 'drinkFrom', 'drinkTo']) if (r[k] && !w[k]) { w[k] = r[k]; changed = true; }
    if (r.marketPrice != null && w.marketPrice == null) { w.marketPrice = r.marketPrice; w.marketN = 0; w.marketAt = Date.now(); changed = true; }
    const src = [...new Set([...(w.sources || []), ...(r.sources || [])])];
    if (src.length !== (w.sources || []).length) { w.sources = src; changed = true; }
    if (changed) { w.updatedAt = Date.now(); await put('wines', w); ok++; }
  }
  await refresh();
  toast(bad ? 'Chiave API non valida' : `Schede aggiornate: ${ok} su ${todo.length}`);
}

// ---------- prezzi, backup ----------
async function updateAllPrices() {
  const key = !!getKey();
  const byBarcode = S.wines.filter((w) => w.barcode);
  const byName = key ? S.wines.filter((w) => !w.barcode) : [];
  const list = [...byBarcode, ...byName];
  if (!list.length) { toast(key ? 'Nessun vino in cantina' : 'Nessun vino con codice a barre: per cercare i prezzi dal nome serve la chiave API (Altro)'); return; }
  if (byName.length && !confirm(`Cerco il prezzo online per nome di ${byName.length} vini senza codice a barre.\nCon la chiave API costa circa ${(byName.length * 0.02).toFixed(2).replace('.', ',')} $. Procedere?`)) return;
  let ok = 0;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    toast(`Prezzi ${i + 1}/${list.length}…`);
    let mp = null;
    if (w.barcode) mp = await marketPrice(w.barcode);
    if (!mp && key) {
      try { const r = await lookupOnline({ name: w.name, producer: w.producer, vintage: w.vintage }); if (r && r.marketPrice != null) mp = { price: r.marketPrice, n: 0 }; }
      catch (e) { if (e.message === 'BADKEY') { toast('Chiave API non valida'); break; } }
    }
    if (mp) { Object.assign(w, { marketPrice: mp.price, marketN: mp.n, marketAt: Date.now() }); await put('wines', w); ok++; }
  }
  await refresh(); toast(`Prezzi aggiornati: ${ok} su ${list.length}`);
}
async function saveAndShare(name, text, mime) {
  if (isNative) {
    try {
      const r = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: name, url: r.uri, dialogTitle: 'Salva o condividi' });
    } catch (e) { if (!/cancel/i.test(String(e && e.message))) toast('Esportazione non riuscita'); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
}
const stamp = () => new Date().toISOString().slice(0, 10);
const exportJson = () => saveAndShare(`cantina-${stamp()}.json`, JSON.stringify({ v: 1, wines: S.wines, moves: S.moves }), 'application/json');
function exportCsv() {
  const cols = ['name', 'producer', 'vintage', 'type', 'qty', 'size', 'barcode', 'location', 'grapes', 'area', 'abv', 'marketPrice', 'rating', 'drinkFrom', 'drinkTo', 'pairing', 'notes'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = S.wines.map((w) => cols.map((c) => cell(w[c])).join(';'));
  saveAndShare(`cantina-${stamp()}.csv`, '﻿' + cols.join(';') + '\n' + rows.join('\n'), 'text/csv');
}
function importTxt() {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = '*/*'; // Android non riconosce sempre il tipo .json/.txt: il contenuto lo controllo io
  i.onchange = async () => {
    try {
      const raw = await i.files[0].text();
      let parsed = null;
      if (/^\s*[\[{]/.test(raw)) { try { parsed = parseJsonList(JSON.parse(raw)); } catch { parsed = null; } }
      await importItems(parsed || parseList(raw));
    } catch { toast('File non valido'); }
  };
  i.click();
}
// Foto remota -> miniatura salvata nell'app (resta disponibile offline).
async function remotePhoto(url) {
  try {
    const blob = await (await fetch(url)).blob();
    if (!blob.size || (blob.type && !/^image\//.test(blob.type))) return '';
    return await resizeFile(new File([blob], 'bottiglia.jpg', { type: blob.type || 'image/jpeg' }), 700);
  } catch { return ''; }
}
async function importItems({ items, skipped }) {
  if (!items.length) { toast('Nessuna bottiglia trovata nel file'); return; }
  const full = (x) => `${x.producer || ''} ${x.name}`;
  const findSame = (it) => S.wines.find((w) => String(w.vintage || '') === it.vintage && (w.location || '') === it.location
    && (normName(full(w)) === normName(full(it)) || nameSim(full(w), full(it)) >= 0.75));
  const upd = [], fresh = [];
  for (const it of items) { const ex = findSame(it); if (ex) upd.push([ex, it]); else fresh.push(it); }
  const bottles = fresh.reduce((s, x) => s + x.qty, 0);
  const nph = items.filter((x) => x.photoUrl).length;
  if (!confirm(`Trovate ${items.length} voci.\n${fresh.length} nuove (${bottles} bottiglie).${upd.length ? `\n${upd.length} già presenti: aggiorno i dati, le quantità restano.` : ''}${skipped.length ? `\n${skipped.length} righe non lette.` : ''}${nph ? `\n${nph} foto da scaricare (serve internet).` : ''}\n\nProcedere?`)) return;
  const now = Date.now();
  const fill = (w, it) => {
    w.producer = it.producer || w.producer || ''; w.name = it.name; w.size = it.size || w.size || '';
    if (it.type && (it.type !== 'Altro' || !w.type || w.type === 'Altro')) w.type = it.type;
    for (const k of ['grapes', 'area', 'abv', 'notes', 'pairing', 'drinkFrom', 'drinkTo']) if (it[k]) w[k] = it[k];
    if (it.marketPrice != null) { w.marketPrice = it.marketPrice; w.marketN = 0; w.marketAt = now; }
    if (it.sources.length) w.sources = it.sources;
    w.updatedAt = now;
  };
  let n = 0, ph = 0;
  const photo = async (w, it) => {
    if (!it.photoUrl || w.photo) return;
    const d = await remotePhoto(it.photoUrl);
    if (d) { w.photo = d; ph++; }
  };
  const total = upd.length + fresh.length;
  for (const [w, it] of upd) { toast(`Importo ${++n}/${total}…`); fill(w, it); await photo(w, it); await put('wines', w); }
  for (const it of fresh) {
    toast(`Importo ${++n}/${total}…`);
    const w = { id: uid(), barcode: '', qty: it.qty, location: it.location, photo: '', rating: 0, createdAt: now };
    fill(w, it); await photo(w, it);
    await put('wines', w);
    await put('moves', { id: uid(), wineId: w.id, ts: now, delta: it.qty, price: null });
  }
  await refresh(); toast(`Importate ${fresh.length} nuove, aggiornate ${upd.length}${nph ? ` · foto ${ph}/${nph}` : ''}`);
}
function importJson() {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = '*/*';
  i.onchange = async () => {
    try {
      const d = JSON.parse(await i.files[0].text());
      if (!Array.isArray(d.wines)) { const pj = parseJsonList(d); if (pj) { await importItems(pj); return; } throw new Error(); }
      if (!confirm(`Importare ${d.wines.length} vini? I dati attuali verranno sostituiti.`)) return;
      await clear('wines'); await clear('moves');
      for (const w of d.wines) await put('wines', w);
      for (const m of d.moves || []) await put('moves', m);
      await refresh(); toast('Backup importato');
    } catch { toast('File non valido'); }
  };
  i.click();
}

load().then(render);
