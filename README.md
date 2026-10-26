# 🧊 Frischfach

PWA, die zeigt, was im Kühlschrank bald abläuft – damit nichts mehr hinten vergammelt.

- **Liste nach Ablauf sortiert**, Ampel: rot = heute/morgen/drüber, gelb = 2–3 Tage, grün = hat Zeit.
  Oben ein Hinweis „Heute weg: …".
- **Eintragen von Hand**: Art wählen → Datum wird mit einer typischen Haltbarkeit vorbelegt
  (`js/haltbarkeit.js`), Schnellknöpfe +1 T / +3 T / +1 W / +2 W.
- **🧾 Kassenbon-Foto**: Claude liest alle Posten, löst Bon-Abkürzungen auf, schätzt die Haltbarkeit
  und hakt aus, was nicht in den Kühlschrank gehört. Vor dem Übernehmen alles prüfbar.
- **📅 MHD-Foto**: Claude liest das Datum von der Packung; fehlt das Jahr, wird es ergänzt.
- **✅ verbraucht / 🗑️ weggeworfen** mit Rückgängig; Bilanz in den Einstellungen.
- **Sicherung** als JSON (Einlesen ergänzt, überschreibt nicht).

## Fotoerkennung / API-Schlüssel

Braucht einen eigenen Schlüssel von console.anthropic.com (Prepaid, Ausgabenlimit setzen).
Er wird in den Einstellungen eingetippt und liegt **nur im localStorage des Geräts** – nie im Code
oder Repo. Die Anfrage geht direkt vom Browser an api.anthropic.com (`dangerouslyAllowBrowser`).
Für mehrere Nutzer gehört der Schlüssel hinter einen Vermittler (z. B. Cloudflare Worker).

Modell `claude-opus-5-5` mit `effort: low` und strukturierter JSON-Ausgabe; Server-Fallback
(`fallbacks: "default"`) ist aktiv. Fotos werden vorher auf 1568 px verkleinert.
Kosten grob 1–2 Cent je Kassenbon.

## Entwicklung

- Kein Build, keine Abhängigkeiten außer dem Claude-SDK vom CDN (Version fest in `js/erkennung.js`).
- Tests: `tests/test.html` im Browser öffnen (Datumsrechnung, Sortierung, Jahresergänzung).
- Bei jeder Änderung `VERSION` in `sw.js` und die Anzeige in `index.html` hochzählen,
  sonst serviert der Service Worker alten Stand aus dem Cache.
