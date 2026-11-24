// AP1-Trainer: private Lern-App für die AP Teil 1 (Fachinformatiker/in Systemintegration)
'use strict';

const LF = {
  1: 'Das Unternehmen und die eigene Rolle im Betrieb',
  2: 'Arbeitsplätze nach Kundenwunsch ausstatten',
  3: 'Clients in Netzwerke einbinden',
  4: 'Schutzbedarfsanalyse im eigenen Arbeitsbereich',
  5: 'Software zur Verwaltung von Daten anpassen',
  6: 'Serviceanfragen bearbeiten',
  0: 'Ohne Lernfeld'
};
const APP_VERSION = '__VERSION__';
const versionText = () => /^\d{12}$/.test(APP_VERSION) ? `${APP_VERSION.slice(6, 8)}.${APP_VERSION.slice(4, 6)}.${APP_VERSION.slice(0, 4)}, ${APP_VERSION.slice(8, 10)}:${APP_VERSION.slice(10)} UTC` : APP_VERSION;
const TYPES = { basic: 'Karteikarte', mc: 'Multiple Choice', calc: 'Rechenaufgabe', open: 'Offene Aufgabe', order: 'Reihenfolge', table: 'Lückentabelle' };
const RATINGS = ['Nochmal', 'Schwer', 'Gut', 'Leicht'];
const SCHEMA = 'ap1-trainer/1';
const DAY = 864e5;

