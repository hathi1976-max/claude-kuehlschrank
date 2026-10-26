import { KATEGORIEN, kategorie, heute, plusTage, tageBis, stufe, restText, sortiere, ergaenzeJahr } from './haltbarkeit.js';
import * as speicher from './speicher.js';

const $ = id => document.getElementById(id);

/* Die Fotoerkennung lädt das Claude-SDK vom CDN. Erst bei Bedarf importieren,
   damit die Liste auch offline und ohne Schlüssel sofort startet. */
let erkennungModul = null;
async function erkennung(){
  if (!erkennungModul) erkennungModul = await import('./erkennung.js');
  return erkennungModul;
}

let artikel = speicher.ladeArtikel();
let bearbeitet = null;      // id des Artikels im Dialog, null = neu
let bonVorschlag = [];      // Zeilen im Kassenbon-Dialog

/* ---------- Liste ---------- */

function zeichne(){
  const liste = $('liste');
  liste.replaceChildren();
  $('leer').hidden = artikel.length > 0;

  let letzteStufe = null;
  const ueberschrift = { rot: 'Jetzt essen', gelb: 'Bald', gruen: 'Hat Zeit' };
  for (const a of sortiere(artikel)){
    const rest = tageBis(a.ablauf);
    const s = stufe(rest);
    if (s !== letzteStufe){
      const g = document.createElement('li');
      g.className = 'gruppe';
      g.textContent = ueberschrift[s];
      liste.append(g);
      letzteStufe = s;
    }
    const li = document.createElement('li');
    li.className = `eintrag ${s}`;
    li.innerHTML = `
      <span class="ic"></span>
      <div class="mitte"><div class="name"></div><div class="rest"></div></div>
      <button class="knopf" data-aktion="gegessen" aria-label="Verbraucht">✅</button>
      <button class="knopf" data-aktion="weg" aria-label="Weggeworfen">🗑️</button>`;
    li.querySelector('.ic').textContent = kategorie(a.kategorie).icon;
    li.querySelector('.name').textContent = a.name;
    li.querySelector('.rest').textContent = restText(rest);
    li.querySelector('.mitte').onclick = () => oeffneArtikel(a);
    li.querySelector('[data-aktion=gegessen]').onclick = () => austragen(a, 'gegessen');
    li.querySelector('[data-aktion=weg]').onclick = () => austragen(a, 'weg');
    liste.append(li);
  }
  zeichneBanner();
}

function zeichneBanner(){
  const dringend = sortiere(artikel).filter(a => tageBis(a.ablauf) <= 0);
  const b = $('banner');
  b.hidden = dringend.length === 0;
  if (!b.hidden) b.textContent = `⚠️ Heute weg: ${dringend.map(a => a.name).join(', ')}`;
}

function speichere(){
  speicher.speichereArtikel(artikel);
  zeichne();
}

function austragen(a, ausgang){
  artikel = artikel.filter(x => x.id !== a.id);
  speicher.bucheAusgang(a, ausgang);
  speichere();
  toast(ausgang === 'gegessen' ? `${a.name} verbraucht 👍` : `${a.name} weggeworfen`, () => {
    artikel.push(a);
    speicher.storniereAusgang(a.id);
    speichere();
  });
}

/* ---------- Eintragen / Bearbeiten ---------- */

function fuelleKategorien(select){
  select.replaceChildren(...KATEGORIEN.map(k => new Option(`${k.icon} ${k.name}`, k.id)));
}

function oeffneArtikel(a = null, vorgabe = {}){
  bearbeitet = a?.id ?? null;
  const daten = a ?? vorgabe;
  $('dlgArtikelTitel').textContent = a ? 'Bearbeiten' : 'Eintragen';
  $('fName').value = daten.name ?? '';
  $('fKategorie').value = daten.kategorie ?? 'sonstiges';
  $('fAblauf').value = daten.ablauf ?? plusTage(heute(), kategorie($('fKategorie').value).tage);
  $('fHinweis').textContent = daten.hinweis ?? '';
  $('fLoeschen').hidden = !a;
  $('dlgArtikel').showModal();
  if (!a && !daten.name) $('fName').focus();
}

$('fKategorie').onchange = () => {
  // Nur bei neuen Einträgen nachziehen – ein gelesenes MHD soll nicht überschrieben werden
  if (bearbeitet === null && !$('fHinweis').textContent)
    $('fAblauf').value = plusTage(heute(), kategorie($('fKategorie').value).tage);
};

