'use strict';
/* Ankieta: planogramy — serwer (Node.js + Express + PostgreSQL), pod Railway.
   Tabela tworzy się sama przy pierwszym starcie. Odpowiednik w Prismie: dla-kamila/schema.prisma.
   Zmienne środowiskowe:
     DATABASE_URL       — adres bazy PostgreSQL (Railway podaje go sam)
     PANEL_HASLO        — hasło do panelu wyników (wymagane)
     ANKIETA_KOD        — opcjonalny kod w linku (?k=KOD); bez niego formularz nie przyjmie odpowiedzi
     ANKIETA_ZAMKNIETA  — ustaw na 1, żeby zamknąć ankietę (formularz pokaże komunikat)
     SESJA_SEKRET       — opcjonalnie; klucz do podpisu sesji panelu */
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const JSZip = require('jszip');
const { Pool } = require('pg');
const A = require('./shared/pytania.js');

const DB_URL = process.env.DATABASE_URL || '';
const lokalna = /@(localhost|127\.0\.0\.1|[^/]*\.railway\.internal)[:/]/.test(DB_URL) || /host=\//.test(DB_URL);
const pool = new Pool({ connectionString: DB_URL, ssl: (lokalna || /sslmode=disable/.test(DB_URL)) ? false : { rejectUnauthorized: false }, max: 5 });

const db = {
  async przygotuj() {
    await pool.query(`CREATE TABLE IF NOT EXISTS odpowiedz (
      id SERIAL PRIMARY KEY,
      utworzono TIMESTAMPTZ NOT NULL DEFAULT now(),
      ankieta TEXT NOT NULL DEFAULT 'planogramy-2026',
      wersja INTEGER NOT NULL DEFAULT 2,
      dane JSONB NOT NULL)`);
    await pool.query('CREATE INDEX IF NOT EXISTS odpowiedz_ankieta_idx ON odpowiedz (ankieta)');
  },
  async dodaj(dane) {
    await pool.query('INSERT INTO odpowiedz (ankieta, wersja, dane) VALUES ($1, $2, $3)', [A.ID, A.WERSJA, JSON.stringify(dane)]);
  },
  async wszystkie() {
    const r = await pool.query('SELECT id, utworzono, dane FROM odpowiedz WHERE ankieta = $1 ORDER BY id', [A.ID]);
    return r.rows;
  },
  async usun(id) {
    const r = await pool.query('DELETE FROM odpowiedz WHERE id = $1 AND ankieta = $2', [id, A.ID]);
    return r.rowCount > 0;
  }
};

const app = express();
const PORT = process.env.PORT || 3000;
const HASLO = process.env.PANEL_HASLO || '';
const KOD = (process.env.ANKIETA_KOD || '').trim();
const ZAMKNIETA = /^(1|tak|true)$/i.test((process.env.ANKIETA_ZAMKNIETA || '').trim());
const SEKRET = process.env.SESJA_SEKRET || crypto.createHash('sha256').update('ankieta-planogramy|' + HASLO).digest('hex');
const SESJA_GODZ = 12;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Frame-Options', 'DENY');
  next();
});
app.use(express.json({ limit: '64kb' }));

/* ---------- pomocnicze ---------- */
function rowne(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function kodOk(k) { return !KOD || rowne(k || '', KOD); }

function podpisz(exp) { return crypto.createHmac('sha256', SEKRET).update(String(exp)).digest('hex'); }
function ciasteczka(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function zalogowany(req) {
  if (!HASLO) return false;
  const t = ciasteczka(req).sesja || '';
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return rowne(sig, podpisz(exp));
}
function wymagajLogowania(req, res, next) {
  if (zalogowany(req)) return next();
  res.status(401).json({ blad: 'Zaloguj się do panelu.' });
}

/* limit wysyłek z jednego adresu — trzymany tylko w pamięci, adres nie trafia do bazy.
   Wysoki próg celowo: cały zespół na spotkaniu wypełnia przez jedno firmowe Wi-Fi (ten sam adres). */
const wysylki = new Map();
function zaDuzo(ip) {
  const teraz = Date.now(), okno = 60 * 60 * 1000;
  const lista = (wysylki.get(ip) || []).filter(t => teraz - t < okno);
  lista.push(teraz);
  wysylki.set(ip, lista);
  if (wysylki.size > 5000) wysylki.clear();
  return lista.length > 300;
}

/* limit błędnych logowań do panelu: 10 prób na 15 minut z jednego adresu (tylko w pamięci) */
const bledneLogowania = new Map();
function zaDuzoLogowan(ip, dopisz) {
  const teraz = Date.now(), okno = 15 * 60 * 1000;
  const lista = (bledneLogowania.get(ip) || []).filter(t => teraz - t < okno);
  if (dopisz) lista.push(teraz);
  bledneLogowania.set(ip, lista);
  if (bledneLogowania.size > 5000) bledneLogowania.clear();
  return lista.length >= 10;
}

/* ---------- strony ---------- */
app.get('/pytania.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'shared', 'pytania.js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'panel.html')));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/zdrowie', (req, res) => res.type('text').send('ok'));

