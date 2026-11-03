// Scheda del vino generata con l'API di Claude (chiave personale, salvata solo sul telefono).
const KEY = 'cantina.apiKey';
export const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setKey = (k) => { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch { /* ignora */ } };

import { offlineProfile } from './kb.js';

const MODEL = 'claude-haiku-5-5';

export async function describeWine({ name, producer, vintage, text: labelText }) {
  const key = getKey();
  if (!key) {
    const p = offlineProfile({ name, producer, vintage, text: labelText });
    if (!p) throw new Error('NOMATCH');
    return p;
  }
  const prompt = `Sei un sommelier. Descrivi questo vino per chi lo sta per bere al ristorante.
Vino: ${name}${producer ? `\nProduttore: ${producer}` : ''}${vintage ? `\nAnnata: ${vintage}` : ''}

Rispondi SOLO con un oggetto JSON, in italiano, con queste chiavi:
- "identita": una frase (denominazione, zona, vitigni principali, stile)
- "vista": colore e aspetto tipici
- "naso": profumi tipici (4-6 descrittori)
- "bocca": struttura, acidità, tannini, corpo, finale
- "abbinamenti": array di 4-6 piatti
- "servizio": temperatura di servizio e se decantare
- "maturita": se l'annata indicata è giovane, in forma o oltre l'apice (una frase; stringa vuota se l'annata manca)
- "confidenza": "alta" se conosci bene questo vino, "media" se descrivi lo stile della denominazione o del vitigno, "bassa" se non lo riconosci

Non inventare dettagli su un'etichetta che non conosci: in quel caso usa confidenza "bassa" e resta generico.`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
  });
  if (r.status === 401 || r.status === 403) throw new Error('BADKEY');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const text = (j.content || []).map((c) => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Risposta non valida');
  return JSON.parse(m[0]);
}

// Legge l'etichetta da una foto con l'IA (richiede la chiave API).
export async function identifyLabelAI(dataUrl) {
  const key = getKey();
  if (!key) throw new Error('NOKEY');
  const data = String(dataUrl).split(',')[1];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 300,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
        { type: 'text', text: 'Questa è l\'etichetta di una bottiglia di vino. Leggi solo ciò che è scritto, senza inventare. Rispondi SOLO con JSON: {"nome": "nome del vino/denominazione", "produttore": "", "annata": "4 cifre o stringa vuota", "tipo": "Rosso|Bianco|Rosé|Spumante|Altro", "denominazione": ""}. Se un campo non è leggibile, usa stringa vuota.' },
      ] }],
    }),
  });
  if (r.status === 401 || r.status === 403) throw new Error('BADKEY');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const m = (j.content || []).map((c) => c.text || '').join('').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Risposta non valida');
  const o = JSON.parse(m[0]);
  if (!o.nome) throw new Error('ILLEGGIBILE');
  return { name: o.nome || '', producer: o.produttore || '', vintage: /^(19|20)\d\d$/.test(o.annata || '') ? o.annata : '', type: ['Rosso', 'Bianco', 'Rosé', 'Spumante', 'Altro'].includes(o.tipo) ? o.tipo : '' };
}