for (const b of document.querySelectorAll('.schnell button'))
  b.onclick = () => { $('fAblauf').value = plusTage(heute(), Number(b.dataset.tage)); };

$('formArtikel').onsubmit = () => {
  const werte = { name: $('fName').value.trim(), kategorie: $('fKategorie').value, ablauf: $('fAblauf').value };
  if (!werte.name || !werte.ablauf) return;
  if (bearbeitet){
    artikel = artikel.map(x => x.id === bearbeitet ? { ...x, ...werte } : x);
  } else {
    artikel.push({ id: speicher.neueId(), hinzugefuegt: heute(), ...werte });
  }
  speichere();
};
$('fAbbrechen').onclick = () => $('dlgArtikel').close();
$('fLoeschen').onclick = () => {
  artikel = artikel.filter(x => x.id !== bearbeitet);
  speichere();
  $('dlgArtikel').close();
};

/* ---------- Fotoerkennung ---------- */

async function mitLadeanzeige(text, fn){
  $('ladenText').textContent = text;
  $('laden').hidden = false;
  try { return await fn(); }
  finally { $('laden').hidden = true; }
}

async function brauchtSchluessel(){
  const e = await erkennung();
  if (e.schluessel()) return true;
  toast('Für Fotos zuerst den API-Schlüssel in den Einstellungen eintragen.');
  oeffneEinstellungen();
  return false;
}

$('btnNeu').onclick = () => oeffneArtikel();
$('btnBon').onclick = async () => { if (await brauchtSchluessel()) $('dateiBon').click(); };
$('btnMhd').onclick = async () => { if (await brauchtSchluessel()) $('dateiMhd').click(); };

$('dateiBon').onchange = async ev => {
  const datei = ev.target.files[0];
  ev.target.value = '';
  if (!datei) return;
  try {
    const e = await erkennung();
    const daten = await mitLadeanzeige('Lese Kassenbon…', async () => e.leseBon(await e.bildAlsBase64(datei)));
    zeigeBon(daten);
  } catch (err){ toast(`❌ ${err.message}`); }
};

$('dateiMhd').onchange = async ev => {
  const datei = ev.target.files[0];
  ev.target.value = '';
  if (!datei) return;
  try {
    const e = await erkennung();
    const d = await mitLadeanzeige('Lese Datum…', async () => e.leseMhd(await e.bildAlsBase64(datei)));
    let ablauf = /^\d{4}-\d{2}-\d{2}$/.test(d.datum) ? d.datum : '';
    if (!ablauf && d.tag > 0 && d.monat > 0) ablauf = ergaenzeJahr(d.tag, d.monat);
    oeffneArtikel(null, {
      name: d.name,
      kategorie: d.kategorie,
      ablauf: ablauf || undefined,
      hinweis: ablauf ? '📅 Datum vom Foto gelesen – bitte kurz prüfen.' : 'Kein Datum lesbar – bitte selbst eintragen.',
    });
  } catch (err){ toast(`❌ ${err.message}`); }
};

function zeigeBon(daten){
  const kauf = /^\d{4}-\d{2}-\d{2}$/.test(daten.kaufdatum) && tageBis(daten.kaufdatum) <= 0 && tageBis(daten.kaufdatum) > -30
    ? daten.kaufdatum : heute();
  $('bKaufdatum').value = kauf;
  bonVorschlag = daten.artikel.map(x => ({
    an: x.kuehlschrank,
    name: x.name,
    kategorie: kategorie(x.kategorie).id,
    tage: Math.max(1, x.haltbar_tage || kategorie(x.kategorie).tage),
  }));
  zeichneBon();
  $('dlgBon').showModal();
}

