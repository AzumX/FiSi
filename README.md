# AP1/AP2-Trainer FISI

Lern-App für die Abschlussprüfung der **Fachinformatiker/innen Systemintegration**: Teil 1 (AP1) und Teil 2 (AP2).
Sie läuft im Browser am PC und auf dem Handy, funktioniert offline und speichert alles nur auf dem eigenen Gerät.

**App öffnen: https://azumx.github.io/FiSi/**

Was sie kann:

- **Karteikarten mit Wiederholungsplan.** Die App merkt sich, was sitzt, und fragt schwierige Karten öfter ab (FSRS). Geplant wird nur bis zum Prüfungstermin.
- **Echte Prüfungsaufgaben.** Alte AP1- und AP2-Prüfungen sind eigene Stapel, mit Originalpunkten und Lösungsweg. Du kannst sie als ganze Prüfung mit Timer und IHK-Note durchspielen.
- **Automatische Kontrolle.** Rechenaufgaben, Multiple Choice, Reihenfolgen und Lückentabellen (z. B. Subnetze oder ein Netzplan) prüft die App selbst.
- **Übungsrunden** zu einzelnen Themen wie Ports, Befehle, Programmieren oder MQTT.

> Das Repository enthält **nur die App**, keine Karteninhalte. Die Lernkarten (u-form, urheberrechtlich geschützt) und die IHK-Prüfungen werden privat als Datei importiert und liegen nie hier oder auf GitHub Pages.

---

## Inhalt

