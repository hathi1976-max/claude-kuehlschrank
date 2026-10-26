/* Haltbarkeiten und Datumsrechnung – reine Funktionen ohne DOM, damit
   tests/test.html sie direkt prüfen kann.

   Die Tage sind Faustwerte für den Kühlschrank ab Kauf (bzw. ab Öffnen bei
   „offen"). Sie sollen nur das Datumsfeld vorbelegen – wer das MHD auf der
   Packung hat, trägt das ein. */

export const KATEGORIEN = [
  { id: 'fleisch',   name: 'Fleisch/Fisch',   icon: '🥩', tage: 2 },
  { id: 'hack',      name: 'Hackfleisch',     icon: '🍔', tage: 1 },
  { id: 'wurst',     name: 'Wurst/Aufschnitt', icon: '🥓', tage: 5 },
  { id: 'milch',     name: 'Milch',           icon: '🥛', tage: 7 },
  { id: 'joghurt',   name: 'Joghurt/Quark',   icon: '🥣', tage: 10 },
  { id: 'kaese',     name: 'Käse',            icon: '🧀', tage: 14 },
  { id: 'eier',      name: 'Eier',            icon: '🥚', tage: 21 },
  { id: 'gemuese',   name: 'Gemüse',          icon: '🥦', tage: 6 },
  { id: 'salat',     name: 'Salat/Kräuter',   icon: '🥬', tage: 3 },
  { id: 'obst',      name: 'Obst',            icon: '🍎', tage: 7 },
  { id: 'reste',     name: 'Reste/Gekochtes', icon: '🍲', tage: 3 },
  { id: 'getraenk',  name: 'Getränke/Säfte',  icon: '🧃', tage: 10 },
  { id: 'sonstiges', name: 'Sonstiges',       icon: '📦', tage: 7 },
];

const NACH_ID = Object.fromEntries(KATEGORIEN.map(k => [k.id, k]));

export function kategorie(id){
  return NACH_ID[id] || NACH_ID.sonstiges;
}

/* Datum als 'YYYY-MM-DD' in Ortszeit. toISOString() wäre UTC und springt
   abends nach 23 Uhr (Sommerzeit: 22 Uhr) auf den nächsten Tag. */
export function isoDatum(d){
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${t}`;
}

export function heute(){
  return isoDatum(new Date());
}

export function plusTage(iso, tage){
  const [j, m, t] = iso.split('-').map(Number);
  return isoDatum(new Date(j, m - 1, t + tage));
}

/* Ganze Kalendertage von `von` bis `bis`. Über Date.UTC, damit die
   Zeitumstellung keinen 23- oder 25-Stunden-Tag ins Ergebnis schmuggelt. */
export function tageBis(bis, von = heute()){
  const utc = s => { const [j, m, t] = s.split('-').map(Number); return Date.UTC(j, m - 1, t); };
  return Math.round((utc(bis) - utc(von)) / 86400000);
}

/* Ampel: rot = heute, morgen oder schon drüber; gelb = in 2–3 Tagen. */
export function stufe(rest){
  if (rest <= 1) return 'rot';
  if (rest <= 3) return 'gelb';
  return 'gruen';
}

export function restText(rest){
  if (rest < -1) return `seit ${-rest} Tagen abgelaufen`;
  if (rest === -1) return 'seit gestern abgelaufen';
  if (rest === 0) return 'heute';
  if (rest === 1) return 'morgen';
  return `in ${rest} Tagen`;
}

/* Was zuerst abläuft, steht oben; bei gleichem Datum alphabetisch. */
export function sortiere(artikel){
  return [...artikel].sort((a, b) =>
    a.ablauf < b.ablauf ? -1 : a.ablauf > b.ablauf ? 1 : a.name.localeCompare(b.name, 'de'));
}

/* Erkannte Datumsangaben sind oft unvollständig („12.11." ohne Jahr). Liegt
   das Datum dann mehr als zwei Monate zurück, ist das nächste Jahr gemeint. */
export function ergaenzeJahr(tag, monat, bezug = heute()){
  const [j] = bezug.split('-').map(Number);
  const kandidat = isoDatum(new Date(j, monat - 1, tag));
  return tageBis(kandidat, bezug) < -60 ? isoDatum(new Date(j + 1, monat - 1, tag)) : kandidat;
}