function zeichneBon(){
  const kauf = $('bKaufdatum').value || heute();
  const ul = $('bListe');
  ul.replaceChildren();
  bonVorschlag.forEach((z, i) => {
    const li = document.createElement('li');
    li.className = 'bon-zeile' + (z.an ? '' : ' aus');
    li.innerHTML = `
      <input type="checkbox" />
      <div class="felder">
        <input class="voll" data-f="name" />
        <select data-f="kategorie"></select>
        <input type="date" data-f="ablauf" />
      </div>`;
    const cb = li.querySelector('input[type=checkbox]');
    cb.checked = z.an;
    cb.onchange = () => { z.an = cb.checked; li.classList.toggle('aus', !z.an); zaehleBon(); };
    const name = li.querySelector('[data-f=name]');
    name.value = z.name;
    name.oninput = () => { z.name = name.value; };
    const sel = li.querySelector('[data-f=kategorie]');
    fuelleKategorien(sel);
    sel.value = z.kategorie;
    sel.onchange = () => { z.kategorie = sel.value; };
    const dat = li.querySelector('[data-f=ablauf]');
    dat.value = plusTage(kauf, z.tage);
    dat.onchange = () => { if (dat.value) z.tage = tageBis(dat.value, $('bKaufdatum').value || heute()); };
    ul.append(li);
  });
  zaehleBon();
}

function zaehleBon(){
  const n = bonVorschlag.filter(z => z.an).length;
  $('bUebernehmen').textContent = `${n} übernehmen`;
  $('bUebernehmen').disabled = n === 0;
}

$('bKaufdatum').onchange = zeichneBon;
$('bAbbrechen').onclick = () => $('dlgBon').close();
$('formBon').onsubmit = () => {
  const kauf = $('bKaufdatum').value || heute();
  const neu = bonVorschlag.filter(z => z.an && z.name.trim()).map(z => ({
    id: speicher.neueId(), hinzugefuegt: kauf, name: z.name.trim(), kategorie: z.kategorie, ablauf: plusTage(kauf, z.tage),
  }));
  artikel.push(...neu);
  speichere();
  toast(`${neu.length} Artikel eingetragen`);
};

/* ---------- Einstellungen ---------- */

async function oeffneEinstellungen(){
  const e = await erkennung().catch(() => null);
  $('eSchluessel').value = '';
  $('eSchluesselStatus').textContent = !e ? 'Fotoerkennung gerade nicht ladbar (offline?).'
    : e.schluessel() ? `✅ Schlüssel hinterlegt (…${e.schluessel().slice(-4)})` : 'Kein Schlüssel hinterlegt.';
  const b = speicher.bilanz();
  $('eBilanz').innerHTML = `
    <div>Verbraucht (30 T)<b>${b.gegessen30}</b></div>
    <div>Weggeworfen (30 T)<b>${b.weg30}</b></div>
    <div>Verbraucht gesamt<b>${b.gegessen}</b></div>
    <div>Weggeworfen gesamt<b>${b.weg}</b></div>`;
  $('dlgEinst').showModal();
}

$('btnEinstellungen').onclick = oeffneEinstellungen;
$('eSchluesselSpeichern').onclick = async () => {
  const wert = $('eSchluessel').value.trim();
  if (!wert) return;
  (await erkennung()).setzeSchluessel(wert);
  $('eSchluessel').value = '';
  $('eSchluesselStatus').textContent = `✅ Schlüssel hinterlegt (…${wert.slice(-4)})`;
};
$('eSchluesselLoeschen').onclick = async () => {
  (await erkennung()).setzeSchluessel('');
  $('eSchluesselStatus').textContent = 'Kein Schlüssel hinterlegt.';
};

$('eSichern').onclick = () => {
  const blob = new Blob([JSON.stringify(speicher.sicherung(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `frischfach-${heute()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
$('eEinlesen').onclick = () => $('eDatei').click();
$('eDatei').onchange = async ev => {
  const datei = ev.target.files[0];
  ev.target.value = '';
  if (!datei) return;
  try {
    const n = speicher.einlesen(JSON.parse(await datei.text()));
    artikel = speicher.ladeArtikel();
    zeichne();
    toast(`${n} Artikel ergänzt`);
  } catch { toast('❌ Datei ist keine Frischfach-Sicherung.'); }
};

/* ---------- Kleinkram ---------- */

let toastTimer = null;
function toast(text, rueckgaengig = null){
  const t = $('toast');
  t.replaceChildren(document.createTextNode(text));
  if (rueckgaengig){
    const b = document.createElement('button');
    b.className = 'btn';
    b.style.marginLeft = '10px';
    b.textContent = 'Rückgängig';
    b.onclick = () => { t.hidden = true; rueckgaengig(); };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, rueckgaengig ? 5000 : 3500);
}

fuelleKategorien($('fKategorie'));
zeichne();
// Über Mitternacht offen gelassen: Ampel stimmt sonst bis zum nächsten Antippen nicht
document.addEventListener('visibilitychange', () => { if (!document.hidden) zeichne(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
