/* Fotoerkennung über Claude: Kassenbon → Artikelliste, Packung → MHD.

   Der API-Schlüssel liegt nur im localStorage dieses Geräts und geht direkt an
   api.anthropic.com – kein eigener Server dazwischen. Das ist für eine App mit
   einem Nutzer vertretbar; für mehrere Nutzer gehört der Schlüssel hinter einen
   Vermittler (z. B. Cloudflare Worker), sonst müsste ihn jeder bekommen. */

import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.132.1/+esm';
import { KATEGORIEN } from './haltbarkeit.js';

const MODELL = 'claude-opus-5-5';
const SCHLUESSEL = 'kuehl.apikey';

export function schluessel(){
  try { return localStorage.getItem(SCHLUESSEL) || ''; } catch { return ''; }
}

export function setzeSchluessel(wert){
  try {
    if (wert) localStorage.setItem(SCHLUESSEL, wert.trim());
    else localStorage.removeItem(SCHLUESSEL);
  } catch { /* privater Modus – dann eben ohne Fotoerkennung */ }
}

/* Handyfotos haben 12+ Megapixel. Claude rechnet ohnehin auf ~1568 px
   herunter; vorher verkleinern spart Upload und Tokens. */
export async function bildAlsBase64(datei, maxKante = 1568){
  const bild = await createImageBitmap(datei);
  const f = Math.min(1, maxKante / Math.max(bild.width, bild.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bild.width * f);
  c.height = Math.round(bild.height * f);
  c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
  bild.close?.();
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

const BON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kaufdatum', 'artikel'],
  properties: {
    kaufdatum: { type: 'string', description: 'Datum auf dem Bon als YYYY-MM-DD, leer wenn nicht lesbar' },
    artikel: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'kategorie', 'haltbar_tage', 'kuehlschrank'],
        properties: {
          name: { type: 'string', description: 'Verständlicher Name, Abkürzungen aufgelöst (z. B. "Joghurt Natur")' },
          kategorie: { type: 'string', enum: KATEGORIEN.map(k => k.id) },
          haltbar_tage: { type: 'integer', description: 'Typische Haltbarkeit im Kühlschrank ab Kauf in Tagen' },
          kuehlschrank: { type: 'boolean', description: 'true, wenn das typischerweise in den Kühlschrank kommt' },
        },
      },
    },
  },
};

const MHD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'kategorie', 'datum', 'tag', 'monat'],
  properties: {
    name: { type: 'string', description: 'Produktname, leer wenn nicht erkennbar' },
    kategorie: { type: 'string', enum: KATEGORIEN.map(k => k.id) },
    datum: { type: 'string', description: 'MHD/Verbrauchsdatum als YYYY-MM-DD, wenn mit Jahr lesbar, sonst leer' },
    tag: { type: 'integer', description: 'Tag des Datums, 0 wenn nicht lesbar' },
    monat: { type: 'integer', description: 'Monat des Datums, 0 wenn nicht lesbar' },
  },
};

async function frage(base64, anweisung, schema){
  const apiKey = schluessel();
  if (!apiKey) throw new Error('Kein API-Schlüssel hinterlegt (Einstellungen).');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let antwort;
  try {
    antwort = await client.beta.messages.create({
      model: MODELL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: anweisung },
        ],
      }],
    });
  } catch (e){
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API-Schlüssel ungültig.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Zu viele Anfragen – kurz warten.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Keine Verbindung zu Claude.');
    if (e instanceof Anthropic.APIError) throw new Error(`Claude meldet Fehler ${e.status ?? ''}: ${e.message}`);
    throw e;
  }

  if (antwort.stop_reason === 'refusal') throw new Error('Claude hat das Bild nicht ausgewertet.');
  if (antwort.stop_reason === 'max_tokens') throw new Error('Antwort abgeschnitten – Bon in zwei Fotos teilen.');
  const text = antwort.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Leere Antwort.');
  return JSON.parse(text);
}

export async function leseBon(base64){
  return frage(base64,
    'Das ist ein deutscher Supermarkt-Kassenbon. Liste alle gekauften Artikel auf ' +
    '(Pfand, Rabatte, Tüten und Summenzeilen weglassen; Mengenzeilen wie "2 x" zum Artikel zählen, ' +
    'nicht doppelt). Löse Bon-Abkürzungen in verständliche Namen auf. ' +
    'Schätze für Lebensmittel die übliche Haltbarkeit im Kühlschrank ab Kauf; ' +
    'für Dinge, die nicht in den Kühlschrank gehören (Nudeln, Konserven, Drogerie), setze kuehlschrank=false.',
    BON_SCHEMA);
}

export async function leseMhd(base64){
  return frage(base64,
    'Auf dem Foto ist eine Lebensmittelpackung. Lies das Mindesthaltbarkeits- oder Verbrauchsdatum ' +
    '(oft "mindestens haltbar bis", "zu verbrauchen bis" oder nur eine Ziffernfolge wie 12.11.26). ' +
    'Gib nur ein Datum an, das du wirklich lesen kannst – nicht raten.',
    MHD_SCHEMA);
}