1. [App aufrufen und installieren](#1-app-aufrufen-und-installieren)
2. [Erste Schritte](#2-erste-schritte)
3. [Täglich lernen](#3-täglich-lernen)
4. [Prüfungen üben (AP1 und AP2)](#4-prüfungen-üben-ap1-und-ap2)
5. [Aufgabentypen und wie sie geprüft werden](#5-aufgabentypen-und-wie-sie-geprüft-werden)
6. [PC und Handy abgleichen](#6-pc-und-handy-abgleichen)
7. [Updates](#7-updates)
8. [Lernfelder](#8-lernfelder)
9. [Probleme und Lösungen](#9-probleme-und-lösungen)
10. [Technik und Entwicklung](#10-technik-und-entwicklung)

---

## 1. App aufrufen und installieren

Die Adresse ist **https://azumx.github.io/FiSi/**. Unter dieser Adresse liegt nur die leere App mit ein paar Beispielkarten. Deine eigenen Karten kommen erst durch den Import dazu (siehe [Erste Schritte](#2-erste-schritte)).

**Android**

| Browser | So installierst du die App |
|---|---|
| Firefox | Seite öffnen → Menü ⋮ → **Installieren** (oder „Zum Startbildschirm hinzufügen“) |
| Chrome | Seite öffnen → Menü ⋮ → **App installieren** |

Danach liegt „AP1-Trainer“ als Symbol auf dem Startbildschirm und öffnet sich ohne Adressleiste wie eine normale App.

**PC (Windows, Linux, Mac)**

- **Chrome oder Edge:** In der Adressleiste rechts auf das Installieren-Symbol klicken. Die App bekommt dann ein eigenes Fenster und einen Eintrag im Startmenü.
- **Firefox:** einfach als Lesezeichen speichern.

**Offline:** Nach dem ersten Öffnen funktioniert die App auch ohne Internet, z. B. in der Bahn.

**Wichtig:** Jeder Browser und jedes Gerät hat seinen **eigenen Speicher**. Karten, die du in Chrome importierst, siehst du nicht in Firefox. Bleib pro Gerät bei einem Browser.

## 2. Erste Schritte

1. **Karten importieren:** Unter **Daten → Karten und Prüfungsaufgaben importieren → Datei wählen** die Datei `alle_karten.json` wählen. Sie enthält alle Lernkarten, Übungen und Prüfungen. Einzelne Stapel lassen sich genauso importieren.
   - Gibt es eine Karte schon, wird sie aktualisiert, **dein Lernstand bleibt erhalten**. Neue Lieferungen kannst du also jederzeit einfach drüber importieren.
   - Die Beispielkarten kannst du danach unter Daten löschen (Stapel „beispiel“).
2. **Einstellungen** unter **Daten → Einstellungen**:
   - **Prüfungstermin:** Die Startseite zählt die Tage herunter, und Wiederholungen werden nie nach diesem Tag geplant.
   - **Neue Karten pro Tag:** Die Startseite zeigt eine Empfehlung, damit bis zur Prüfung alles einmal drankommt.
   - **Ziel-Trefferquote:** 90 % ist ein guter Standard. Höher bedeutet mehr Wiederholungen.

**Dateien aufs Handy bringen:** Am besten über Google Drive, eine private E-Mail, ein USB-Kabel oder einen Messenger. Auf einem Firmenhandy mit Microsoft Intune kommen Dateien aus **Outlook oder Teams verschlüsselt** an und lassen sich nicht importieren. Die App zeigt in dem Fall einen Hinweis.

## 3. Täglich lernen

**Start → Lernen starten.** Du bekommst die fälligen Wiederholungen und dazwischen die neuen Karten des Tages.

1. Frage lesen, selbst antworten (im Kopf, auf Papier oder im Eingabefeld).
2. **Antwort zeigen** oder **Prüfen**.
3. Ehrlich bewerten. Die App plant danach, wann die Karte wiederkommt.

| Taste | Bewertung | Bedeutung |
|---|---|---|
| 1 | Nochmal | nicht gewusst, kommt heute noch mal |
| 2 | Schwer | gewusst, aber mit Mühe |
| 3 | Gut | gewusst |
| 4 | Leicht | sofort und sicher gewusst |

Am PC zeigt die **Leertaste** die Antwort. Bei automatisch geprüften Aufgaben schlägt die App die Bewertung vor (farbig markiert).

**Gezielt lernen** im Reiter **Lernen**:

- **Filter** nach Lernfeld, Stapel, Thema und Kartentyp, z. B. nur LF 3 oder nur Rechenaufgaben
- **Freies Üben:** zufällige Karten aus der Auswahl, ohne den Wiederholungsplan zu verändern
- **Schwächste Karten üben:** die 20 Karten mit den meisten Fehlern
- **Übungsrunden** startest du direkt auf der **Startseite**. Sie fragen nur, was noch nicht sitzt.

Nach dem Aufdecken zeigt eine Lernkarte darunter **passende Übungs- und Prüfungsaufgaben**. Umgekehrt zeigt eine Prüfungsaufgabe die passenden Lernkarten. So siehst du, wie der Stoff in der Prüfung abgefragt wird.

**Statistik:** Lernen pro Tag, Prognose der fälligen Karten, Fortschritt und Fehlerquote je Lernfeld, schwierigste Karten.

## 4. Prüfungen üben (AP1 und AP2)

Jede echte Prüfung ist ein **eigener Stapel**, eine Karte pro Teilaufgabe, mit den Originalpunkten:

| Stapel | Prüfung | Punkte |
|---|---|---|
| AP1 Winter 2026/27 | AP Teil 1, „Einrichten eines IT-gestützten Arbeitsplatzes“ | 90 |
| AP2 Winter 2026/27 · Konzeption (FISI) | AP Teil 2, „Konzeption und Administration von IT-Systemen“ | 90 |
| AP2 Winter 2026/27 · Netzwerke (FISI) | AP Teil 2, „Analyse und Entwicklung von Netzwerken“ | 90 |

Weitere Prüfungen kommen als neue Stapel dazu.

**Eine Prüfung gezielt lernen:** Unter **Lernen** den Stapel im Filter wählen. Mit der Suche „AP2 Winter 2026/27“ findest du beide AP2-Teile zusammen.

**Als echte Prüfung durchspielen:**

1. Reiter **Prüfung** öffnen und den Stapel wählen.
2. Auswahl **„In Reihenfolge (ganze Prüfung)“** einstellen, Dauer 90 Minuten.
3. **Simulation starten.** Antworten eingeben, der Timer läuft.
4. Danach wertet die App aus. Automatisch prüfbare Aufgaben sind schon bepunktet. Offene Aufgaben vergleichst du mit der Lösung und vergibst selbst Punkte.
5. Ergebnis mit IHK-Note speichern. Der Verlauf steht unten auf der Seite.

Die Simulation geht auch **gemischt** (zufällige Aufgaben aus einem Lernfeld) oder mit **„Schwächen zuerst“**.

**AP1 und AP2 bleiben getrennt.** Reiner AP2-Stoff (Lernfelder 7–12, z. B. Routing, DMZ, MQTT) kommt **nicht** in die täglichen neuen Karten. Du lernst ihn nur, wenn du gezielt einen AP2-Stapel oder ein Lernfeld ab 7 auswählst. AP2-Aufgaben zu AP1-Themen (z. B. Subnetting, DHCP, Schutzziele, SQL, Netzplan) stehen in LF 1–6 und laufen im täglichen Lernen mit.

**Anmerkungen zu den Lösungen:** Die offiziellen Lösungsvorschläge enthalten manchmal Fehler oder Lücken. Ergänzungen und Korrekturen stehen *kursiv* mit „(Anmerkung, nicht aus der Lösung)“ bzw. „(nicht von u-form)“.

## 5. Aufgabentypen und wie sie geprüft werden

| Typ | So antwortest du | Prüfung |
|---|---|---|
| Karteikarte | im Kopf | selbst bewerten |
| Offene Aufgabe | Freitext | Lösung vergleichen, selbst bewerten |
| Multiple Choice | Antworten antippen, oft mehrere richtig | automatisch |
| Rechenaufgabe | Ergebnis **oder ganze Rechnung** eingeben | automatisch, mit kleiner Toleranz |
| Reihenfolge | Schritte sortieren | automatisch, Teilpunkte je Schritt an der richtigen Stelle |
| Lückentabelle | Felder ausfüllen | automatisch nach Stichworten, Teilpunkte je Feld |

**Rechenaufgaben:**

- Du kannst die **ganze Rechnung** eintippen, z. B. `499*1,3*1,15/0,98`. Erlaubt sind `+ - * / × ÷ : ( ) ^`. Die App rechnet sie aus und zeigt sie bei der Lösung als „Deine Rechnung“.
- Am Handy gibt es eine **Tastenleiste** mit Rechenzeichen über der Tastatur, du musst also nicht zum Taschenrechner wechseln.
- **Komma ist Dezimaltrennzeichen** (`0,98`). Ein Punkt mit genau drei Ziffern dahinter gilt als Tausenderpunkt (`1.200` = 1200). Darauf weist die App hin. Unter dem Feld steht immer, wie sie deine Eingabe liest.
- Sehr große Ergebnisse werden als Potenz angezeigt, z. B. `2⁶⁴ ≈ 1,84 × 10¹⁹`.

**Lückentabellen:** Stichworte reichen, Groß- und Kleinschreibung ist egal. Zahlen, IP- und MAC-Adressen müssen exakt stimmen. Liegt die App bei einem Feld falsch, **tippst du das Feld an** und drehst die Bewertung um.

## 6. PC und Handy abgleichen

Lernstand und Karten liegen nur im Browser des jeweiligen Geräts. So bringst du beide auf denselben Stand:

1. Auf Gerät A: **Daten → Sicherung speichern** (oder **Teilen …**).
2. Datei auf Gerät B bringen.
3. Auf Gerät B: **Daten → Sicherung einlesen**.

Nichts wird überschrieben: Pro Karte gewinnt der neuere Lernstand, Bewertungen und Prüfungsergebnisse werden zusammengeführt. Das geht in beide Richtungen.

Die Sicherung ist auch dein **Backup**. Wird der Browser zurückgesetzt, sind die Daten sonst weg.

## 7. Updates

Neue App-Versionen kommen automatisch, sobald du die App mit Internet öffnest. Die aktuelle Version steht unter **Daten → App-Version**.

Kommt ein Update nicht an: **Daten → App neu laden (Update holen)**. Das leert nur den App-Cache, **deine Karten und dein Lernstand bleiben**.

Am PC gilt das genauso, jeder Browser aktualisiert für sich.

## 8. Lernfelder

| LF | Name | Prüfung |
|---|---|---|
| 1 | Das Unternehmen und die eigene Rolle im Betrieb | AP1 |
| 2 | Arbeitsplätze nach Kundenwunsch ausstatten | AP1 |
| 3 | Clients in Netzwerke einbinden | AP1 |
| 4 | Schutzbedarfsanalyse im eigenen Arbeitsbereich | AP1 |
| 5 | Software zur Verwaltung von Daten anpassen | AP1 |
| 6 | Serviceanfragen bearbeiten | AP1 |
| 7 | Cyber-physische Systeme ergänzen | AP2 |
| 8 | Daten systemübergreifend bereitstellen | AP2 |
| 9 | Netzwerke und Dienste bereitstellen | AP2 |
| 10 | Serverdienste bereitstellen und Administrationsaufgaben automatisieren | AP2 (FISI) |
| 11 | Betrieb und Sicherheit vernetzter Systeme gewährleisten | AP2 (FISI) |
| 12 | Kundenspezifische Systemintegration durchführen | AP2 (FISI) |

Lernfelder ab 7 erscheinen in den Auswahllisten erst, wenn es Karten dazu gibt.

## 9. Probleme und Lösungen

| Problem | Lösung |
|---|---|
| „0 Karten importiert“ oder Fehlermeldung beim Import | Datei nicht über Outlook oder Teams aufs Handy schicken (Intune-Verschlüsselung). Sonst erst **App neu laden**, dann erneut importieren. |
| Neue Funktionen fehlen | **Daten → App neu laden (Update holen)** |
| Karten am Handy fehlen, am PC sind sie da | Jedes Gerät hat eigenen Speicher: Karten dort importieren oder per Sicherung abgleichen |
| Rechenergebnis wird falsch gewertet | Unter dem Eingabefeld prüfen, wie die App die Zahl liest (Komma = Dezimal, `1.200` = Tausend) |
| Lückentabelle wertet ein richtiges Feld als falsch | Feld antippen, die Bewertung dreht sich um |

## 10. Technik und Entwicklung

- **Eine Seite** aus HTML, CSS und JavaScript, ohne Framework. Quellcode in `src/`, `tools/build.sh` baut daraus `dist/`.
- **Speicher:** IndexedDB im Browser. Kein Server, kein Konto, keine Cloud.
- **Offline und installierbar:** Service Worker (`sw.js`, lädt die Seite netzwerk-zuerst, damit Updates sofort ankommen) und Web-App-Manifest.
- **Wiederholungsplanung:** FSRS-4.5 mit Standardparametern, Intervalle enden vor dem Prüfungstermin.
- **Deployment:** Jeder Push auf `main` baut die App per GitHub Actions (`.github/workflows/pages.yml`) und veröffentlicht sie auf GitHub Pages. `robots.txt` und `noindex` halten Suchmaschinen fern.

```
./tools/build.sh                       # erzeugt dist/ und setzt die App-Version
python3 -m http.server -d dist 8080    # lokal testen: http://localhost:8080
```

| Datei | Inhalt |
|---|---|
| [KARTENFORMAT.md](KARTENFORMAT.md) | Aufbau der Importdateien (JSON/CSV), alle Kartentypen und Felder |
| [SCANNEN.md](SCANNEN.md) | Papierkarten und Prüfungen scannen und liefern |
| [HOSTING.md](HOSTING.md) | Andere Wege, die App bereitzustellen |