// ---------- Storage (IndexedDB, everything mirrored in memory) ----------
const DB = {
  db: null,
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('ap1-trainer', 1);
        r.onupgradeneeded = () => { for (const s of ['cards', 'states', 'logs', 'exams', 'meta']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch (e) { this.db = null; console.warn('IndexedDB nicht verfügbar', e); }
  },
  all(store) {
    if (!this.db) return Promise.resolve([]);
    return new Promise((res, rej) => { const q = this.db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  tx(store, fn) {
    if (!this.db) return Promise.resolve();
    return new Promise((res, rej) => { const t = this.db.transaction(store, 'readwrite'); fn(t.objectStore(store)); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }).catch(e => toast('Speichern fehlgeschlagen: ' + e.message));
  },
  put(store, items) { items = [].concat(items); return this.tx(store, os => items.forEach(i => os.put(i))); },
  del(store, ids) { ids = [].concat(ids); return this.tx(store, os => ids.forEach(i => os.delete(i))); },
  clear(store) { return this.tx(store, os => os.clear()); }
};

const S = { cards: new Map(), states: new Map(), logs: [], exams: [], settings: {} };
const DEFAULT_SETTINGS = { id: 'settings', examDate: '2027-05-04', newPerDay: 15, retention: 0.9, seeded: false };

async function load() {
  await DB.open();
  const [cards, states, logs, exams, meta] = await Promise.all(['cards', 'states', 'logs', 'exams', 'meta'].map(s => DB.all(s)));
  cards.forEach(c => S.cards.set(c.id, c));
  states.forEach(s => S.states.set(s.id, s));
  S.logs = logs.sort((a, b) => a.ts - b.ts);
  S.exams = exams.sort((a, b) => a.ts - b.ts);
  S.settings = { ...DEFAULT_SETTINGS, ...(meta.find(m => m.id === 'settings') || {}) };
  if (!S.settings.seeded && S.cards.size === 0 && typeof SAMPLE_CARDS !== 'undefined') {
    await upsertCards(SAMPLE_CARDS.map(c => ({ ...c })));
    S.settings.seeded = true; await saveSettings();
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
}
const saveSettings = () => DB.put('meta', S.settings);

// ---------- Card model ----------
function normCard(c) {
  const now = Date.now();
  const card = {
    id: String(c.id || ('c-' + now.toString(36) + Math.random().toString(36).slice(2, 7))),
    deck: c.deck || 'eigene',
    lf: Number.isFinite(+c.lf) ? +c.lf : 0,
    topic: c.topic || '',
    type: TYPES[c.type] ? c.type : 'basic',
    front: String(c.front || '').trim(),
    back: String(c.back || '').trim(),
    tags: Array.isArray(c.tags) ? c.tags : String(c.tags || '').split(/[,;]/).map(t => t.trim()).filter(Boolean),
    images: Array.isArray(c.images) ? c.images : [],
    backImages: Array.isArray(c.backImages) ? c.backImages : [],
    points: c.points != null && c.points !== '' ? +c.points : null,
    level: [1, 2, 3].includes(+c.level) ? +c.level : null,
    source: c.source || '',
    created: c.created || now,
    updated: c.updated || now
  };
  if (card.type === 'mc') card.options = (c.options || []).map(o => typeof o === 'string' ? { text: o.replace(/^\*/, ''), correct: o.startsWith('*') } : { text: String(o.text), correct: !!o.correct });
  if (card.type === 'calc') { card.answer = +String(c.answer).replace(',', '.'); card.unit = c.unit || ''; card.tolerance = c.tolerance != null && c.tolerance !== '' ? +String(c.tolerance).replace(',', '.') : 0.01; }
  if (card.type === 'open' && c.rubric) card.rubric = c.rubric;
  if (card.type === 'order') card.items = (Array.isArray(c.items) ? c.items : String(c.items || '').split('\n')).map(t => String(t).trim()).filter(Boolean);
  if (card.type === 'table') {
    card.table = String(c.table || '').trim();
    // blanks: Zellen zum Ausfüllen als "Zeile,Spalte" (1-basiert, Kopfzeile zählt nicht); leer = alles außer 1. Spalte
    card.blanks = (Array.isArray(c.blanks) ? c.blanks : String(c.blanks || '').split(/[;\s]+/)).map(b => String(b).replace(/\s/g, '')).filter(b => /^\d+,\d+$/.test(b));
    if (c.accept && typeof c.accept === 'object') card.accept = c.accept;
  }
  return card;
}
async function upsertCards(list) {
  const cards = list.map(normCard);
  cards.forEach(c => S.cards.set(c.id, c));
  await DB.put('cards', cards);
  return cards.length;
}
async function deleteCards(ids) {
  ids.forEach(id => { S.cards.delete(id); S.states.delete(id); });
  await DB.del('cards', ids); await DB.del('states', ids);
}
const decks = () => [...new Set([...S.cards.values()].map(c => c.deck))].sort();
const pointsOf = c => c.points || (c.type === 'table' ? Math.max(2, Math.min(10, Math.ceil(tableBlanks(c).length / 2))) : c.type === 'open' || c.type === 'calc' || c.type === 'order' ? 4 : 2);

// Lückentabelle: Tabelle zerlegen, Lücken bestimmen, Eingaben tolerant vergleichen
function parseTable(src) {
  const rows = String(src || '').split('\n').filter(l => /^\s*\|/.test(l));
  const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
  const sep = r => /^\s*\|[\s\-:|]+\|\s*$/.test(r);
  const hasHead = rows.length > 1 && sep(rows[1]);
  return { head: hasHead ? cells(rows[0]) : null, rows: rows.filter((r, k) => !sep(r) && !(hasHead && k === 0)).map(cells) };
}
function tableBlanks(c) {
  const t = parseTable(c.table);
  if (c.blanks && c.blanks.length) return c.blanks.filter(b => { const [r, k] = b.split(',').map(Number); return t.rows[r - 1] && t.rows[r - 1][k - 1] != null; });
  const out = []; t.rows.forEach((row, r) => row.forEach((x, k) => { if (k > 0 && x && x !== '–' && x !== '-') out.push(`${r + 1},${k + 1}`); })); return out;
}
const foldTxt = s => String(s || '').toLowerCase().replace(/\*\*|`|_/g, '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9%]+/g, ' ').trim();
const STOP = new Set('der die das und oder ein eine einer eines einem einen mit von fuer auf bei den dem des ist sind wird werden nicht nur auch als wie aus zum zur durch sehr'.split(' '));
const MODS = new Set('sehr nicht kein keine keiner wenig gering extrem un'.split(' '));
const keyWords = s => foldTxt(s).split(' ').filter(w => (w.length >= 4 || /\d/.test(w)) && !STOP.has(w));
function cellHit(sol, given, alts) {
  const a = foldTxt(given); if (!a) return false;
  return [sol, ...(alts || [])].some(x => {
    const s = foldTxt(x); if (!s) return false;
    // ganze Lösung im Text enthalten zählt, außer ein Zusatz wie „sehr“ oder „nicht“ ändert die Bedeutung („sehr hoch“ ≠ „hoch“)
    if (a === s || ((' ' + a + ' ').includes(' ' + s + ' ') && !a.split(' ').some(w => MODS.has(w) && !s.split(' ').includes(w)))) return true;
    const kw = keyWords(x); if (kw.length < 2) return false;
    // längere Zellen: mindestens die Hälfte der Schlüsselwörter (auch als Wortanfang) genannt
    const aw = a.split(' ');
    const n = kw.filter(w => aw.some(v => v === w || (v.length >= 4 && (w.startsWith(v) || v.startsWith(w))))).length;
    return n >= Math.ceil(kw.length / 2);
  });
}

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtNum = (n, d = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtRes = n => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 4 });
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysToExam = () => Math.ceil((new Date(S.settings.examDate + 'T08:00:00').getTime() - Date.now()) / DAY);
const schedOpts = () => ({ retention: S.settings.retention, maxInterval: Math.max(1, Math.min(365, daysToExam() - 3)) });

// light Markdown: **fett**, `code`, ```block```, - Liste, | Tabellen |, ![](bild:N)
function md(src, images = []) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let out = [], i = 0;
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_(\S.*?\S)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
    .replace(/!\[([^\]]*)\]\(bild:(\d+)\)/g, (m, alt, n) => images[+n - 1] ? `<img src="${esc(images[+n - 1])}" alt="${alt}">` : m);
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++; out.push('<pre>' + esc(buf.join('\n')) + '</pre>'); continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const body = rows.filter(r => !/^\s*\|[\s\-:|]+\|\s*$/.test(r));
      const hasHead = rows.length > 1 && /^\s*\|[\s\-:|]+\|\s*$/.test(rows[1]);
      let t = '<div class="tablewrap" lang="de"><table>';
      body.forEach((r, k) => { const tag = hasHead && k === 0 ? 'th' : 'td'; t += '<tr>' + cells(r).map(c => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>'; });
      out.push(t + '</table></div>'); continue;
    }
    if (/^\s*[-•]\s+/.test(l)) {
      // Liste; eingerückte Punkte (2+ Leerzeichen) werden zur Unterliste des vorherigen Punkts
      let html = '<ul>', open = false, sub = false;
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) {
        const deep = /^\s{2,}/.test(lines[i]), t = inline(lines[i++].replace(/^\s*[-•]\s+/, ''));
        if (deep && open) { if (!sub) { html += '<ul>'; sub = true; } html += '<li>' + t + '</li>'; continue; }
        if (sub) { html += '</ul>'; sub = false; }
        if (open) html += '</li>';
        html += '<li>' + t; open = true;
      }
      out.push(html + (sub ? '</ul>' : '') + (open ? '</li>' : '') + '</ul>'); continue;
    }
    out.push(l.trim() === '' ? '<br>' : inline(l) + '<br>'); i++;
  }
  return out.join('').replace(/(<br>)+$/, '');
}
function imgs(list, used) {
  return (list || []).filter((_, k) => !used.includes(k + 1)).map(s => `<img src="${esc(s)}" alt="">`).join('');
}
function renderContent(text, images) {
  const used = [...String(text || '').matchAll(/\(bild:(\d+)\)/g)].map(m => +m[1]);
  const rest = imgs(images, used);
  return `<div class="content">${md(text, images)}</div>${rest ? `<div class="images content">${rest}</div>` : ''}`;
}
let toastTimer;
function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, Math.max(2600, msg.length * 60));
}
function levelChip(c) { return c.level ? `<span class="chip" title="Schwierigkeit ${c.level} von 3">${'●'.repeat(c.level)}${'○'.repeat(3 - c.level)}</span>` : ''; }
function lfChip(lf) { return `<span class="chip lf" title="${esc(LF[lf] || '')}">${lf ? 'LF ' + lf : 'ohne LF'}</span>`; }
function readFile(file, asDataURL) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); asDataURL ? r.readAsDataURL(file) : r.readAsText(file); });
}
// Text einer Datei lesen, mit Ausweichweg: manche Handy-Browser liefern über FileReader einen leeren Text
async function readText(file) {
  let t = '';
  try { t = await readFile(file); } catch (e) { /* zweiter Versuch unten */ }
  if (!t && file.size > 0) {
    try { t = new TextDecoder('utf-8').decode(await file.arrayBuffer()); } catch (e) { /* bleibt leer */ }
  }
  if (!t) throw new Error(`„${file.name || 'Datei'}“ kam leer an (Größe laut Gerät: ${Math.round((file.size || 0) / 1024)} KB). Bitte die Datei in den Downloads prüfen oder neu herunterladen.`);
  return t;
}
async function shrinkImage(file, max = 1400) {
  const url = await readFile(file, true);
  if (!/^data:image\/(png|jpe?g|webp)/.test(url)) return url;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  if (k === 1 && url.length < 400e3) return url;
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

// ---------- Filters ----------
const filter = { lf: 'all', deck: 'all', topic: 'all', type: 'all', q: '' };
function filtered(f = filter) {
  const q = f.q.trim().toLowerCase();
  return [...S.cards.values()].filter(c =>
    (f.lf === 'all' || String(c.lf) === String(f.lf)) &&
    (f.deck === 'all' || c.deck === f.deck) &&
    (!f.topic || f.topic === 'all' || c.topic === f.topic) &&
    (f.type === 'all' || c.type === f.type) &&
    (!q || (c.front + ' ' + c.back + ' ' + c.topic + ' ' + c.tags.join(' ') + ' ' + c.source).toLowerCase().includes(q)));
}
// Themen, die zu Lernfeld + Stapel passen (für das Themen-Auswahlfeld)
const topicsFor = () => [...new Set(filtered({ ...filter, topic: 'all', type: 'all', q: '' }).map(c => c.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
function filterControls(prefix, opts = {}) {
  return `<div class="fields">
    <label class="field">Lernfeld<select id="${prefix}-lf">${['all', 1, 2, 3, 4, 5, 6, 0].map(v => `<option value="${v}" ${String(filter.lf) === String(v) ? 'selected' : ''}>${v === 'all' ? 'Alle Lernfelder' : (v ? 'LF ' + v + ' · ' : '') + LF[v]}</option>`).join('')}</select></label>
    <label class="field">Stapel<select id="${prefix}-deck"><option value="all">Alle Stapel</option>${decks().map(d => `<option ${filter.deck === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
    <label class="field">Thema<select id="${prefix}-topic"><option value="all">Alle Themen</option>${topicsFor().map(t => `<option ${filter.topic === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    ${opts.type ? `<label class="field">Typ<select id="${prefix}-type"><option value="all">Alle Typen</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${filter.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
    ${opts.search ? `<label class="field">Suche<input type="search" id="${prefix}-q" value="${esc(filter.q)}" placeholder="Begriff, Thema, Tag"></label>` : ''}
  </div>`;
}
function bindFilter(prefix, rerender) {
  for (const k of ['lf', 'deck', 'topic', 'type', 'q']) {
    const el = $('#' + prefix + '-' + k); if (!el) continue;
    el.addEventListener(k === 'q' ? 'input' : 'change', () => {
      filter[k] = el.value;
      if (k === 'lf' || k === 'deck') {
        if (!topicsFor().includes(filter.topic)) filter.topic = 'all';
        const ts = $('#' + prefix + '-topic');
        if (ts) ts.innerHTML = '<option value="all">Alle Themen</option>' + topicsFor().map(t => `<option ${filter.topic === t ? 'selected' : ''}>${esc(t)}</option>`).join('');
      }
      rerender(k === 'q');
    });
  }
}

// ---------- Stats helpers ----------
function cardStatus(id) {
  const st = S.states.get(id);
  if (!st || st.state === 'new') return 'new';
  if (st.state === 'review' && st.s >= 21) return 'mastered';
  return 'learning';
}
function dueCards(list) { const now = Date.now(); return list.filter(c => { const st = S.states.get(c.id); return st && st.state !== 'new' && st.due <= now; }); }
function newCards(list) { return list.filter(c => !S.states.has(c.id) || S.states.get(c.id).state === 'new'); }
function introducedToday() { const t0 = startOfDay(); return S.logs.filter(l => l.ts >= t0 && l.wasNew && !l.cram).length; }
function recommendedNewPerDay() {
  const remaining = newCards([...S.cards.values()]).length;
  const days = Math.max(1, daysToExam() - 28); // last 4 weeks: nur Wiederholung + Prüfungssimulation
  return Math.ceil(remaining / days);
}

// ---------- Router ----------
const VIEWS = { home: viewHome, lernen: viewStudy, karten: viewCards, pruefung: viewExam, statistik: viewStats, daten: viewData };
let cleanup = null;
function route() {
  const name = (location.hash || '#home').slice(1).split('-')[0];
  const view = VIEWS[name] ? name : 'home';
  if (cleanup) { cleanup(); cleanup = null; }
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.view === view ? 'page' : 'false'));
  const main = $('#main'); main.innerHTML = '';
  VIEWS[view](main);
  window.scrollTo(0, 0);
}
function go(v) { if (location.hash === '#' + v) route(); else location.hash = v; }

// ---------- Home ----------
function viewHome(main) {
  const all = [...S.cards.values()];
  const due = dueCards(all).length;
  const fresh = newCards(all).length;
  const newToday = Math.max(0, S.settings.newPerDay - introducedToday());
  const d = daysToExam();
  const rec = recommendedNewPerDay();
  const t0 = startOfDay();
  const reviewedToday = S.logs.filter(l => l.ts >= t0).length;
  main.innerHTML = `
  <section class="panel">
    <div class="row spread">
      <div class="countdown"><b class="num">${d > 0 ? d : 0}</b><span>Tage bis zur AP1 am ${new Date(S.settings.examDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      <button class="btn primary" id="go-study" ${due + Math.min(newToday, fresh) === 0 ? 'disabled' : ''}>Lernen starten</button>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${due}</b><span>fällige Wiederholungen</span></div>
      <div class="kpi"><b>${Math.min(newToday, fresh)}</b><span>neue Karten heute</span></div>
      <div class="kpi"><b>${reviewedToday}</b><span>heute gelernt</span></div>
      <div class="kpi"><b>${all.length}</b><span>Karten gesamt</span></div>
    </div>
    ${fresh > 0 ? `<p class="small muted">Noch ${fresh} Karten nie gesehen. Damit alle 4 Wochen vor der Prüfung durch sind, brauchst du etwa <b>${rec} ${rec === 1 ? 'neue Karte' : 'neue Karten'} pro Tag</b> (eingestellt: ${S.settings.newPerDay}).${rec > S.settings.newPerDay ? ' <a href="#daten">Anpassen</a>' : ''}</p>` : ''}
    ${S.cards.size && [...S.cards.values()].every(c => c.deck === 'beispiel') ? `<div class="notice">Das sind Beispielkarten, damit du die App ausprobieren kannst. Deine u-form-Karten kommen dazu, sobald sie gescannt und eingelesen sind. Die Beispiele kannst du unter <a href="#daten">Daten</a> löschen.</div>` : ''}
  </section>
  <section class="panel">
    <div class="row spread"><h2>Fortschritt nach Lernfeld</h2>
      <div class="legend"><span><i style="background:var(--good)"></i>sitzt (≥ 21 Tage)</span><span><i style="background:var(--warn)"></i>in Arbeit</span><span><i style="background:var(--surface-2)"></i>neu</span></div></div>
    <div class="lfbars">${lfBars()}</div>
  </section>
  ${roundsPanel()}
  <section class="grid2">
    <div class="panel"><h3>Prüfung simulieren</h3><p class="small muted">90 Minuten, gemischte Aufgaben, Auswertung mit IHK-Notenschlüssel.</p><button class="btn" id="go-exam">Simulation starten</button></div>
    <div class="panel"><h3>Zwischen PC und Handy abgleichen</h3><p class="small muted">Fortschritt exportieren und auf dem anderen Gerät importieren. Beide Stände werden zusammengeführt.</p><button class="btn" id="go-data">Abgleichen</button></div>
  </section>`;
  $('#go-study').onclick = () => { startSession([...S.cards.values()], false); if (session) go('lernen'); };
  $('#go-exam').onclick = () => go('pruefung');
  main.querySelectorAll('[data-round]').forEach(b => b.onclick = () => {
    // Nur Fragen, die zuletzt nicht mit Gut/Leicht bewertet wurden; ist alles geschafft, die ganze Runde
    const cs = roundCards(b.dataset.round), last = lastLogs();
    const open = cs.filter(c => !(last.has(c.id) && last.get(c.id).g >= 3));
    startSession(open.length ? open : cs, true); if (session) go('lernen');
  });
  $('#go-data').onclick = () => go('daten');
}
// Übungsrunden: Karten mit einem Tag „Übungsrunde …“ lassen sich mit einem Klick als freies Üben starten
const lastLogs = () => { const last = new Map(); for (const l of S.logs) if (!last.has(l.card) || l.ts > last.get(l.card).ts) last.set(l.card, l); return last; };
const roundCards = name => [...S.cards.values()].filter(c => c.tags.includes(name));
function roundsPanel() {
  const names = [...new Set([...S.cards.values()].flatMap(c => c.tags.filter(t => t.startsWith('Übungsrunde '))))].sort((a, b) => a.localeCompare(b, 'de'));
  if (!names.length) return '';
  const btns = names.map(n => {
    const cs = roundCards(n);
    const last = lastLogs();
    const ok = cs.filter(c => last.has(c.id) && last.get(c.id).g >= 3).length;
    return `<button class="btn" data-round="${esc(n)}">${esc(n.replace('Übungsrunde ', ''))} <span class="small muted num">${ok}/${cs.length}</span></button>`;
  }).join('');
  return `<section class="panel"><h2>Übungsrunden</h2><p class="small muted">Kurze Runden zu prüfungstypischen Themen, ohne Lernplanung. Die Zahl zeigt, wie viele Fragen du zuletzt mit „Gut“ oder „Leicht“ bewertet hast. Eine angefangene Runde startet nur mit den offenen Fragen, eine geschaffte Runde wieder komplett.</p><div class="row">${btns}</div></section>`;
}
function lfBars() {
  const all = [...S.cards.values()];
  return [1, 2, 3, 4, 5, 6, 0].map(lf => {
    const cs = all.filter(c => c.lf === lf); if (!cs.length) return '';
    const m = cs.filter(c => cardStatus(c.id) === 'mastered').length, l = cs.filter(c => cardStatus(c.id) === 'learning').length;
    return `<div class="lfbar"><span>${lf ? '<b>LF ' + lf + '</b> · ' : ''}${esc(LF[lf])}</span><span class="muted num small">${m}/${cs.length}</span>
      <div class="bar"><i class="s-good" style="width:${m / cs.length * 100}%"></i><i class="s-learn" style="width:${l / cs.length * 100}%"></i></div></div>`;
  }).join('') || '<p class="muted">Noch keine Karten.</p>';
}

// ---------- Study ----------
let session = null;
function viewStudy(main) {
  if (session && session.queue.length) return renderStudy(main);
  const list = filtered({ ...filter, q: '' });
  const due = dueCards(list).length;
  const fresh = newCards(list).length;
  const newToday = Math.max(0, S.settings.newPerDay - introducedToday());
  main.innerHTML = `
  <section class="panel">
    <h1>Lernen</h1>
    ${filterControls('st')}
    <div class="kpis"><div class="kpi"><b>${due}</b><span>fällig</span></div><div class="kpi"><b>${Math.min(fresh, newToday)}</b><span>neu (von ${fresh})</span></div><div class="kpi"><b>${list.length}</b><span>Karten in Auswahl</span></div></div>
    <div class="row">
      <button class="btn primary" id="st-go" ${due + Math.min(fresh, newToday) ? '' : 'disabled'}>Fällige + neue lernen</button>
      <button class="btn" id="st-cram" ${list.length ? '' : 'disabled'}>Freies Üben (zufällig, ohne Planung)</button>
      <button class="btn ghost" id="st-weak">Schwächste Karten üben</button>
    </div>
    <p class="small muted">Tasten am PC: <kbd>Leertaste</kbd> Antwort zeigen, <kbd>1</kbd>–<kbd>4</kbd> bewerten.</p>
  </section>`;
  bindFilter('st', () => viewStudy(main));
  $('#st-go').onclick = () => startSession(list, false);
  $('#st-cram').onclick = () => startSession(list, true);
  $('#st-weak').onclick = () => {
    const weak = list.filter(c => S.states.has(c.id) && S.states.get(c.id).state !== 'new')
      .sort((a, b) => weakness(b) - weakness(a)).slice(0, 20);
    if (!weak.length) return toast('Noch keine gelernten Karten in dieser Auswahl.');
    startSession(weak, true, true);
  };
}
function weakness(c) { const st = S.states.get(c.id); return (st.lapses || 0) * 2 + (st.d || 5) - Math.log((st.s || 0.1) + 1); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startSession(list, cram, keepOrder) {
  let queue;
  if (cram) queue = keepOrder ? list.map(c => c.id) : shuffle(list.map(c => c.id)).slice(0, 50);
  else {
    const due = dueCards(list).sort((a, b) => S.states.get(a.id).due - S.states.get(b.id).due).map(c => c.id);
    const fresh = newCards(list).sort((a, b) => a.lf - b.lf || a.id.localeCompare(b.id, 'de', { numeric: true }))
      .slice(0, Math.max(0, S.settings.newPerDay - introducedToday())).map(c => c.id);
    queue = [];
    // mische neue Karten zwischen die Wiederholungen
    const step = fresh.length ? Math.max(1, Math.floor(due.length / fresh.length)) : 0;
    let di = 0;
    for (const f of fresh) { queue.push(...due.slice(di, di + step)); di += step; queue.push(f); }
    queue.push(...due.slice(di));
  }
  if (!queue.length) return toast('Nichts zu lernen in dieser Auswahl.');
  session = { queue, cram, done: 0, total: queue.length, again: 0, shown: false, answer: null };
  renderStudy($('#main'));
}
// Übungsaufgaben verweisen per Tag „passt zu u-form Nr. 148, 166“ auf Lernkarten. Nach dem Aufdecken werden die
// verknüpften Karten aufklappbar gezeigt: bei einer Übung die Lernkarten, bei einer Lernkarte die passenden Übungen.
const refNums = c => c.tags.filter(t => /^passt zu u-form/i.test(t)).flatMap(t => t.match(/\d+/g) || []).map(Number);
function relatedHtml(c) {
  const ids = c.id.startsWith('uf-')
    ? [...S.cards.values()].filter(o => refNums(o).includes(+c.id.slice(3))).map(o => o.id)
    : [...new Set(refNums(c))].map(n => 'uf-' + String(n).padStart(3, '0')).filter(id => id !== c.id && S.cards.has(id));
  if (!ids.length) return '';
  const title = c.id.startsWith('uf-') ? `Übungsaufgabe${ids.length > 1 ? 'n' : ''} dazu` : `Passende Lernkarte${ids.length > 1 ? 'n' : ''}`;
  return `<div class="related"><div class="small muted">${title}:</div>${ids.map(id => {
    const r = S.cards.get(id);
    const label = id.startsWith('uf-') ? `Nr. ${+id.slice(3)}` : 'Übung';
    const q = r.id.startsWith('uf-') ? '' : renderContent(r.front, r.images);
    return `<details class="related-card"><summary><b>${label}</b> · ${esc(r.front.replace(/!\[\]\(bild:\d+\)/g, '').replace(/[*_`]/g, '').split('\n')[0].slice(0, 90))}</summary>${q}${q ? '<hr>' : ''}${renderContent(r.back, r.backImages)}</details>`;
  }).join('')}</div>`;
}
function renderStudy(main) {
  const id = session.queue[0];
  const c = S.cards.get(id);
  if (!c) { session.queue.shift(); return session.queue.length ? renderStudy(main) : finishSession(main); }
  const st = S.states.get(id);
  const prev = FSRS.preview(st, Date.now(), schedOpts());
  const pct = session.done / (session.done + session.queue.length) * 100;
  main.innerHTML = `
  <div class="row spread"><span class="small muted num">${session.cram ? 'Freies Üben · ' : ''}${session.done} erledigt · ${session.queue.length} offen</span><button class="btn ghost small" id="st-end">Beenden</button></div>
  <div class="progress"><i style="width:${pct}%"></i></div>
  <article class="studycard">
    <div class="row">${lfChip(c.lf)}<span class="chip">${TYPES[c.type]}</span>${c.topic ? `<span class="chip">${esc(c.topic)}</span>` : ''}${levelChip(c)}${!st || st.state === 'new' ? '<span class="chip warn">neu</span>' : ''}<span class="small muted" style="margin-left:auto">${esc(c.source)}</span></div>
    <div class="q">${renderContent(c.front, c.images)}</div>
    <div id="st-input">${answerInput(c, 'st')}</div>
    <div id="st-answer" class="a" hidden></div>
  </article>
  <div id="st-actions">
    <button class="btn primary" id="st-show" style="width:100%">${c.type === 'mc' || c.type === 'calc' || c.type === 'order' || c.type === 'table' ? 'Prüfen' : 'Antwort zeigen'}</button>
  </div>
  <div class="small muted">Karte bearbeiten: <a href="#karten" id="st-edit">${esc(c.id)}</a></div>`;
  bindOrder(c, 'st'); bindCalc('st');
  $('#st-end').onclick = () => { session = null; go('home'); };
  $('#st-edit').onclick = e => { e.preventDefault(); editCardId = c.id; go('karten'); };
  const reveal = () => {
    if (session.shown) return;
    session.shown = true;
    const result = checkAnswer(c, 'st');
    $('#st-answer').hidden = false;
    $('#st-answer').innerHTML = resultHtml(c, result) + renderContent(c.back, c.backImages) + relatedHtml(c);
    if (c.type === 'mc') markOptions(c, 'st');
    if (c.type === 'order') markOrder(c, 'st');
    const suggOf = r => r == null ? null : r.ok ? 3 : r.part >= .5 && c.type === 'table' ? 2 : 1;
    const sugg = suggOf(result);
    $('#st-actions').innerHTML = `<div class="rate">${RATINGS.map((r, k) => `<button class="btn r${k + 1} ${sugg === k + 1 ? 'suggest' : ''}" data-g="${k + 1}">${r}<small>${session.cram ? '&nbsp;' : FSRS.fmtInterval(prev[k])}</small></button>`).join('')}</div>`;
    if (c.type === 'table') markTable(c, 'st', result, () => {
      result.hits = Object.values(result.cells).filter(Boolean).length; result.ok = result.hits === result.total;
      const v = $('#tb-verdict'); v.textContent = tableVerdict(result); v.className = 'verdict ' + (result.ok ? 'ok' : 'no');
      const g = suggOf({ ok: result.ok, part: result.hits / result.total });
      $('#st-actions').querySelectorAll('[data-g]').forEach(b => b.classList.toggle('suggest', +b.dataset.g === g));
    });
    $('#st-actions').querySelectorAll('[data-g]').forEach(b => b.onclick = () => rate(+b.dataset.g));
  };
  const rate = async g => {
    if (!session.shown) return;
    const now = Date.now();
    const wasNew = !st || st.state === 'new';
    const log = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), card: id, ts: now, g, wasNew, cram: !!session.cram, state: st ? st.state : 'new' };
    S.logs.push(log); DB.put('logs', log);
    if (!session.cram) {
      const next = FSRS.schedule(st || { id, state: 'new' }, g, now, schedOpts());
      next.id = id; S.states.set(id, next); DB.put('states', next);
      session.queue.shift();
      if (next.due - now < 20 * 60e3) session.queue.splice(Math.min(session.queue.length, 3 + Math.floor(Math.random() * 3)), 0, id);
    } else {
      session.queue.shift();
      if (g === 1) session.queue.splice(Math.min(session.queue.length, 4), 0, id);
    }
    if (g === 1) session.again++;
    session.done++; session.shown = false;
    session.queue.length ? renderStudy(main) : finishSession(main);
  };
  $('#st-show').onclick = reveal;
  const onKey = e => {
    if (e.target.matches('.filltable input') && e.key === 'Enter') {
      // Enter springt in der Lückentabelle zum nächsten Feld, erst im letzten wird geprüft
      e.preventDefault(); const all = [...document.querySelectorAll('#st-table input')], k = all.indexOf(e.target);
      if (k < all.length - 1) all[k + 1].focus(); else if (!session.shown) reveal(); return;
    }
    if (e.target.matches('input[type=text], textarea, select')) { if (e.key === 'Enter' && !session.shown) { e.preventDefault(); reveal(); } return; }
    if ((e.key === ' ' && !e.target.matches('input')) || e.key === 'Enter') { e.preventDefault(); reveal(); }
    else if (/^[1-4]$/.test(e.key)) rate(+e.key);
  };
  if (renderStudy.unbind) renderStudy.unbind();
  document.addEventListener('keydown', onKey);
  renderStudy.unbind = () => { document.removeEventListener('keydown', onKey); renderStudy.unbind = null; };
  cleanup = renderStudy.unbind;
}
function finishSession(main) {
  renderStudy.unbind && renderStudy.unbind(); renderStudy.unbind = null;
  const s = session; session = null;
  const all = [...S.cards.values()];
  main.innerHTML = `<section class="panel empty">
    <h2>Geschafft</h2>
    <p><span class="num">${s.done}</span> Bewertungen, davon <span class="num">${s.again}</span> × „Nochmal“.</p>
    <p class="small">Als Nächstes fällig: ${nextDueText(all)}</p>
    <div class="row"><button class="btn primary" onclick="location.hash='home'">Zur Übersicht</button><button class="btn" onclick="location.hash='statistik'">Statistik</button></div>
  </section>`;
}
function nextDueText(all) {
  const ds = all.map(c => S.states.get(c.id)).filter(s => s && s.state !== 'new').map(s => s.due).sort((a, b) => a - b);
  if (!ds.length) return '–';
  const ms = Math.max(0, ds[0] - Date.now());
  return ms < 60e3 ? 'jetzt' : 'in ' + FSRS.fmtInterval(ms);
}

// answer widgets shared by study & exam
function answerInput(c, p, saved) {
  if (c.type === 'mc') {
    const multi = c.options.filter(o => o.correct).length !== 1;
    return `<div class="stack"><span class="small muted">${multi ? 'Mehrere Antworten können richtig sein.' : 'Eine Antwort ist richtig.'}</span><div class="options">${c.options.map((o, k) =>
      `<label class="opt" id="${p}-opt-${k}"><input type="${multi ? 'checkbox' : 'radio'}" name="${p}-mc" value="${k}" ${saved && saved.includes(k) ? 'checked' : ''}><span class="content">${md(o.text)}</span></label>`).join('')}</div></div>`;
  }
  if (c.type === 'order') {
    // Zufällige Anzeige-Reihenfolge; gespeichert werden Indizes in c.items (richtige Reihenfolge = 0,1,2,…)
    const pool = c.items.map((t, k) => k).sort(() => Math.random() - .5);
    return `<div class="stack order" id="${p}-order" data-chosen="${esc(JSON.stringify(saved || []))}" data-pool="${esc(JSON.stringify(pool))}"><span class="small muted">Tippe die Schritte in der richtigen Reihenfolge an. Antippen in deiner Liste nimmt einen Schritt zurück.</span><ol class="order-chosen"></ol><div class="order-pool"></div></div>`;
  }
  if (c.type === 'table') {
    const t = parseTable(c.table), bl = new Set(tableBlanks(c)), sv = saved || {};
    return `<div class="stack"><span class="small muted">Fülle die leeren Felder aus. Stichworte reichen, Groß-/Kleinschreibung ist egal.</span><div class="tablewrap" lang="de"><table class="filltable content" id="${p}-table">${t.head ? '<tr>' + t.head.map(h => `<th>${md(h)}</th>`).join('') + '</tr>' : ''}${t.rows.map((row, r) => '<tr>' + row.map((x, k) => { const key = `${r + 1},${k + 1}`; return bl.has(key) ? `<td class="blank" data-cell="${key}"><input type="text" autocomplete="off" aria-label="${esc(((t.head && t.head[k]) || 'Spalte ' + (k + 1)) + ', ' + foldTxt(row[0]).slice(0, 40))}" value="${esc(sv[key] || '')}"></td>` : `<td>${md(x)}</td>`; }).join('') + '</tr>').join('')}</table></div></div>`;
  }
  if (c.type === 'calc') return `<div class="stack calcbox"><label class="field">Dein Ergebnis${c.unit ? ' in ' + esc(c.unit) : ''} <span class="small muted">(du kannst auch direkt rechnen, z. B. 3*450+120)</span><input type="text" inputmode="decimal" id="${p}-calc" value="${esc(saved ?? '')}" autocomplete="off" spellcheck="false"></label>
    <div class="calc-keys" id="${p}-calckeys" aria-label="Rechenzeichen">${[['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['(', '('], [')', ')'], ['xʸ', '^'], ['⌫', 'del']].map(([l, v]) => `<button type="button" class="btn small calc-key" data-k="${v}">${l}</button>`).join('')}</div>
    <div class="calc-prev num" id="${p}-calcprev" aria-live="polite"></div></div>`;
  if (c.type === 'open' && p === 'ex') return `<label class="field">Deine Antwort (Stichpunkte reichen)<textarea id="${p}-open">${esc(saved ?? '')}</textarea></label>`;
  return '';
}
// Mini-Rechner im Ergebnisfeld: + - * / ( ) ^, Komma oder Punkt als Dezimalzeichen
function calcExpr(src) {
  let t = String(src || '').replace(/\s/g, '').replace(/[×xX]/g, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\.(?=\d)/g, '').replace(/,/g, '.');   // 1.234,5 → 1234.5
  else t = t.replace(/(\d)\.(?=\d{3}(\D|$))/g, '$1');                     // 1.200 → 1200 (Tausenderpunkt)
  let i = 0;
  const peek = () => t[i];
  const num = () => { const m = /^\d*\.?\d+(e[+-]?\d+)?|^\d+\.?/.exec(t.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
  const atom = () => {
    if (peek() === '-') { i++; return -atom(); }
    if (peek() === '+') { i++; return atom(); }
    if (peek() === '(') { i++; const v = sum(); if (peek() === ')') i++; return v; }
    return num();
  };
  const pow = () => { const b = atom(); if (peek() === '^') { i++; return Math.pow(b, pow()); } return b; };
  const prod = () => { let v = pow(); while (peek() === '*' || peek() === '/') { const op = t[i++]; const r = pow(); v = op === '*' ? v * r : v / r; } return v; };
  const sum = () => { let v = prod(); while (peek() === '+' || peek() === '-') { const op = t[i++]; const r = prod(); v = op === '+' ? v + r : v - r; } return v; };
  try { const v = sum(); return i === t.length && Number.isFinite(v) ? v : NaN; } catch (e) { return NaN; }
}
const isExpr = s => /\d\s*[-+*/×÷:^x−]\s*[\d(]|[()]|\^/.test(String(s || '').replace(/^\s*[-−]/, ''));
function bindCalc(p) {
  const inp = $('#' + p + '-calc'), keys = $('#' + p + '-calckeys'), prev = $('#' + p + '-calcprev'); if (!inp || !keys || keys.dataset.bound) return;
  keys.dataset.bound = '1';
  const show = () => { const v = inp.value; const r = calcExpr(v); prev.textContent = isExpr(v) ? (Number.isFinite(r) ? '= ' + fmtRes(Math.round(r * 1e6) / 1e6) : '…') : ''; };
  inp.addEventListener('input', show);
  // pointerdown statt click: Fokus bleibt im Feld, die Handy-Tastatur geht nicht zu
  keys.addEventListener('pointerdown', e => {
    const b = e.target.closest('.calc-key'); if (!b || inp.disabled) return;
    e.preventDefault();
    const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a, k = b.dataset.k;
    if (k === 'del') { const from = a === z ? Math.max(0, a - 1) : a; inp.value = inp.value.slice(0, from) + inp.value.slice(z); inp.setSelectionRange(from, from); }
    else { inp.value = inp.value.slice(0, a) + k + inp.value.slice(z); inp.setSelectionRange(a + k.length, a + k.length); }
    inp.focus({ preventScroll: true }); show();
  });
  keys.addEventListener('click', e => e.preventDefault());
  show();
}
function bindOrder(c, p) {
  const box = $('#' + p + '-order'); if (!box || box.dataset.bound) return;
  box.dataset.bound = '1';
  const draw = () => {
    const chosen = JSON.parse(box.dataset.chosen), pool = JSON.parse(box.dataset.pool);
    box.querySelector('.order-chosen').innerHTML = chosen.map(k => `<li><button type="button" class="opt order-item" data-k="${k}"><span class="content">${md(c.items[k])}</span></button></li>`).join('');
    box.querySelector('.order-pool').innerHTML = pool.filter(k => !chosen.includes(k)).map(k => `<button type="button" class="opt order-item" data-k="${k}"><span class="content">${md(c.items[k])}</span></button>`).join('');
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('.order-item'); if (!b || box.dataset.locked) return;
    const chosen = JSON.parse(box.dataset.chosen), k = +b.dataset.k;
    box.dataset.chosen = JSON.stringify(chosen.includes(k) ? chosen.filter(x => x !== k) : [...chosen, k]);
    draw();
  });
  draw();
}
function markOrder(c, p) {
  const box = $('#' + p + '-order'); if (!box) return;
  box.dataset.locked = '1';
  const chosen = JSON.parse(box.dataset.chosen);
  box.querySelectorAll('.order-chosen .order-item').forEach((b, i) => b.classList.add(chosen[i] === i ? 'correct' : 'wrong'));
  box.querySelector('.order-pool').innerHTML = '';
}
function markTable(c, p, r, onChange) {
  const tb = $('#' + p + '-table'); if (!tb || !r) return;
  const t = parseTable(c.table);
  tb.querySelectorAll('td.blank').forEach(td => {
    const key = td.dataset.cell, [rr, k] = key.split(',').map(Number), given = td.querySelector('input') ? td.querySelector('input').value : '';
    const sol = t.rows[rr - 1][k - 1];
    td.innerHTML = `<div class="given">${given.trim() ? esc(given) : '<span class="muted">leer</span>'}</div>${foldTxt(given) === foldTxt(sol) ? '' : `<div class="sol">${md(sol)}</div>`}`;
    td.classList.add(r.cells[key] ? 'correct' : 'wrong');
    if (onChange) { td.title = 'Antippen, um die Bewertung zu ändern'; td.onclick = () => { r.cells[key] = !r.cells[key]; td.classList.toggle('correct', r.cells[key]); td.classList.toggle('wrong', !r.cells[key]); onChange(); }; }
  });
}
function tableReview(c, ans, cellsOk) {
  const t = parseTable(c.table), bl = new Set(tableBlanks(c)), a = ans || {};
  return `<div class="tablewrap" lang="de"><table class="filltable content">${t.head ? '<tr>' + t.head.map(h => `<th>${md(h)}</th>`).join('') + '</tr>' : ''}${t.rows.map((row, r) => '<tr>' + row.map((x, k) => { const key = `${r + 1},${k + 1}`; if (!bl.has(key)) return `<td>${md(x)}</td>`; const g = a[key] || ''; return `<td class="blank ${cellsOk[key] ? 'correct' : 'wrong'}"><div class="given">${g.trim() ? esc(g) : '<span class="muted">leer</span>'}</div>${foldTxt(g) === foldTxt(x) ? '' : `<div class="sol">${md(x)}</div>`}</td>`; }).join('') + '</tr>').join('')}</table></div>`;
}
const orderSolution = c => '<ol class="order-solution">' + c.items.map(t => `<li>${md(t)}</li>`).join('') + '</ol>';
function readAnswer(c, p) {
  if (c.type === 'order') { const b = $('#' + p + '-order'); return b ? JSON.parse(b.dataset.chosen) : []; }
  if (c.type === 'table') { const o = {}; document.querySelectorAll(`#${p}-table td.blank input`).forEach(i => { if (i.value.trim()) o[i.closest('td').dataset.cell] = i.value.trim(); }); return o; }
  if (c.type === 'mc') return [...document.querySelectorAll(`input[name="${p}-mc"]:checked`)].map(i => +i.value);
  if (c.type === 'calc') { const v = $('#' + p + '-calc'); return v ? v.value : ''; }
  if (c.type === 'open') { const v = $('#' + p + '-open'); return v ? v.value : ''; }
  return null;
}
function evalAnswer(c, ans) {
  if (c.type === 'mc') {
    const want = c.options.map((o, k) => o.correct ? k : -1).filter(k => k >= 0);
    const ok = want.length === ans.length && want.every(k => ans.includes(k));
    return { ok, auto: true };
  }
  if (c.type === 'order') {
    const a = ans || [];
    const hits = c.items.filter((t, k) => a[k] === k).length;
    return { ok: hits === c.items.length && a.length === c.items.length, auto: true, part: c.items.length ? hits / c.items.length : 0, hits };
  }
  if (c.type === 'table') {
    const t = parseTable(c.table), bl = tableBlanks(c), a = ans || {}, cells = {};
    bl.forEach(key => { const [r, k] = key.split(',').map(Number); cells[key] = cellHit(t.rows[r - 1][k - 1], a[key], c.accept && c.accept[key] && [].concat(c.accept[key])); });
    const hits = bl.filter(k => cells[k]).length;
    return { ok: hits === bl.length, auto: true, part: bl.length ? hits / bl.length : 0, hits, total: bl.length, cells };
  }
  if (c.type === 'calc') {
    const v = calcExpr(ans);
    if (!Number.isFinite(v)) return { ok: false, auto: true, given: ans };
    if (isExpr(ans)) { const tol = Math.abs(c.answer) * (c.tolerance ?? 0.01); return { ok: Math.abs(v - c.answer) <= Math.max(tol, 1e-9), auto: true, given: v, expr: String(ans).trim() }; }
    const tol = Math.abs(c.answer) * (c.tolerance ?? 0.01);
    return { ok: Math.abs(v - c.answer) <= Math.max(tol, 1e-9), auto: true, given: v };
  }
  return null;
}
function checkAnswer(c, p) { return evalAnswer(c, readAnswer(c, p)); }
function resultHtml(c, r) {
  if (!r) return '';
  if (c.type === 'order') return `<div class="verdict ${r.ok ? 'ok' : 'no'}">${r.ok ? 'Richtig' : `Nicht ganz: ${r.hits} von ${c.items.length} an der richtigen Stelle`}</div>${r.ok ? '' : '<span class="eyebrow">Richtige Reihenfolge</span>' + orderSolution(c)}<br>`;
  if (c.type === 'table') return `<div class="verdict ${r.ok ? 'ok' : 'no'}" id="tb-verdict">${tableVerdict(r)}</div><p class="small muted">Die App vergleicht nach Stichworten. Tippe auf ein Feld, wenn die Bewertung nicht passt.</p>`;
  if (c.type === 'calc') return `<div class="verdict ${r.ok ? 'ok' : 'no'}">${r.ok ? 'Richtig' : 'Falsch'}: Lösung ${fmtRes(c.answer)} ${esc(c.unit)}</div>${r.expr ? `<p class="small muted">Deine Rechnung: <span class="num">${esc(r.expr)} = ${fmtRes(Math.round(r.given * 1e6) / 1e6)}</span></p>` : ''}<br>`;
  return `<div class="verdict ${r.ok ? 'ok' : 'no'}">${r.ok ? 'Richtig' : 'Nicht ganz'}</div><br>`;
}
const tableVerdict = r => r.hits === r.total ? `Richtig: alle ${r.total} Felder` : `${r.hits} von ${r.total} Feldern richtig`;
function markOptions(c, p) {
  c.options.forEach((o, k) => {
    const el = $('#' + p + '-opt-' + k); if (!el) return;
    const checked = el.querySelector('input').checked;
    if (o.correct) el.classList.add('correct'); else if (checked) el.classList.add('wrong');
    el.querySelector('input').disabled = true;
  });
}

// ---------- Card list & editor ----------
let editCardId = null;
let listLimit = 60;
function viewCards(main) {
  if (editCardId) return viewEditor(main, editCardId === '__new' ? null : S.cards.get(editCardId));
  const render = (keepFocus) => {
    const list = filtered().sort((a, b) => a.lf - b.lf || a.id.localeCompare(b.id, 'de', { numeric: true }));
    const html = list.slice(0, listLimit).map(c => {
      const s = cardStatus(c.id);
      return `<div class="cl-item" data-id="${esc(c.id)}" tabindex="0"><span class="cl-front">${esc(c.front.replace(/\n/g, ' '))}</span><span class="small muted mono">${esc(c.id)}</span>
      <div class="cl-meta">${lfChip(c.lf)}${levelChip(c)}<span class="chip">${TYPES[c.type]}</span><span class="chip">${esc(c.deck)}</span>${s === 'mastered' ? '<span class="chip good">sitzt</span>' : s === 'learning' ? '<span class="chip warn">in Arbeit</span>' : ''}${c.images.length ? '<span class="chip">Bild</span>' : ''}</div></div>`;
    }).join('');
    $('#cl').innerHTML = html || '<div class="empty">Keine Karten gefunden.</div>';
    $('#cl-count').textContent = list.length + ' Karten';
    $('#cl-more').hidden = list.length <= listLimit;
    $('#cl').querySelectorAll('.cl-item').forEach(el => { el.onclick = () => { editCardId = el.dataset.id; viewCards(main); }; el.onkeydown = e => { if (e.key === 'Enter') el.click(); }; });
    if (!keepFocus) return;
  };
  main.innerHTML = `
  <section class="panel">
    <div class="row spread"><h1>Karten</h1><button class="btn primary" id="cl-new">Neue Karte</button></div>
    ${filterControls('cl', { type: true, search: true })}
    <span class="small muted" id="cl-count"></span>
  </section>
  <div class="cardlist" id="cl"></div>
  <button class="btn" id="cl-more" hidden>Mehr anzeigen</button>`;
  bindFilter('cl', render);
  $('#cl-new').onclick = () => { editCardId = '__new'; viewCards(main); };
  $('#cl-more').onclick = () => { listLimit += 100; render(); };
  render();
}
function viewEditor(main, card) {
  const c = card ? JSON.parse(JSON.stringify(card)) : normCard({ deck: filter.deck !== 'all' ? filter.deck : 'eigene', lf: filter.lf !== 'all' ? filter.lf : 0 });
  const isNew = !card;
  const optText = c.options ? c.options.map(o => (o.correct ? '*' : '') + o.text).join('\n') : '';
  main.innerHTML = `
  <section class="panel">
    <div class="row spread"><h1>${isNew ? 'Neue Karte' : 'Karte bearbeiten'}</h1><button class="btn ghost" id="ed-back">Zurück</button></div>
    <div class="fields">
      <label class="field">ID<input type="text" id="ed-id" value="${esc(c.id)}" ${isNew ? '' : 'readonly'}></label>
      <label class="field">Stapel<input type="text" id="ed-deck" value="${esc(c.deck)}" list="ed-decks"><datalist id="ed-decks">${decks().map(d => `<option value="${esc(d)}">`).join('')}</datalist></label>
      <label class="field">Lernfeld<select id="ed-lf">${[1, 2, 3, 4, 5, 6, 0].map(v => `<option value="${v}" ${c.lf === v ? 'selected' : ''}>${v ? 'LF ' + v : 'Ohne'}</option>`).join('')}</select></label>
      <label class="field">Typ<select id="ed-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${c.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">Thema<input type="text" id="ed-topic" value="${esc(c.topic)}"></label>
      <label class="field">Schwierigkeit<select id="ed-level">${[['', '–'], [1, '●○○ leicht'], [2, '●●○ mittel'], [3, '●●● schwer']].map(([v, t]) => `<option value="${v}" ${String(c.level ?? '') === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field">Punkte (Prüfung)<input type="number" id="ed-points" min="0" step="1" value="${c.points ?? ''}" placeholder="${pointsOf(c)}"></label>
    </div>
    <label class="field">Frage / Vorderseite<textarea id="ed-front">${esc(c.front)}</textarea></label>
    <div class="row"><label class="btn small">Bild zur Frage<input type="file" accept="image/*" id="ed-img" multiple hidden></label><span class="small muted" id="ed-imgs">${c.images.length} Bild(er)</span><button class="btn ghost small" id="ed-imgclear" ${c.images.length ? '' : 'hidden'}>Bilder entfernen</button></div>
    <div id="ed-mc" class="stack" hidden><label class="field">Antwortoptionen (eine pro Zeile, richtige mit * davor)<textarea id="ed-options" class="mono">${esc(optText)}</textarea></label></div>
    <div id="ed-order" class="stack" hidden><label class="field">Schritte in der richtigen Reihenfolge (einer pro Zeile, die App mischt sie)<textarea id="ed-items" class="mono">${esc((c.items || []).join('\n'))}</textarea></label></div>
    <div id="ed-table" class="stack" hidden><label class="field">Lösungstabelle (Markdown, erste Zeile = Kopfzeile)<textarea id="ed-tabsrc" class="mono" style="min-height:120px">${esc(c.table || '| | Spalte A | Spalte B |\n|---|---|---|\n| Zeile 1 | … | … |')}</textarea></label><label class="field">Lücken als Zeile,Spalte (z. B. <code>1,2; 3,3</code>, leer = alles außer 1. Spalte)<input type="text" id="ed-blanks" value="${esc((c.blanks || []).join('; '))}"></label></div>
    <div id="ed-calc" class="fields" hidden>
      <label class="field">Ergebnis<input type="text" id="ed-answer" inputmode="decimal" value="${c.answer ?? ''}"></label>
      <label class="field">Einheit<input type="text" id="ed-unit" value="${esc(c.unit || '')}"></label>
      <label class="field">Toleranz (relativ)<input type="text" id="ed-tol" value="${c.tolerance ?? 0.01}"></label>
    </div>
    <label class="field">Antwort / Rückseite / Lösungsweg<textarea id="ed-back-text" style="min-height:140px">${esc(c.back)}</textarea></label>
    <div class="row"><label class="btn small">Bild zur Antwort<input type="file" accept="image/*" id="ed-bimg" multiple hidden></label><span class="small muted" id="ed-bimgs">${c.backImages.length} Bild(er)</span></div>
    <div class="fields"><label class="field">Tags (Komma)<input type="text" id="ed-tags" value="${esc(c.tags.join(', '))}"></label><label class="field">Quelle<input type="text" id="ed-source" value="${esc(c.source)}" placeholder="z. B. u-form Nr. 42 oder AP1 Frühjahr 2024, Aufg. 2b"></label></div>
    <p class="small muted">Formatierung: <code>**fett**</code>, <code>\`code\`</code>, Zeilen mit <code>- </code> als Liste, Tabellen mit <code>| a | b |</code>, Bild an bestimmter Stelle mit <code>![](bild:1)</code>.</p>
    <div class="row"><button class="btn primary" id="ed-save">Speichern</button>${isNew ? '' : '<button class="btn" id="ed-reset">Lernstand zurücksetzen</button><button class="btn danger" id="ed-del">Löschen</button>'}</div>
    <div id="ed-confirm"></div>
  </section>
  <section class="panel"><span class="eyebrow">Vorschau</span><div id="ed-preview"></div></section>`;
  const sync = () => {
    const t = $('#ed-type').value;
    $('#ed-mc').hidden = t !== 'mc'; $('#ed-calc').hidden = t !== 'calc'; $('#ed-order').hidden = t !== 'order'; $('#ed-table').hidden = t !== 'table';
    $('#ed-preview').innerHTML = renderContent($('#ed-front').value, c.images) + '<hr style="border:0;border-top:1px dashed var(--line)">' + renderContent($('#ed-back-text').value, c.backImages);
  };
  ['ed-type', 'ed-front', 'ed-back-text'].forEach(id => $('#' + id).addEventListener('input', sync));
  sync();
  const addImgs = async (input, key, label) => {
    for (const f of input.files) c[key].push(await shrinkImage(f));
    $(label).textContent = c[key].length + ' Bild(er)'; $('#ed-imgclear').hidden = !c.images.length; sync();
  };
  $('#ed-img').onchange = e => addImgs(e.target, 'images', '#ed-imgs');
  $('#ed-bimg').onchange = e => addImgs(e.target, 'backImages', '#ed-bimgs');
  $('#ed-imgclear').onclick = () => { c.images = []; c.backImages = []; $('#ed-imgs').textContent = '0 Bild(er)'; $('#ed-bimgs').textContent = '0 Bild(er)'; sync(); };
  $('#ed-back').onclick = () => { editCardId = null; viewCards(main); };
  $('#ed-save').onclick = async () => {
    const id = $('#ed-id').value.trim();
    if (!id) return toast('Bitte eine ID angeben.');
    if (isNew && S.cards.has(id)) return toast('Diese ID gibt es schon.');
    if (!$('#ed-front').value.trim()) return toast('Die Frage ist leer.');
    const raw = {
      ...c, id, deck: $('#ed-deck').value.trim() || 'eigene', lf: +$('#ed-lf').value, type: $('#ed-type').value, topic: $('#ed-topic').value.trim(),
      points: $('#ed-points').value, level: $('#ed-level').value, front: $('#ed-front').value, back: $('#ed-back-text').value, tags: $('#ed-tags').value, source: $('#ed-source').value.trim(),
      options: $('#ed-options').value.split('\n').map(s => s.trim()).filter(Boolean), answer: $('#ed-answer').value, unit: $('#ed-unit').value, tolerance: $('#ed-tol').value, items: $('#ed-items').value, table: $('#ed-tabsrc').value, blanks: $('#ed-blanks').value, updated: Date.now()
    };
    if (raw.type === 'mc' && (raw.options.length < 2 || !raw.options.some(o => o.startsWith('*')))) return toast('Multiple Choice braucht mind. 2 Optionen und eine mit *.');
    if (raw.type === 'table' && (parseTable(raw.table).rows.length < 1 || !tableBlanks(normCard(raw)).length)) return toast('Lückentabelle braucht eine Tabelle und mindestens eine Lücke.');
    if (raw.type === 'order' && raw.items.split('\n').filter(t => t.trim()).length < 2) return toast('Reihenfolge braucht mind. 2 Schritte.');
    if (raw.type === 'calc' && !Number.isFinite(+String(raw.answer).replace(',', '.'))) return toast('Bitte ein Ergebnis als Zahl angeben.');
    await upsertCards([raw]);
    toast('Gespeichert'); editCardId = null; viewCards(main);
  };
  if (!isNew) {
    $('#ed-del').onclick = () => {
      $('#ed-confirm').innerHTML = `<div class="confirmbar"><span>Karte und Lernstand endgültig löschen?</span><button class="btn danger small" id="ed-del2">Ja, löschen</button><button class="btn small" id="ed-del0">Abbrechen</button></div>`;
      $('#ed-del2').onclick = async () => { await deleteCards([c.id]); toast('Gelöscht'); editCardId = null; viewCards(main); };
      $('#ed-del0').onclick = () => $('#ed-confirm').innerHTML = '';
    };
    $('#ed-reset').onclick = async () => { S.states.delete(c.id); await DB.del('states', c.id); toast('Lernstand zurückgesetzt'); };
  }
}

// ---------- Exam simulation ----------
let exam = null;
function viewExam(main) {
  if (exam && exam.phase === 'run') return renderExamQ(main);
  if (exam && exam.phase === 'grade') return renderGrading(main);
  const list = filtered({ ...filter, q: '', type: 'all' });
  const pts = list.reduce((s, c) => s + pointsOf(c), 0);
  main.innerHTML = `
  <section class="panel">
    <h1>Prüfungssimulation</h1>
    <p class="small muted">Die AP1 dauert 90 Minuten und hat 100 Punkte. Am meisten bringt die Simulation mit echten alten Prüfungsaufgaben. Lege sie als eigenen Stapel an (z. B. „AP1 Frühjahr 2024“) und wähle ihn hier aus.</p>
    ${filterControls('ex')}
    <div class="fields">
      <label class="field">Dauer (Minuten)<input type="number" id="ex-min" value="90" min="5" step="5"></label>
      <label class="field">Ziel-Punkte (ca.)<input type="number" id="ex-pts" value="100" min="10" step="10"></label>
      <label class="field">Auswahl<select id="ex-mode"><option value="mix">Zufällig gemischt</option><option value="order">In Reihenfolge (ganze Prüfung)</option><option value="weak">Schwächen zuerst</option></select></label>
    </div>
    <p class="small muted">In der Auswahl: ${list.length} Aufgaben mit zusammen ${pts} Punkten. Karteikarten zählen 2 Punkte, Rechen- und offene Aufgaben 4, sofern auf der Karte nichts anderes steht.</p>
    <div class="row"><button class="btn primary" id="ex-go" ${list.length ? '' : 'disabled'}>Simulation starten</button></div>
  </section>
  ${examHistory()}`;
  bindFilter('ex', () => viewExam(main));
  $('#ex-go').onclick = () => {
    const mode = $('#ex-mode').value, target = +$('#ex-pts').value || 100;
    let pool = mode === 'order' ? list.sort((a, b) => a.id.localeCompare(b.id, 'de', { numeric: true }))
      : mode === 'weak' ? list.sort((a, b) => (S.states.has(b.id) ? weakness(b) : 3) - (S.states.has(a.id) ? weakness(a) : 3)) : shuffle(list);
    const picked = []; let sum = 0;
    for (const c of pool) { if (sum >= target) break; picked.push(c.id); sum += pointsOf(c); }
    exam = { phase: 'run', ids: picked, idx: 0, answers: {}, start: Date.now(), minutes: +$('#ex-min').value || 90, scores: {}, label: filter.deck !== 'all' ? filter.deck : (filter.lf !== 'all' ? 'LF ' + filter.lf : 'Gemischt') };
    renderExamQ(main);
  };
}
function examHistory() {
  if (!S.exams.length) return '';
  return `<section class="panel"><h2>Bisherige Simulationen</h2><div class="tablewrap"><table class="data"><tr><th>Datum</th><th>Auswahl</th><th class="n">Punkte</th><th class="n">%</th><th class="n">Note</th></tr>
  ${S.exams.slice().reverse().map(e => `<tr><td>${new Date(e.ts).toLocaleDateString('de-DE')}</td><td>${esc(e.label)}</td><td class="n">${fmtNum(e.got, 1)}/${e.max}</td><td class="n">${fmtNum(e.pct)}</td><td class="n">${ihkGrade(e.pct).note}</td></tr>`).join('')}</table></div></section>`;
}
function ihkGrade(pct) {
  if (pct >= 92) return { note: 1, text: 'sehr gut' };
  if (pct >= 81) return { note: 2, text: 'gut' };
  if (pct >= 67) return { note: 3, text: 'befriedigend' };
  if (pct >= 50) return { note: 4, text: 'ausreichend' };
  if (pct >= 30) return { note: 5, text: 'mangelhaft' };
  return { note: 6, text: 'ungenügend' };
}
let examTimer = null;
function renderExamQ(main) {
  const save = () => { const cur = S.cards.get(exam.ids[exam.idx]); if (cur && main.querySelector('#ex-q')) exam.answers[cur.id] = readAnswer(cur, 'ex'); };
  const c = S.cards.get(exam.ids[exam.idx]);
  const total = exam.ids.reduce((s, id) => s + pointsOf(S.cards.get(id) || {}), 0);
  main.innerHTML = `
  <div class="examhead"><span class="timer" id="ex-timer">--:--</span><span class="small muted num">Aufgabe ${exam.idx + 1} von ${exam.ids.length} · ${total} Punkte gesamt</span><button class="btn small" id="ex-submit">Abgeben</button></div>
  <div class="qgrid">${exam.ids.map((id, k) => { const a = exam.answers[id]; const done = a != null && (Array.isArray(a) ? a.length : String(a).trim() !== ''); return `<button class="qdot ${done ? 'done' : ''} ${k === exam.idx ? 'cur' : ''}" data-k="${k}">${k + 1}</button>`; }).join('')}</div>
  <article class="studycard" id="ex-q">
    <div class="row">${lfChip(c.lf)}<span class="chip">${TYPES[c.type]}</span><span class="chip">${pointsOf(c)} Punkte</span></div>
    <div class="q">${renderContent(c.front, c.images)}</div>
    ${answerInput(c, 'ex', exam.answers[c.id]) || '<p class="small muted">Beantworte die Frage im Kopf oder auf Papier. Du bewertest dich nach der Abgabe selbst.</p>'}
  </article>
  <div class="row spread"><button class="btn" id="ex-prev" ${exam.idx ? '' : 'disabled'}>Zurück</button><button class="btn primary" id="ex-next">${exam.idx < exam.ids.length - 1 ? 'Weiter' : 'Zur Abgabe'}</button></div>
  <div id="ex-confirm"></div>`;
  bindOrder(c, 'ex'); bindCalc('ex');
  const goto = k => { save(); exam.idx = k; renderExamQ(main); };
  main.querySelectorAll('.qdot').forEach(b => b.onclick = () => goto(+b.dataset.k));
  $('#ex-prev').onclick = () => goto(exam.idx - 1);
  $('#ex-next').onclick = () => exam.idx < exam.ids.length - 1 ? goto(exam.idx + 1) : askSubmit();
  const askSubmit = () => {
    save();
    const open = exam.ids.filter(id => { const a = exam.answers[id]; const cc = S.cards.get(id); return cc.type !== 'basic' && (a == null || (Array.isArray(a) ? !a.length : !String(a).trim())); }).length;
    $('#ex-confirm').innerHTML = `<div class="confirmbar"><span>${open ? open + ' Aufgaben ohne Antwort. ' : ''}Jetzt abgeben?</span><button class="btn primary small" id="ex-yes">Abgeben</button><button class="btn small" id="ex-no">Weiter bearbeiten</button></div>`;
    $('#ex-yes').onclick = submit; $('#ex-no').onclick = () => $('#ex-confirm').innerHTML = '';
  };
  const submit = () => { save(); clearInterval(examTimer); exam.phase = 'grade'; exam.end = Date.now(); renderGrading(main); };
  $('#ex-submit').onclick = askSubmit;
  const tick = () => {
    const left = exam.start + exam.minutes * 60e3 - Date.now();
    const el = $('#ex-timer'); if (!el) return clearInterval(examTimer);
    if (left <= 0) { toast('Zeit abgelaufen'); return submit(); }
    const m = Math.floor(left / 60e3), s = Math.floor(left / 1000) % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; el.classList.toggle('low', left < 5 * 60e3);
  };
  clearInterval(examTimer); examTimer = setInterval(tick, 1000); tick();
  cleanup = () => { save(); clearInterval(examTimer); };
}
function renderGrading(main) {
  const items = exam.ids.map(id => S.cards.get(id)).filter(Boolean);
  items.forEach(c => {
    if (exam.scores[c.id] != null) return;
    const r = evalAnswer(c, exam.answers[c.id] ?? (c.type === 'mc' ? [] : ''));
    if (r && c.type === 'table') exam.cells = Object.assign(exam.cells || {}, { [c.id]: r.cells });
    if (r && !(c.type === 'table' && exam.scores[c.id] != null)) exam.scores[c.id] = r.ok ? pointsOf(c) : r.part ? Math.floor(pointsOf(c) * r.part * 2) / 2 : 0;
  });
  const pending = items.filter(c => exam.scores[c.id] == null).length;
  const max = items.reduce((s, c) => s + pointsOf(c), 0);
  const got = items.reduce((s, c) => s + (exam.scores[c.id] || 0), 0);
  const pct = max ? got / max * 100 : 0;
  const g = ihkGrade(pct);
  main.innerHTML = `
  <section class="panel">
    <h1>Auswertung</h1>
    <div class="row" style="gap:24px"><div><span class="eyebrow">Ergebnis</span><div class="grade num">${fmtNum(pct)} %</div></div>
      <div><span class="eyebrow">IHK-Note</span><div class="grade num">${g.note}</div><span class="small muted">${g.text}</span></div>
      <div><span class="eyebrow">Punkte</span><div class="grade num" style="font-size:1.6rem">${fmtNum(got, 1)} / ${max}</div><span class="small muted">${Math.round((exam.end - exam.start) / 60e3)} von ${exam.minutes} Minuten</span></div></div>
    ${pending ? `<div class="notice">Noch ${pending} Aufgaben selbst bewerten: Vergleiche deine Antwort mit der Lösung und vergib Punkte.</div>` : ''}
    <div class="row"><button class="btn primary" id="gr-save" ${pending ? 'disabled' : ''}>Ergebnis speichern</button><button class="btn" id="gr-drop">Verwerfen</button></div>
  </section>
  ${items.map((c, k) => {
    const a = exam.answers[c.id]; const p = pointsOf(c);
    const given = c.type === 'mc' ? (a || []).map(i => c.options[i] && c.options[i].text).join(' · ') : c.type === 'order' ? (a || []).map(i => c.items[i]).join(' → ') : (a || '');
    const sc = exam.scores[c.id];
    return `<section class="panel"><div class="row spread"><h3>Aufgabe ${k + 1}</h3><span class="chip ${sc == null ? 'warn' : sc >= p ? 'good' : sc > 0 ? 'warn' : 'bad'}">${sc == null ? 'offen' : fmtNum(sc, 1) + ' / ' + p}</span></div>
      ${renderContent(c.front, c.images)}
      ${c.type === 'table' ? `<div><span class="eyebrow">Deine Antwort und Lösung</span>${tableReview(c, a, (exam.cells || {})[c.id] || {})}</div>` : `<div><span class="eyebrow">Deine Antwort</span><div class="content">${given ? md(String(given)) : '<span class="muted">keine</span>'}</div></div>`}
      <div><span class="eyebrow">Lösung</span>${c.type === 'mc' ? '<div class="content">' + c.options.filter(o => o.correct).map(o => md(o.text)).join('<br>') + '</div>' : ''}${c.type === 'calc' ? `<div class="content"><b>${fmtRes(c.answer)} ${esc(c.unit)}</b></div>` : ''}${c.type === 'order' ? orderSolution(c) : ''}${renderContent(c.back, c.backImages)}</div>
      ${c.type === 'basic' || c.type === 'open' || c.type === 'table' ? `<div class="row"><span class="small muted">${c.type === 'table' ? 'Punkte (automatisch vorgeschlagen, bei Bedarf anpassen):' : 'Punkte:'}</span>${[0, .25, .5, .75, 1].map(f => { const v = Math.round(p * f * 2) / 2; return `<button class="btn small ${sc === v ? 'primary' : ''}" data-score="${c.id}" data-v="${v}">${fmtNum(v, 1)}</button>`; }).filter((v, i, arr) => arr.indexOf(v) === i).join('')}</div>` : ''}
    </section>`;
  }).join('')}`;
  main.querySelectorAll('[data-score]').forEach(b => b.onclick = () => { const y = window.scrollY; exam.scores[b.dataset.score] = +b.dataset.v; renderGrading(main); window.scrollTo(0, y); });
  $('#gr-drop').onclick = () => { exam = null; viewExam(main); };
  $('#gr-save').onclick = async () => {
    const rec = { id: 'ex-' + Date.now(), ts: exam.start, label: exam.label, got, max, pct, minutes: exam.minutes, used: Math.round((exam.end - exam.start) / 60e3), detail: items.map(c => ({ id: c.id, lf: c.lf, s: exam.scores[c.id], p: pointsOf(c) })) };
    S.exams.push(rec); await DB.put('exams', rec); exam = null; toast('Ergebnis gespeichert'); if (location.hash.startsWith('#pruefung')) viewExam(main);
  };
}

// ---------- Statistics ----------
function barChart(values, labels, opts = {}) {
  const W = 600, H = 150, pad = { l: 28, r: 6, t: 8, b: 20 };
  const max = Math.max(1, ...values.map(v => Array.isArray(v) ? v[0] + v[1] : v));
  const nice = Math.ceil(max / 5) * 5 || 5;
  const bw = (W - pad.l - pad.r) / values.length;
  const y = v => H - pad.b - v / nice * (H - pad.t - pad.b);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || '')}">`;
  [0, nice / 2, nice].forEach(t => { s += `<line class="gridline" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.l - 4}" y="${y(t) + 3}" text-anchor="end">${t}</text>`; });
  values.forEach((v, i) => {
    const [a, b] = Array.isArray(v) ? v : [v, 0];
    const x = pad.l + i * bw + bw * 0.15, w = bw * 0.7;
    if (a) s += `<rect class="barfill" x="${x}" y="${y(a)}" width="${w}" height="${y(0) - y(a)}" rx="1.5"><title>${labels[i]}: ${a}</title></rect>`;
    if (b) s += `<rect class="barfill bad" x="${x}" y="${y(a + b)}" width="${w}" height="${y(a) - y(a + b)}" rx="1.5"><title>${labels[i]}: ${b} × Nochmal</title></rect>`;
    if (labels[i] && (values.length <= 14 || i % 5 === 0 || i === values.length - 1)) s += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>`;
  });
  return s + '</svg>';
}
function viewStats(main) {
  const all = [...S.cards.values()];
  const t0 = startOfDay();
  const days = 30;
  const per = Array.from({ length: days }, (_, i) => { const a = t0 - (days - 1 - i) * DAY, b = a + DAY; const ls = S.logs.filter(l => l.ts >= a && l.ts < b); return [ls.filter(l => l.g > 1).length, ls.filter(l => l.g === 1).length]; });
  const perLabels = Array.from({ length: days }, (_, i) => { const d = new Date(t0 - (days - 1 - i) * DAY); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; });
  const fc = Array.from({ length: 14 }, (_, i) => { const a = i === 0 ? 0 : t0 + i * DAY, b = t0 + (i + 1) * DAY; return all.filter(c => { const s = S.states.get(c.id); return s && s.state !== 'new' && s.due >= a && s.due < b; }).length; });
  const fcLabels = Array.from({ length: 14 }, (_, i) => i === 0 ? 'heute' : '+' + i);
  const rev = S.logs.filter(l => l.ts >= t0 - 29 * DAY && l.state === 'review' && !l.cram);
  const retention = rev.length ? rev.filter(l => l.g > 1).length / rev.length * 100 : null;
  const streak = (() => {
    const days = new Set(S.logs.map(l => startOfDay(l.ts)));
    let d = days.has(t0) ? t0 : startOfDay(t0 - DAY / 2), n = 0; // heute zählt, sobald gelernt
    while (days.has(d)) { n++; d = startOfDay(d - DAY / 2); }
    return n;
  })();
  const rows = [1, 2, 3, 4, 5, 6, 0].map(lf => {
    const cs = all.filter(c => c.lf === lf); if (!cs.length) return '';
    const ids = new Set(cs.map(c => c.id));
    const ls = S.logs.filter(l => ids.has(l.card) && !l.cram);
    const err = ls.length ? ls.filter(l => l.g === 1).length / ls.length * 100 : null;
    const ex = S.exams.flatMap(e => e.detail || []).filter(d => d.lf === lf);
    const exPct = ex.length ? ex.reduce((s, d) => s + (d.s || 0), 0) / ex.reduce((s, d) => s + d.p, 0) * 100 : null;
    return `<tr><td><b>LF ${lf || '–'}</b> <span class="muted small">${esc(LF[lf])}</span></td><td class="n">${cs.length}</td><td class="n">${cs.filter(c => cardStatus(c.id) !== 'new').length}</td><td class="n">${cs.filter(c => cardStatus(c.id) === 'mastered').length}</td><td class="n">${err == null ? '–' : fmtNum(err) + ' %'}</td><td class="n">${exPct == null ? '–' : fmtNum(exPct) + ' %'}</td></tr>`;
  }).join('');
  const weak = all.filter(c => S.states.has(c.id) && S.states.get(c.id).state !== 'new' && (S.states.get(c.id).lapses || 0) > 0).sort((a, b) => weakness(b) - weakness(a)).slice(0, 8);
  main.innerHTML = `
  <section class="panel">
    <h1>Statistik</h1>
    <div class="kpis">
      <div class="kpi"><b>${S.logs.length}</b><span>Bewertungen gesamt</span></div>
      <div class="kpi"><b>${retention == null ? '–' : fmtNum(retention) + ' %'}</b><span>Trefferquote Wiederholungen (30 T)</span></div>
      <div class="kpi"><b>${streak}</b><span>Tage in Folge gelernt</span></div>
      <div class="kpi"><b>${all.filter(c => cardStatus(c.id) === 'mastered').length}/${all.length}</b><span>Karten sitzen</span></div>
    </div>
  </section>
  <section class="panel"><div class="row spread"><h2>Gelernt pro Tag</h2><div class="legend"><span><i style="background:var(--accent)"></i>gewusst</span><span><i style="background:var(--bad)"></i>Nochmal</span></div></div>${barChart(per, perLabels, { label: 'Bewertungen der letzten 30 Tage' })}</section>
  <section class="panel"><h2>Fällig in den nächsten 14 Tagen</h2>${barChart(fc, fcLabels, { label: 'Fällige Karten pro Tag' })}</section>
  <section class="panel"><h2>Nach Lernfeld</h2><div class="tablewrap"><table class="data"><tr><th>Lernfeld</th><th class="n">Karten</th><th class="n">gesehen</th><th class="n">sitzen</th><th class="n">Fehlerquote</th><th class="n">Prüfung</th></tr>${rows}</table></div></section>
  ${weak.length ? `<section class="panel"><h2>Deine schwierigsten Karten</h2><div class="cardlist">${weak.map(c => `<div class="cl-item" data-id="${esc(c.id)}"><span class="cl-front">${esc(c.front.replace(/\n/g, ' '))}</span><span class="small muted num">${S.states.get(c.id).lapses}× vergessen</span></div>`).join('')}</div></section>` : ''}
  ${examHistory()}`;
  main.querySelectorAll('.cl-item').forEach(el => el.onclick = () => { editCardId = el.dataset.id; go('karten'); });
}

// ---------- Data: export / import / settings ----------
function exportData(withCards = true) {
  return {
    schema: SCHEMA, exportedAt: new Date().toISOString(), device: navigator.userAgent.includes('Android') ? 'Android' : 'PC',
    settings: S.settings, cards: withCards ? [...S.cards.values()] : [], states: [...S.states.values()], logs: S.logs, exams: S.exams
  };
}
async function mergeData(d) {
  if (!d || (d.schema !== SCHEMA && !Array.isArray(d.cards))) throw new Error('Unbekanntes Dateiformat');
  let nc = 0, ns = 0, nl = 0;
  const cards = (d.cards || []).filter(c => { const cur = S.cards.get(c.id); return !cur || (c.updated || 0) > (cur.updated || 0); });
  if (cards.length) { cards.forEach(c => S.cards.set(c.id, c)); await DB.put('cards', cards); nc = cards.length; }
  const states = (d.states || []).filter(s => { const cur = S.states.get(s.id); return !cur || (s.last || 0) > (cur.last || 0); });
  if (states.length) { states.forEach(s => S.states.set(s.id, s)); await DB.put('states', states); ns = states.length; }
  const have = new Set(S.logs.map(l => l.id));
  const logs = (d.logs || []).filter(l => !have.has(l.id));
  if (logs.length) { S.logs.push(...logs); S.logs.sort((a, b) => a.ts - b.ts); await DB.put('logs', logs); nl = logs.length; }
  const haveEx = new Set(S.exams.map(e => e.id));
  const exams = (d.exams || []).filter(e => !haveEx.has(e.id));
  if (exams.length) { S.exams.push(...exams); S.exams.sort((a, b) => a.ts - b.ts); await DB.put('exams', exams); }
  if (d.settings && d.settings.examDate) { S.settings.examDate = d.settings.examDate; await saveSettings(); }
  return `${nc} Karten, ${ns} Lernstände, ${nl} Bewertungen, ${exams.length} Simulationen übernommen`;
}
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split('\n')[0];
  const delim = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map(h => h.trim().toLowerCase());
  const alias = { frage: 'front', vorderseite: 'front', antwort: 'back', rückseite: 'back', lernfeld: 'lf', thema: 'topic', typ: 'type', stapel: 'deck', optionen: 'options', ergebnis: 'answer', einheit: 'unit', punkte: 'points', quelle: 'source', toleranz: 'tolerance', schwierigkeit: 'level', tabelle: 'table', luecken: 'blanks', lücken: 'blanks' };
  return rows.filter(r => r.some(x => x.trim())).map(r => {
    const o = {}; head.forEach((h, k) => o[alias[h] || h] = (r[k] || '').trim());
    if (o.options) o.options = o.options.split('|').map(s => s.trim()).filter(Boolean);
    if (o.type === 'order' && o.options && !o.items) { o.items = o.options; delete o.options; }
    return o;
  });
}
// Text aus einer Datei aufbereiten: BOM entfernen und JSON aus einer HTML-Hülle holen
// (z. B. wenn der Handy-Browser die Datei als Webseite gespeichert hat)
function unwrapImportText(text, name) {
  let t = String(text || '').replace(/^\uFEFF/, '').trim();
  const label = name ? `„${name}“` : 'Der Text';
  if (/^MSMAMARPCRYPT/.test(t)) throw new Error(`${label} wurde von einer Firmen-App (Microsoft Intune, z. B. Outlook oder Teams) verschlüsselt und kann nicht gelesen werden. Lade die Datei auf einem privaten Weg aufs Handy, z. B. per Google Drive, privater Mail-App, USB-Kabel oder direkt über die Claude-App.`);
  if (!t) throw new Error(`${label} ist leer. Bitte die Datei noch einmal herunterladen und prüfen, ob sie größer als 0 KB ist.`);
  if (t.startsWith('<')) {
    const doc = new DOMParser().parseFromString(t, 'text/html');
    const inner = (doc.querySelector('pre') || doc.body || doc.documentElement).textContent.trim();
    const k = inner.search(/[\[{]/);
    if (k < 0) throw new Error(`${label} ist eine Webseite und keine Kartendatei. Lade die Datei direkt herunter (nicht im Browser öffnen und speichern).`);
    t = inner.slice(k);
  }
  return t;
}
async function importCardsText(text, name = '') {
  let list;
  const t = unwrapImportText(text, name);
  if (t.startsWith('{') || t.startsWith('[')) {
    const d = JSON.parse(t);
    if (d.schema === SCHEMA) return mergeData(d);
    list = Array.isArray(d) ? d : d.cards;
    if (!Array.isArray(list)) throw new Error('JSON enthält kein Karten-Array');
    // Prüfungs-Format: { exam: "...", deck, tasks: [...] } wird wie cards behandelt
  } else {
    list = parseCSV(t);
    if (list.length && !list.some(c => c.front)) throw new Error(`In ${name ? '„' + name + '“' : 'dem Text'} fehlt die Spalte „front“ bzw. „Frage“. Anfang der Datei: ${t.slice(0, 60)}`);
  }
  const bad = list.filter(c => !c.front);
  if (!list.length || bad.length === list.length) throw new Error(`Keine Karten gefunden${name ? ' in „' + name + '“' : ''}. Anfang der Datei: ${t.slice(0, 60)}`);
  list = list.filter(c => c.front);
  const n = await upsertCards(list);
  return `${n} Karten importiert${bad.length ? `, ${bad.length} ohne Frage übersprungen` : ''}${name ? ' aus ' + name : ''}`;
}
function download(name, text) {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return true;
  } catch (e) { return false; }
}
function viewData(main) {
  const deckList = decks().map(d => `<option>${esc(d)}</option>`).join('');
  main.innerHTML = `
  <section class="panel">
    <h1>Daten</h1>
    <h2>Zwischen Geräten abgleichen</h2>
    <p class="small muted">Exportiere auf Gerät A, öffne die Datei auf Gerät B mit „Sicherung einlesen“. Es wird zusammengeführt, nichts überschrieben: pro Karte gewinnt der neuere Lernstand. Am einfachsten geht die Datei per Cloud-Ordner, Mail an dich selbst oder Messenger rüber.</p>
    <div class="row">
      <button class="btn primary" id="dt-export">Sicherung speichern</button>
      <button class="btn" id="dt-share">Teilen …</button>
      <button class="btn" id="dt-copy">In Zwischenablage</button>
      <label class="btn">Sicherung einlesen<input type="file" id="dt-import" accept=".json,.txt,application/json,text/plain" hidden></label>
    </div>
    <details><summary class="small">Sicherung als Text einfügen</summary><div class="stack" style="margin-top:8px"><textarea id="dt-paste" class="mono" placeholder="Inhalt der Sicherungsdatei hier einfügen"></textarea><button class="btn" id="dt-paste-go">Einlesen</button></div></details>
    <p class="small muted">Letzter Export: ${S.settings.lastExport ? new Date(S.settings.lastExport).toLocaleString('de-DE') : 'noch nie'}</p>
  </section>
  <section class="panel">
    <h2>Karten und Prüfungsaufgaben importieren</h2>
    <p class="small muted">JSON im AP1-Trainer-Format oder CSV mit Kopfzeile, z. B. <code>id;lf;thema;typ;frage;antwort;optionen;ergebnis;einheit;punkte;stapel;quelle</code>. Bei Multiple Choice die Optionen mit <code>|</code> trennen und richtige mit <code>*</code> markieren. Gleiche ID überschreibt die Karte, der Lernstand bleibt.</p>
    <div class="row"><label class="btn primary">Datei wählen<input type="file" id="dt-cards" accept=".json,.csv,.txt,.tsv,application/json,text/plain,text/csv,text/html" multiple hidden></label></div>
    <details><summary class="small">Als Text einfügen</summary><div class="stack" style="margin-top:8px"><textarea id="dt-cardtext" class="mono" placeholder='[{"id":"uf-001","lf":3,"type":"basic","front":"…","back":"…"}]'></textarea><button class="btn" id="dt-cardtext-go">Importieren</button></div></details>
  </section>
  <section class="panel">
    <h2>Einstellungen</h2>
    <div class="fields">
      <label class="field">Prüfungstermin<input type="date" id="dt-date" value="${esc(S.settings.examDate)}"></label>
      <label class="field">Neue Karten pro Tag<input type="number" id="dt-new" min="0" max="200" value="${S.settings.newPerDay}"></label>
      <label class="field">Ziel-Trefferquote<select id="dt-ret">${[0.85, 0.9, 0.93, 0.95].map(r => `<option value="${r}" ${S.settings.retention === r ? 'selected' : ''}>${Math.round(r * 100)} %${r === 0.9 ? ' (Standard)' : ''}</option>`).join('')}</select></label>
    </div>
    <p class="small muted">Empfohlen: ${recommendedNewPerDay()} neue Karten pro Tag, damit alle Karten 4 Wochen vor der Prüfung einmal gelernt sind. Wiederholungsabstände werden nie über den Prüfungstermin hinaus geplant.</p>
    <div class="row"><button class="btn" id="dt-save">Einstellungen speichern</button></div>
    <p class="small muted">App-Version: <span class="num" id="dt-version">${versionText()}</span></p>
    <div class="row"><button class="btn small" id="dt-refresh">App neu laden (Update holen)</button></div>
  </section>
  <section class="panel">
    <h2>Aufräumen</h2>
    <div class="row"><select id="dt-deck" style="max-width:260px">${deckList}</select><button class="btn danger" id="dt-deldeck" ${deckList ? '' : 'disabled'}>Stapel löschen</button><button class="btn danger" id="dt-wipe">Alles zurücksetzen</button></div>
    <div id="dt-confirm"></div>
    <p class="small muted">Speicher: ${S.cards.size} Karten, ${S.logs.length} Bewertungen. ${DB.db ? 'Daten liegen nur in diesem Browser auf diesem Gerät.' : '<b>Achtung: Der Browser erlaubt hier keinen dauerhaften Speicher. Bitte regelmäßig exportieren.</b>'}</p>
  </section>`;
  const json = () => JSON.stringify(exportData());
  const fname = () => `ap1-trainer-${new Date().toISOString().slice(0, 10)}.json`;
  const mark = async () => { S.settings.lastExport = Date.now(); await saveSettings(); };
  $('#dt-export').onclick = async () => { if (download(fname(), json())) { await mark(); toast('Sicherung gespeichert'); } else toast('Speichern geht hier nicht. Nutze „In Zwischenablage“.'); };
  $('#dt-share').onclick = async () => {
    try {
      const file = new File([json()], fname(), { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'AP1-Trainer Sicherung' }); await mark(); }
      else toast('Teilen wird von diesem Browser nicht unterstützt.');
    } catch (e) { if (e.name !== 'AbortError') toast('Teilen fehlgeschlagen'); }
  };
  $('#dt-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(json()); await mark(); toast('Kopiert'); }
    catch (e) { const ta = $('#dt-paste'); ta.closest('details').open = true; ta.value = json(); ta.select(); toast('Text markiert, bitte manuell kopieren'); }
  };
  const doImport = async (fn) => { try { toast(await fn()); } catch (e) { toast('Import fehlgeschlagen: ' + e.message); } };
  $('#dt-import').onchange = e => doImport(async () => { const f = e.target.files[0]; e.target.value = ''; if (!f) throw new Error('Keine Datei gewählt.'); return mergeData(JSON.parse(unwrapImportText(await readText(f), f.name))); });
  $('#dt-paste-go').onclick = () => doImport(async () => mergeData(JSON.parse($('#dt-paste').value)));
  $('#dt-cards').onchange = e => doImport(async () => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) throw new Error('Das Handy hat keine Datei übergeben. Bitte noch einmal wählen.');
    const out = []; for (const f of files) out.push(await importCardsText(await readText(f), f.name)); return out.join(' · ');
  });
  $('#dt-cardtext-go').onclick = () => doImport(async () => importCardsText($('#dt-cardtext').value));
  $('#dt-refresh').onclick = async () => {
    // Offline-Cache leeren und Seite frisch laden. Karten und Lernstand liegen in der Datenbank und bleiben erhalten.
    try {
      if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch (e) { /* egal, wir laden trotzdem neu */ }
    location.reload();
  };
  $('#dt-save').onclick = async () => {
    S.settings.examDate = $('#dt-date').value || S.settings.examDate;
    S.settings.newPerDay = Math.max(0, +$('#dt-new').value || 0);
    S.settings.retention = +$('#dt-ret').value;
    await saveSettings(); toast('Gespeichert');
  };
  const confirmBox = (text, action) => {
    $('#dt-confirm').innerHTML = `<div class="confirmbar"><span>${text}</span><button class="btn danger small" id="dt-yes">Ja, löschen</button><button class="btn small" id="dt-no">Abbrechen</button></div>`;
    $('#dt-yes').onclick = async () => { await action(); viewData(main); };
    $('#dt-no').onclick = () => $('#dt-confirm').innerHTML = '';
  };
  $('#dt-deldeck').onclick = () => {
    const d = $('#dt-deck').value; const ids = [...S.cards.values()].filter(c => c.deck === d).map(c => c.id);
    confirmBox(`Stapel „${esc(d)}“ mit ${ids.length} Karten und deren Lernstand löschen?`, async () => { await deleteCards(ids); toast('Stapel gelöscht'); });
  };
  $('#dt-wipe').onclick = () => confirmBox('Alle Karten, Lernstände und Simulationen auf diesem Gerät löschen? Vorher exportieren!', async () => {
    for (const s of ['cards', 'states', 'logs', 'exams']) await DB.clear(s);
    S.cards.clear(); S.states.clear(); S.logs = []; S.exams = []; toast('Zurückgesetzt');
  });
}

// ---------- Boot ----------
(async function boot() {
  await load();
  window.addEventListener('hashchange', route);
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => go(t.dataset.view));
  route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && document.querySelector('link[rel=manifest]')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => { /* kein Offline-Cache in dieser Umgebung */ });
    // Neue Version wurde aktiv: einmal neu laden, damit sie sofort gilt
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }
})();
