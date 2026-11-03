// Ricerca dati bottiglia da codice a barre (fonti aperte, nessuna chiave API).
const OFF = 'https://world.openfoodfacts.org/api/v2/product/';
const PRICES = 'https://prices.openfoodfacts.org/api/v1/prices';
const UPC = 'https://api.upcitemdb.com/prod/trial/lookup?upc=';

async function getJson(url, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

// Anagrafica: Open Food Facts, poi UPCitemdb come ripiego.
export async function lookupProduct(code) {
  const j = await getJson(`${OFF}${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,image_front_url,categories_tags`);
  const p = j && j.status === 1 ? j.product : null;
  if (p && (p.product_name || p.brands)) {
    return {
      name: p.product_name || '', producer: (p.brands || '').split(',')[0].trim(),
      photoUrl: p.image_front_url || '', source: 'Open Food Facts',
    };
  }
  const u = await getJson(UPC + encodeURIComponent(code));
  const it = u && u.items && u.items[0];
  if (it && it.title) {
    return { name: it.title, producer: it.brand || '', photoUrl: (it.images && it.images[0]) || '', source: 'UPCitemdb' };
  }
  return null;
}

// Prezzo medio: media delle rilevazioni in EUR (non in sconto) di Open Prices.
export async function marketPrice(code) {
  const j = await getJson(`${PRICES}?product_code=${encodeURIComponent(code)}&size=50&order_by=-date`);
  const items = (j && j.items) || [];
  const v = items
    .filter((x) => x.currency === 'EUR' && typeof x.price === 'number' && x.price > 0 && !x.price_is_discounted)
    .map((x) => x.price)
    .sort((a, b) => a - b);
  if (!v.length) return null;
  // scarta gli estremi se ci sono abbastanza dati
  const cut = v.length >= 6 ? Math.floor(v.length * 0.1) : 0;
  const core = v.slice(cut, v.length - cut);
  const avg = core.reduce((s, x) => s + x, 0) / core.length;
  return { price: Math.round(avg * 100) / 100, n: v.length };
}

// Scarica la foto remota e la salva come data URL (resta disponibile offline).
export async function fetchImageAsDataUrl(url) {
  if (!url) return '';
  try {
    const r = await fetch(url);
    if (!r.ok) return '';
    const b = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => res('');
      fr.readAsDataURL(b);
    });
  } catch { return ''; }
}
