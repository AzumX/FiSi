# AP1-Trainer FISI

Private Lern-App für die Abschlussprüfung Teil 1 (Fachinformatiker/in Systemintegration).
Läuft im Browser am PC und auf Android, offline-fähig, alle Daten bleiben im Browser des Geräts.

## Technik

- Eine einzige Seite (`dist/index.html`) mit HTML, CSS und JavaScript, ohne Framework und ohne Build-Werkzeuge außer `tools/build.sh`.
- Speicher: IndexedDB im Browser. Kein Server, kein Konto, keine Cloud.
- Offline: Service Worker (`sw.js`) und Manifest, damit sich die App auf Android installieren lässt („Zum Startbildschirm hinzufügen“).
- Wiederholungsplanung: FSRS-4.5 mit Standardparametern. Abstände werden nie über den Prüfungstermin hinaus geplant.
- Abgleich PC ↔ Handy: Export als JSON-Datei, Import auf dem anderen Gerät führt zusammen (pro Karte gewinnt der neuere Lernstand, Bewertungen werden vereinigt).

## Funktionen

- **Lernen**: fällige Wiederholungen plus neue Karten pro Tag, Filter nach Lernfeld und Stapel, freies Üben, „schwächste Karten“.
- **Kartentypen**: Karteikarte, Multiple Choice (automatisch geprüft), Rechenaufgabe (Ergebnis mit Toleranz geprüft), offene Aufgabe (Selbstbewertung).
- **Prüfungssimulation**: Timer (Standard 90 min), Punkte, Auswertung mit IHK-Notenschlüssel, Verlauf.
- **Statistik**: Lernen pro Tag, Prognose fälliger Karten, Fortschritt und Fehlerquote je Lernfeld, schwierigste Karten.
- **Karten-Editor** mit Bildern, Tabellen und Code-Blöcken.

## Bauen und starten

```
./tools/build.sh          # erzeugt dist/
python3 -m http.server -d dist 8080   # lokal testen: http://localhost:8080
```

Zum Installieren auf dem Handy muss `dist/` über HTTPS erreichbar sein (siehe HOSTING.md).
Die App-Dateien enthalten keine Karteninhalte außer 20 selbst geschriebenen Beispielkarten.
Die u-form-Karten werden nur lokal importiert und landen nie im Repository.

Kartenformat: siehe [KARTENFORMAT.md](KARTENFORMAT.md). Scannen: siehe [SCANNEN.md](SCANNEN.md).
