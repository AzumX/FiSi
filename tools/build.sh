#!/usr/bin/env bash
# Baut dist/ (selbst gehostete PWA) und dist/artifact.html (Vorschau ohne Dokument-Gerüst)
set -euo pipefail
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
mkdir -p dist
FONTS='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:wght@400;600&display=swap">'
inner() {
  echo "<title>AP1-Trainer</title>"
  echo '<meta name="claude:viewport-fit-sides" content="cover">'
  echo "$FONTS"
  echo "<style>"; cat src/app.css; echo "</style>"
  cat src/body.html
  echo "<script>"; cat src/fsrs.js src/samples.js src/app.js; echo "</script>"
}
inner > dist/artifact.html
{
  echo '<!doctype html><html lang="de"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<meta name="theme-color" content="#1d5fd1"><meta name="robots" content="noindex, nofollow">'
  echo '<link rel="manifest" href="manifest.json"><link rel="icon" href="icon.svg"><link rel="apple-touch-icon" href="icon-192.png">'
  echo '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}img{max-width:100%}</style>'
  echo '</head><body>'
  inner
  echo '</body></html>'
} > dist/index.html
cp src/manifest.json src/icon.svg src/icon-192.png src/icon-512.png dist/
sed "s/__VERSION__/$V/" src/sw.js > dist/sw.js
echo "robots: User-agent: *" > /dev/null
printf 'User-agent: *\nDisallow: /\n' > dist/robots.txt
echo "build $V ok"
