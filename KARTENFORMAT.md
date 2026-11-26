# Kartenformat

Importiert wird eine JSON-Datei (Liste von Karten) oder eine CSV-Datei mit Kopfzeile, in der App unter **Daten → Karten und Prüfungsaufgaben importieren**.

**Karteninhalte gehören nicht in dieses Repository.** Die u-form-Karten und IHK-Prüfungen sind urheberrechtlich geschützt und werden nur als private Importdatei weitergegeben.
Gleiche `id` überschreibt die Karte, der Lernstand bleibt erhalten.

## Felder

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | eindeutig. Schema: `uf-001` (u-form Karte 1), `ub-001` (eigene Übung), `ap1-w26-1.2` (AP1 Winter 2026/27, Aufgabe 1.2), `ap2-w26-2.1.5` bzw. `ap2-w26-nw-1.1.4` (AP2-Teile) |
| `deck` | nein | Stapel, z. B. `u-form`, `Übung`, `AP1 Winter 2026/27` oder `AP2 Winter 2026/27 · Netzwerke (FISI)`. Eine Prüfung = ein Stapel |
| `lf` | nein | Lernfeld 1–12, 0 = ohne. LF 1–6 = AP1, LF 7–12 = AP2. Karten ab LF 7 kommen nicht in die täglichen neuen Karten, nur bei gezielter Auswahl |
| `topic` | nein | Thema, z. B. `Subnetting` |
| `type` | nein | `basic` (Standard), `mc`, `calc`, `open`, `order`, `table` |
| `front` | ja | Frage / Vorderseite |
| `back` | nein | Antwort, Lösungsweg |
| `options` | bei `mc` | `[{"text": "...", "correct": true}, ...]` oder in CSV `*richtig|falsch|falsch` |
| `items` | bei `order` | Schritte in der **richtigen** Reihenfolge als Liste, die App mischt sie (CSV: `Schritt 1|Schritt 2|…` in der Spalte optionen) |
| `table`, `blanks` | bei `table` | **Lückentabelle**: `table` ist die vollständige Lösungstabelle in Markdown (erste Zeile = Kopfzeile). `blanks` nennt die Felder zum Ausfüllen als `"Zeile,Spalte"` (1-basiert, Kopfzeile zählt nicht), z. B. `["1,3", "2,2"]`. Fehlt `blanks`, ist alles außer der ersten Spalte auszufüllen. Optional `accept`: weitere richtige Antworten je Feld, z. B. `{"1,3": ["zwei", "2"]}` |
| `answer`, `unit`, `tolerance` | bei `calc` | Ergebnis als Zahl, Einheit, relative Toleranz (Standard 0.01 = 1 %; bei Geldbeträgen kleiner wählen, z. B. 0.0001) |
| `points` | nein | Punkte in der Prüfungssimulation (Standard: 2, bei `calc`/`open`/`order` 4; bei `order` gibt es Teilpunkte je Schritt an der richtigen Stelle; bei `table` Standard = halbe Anzahl Lücken, Teilpunkte je richtigem Feld) |
| `level` | nein | Schwierigkeit 1–3 (die Punkte ●○○ auf den u-form-Karten) |
| `images`, `backImages` | nein | Bilder als Data-URL; im Text an bestimmter Stelle mit `![](bild:1)` |
| `tags`, `source` | nein | Schlagwörter, Herkunft (z. B. `u-form Nr. 42`). Besondere Tags: `Übungsrunde …` (erscheint als Runde auf der Startseite), `passt zu u-form 48, 157` (verknüpft die Karte mit diesen Lernkarten) |

Text darf leichtes Markdown enthalten: `**fett**`, `_kursiv_`, `` `code` ``, Listen mit `- `, Tabellen mit `| a | b |`, Code-Blöcke mit ```` ``` ````.

## Beispiel JSON

```json
[
  { "id": "uf-001", "deck": "u-form", "lf": 3, "topic": "Subnetting", "type": "basic",
    "front": "Was ist eine Subnetzmaske?", "back": "Trennt Netz- und Hostanteil einer IPv4-Adresse.", "source": "u-form Nr. 1" },
  { "id": "ap1-2024f-3a", "deck": "AP1 Frühjahr 2024", "lf": 2, "type": "calc", "points": 4,
    "front": "Berechnen Sie ...", "answer": 171.8, "unit": "s", "tolerance": 0.01, "back": "Lösungsweg ..." }
]
```

## Beispiel CSV (Semikolon)

```
id;lf;thema;typ;frage;antwort;optionen;ergebnis;einheit;punkte;stapel;quelle
uf-002;3;Ports;mc;Welcher Port gehört zu HTTPS?;;*443|80|22;;;;u-form;u-form Nr. 2
uf-003;5;SQL;basic;Was ist ein Primärschlüssel?;Eindeutiges Merkmal eines Datensatzes;;;;;u-form;u-form Nr. 3
```
