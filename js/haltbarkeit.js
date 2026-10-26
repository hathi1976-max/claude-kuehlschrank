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

/* ---------- Gesprochenes ohne Claude zerlegen ----------

   Rückfall, wenn kein API-Schlüssel da ist: nach Komma/„und" trennen, die Art
   über Stichwörter raten. Reihenfolge zählt – „Hackfleisch" muss vor „fleisch"
   greifen, „Reste vom Gulasch" vor allem anderen. */

const STICHWORTE = [
  ['reste',    ['rest', 'gulasch', 'suppe', 'eintopf', 'soße', 'sosse', 'gekocht', 'auflauf', 'lasagne', 'pizza']],
  ['hack',     ['hack']],
  ['wurst',    ['wurst', 'schinken', 'salami', 'aufschnitt', 'speck', 'würstchen', 'leberkäse']],
  ['fleisch',  ['fleisch', 'hähnchen', 'huhn', 'pute', 'steak', 'schnitzel', 'fisch', 'lachs', 'forelle', 'garnelen', 'filet']],
  ['joghurt',  ['joghurt', 'quark', 'skyr', 'pudding', 'sahne', 'schmand', 'crème fraîche', 'creme fraiche']],
  ['kaese',    ['käse', 'gouda', 'feta', 'mozzarella', 'camembert', 'brie', 'parmesan', 'emmentaler', 'frischkäse']],
  ['milch',    ['milch', 'buttermilch', 'kefir']],
  ['salat',    ['salat', 'kräuter', 'rucola', 'spinat', 'petersilie', 'schnittlauch', 'basilikum']],
  ['obst',     ['apfel', 'äpfel', 'birne', 'banane', 'beere', 'traube', 'kiwi', 'pfirsich', 'melone', 'obst', 'zitrone']],
  ['gemuese',  ['gemüse', 'paprika', 'gurke', 'tomate', 'möhre', 'karotte', 'zucchini', 'brokkoli', 'pilz', 'champignon', 'lauch', 'kohl', 'spargel', 'aubergine']],
  ['getraenk', ['saft', 'smoothie', 'limo', 'getränk']],
];

export function rateKategorie(name){
  const n = name.toLowerCase();
  if (/(^|\s)eier?(\s|$)/.test(n)) return 'eier';
  for (const [id, woerter] of STICHWORTE) if (woerter.some(w => n.includes(w))) return id;
  return 'sonstiges';
}

const ZAHLWORTE = { zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10 };

/* „Milch, zwei Joghurt und Reste vom Gulasch von gestern" →
   [{name:'Milch'}, {name:'Joghurt (2)'}, {name:'Reste vom Gulasch', vorTagen:1}] */
export function zerlegeSprache(text){
  return text
    .split(/,|;|\n|\s+und\s+|\s+sowie\s+/i)
    .map(teil => {
      let t = teil.trim().replace(/[.!?]+$/, '');
      let vorTagen = 0;
      const alt = t.match(/\s*(?:von|seit)\s+(vorgestern|gestern)$/i);
      if (alt){ vorTagen = alt[1].toLowerCase() === 'vorgestern' ? 2 : 1; t = t.slice(0, alt.index); }
      t = t.replace(/^(?:noch\s+)?(?:ein|eine|einen|einmal|der|die|das|den)\s+/i, '');
      let menge = 0;
      const zahl = t.match(/^(\d+)\s*(?:x\s+)?|^(zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+/i);
      if (zahl){ menge = zahl[1] ? Number(zahl[1]) : ZAHLWORTE[zahl[2].toLowerCase()]; t = t.slice(zahl[0].length); }
      t = t.trim();
      if (!t) return null;
      t = t[0].toUpperCase() + t.slice(1);
      const name = menge > 1 ? `${t} (${menge})` : t;
      return { name, kategorie: rateKategorie(t), vorTagen };
    })
    .filter(Boolean);
}

/* Erkannte Datumsangaben sind oft unvollständig („12.11." ohne Jahr). Liegt
   das Datum dann mehr als zwei Monate zurück, ist das nächste Jahr gemeint. */
export function ergaenzeJahr(tag, monat, bezug = heute()){
  const [j] = bezug.split('-').map(Number);
  const kandidat = isoDatum(new Date(j, monat - 1, tag));
  return tageBis(kandidat, bezug) < -60 ? isoDatum(new Date(j + 1, monat - 1, tag)) : kandidat;
}
