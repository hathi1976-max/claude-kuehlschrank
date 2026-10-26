/* Ablage im localStorage dieses Geräts.

   kuehl.artikel – was gerade im Kühlschrank liegt
   kuehl.bilanz  – Ausgänge (verbraucht/weggeworfen) mit Datum, für die Bilanz */

import { heute, tageBis } from './haltbarkeit.js';

const ARTIKEL = 'kuehl.artikel';
const BILANZ = 'kuehl.bilanz';

function lies(schluessel){
  try { return JSON.parse(localStorage.getItem(schluessel) || '[]'); } catch { return []; }
}

function schreib(schluessel, wert){
  try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* voll oder gesperrt */ }
}

export function neueId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function ladeArtikel(){
  return lies(ARTIKEL).filter(a => a && a.id && a.name && /^\d{4}-\d{2}-\d{2}$/.test(a.ablauf));
}

export function speichereArtikel(artikel){
  schreib(ARTIKEL, artikel);
}

export function bucheAusgang(a, ausgang){
  const b = lies(BILANZ);
  b.push({ id: a.id, name: a.name, kategorie: a.kategorie, datum: heute(), ausgang });
  schreib(BILANZ, b);
}

export function storniereAusgang(id){
  schreib(BILANZ, lies(BILANZ).filter(x => x.id !== id));
}

export function bilanz(){
  const b = lies(BILANZ);
  const zaehle = (ausgang, tage) => b.filter(x => x.ausgang === ausgang && (tage == null || tageBis(x.datum) > -tage)).length;
  return {
    gegessen: zaehle('gegessen'), weg: zaehle('weg'),
    gegessen30: zaehle('gegessen', 30), weg30: zaehle('weg', 30),
  };
}

export function sicherung(){
  return { app: 'frischfach', stand: heute(), artikel: lies(ARTIKEL), bilanz: lies(BILANZ) };
}

/* Ergänzt statt zu überschreiben: bekannte ids bleiben, wie sie sind. */
export function einlesen(daten){
  if (daten?.app !== 'frischfach' || !Array.isArray(daten.artikel)) throw new Error('keine Sicherung');
  const vorhanden = lies(ARTIKEL);
  const ids = new Set(vorhanden.map(a => a.id));
  const neu = daten.artikel.filter(a => a?.id && !ids.has(a.id));
  schreib(ARTIKEL, [...vorhanden, ...neu]);
  if (Array.isArray(daten.bilanz)){
    const b = lies(BILANZ);
    const schon = new Set(b.map(x => x.id + x.ausgang));
    schreib(BILANZ, [...b, ...daten.bilanz.filter(x => x?.id && !schon.has(x.id + x.ausgang))]);
  }
  return neu.length;
}