/* ---------- formularz ---------- */
app.get('/api/konfig', (req, res) => {
  res.json({ zamknieta: ZAMKNIETA, kodOk: kodOk(req.query.k) });
});

app.post('/api/odpowiedz', async (req, res) => {
  try {
    if (ZAMKNIETA) return res.status(403).json({ blad: 'Ankieta jest już zamknięta.' });
    const body = req.body || {};
    if (!kodOk(body.k)) return res.status(403).json({ blad: 'Link jest niepełny. Otwórz ankietę z linku, który dostałeś w wiadomości.' });
    if (zaDuzo(req.ip)) return res.status(429).json({ blad: 'Zbyt wiele wysyłek z tego urządzenia. Spróbuj za godzinę.' });
    const w = A.waliduj(body.dane);
    if (!w.ok) return res.status(400).json({ blad: 'Uzupełnij brakujące odpowiedzi.', bledy: w.bledy });
    await db.dodaj(w.czyste);
    res.json({ ok: true });
  } catch (e) {
    console.error('Zapis odpowiedzi:', e);
    res.status(500).json({ blad: 'Nie zapisałem odpowiedzi — błąd serwera. Spróbuj ponownie za chwilę.' });
  }
});

/* ---------- panel ---------- */
app.get('/api/sesja', (req, res) => res.json({ zalogowany: zalogowany(req), hasloUstawione: !!HASLO }));

app.post('/api/login', async (req, res) => {
  if (!HASLO) return res.status(503).json({ blad: 'Hasło panelu nie jest ustawione (zmienna PANEL_HASLO).' });
  if (zaDuzoLogowan(req.ip, false)) return res.status(429).json({ blad: 'Zbyt wiele błędnych prób. Spróbuj ponownie za 15 minut.' });
  const haslo = (req.body && req.body.haslo) || '';
  if (!rowne(haslo, HASLO)) {
    zaDuzoLogowan(req.ip, true);
    await new Promise(r => setTimeout(r, 700));
    return res.status(401).json({ blad: 'Nieprawidłowe hasło.' });
  }
  const exp = Date.now() + SESJA_GODZ * 3600 * 1000;
  const bezpieczne = req.secure ? '; Secure' : '';
  res.set('Set-Cookie', `sesja=${exp}.${podpisz(exp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESJA_GODZ * 3600}${bezpieczne}`);
  res.json({ ok: true });
});

app.post('/api/wyloguj', (req, res) => {
  res.set('Set-Cookie', 'sesja=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/wyniki', wymagajLogowania, async (req, res) => {
  try {
    const rows = await db.wszystkie();
    const baza = `${req.protocol}://${req.get('host')}/`;
    res.json({
      wiersze: rows.map(r => ({ id: r.id, utworzono: r.utworzono, dane: r.dane })),
      link: KOD ? `${baza}?k=${encodeURIComponent(KOD)}` : baza,
      zamknieta: ZAMKNIETA
    });
  } catch (e) {
    console.error('Odczyt wyników:', e);
    res.status(500).json({ blad: 'Błąd odczytu bazy.' });
  }
});

app.delete('/api/odpowiedz/:id', wymagajLogowania, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ blad: 'Zły numer.' });
  try {
    if (await db.usun(id)) return res.json({ ok: true });
    res.status(404).json({ blad: 'Nie ma takiej ankiety.' });
  } catch (e) {
    console.error('Usuwanie:', e);
    res.status(500).json({ blad: 'Błąd bazy.' });
  }
});

