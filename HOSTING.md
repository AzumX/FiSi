# Hosting

Die App läuft fertig unter **https://azumx.github.io/FiSi/** (GitHub Pages, wird bei jedem Push auf `main` automatisch neu gebaut). Installation und Nutzung: siehe [README](README.md#1-app-aufrufen-und-installieren).

Diese Seite beschreibt nur andere Wege, die App bereitzustellen.

Damit Android die App installieren und offline nutzen kann, muss `dist/` einmal über HTTPS erreichbar sein.
Danach läuft sie aus dem Offline-Cache. Die Karten liegen nicht auf dem Server, sondern nur im Browser des Geräts.

Möglichkeiten (alle kostenlos):

1. **GitHub Pages** (so läuft es aktuell): Workflow `.github/workflows/pages.yml`, in den Repository-Einstellungen unter Pages die Quelle „GitHub Actions“ wählen. Die Adresse ist öffentlich erreichbar,
   enthält aber nur die leere App mit Beispielkarten. `robots.txt` und `noindex` halten Suchmaschinen fern.
2. **Netlify Drop** (app.netlify.com/drop): `dist/`-Ordner in den Browser ziehen, fertig.
3. **Nur PC**: `python3 -m http.server -d dist 8080` und `http://localhost:8080` öffnen.
