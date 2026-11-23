# Auf dem Handy installieren (Hosting)

Damit Android die App installieren und offline nutzen kann, muss `dist/` einmal über HTTPS erreichbar sein.
Danach läuft sie aus dem Offline-Cache. Die Karten liegen nicht auf dem Server, sondern nur im Browser des Geräts.

Möglichkeiten (alle kostenlos):

1. **GitHub Pages**: Repository anlegen, `dist/` veröffentlichen. Die Adresse ist öffentlich erreichbar,
   enthält aber nur die leere App mit Beispielkarten. `robots.txt` und `noindex` halten Suchmaschinen fern.
2. **Netlify Drop** (app.netlify.com/drop): `dist/`-Ordner in den Browser ziehen, fertig.
3. **Nur PC**: `python3 -m http.server -d dist 8080` und `http://localhost:8080` öffnen.

Auf Android: Seite in Chrome öffnen, Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