function poleCsv(v) {
  const s = String(v === undefined || v === null ? '' : v);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

app.get('/api/eksport.csv', wymagajLogowania, async (req, res) => {
  try {
    const rows = await db.wszystkie();
    const linie = [A.naglowkiCsv().map(poleCsv).join(';')];
    rows.forEach((r, i) => {
      const d = new Date(r.utworzono).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
      linie.push(A.wierszCsv(i + 1, r.dane || {}, d).map(poleCsv).join(';'));
    });
    const dzis = new Date().toISOString().slice(0, 10);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="Ankieta_planogramy_wyniki_${dzis}.csv"`);
    res.send('﻿' + linie.join('\r\n') + '\r\n');
  } catch (e) {
    console.error('Eksport:', e);
    res.status(500).send('Błąd eksportu.');
  }
});

/* ---------- eksport do Excela w standardzie Stalco ----------
   Bierzemy gotowy szablon (logo, zieleń, Montserrat, formuły Podsumowania) i wpisujemy
   odpowiedzi w arkusz „Wyniki” od wiersza 9 — bez przebudowy pliku, więc wygląd zostaje 1:1.
   Formuły przeliczają się przy otwarciu w Excelu (fullCalcOnLoad w szablonie). */
const SZABLON = path.join(__dirname, 'szablony', 'Ankieta_planogramy_Stalco_2026.xlsx');
const WYNIKI_PIERWSZY = 9, WYNIKI_OSTATNI = 208;

function litera(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function xmlTekst(s) {
  return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function plikWynikow(rows) {
  const zip = await JSZip.loadAsync(fs.readFileSync(SZABLON));
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const rid = (wbXml.match(/<sheet [^>]*name="Wyniki"[^>]*r:id="([^"]+)"/) || [])[1];
  const cel = rid && (relsXml.match(new RegExp('<Relationship[^>]*Id="' + rid + '"[^>]*Target="([^"]+)"')) ||
                      relsXml.match(new RegExp('<Relationship[^>]*Target="([^"]+)"[^>]*Id="' + rid + '"')) || [])[1];
  if (!cel) throw new Error('Nie znalazłem arkusza Wyniki w szablonie');
  const sciezka = 'xl/' + cel.replace(/^\/?xl\//, '');
  let xml = await zip.file(sciezka).async('string');
  rows.slice(0, WYNIKI_OSTATNI - WYNIKI_PIERWSZY + 1).forEach((r, i) => {
    const nr = WYNIKI_PIERWSZY + i;
    const wartosci = A.wierszCsv(i + 1, r.dane || {}, '').slice(1, 28); // kolumny B..AB, bez Lp i daty
    wartosci.forEach((v, j) => {
      if (v === '' || v === null || v === undefined) return;
      const ref = litera(j + 2) + nr;
      const wzor = new RegExp('<c r="' + ref + '"( s="\\d+")?( t="n")?\\s*(?:/>|></c>)');
      const nowa = typeof v === 'number'
        ? '<c r="' + ref + '"$1><v>' + v + '</v></c>'
        : '<c r="' + ref + '"$1 t="inlineStr"><is><t xml:space="preserve">' + xmlTekst(v) + '</t></is></c>';
      xml = xml.replace(wzor, nowa);
    });
  });
  zip.file(sciezka, xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

app.get('/api/eksport.xlsx', wymagajLogowania, async (req, res) => {
  try {
    const rows = await db.wszystkie();
    const bufor = await plikWynikow(rows);
    const dzis = new Date().toISOString().slice(0, 10);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="Ankieta_planogramy_wyniki_${dzis}.xlsx"`);
    if (rows.length > WYNIKI_OSTATNI - WYNIKI_PIERWSZY + 1) res.set('X-Uwaga', 'Ponad 200 ankiet - w Excelu pierwsze 200, pelna lista w CSV');
    res.send(bufor);
  } catch (e) {
    console.error('Eksport xlsx:', e);
    res.status(500).send('Błąd eksportu do Excela.');
  }
});

async function start() {
  if (!DB_URL) { console.error('BRAK DATABASE_URL — podepnij bazę PostgreSQL w Railway (zmienna DATABASE_URL).'); process.exit(1); }
  for (let proba = 1; ; proba++) {
    try { await db.przygotuj(); break; }
    catch (e) {
      if (proba >= 10) { console.error('Nie połączyłem się z bazą:', e.message); process.exit(1); }
      console.warn(`Baza jeszcze nie odpowiada (próba ${proba}/10), czekam 3 s…`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  app.listen(PORT, () => {
  if (!fs.existsSync(SZABLON)) console.warn('UWAGA: brak szablonu Excela ' + SZABLON + ' — eksport .xlsx nie zadziała.');
    console.log(`Ankieta planogramy działa na porcie ${PORT}`);
    if (!HASLO) console.warn('UWAGA: brak PANEL_HASLO — panel wyników jest zablokowany.');
    if (!KOD) console.warn('Info: brak ANKIETA_KOD — formularz przyjmuje odpowiedzi z samego adresu strony.');
  });
}
start();
