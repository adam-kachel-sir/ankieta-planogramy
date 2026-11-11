(function () {
  'use strict';
  var A = window.ANKIETA;
  var el = function (id) { return document.getElementById(id); };
  var wiersze = [];
  var zegar = null;
  var ROLE = A.ROLE;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function liczba(x, miejsca) { return x === null || x === undefined || isNaN(x) ? '—' : x.toFixed(miejsca === undefined ? 2 : miejsca).replace('.', ','); }
  function proc(x) { return x === null || isNaN(x) ? '—' : Math.round(x * 100) + '%'; }
  function kolor(x) { if (x === null || isNaN(x)) return ''; return x >= 4.5 ? 'c-ok' : (x >= 3.5 ? 'c-uwaga' : 'c-zle'); }
  function data(d) { return new Date(d).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  function pokazAlert(t, typ) { var a = el('alert'); a.textContent = t || ''; a.className = 'alert' + (t ? ' pokaz ' + (typ || 'zly') : ''); }

  function api(url, opcje) {
    return fetch(url, Object.assign({ credentials: 'same-origin' }, opcje || {})).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; });
    });
  }

  /* ---------- obliczenia ---------- */
  function grupa(rola) { return rola ? wiersze.filter(function (w) { return w.dane.A1 === rola; }) : wiersze; }

  function sredniaSkali(q, rola) {
    var suma = 0, n = 0, nd = 0;
    grupa(rola).forEach(function (w) {
      var v = w.dane[q.id];
      if (v === A.SKALA.nd) nd++;
      else if (typeof v === 'number') { suma += q.odwrocone ? 7 - v : v; n++; }
    });
    return { sr: n ? suma / n : null, n: n, nd: nd };
  }

  function sredniaObszaru(s, rola) {
    var vals = A.PYTANIA.filter(function (q) { return q.s === s && q.typ === 'skala'; })
      .map(function (q) { return sredniaSkali(q, rola).sr; })
      .filter(function (x) { return x !== null; });
    return vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
  }

  function testProc(q, rola) {
    var n = 0, ok = 0;
    grupa(rola).forEach(function (w) { var v = w.dane[q.id]; if (v) { n++; if (v === q.poprawna) ok++; } });
    return { p: n ? ok / n : null, n: n };
  }

  function rozklad(q) {
    var licz = {}, odp = 0;
    q.opcje.forEach(function (o) { licz[typeof o === 'string' ? o : o.w] = 0; });
    wiersze.forEach(function (w) {
      var v = w.dane[q.id];
      if (v === undefined || v === null || (Array.isArray(v) && !v.length)) return;
      odp++;
      (Array.isArray(v) ? v : [v]).forEach(function (x) { if (licz[x] !== undefined) licz[x]++; });
    });
    return { licz: licz, odp: odp };
  }

  /* ---------- widoki ---------- */
  function kafle() {
    var html = '<div class="kafel glowny"><div class="liczba">' + wiersze.length + '</div><div class="opis">ankiet razem</div></div>';
    var sumaRol = 0;
    ROLE.forEach(function (r) {
      var n = grupa(r).length; sumaRol += n;
      html += '<div class="kafel"><div class="liczba">' + n + '</div><div class="opis">' + esc(r) + '</div></div>';
    });
    var nie = wiersze.filter(function (w) { return w.dane.A2 === A.NIE_KORZYSTAM; }).length;
    html += '<div class="kafel"><div class="liczba">' + nie + '</div><div class="opis">nie korzysta z planogramów</div></div>';
    el('kafle').innerHTML = html;
    var k = el('kontrola');
    if (sumaRol === wiersze.length) { k.className = 'kontrola ok'; k.textContent = 'Kontrola: suma ról = liczba ankiet (' + wiersze.length + '), zgadza się.'; }
    else { k.className = 'kontrola zle'; k.textContent = 'Kontrola: suma ról (' + sumaRol + ') ≠ liczba ankiet (' + wiersze.length + ') — sprawdź listę ankiet.'; }
  }

  function naglowekRol(pierwsza) {
    return '<tr><th>' + esc(pierwsza) + '</th><th>Wszyscy</th>' + ROLE.map(function (r) { return '<th>' + esc(r) + '</th>'; }).join('') + '</tr>';
  }

  function blokRozkladu(q, tytul, opis, klucz) {
    var r = rozklad(q);
    var max = Math.max.apply(null, Object.keys(r.licz).map(function (k) { return r.licz[k]; }).concat([1]));
    var h = '<div class="blok"><h3>' + esc(tytul) + '</h3><p class="pod">' + esc(opis) + ' · odpowiedzi: ' + r.odp + '</p><div class="rozklad">';
    q.opcje.forEach(function (o, i) {
      var w = typeof o === 'string' ? o : o.w, t = typeof o === 'string' ? o : o.w + ') ' + o.t;
      var n = r.licz[w];
      var meta = klucz ? '<div class="r-meta">' + esc(klucz[i].przyczyna) + ' → ' + esc(klucz[i].kto) + '</div>' : '';
      h += '<div class="r-wiersz"><div>' + esc(t) + meta + '</div><div class="r-tor"><div class="r-wyp" style="width:' + Math.round(n / max * 100) + '%"></div></div>' +
        '<div class="r-licz">' + n + ' · ' + proc(r.odp ? n / r.odp : null) + '</div></div>';
    });
    return h + '</div></div>';
  }

  function podsumowanie() {
    var h = '';
    if (!wiersze.length) { el('z-podsumowanie').innerHTML = '<p class="pusto">Nie ma jeszcze żadnej ankiety. Wyniki pojawią się tu po pierwszej wysyłce.</p>'; return; }

    h += '<div class="blok"><h3>Wynik obszarów</h3><p class="pod">Średnia pytań na skali 1–6 po odwróceniu pytań negatywnych — wyższa liczba = lepiej.</p><div class="tabela-wrap"><table>' + naglowekRol('Obszar');
    ['B', 'C', 'D', 'E'].forEach(function (s) {
      var sek = A.SEKCJE.filter(function (x) { return x.id === s; })[0];
      h += '<tr class="obszar"><td>' + esc(sek.obszar) + '</td>';
      [null].concat(ROLE).forEach(function (r) { var x = sredniaObszaru(s, r); h += '<td class="' + kolor(x) + '">' + liczba(x) + '</td>'; });
      h += '</tr>';
    });
    h += '</table></div><p class="legenda">Progi:<span class="c-ok"></span>≥ 4,5 mocna strona<span class="c-uwaga"></span>3,5–4,49 do poprawy<span class="c-zle"></span>&lt; 3,5 priorytet</p></div>';

    h += '<div class="blok"><h3>Pytania na skali</h3><p class="pod">Średnia po odwróceniu · „nd” = ile osób wybrało „nie dotyczy / nie wiem”.</p><div class="tabela-wrap"><table>' +
      '<tr><th>Pytanie</th><th>Wszyscy</th><th>n</th><th>nd</th>' + ROLE.map(function (r) { return '<th>' + esc(r) + '</th>'; }).join('') + '</tr>';
    A.PYTANIA.filter(function (q) { return q.typ === 'skala'; }).forEach(function (q) {
      var c = sredniaSkali(q, null);
      h += '<tr><td><b>' + q.id + '</b> ' + esc(q.tekst) + (q.odwrocone ? '<span class="odwr">odwr.</span>' : '') + '</td>' +
        '<td class="' + kolor(c.sr) + '">' + liczba(c.sr) + '</td><td>' + c.n + '</td><td>' + c.nd + '</td>';
      ROLE.forEach(function (r) { var x = sredniaSkali(q, r).sr; h += '<td class="' + kolor(x) + '">' + liczba(x) + '</td>'; });
      h += '</tr>';
    });
    h += '</table></div></div>';

    h += '<div class="blok"><h3>Test wiedzy a deklaracja</h3><p class="pod">Wysoka deklaracja C1 przy słabym teście = realna luka do szkolenia.</p><div class="tabela-wrap"><table>' + naglowekRol('Miara');
    ['C4', 'C5'].forEach(function (id) {
      var q = A.pytanie(id);
      h += '<tr><td><b>' + id + '</b> prawidłowa „' + q.poprawna + '”: ' + esc(q.tekst) + '</td>';
      [null].concat(ROLE).forEach(function (r) { var t = testProc(q, r); h += '<td>' + proc(t.p) + '</td>'; });
      h += '</tr>';
    });
    h += '<tr><td><b>C1</b> deklaracja rozumienia karty (śr. 1–6)</td>';
    [null].concat(ROLE).forEach(function (r) { var x = sredniaSkali(A.pytanie('C1'), r).sr; h += '<td class="' + kolor(x) + '">' + liczba(x) + '</td>'; });
    h += '</tr></table></div></div>';

    h += blokRozkladu(A.pytanie('A2'), 'Częstotliwość korzystania (A2)', 'Ile osób faktycznie pracuje z planogramem');
    h += blokRozkladu(A.pytanie('A3'), 'Rezultat: koncepty wdrożone w 6 miesiącach (A3)', 'Miara rezultatu, nie deklaracji');
    h += blokRozkladu(A.pytanie('A4'), 'Kontrola zgodności po montażu (A4)', 'Czy planogram żyje po montażu');
    h += blokRozkladu(A.pytanie('G1'), 'Bariery (G1) — szkolenie czy system', 'Każdy mógł wskazać maksymalnie dwie; procent liczony od liczby osób', A.BARIERY_KLUCZ);
    h += blokRozkladu(A.pytanie('F1'), 'Problemy techniczne (F1)', 'Lista dla Działu Wizualizacji; procent liczony od liczby osób');
    h += blokRozkladu(A.pytanie('H2'), 'Tematy szkolenia wskazane przez zespół (H2)', 'Procent liczony od liczby osób');
    el('z-podsumowanie').innerHTML = h;
  }

  function otwarte() {
    var h = '';
    ['F2', 'G2', 'H1'].forEach(function (id) {
      var q = A.pytanie(id);
      var lista = wiersze.filter(function (w) { return typeof w.dane[id] === 'string' && w.dane[id].trim(); });
      h += '<div class="blok"><h3>' + id + ' · ' + esc(q.tekst) + '</h3><p class="pod">Odpowiedzi: ' + lista.length + '</p><div class="otwarte-lista">';
      if (!lista.length) h += '<p class="pusto">Brak odpowiedzi.</p>';
      lista.slice().reverse().forEach(function (w) {
        h += '<div class="otwarta"><div class="meta">Ankieta nr ' + w.id + ' · ' + esc(w.dane.A1 || '') + ' · ' + data(w.utworzono) + '</div>' + esc(w.dane[id]) + '</div>';
      });
      h += '</div></div>';
    });
    el('z-otwarte').innerHTML = h;
  }

  /* Pełna treść jednej ankiety — tak, jak wypełnił ją handlowiec */
  function odpowiedzTekst(q, v) {
    if (q.typ === 'skala') {
      if (v === A.SKALA.nd) return { t: A.SKALA.ndTekst };
      return { t: v + ' — ' + A.SKALA.etykiety[v - 1], ocena: q.odwrocone ? 'pytanie odwrócone: po przeliczeniu ' + (7 - v) : '' };
    }
    if (q.typ === 'test') {
      var o = q.opcje.filter(function (x) { return x.w === v; })[0];
      return { t: v + ') ' + (o ? o.t : ''), test: v === q.poprawna };
    }
    if (Array.isArray(v)) return { t: v.join('\n') };
    return { t: String(v) };
  }

  function szczegoly(w) {
    var h = '<div class="szczegoly"><div class="szcz-nag">Ankieta nr ' + w.id + ' · wysłana ' + data(w.utworzono) + '</div>';
    A.SEKCJE.forEach(function (s) {
      var pyt = A.PYTANIA.filter(function (q) { return q.s === s.id; });
      h += '<div class="szcz-sekcja">' + s.id + ' · ' + esc(s.tytul) + '</div>';
      pyt.forEach(function (q) {
        var v = w.dane[q.id], tresc, klasa = '';
        if (!A.widoczne(q, w.dane)) {
          tresc = '<span class="szcz-pom">' + (q.tylkoNieKorzystam ? 'nie dotyczy — ta osoba korzysta z planogramów' : 'pominięte — ta osoba nie korzysta z planogramów') + '</span>';
        }
        else if (v === undefined || v === null || v === '') { tresc = '<span class="szcz-pom">brak odpowiedzi</span>'; }
        else {
          var o = odpowiedzTekst(q, v);
          tresc = esc(o.t);
          if (o.ocena) tresc += '<div class="szcz-meta">' + esc(o.ocena) + '</div>';
          if (o.test === true) { klasa = ' ok'; tresc += '<div class="szcz-meta">✓ odpowiedź prawidłowa</div>'; }
          if (o.test === false) { klasa = ' zle'; tresc += '<div class="szcz-meta">✗ prawidłowa: „' + q.poprawna + '”</div>'; }
        }
        h += '<div class="szcz-wiersz' + klasa + '"><div class="szcz-pyt"><b>' + q.id + '</b> ' + esc(q.tekst) + '</div><div class="szcz-odp">' + tresc + '</div></div>';
      });
    });
    return h + '</div>';
  }

  var otwarta = null;
  function lista() {
    var h = '<div class="blok"><h3>Wszystkie ankiety</h3><p class="pod">Kliknij <b>Pokaż</b>, żeby zobaczyć ankietę w całości. Usuń tylko ankiety testowe — usunięcia nie da się cofnąć.</p><div class="tabela-wrap"><table>' +
      '<tr><th>Nr</th><th>Data</th><th>Rola</th><th>Częstotliwość</th><th>Wdrożenia</th><th></th><th></th></tr>';
    if (!wiersze.length) h += '<tr><td colspan="7" class="lewy pusto">Brak ankiet.</td></tr>';
    wiersze.slice().reverse().forEach(function (w) {
      var jest = otwarta === w.id;
      h += '<tr' + (jest ? ' class="aktywny"' : '') + '><td class="lewy" style="min-width:0">' + w.id + '</td><td>' + data(w.utworzono) + '</td><td>' + esc(w.dane.A1) + '</td><td>' + esc(w.dane.A2) + '</td><td>' + esc(w.dane.A3 || '—') + '</td>' +
        '<td><button class="pokaz" type="button" data-id="' + w.id + '">' + (jest ? 'Zwiń' : 'Pokaż') + '</button></td>' +
        '<td><button class="usun" type="button" data-id="' + w.id + '">Usuń</button></td></tr>';
      if (jest) h += '<tr class="szcz-tr"><td colspan="7">' + szczegoly(w) + '</td></tr>';
    });
    h += '</table></div></div>';
    el('z-lista').innerHTML = h;
  }

  function rysuj() { kafle(); podsumowanie(); otwarte(); lista(); }

  /* ---------- dane i sesja ---------- */
  function wczytaj() {
    return api('/api/wyniki').then(function (r) {
      if (r.status === 401) { pokazLogin(); return; }
      if (r.status !== 200) { pokazAlert(r.j.blad || 'Nie wczytałem wyników.'); return; }
      pokazAlert('');
      wiersze = r.j.wiersze || [];
      el('link').value = r.j.link || '';
      el('stan').textContent = 'Ostatnia aktualizacja: ' + new Date().toLocaleTimeString('pl-PL') + (r.j.zamknieta ? ' · ankieta ZAMKNIĘTA (formularz nie przyjmuje odpowiedzi)' : ' · ankieta otwarta') + ' · panel odświeża się co minutę';
      rysuj();
    }).catch(function () { pokazAlert('Brak połączenia z serwerem.'); });
  }

  function pokazLogin() {
    el('ekranPanel').classList.add('ukryte');
    el('ekranLogin').classList.remove('ukryte');
    if (zegar) { clearInterval(zegar); zegar = null; }
    setTimeout(function () { el('haslo').focus(); }, 50);
  }
  function pokazPanel() {
    el('ekranLogin').classList.add('ukryte');
    el('ekranPanel').classList.remove('ukryte');
    wczytaj();
    if (!zegar) zegar = setInterval(wczytaj, 60000);
  }

  el('formLogin').addEventListener('submit', function (e) {
    e.preventDefault();
    api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ haslo: el('haslo').value }) })
      .then(function (r) {
        if (r.status === 200) { el('haslo').value = ''; pokazAlert(''); pokazPanel(); }
        else pokazAlert(r.j.blad || 'Nie zalogowałem.');
      });
  });
  el('wyloguj').addEventListener('click', function () { api('/api/wyloguj', { method: 'POST' }).then(pokazLogin); });
  el('odswiez').addEventListener('click', wczytaj);
  el('drukuj').addEventListener('click', function () {
    if (!wiersze.length) { pokazAlert('Nie ma jeszcze żadnej ankiety do wydrukowania.', 'info'); return; }
    var teraz = new Date().toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    el('drukNaglowek').innerHTML = 'Stan na <b>' + esc(teraz) + '</b> · ankiet: <b>' + wiersze.length + '</b> · Dział Wizualizacji i Rozwoju Sieci';
    window.print();
  });
  el('kopiuj').addEventListener('click', function () {
    var pole = el('link'), b = el('kopiuj');
    var gotowe = function () { b.textContent = 'Skopiowano'; setTimeout(function () { b.textContent = 'Kopiuj link'; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(pole.value).then(gotowe, function () { pole.select(); });
    else { pole.select(); }
  });

  document.querySelectorAll('.zakladki button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.zakladki button').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      ['podsumowanie', 'otwarte', 'lista'].forEach(function (z) { el('z-' + z).classList.toggle('ukryte', z !== b.getAttribute('data-z')); });
    });
  });

  el('z-lista').addEventListener('click', function (e) {
    var p = e.target.closest('.pokaz');
    if (p) { var id = Number(p.getAttribute('data-id')); otwarta = otwarta === id ? null : id; lista(); return; }
    var b = e.target.closest('.usun');
    if (!b) return;
    if (!b.classList.contains('potwierdz')) {
      b.classList.add('potwierdz'); b.textContent = 'Na pewno? Usuń';
      setTimeout(function () { if (b.isConnected) { b.classList.remove('potwierdz'); b.textContent = 'Usuń'; } }, 4000);
      return;
    }
    api('/api/odpowiedz/' + b.getAttribute('data-id'), { method: 'DELETE' }).then(function (r) {
      if (r.status === 200) wczytaj(); else pokazAlert(r.j.blad || 'Nie usunąłem ankiety.');
    });
  });

  api('/api/sesja').then(function (r) {
    if (!r.j.hasloUstawione) { pokazAlert('Panel jest zablokowany: na serwerze nie ustawiono zmiennej PANEL_HASLO.'); return; }
    if (r.j.zalogowany) pokazPanel(); else pokazLogin();
  }).catch(function () { pokazAlert('Brak połączenia z serwerem.'); });
})();
