(function () {
  'use strict';
  var A = window.ANKIETA;
  var KLUCZ_SZKIC = 'ankieta-' + A.ID + '-szkic';
  var KLUCZ_WYSLANA = 'ankieta-' + A.ID + '-wyslana';
  var KLUCZ_CZAS = 'ankieta-' + A.ID + '-czas';
  var kod = new URLSearchParams(location.search).get('k') || '';
  var dane = {};
  var el = function (id) { return document.getElementById(id); };
  var form = el('formularz');

  function czytaj(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function zapisz(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* tryb prywatny — bez szkicu */ } }
  function usun(k) { try { localStorage.removeItem(k); } catch (e) { } }

  function h(tag, attrs, dzieci) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (a) {
      if (a === 'text') n.textContent = attrs[a];
      else if (a === 'class') n.className = attrs[a];
      else n.setAttribute(a, attrs[a]);
    });
    (dzieci || []).forEach(function (d) { if (d) n.appendChild(d); });
    return n;
  }

  function pokazAlert(tekst, typ) {
    var a = el('alert');
    a.textContent = tekst || '';
    a.className = 'alert' + (tekst ? ' pokaz ' + (typ || 'zly') : '');
  }

  function ekran(id) {
    ['ekranStart', 'ekranKoniec', 'ekranJuz', 'ekranStop'].forEach(function (e) { el(e).classList.toggle('ukryte', e !== id); });
    el('pasekDol').classList.toggle('ukryte', id !== 'ekranStart');
  }

  /* ---------- budowa formularza ---------- */
  function opcjaPrzycisk(q, wartosc, etykieta, litera, wielokrotny) {
    var b = h('button', { type: 'button', class: 'opcja' + (wielokrotny ? ' kw' : ''), role: wielokrotny ? 'checkbox' : 'radio', 'aria-checked': 'false', 'data-w': wartosc });
    b.appendChild(h('span', { class: 'znak', 'aria-hidden': 'true' }));
    var t = h('span');
    if (litera) t.appendChild(h('span', { class: 'lit', text: litera + ')' }));
    t.appendChild(document.createTextNode((litera ? ' ' : '') + etykieta));
    b.appendChild(t);
    b.addEventListener('click', function () { wybierz(q, wartosc, wielokrotny); });
    return b;
  }

  function zbudujPytanie(q) {
    var karta = h('div', { class: 'karta pyt', id: 'p-' + q.id, 'data-id': q.id });
    karta.appendChild(h('div', { class: 'nr' }));
    karta.appendChild(h('p', { class: 'txt', text: q.tekst + (q.wymagane ? '' : ' (nieobowiązkowe)') }));
    if (q.podpowiedz) karta.appendChild(h('p', { class: 'pod', text: q.podpowiedz }));

    if (q.typ === 'jeden' || q.typ === 'wiele' || q.typ === 'test') {
      var box = h('div', { class: 'opcje', role: q.typ === 'wiele' ? 'group' : 'radiogroup' });
      q.opcje.forEach(function (o) {
        if (typeof o === 'string') box.appendChild(opcjaPrzycisk(q, o, o, null, q.typ === 'wiele'));
        else box.appendChild(opcjaPrzycisk(q, o.w, o.t, o.w, false));
      });
      karta.appendChild(box);
    } else if (q.typ === 'skala') {
      var s = h('div', { class: 'skala' });
      var rz = h('div', { class: 'skala-przyciski', role: 'radiogroup', 'aria-label': 'Ocena od 1 do 6' });
      for (var i = A.SKALA.min; i <= A.SKALA.max; i++) {
        (function (n) {
          var b = h('button', { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-w': String(n), 'aria-label': n + ' — ' + A.SKALA.etykiety[n - 1], text: String(n) });
          b.addEventListener('click', function () { wybierz(q, n); });
          rz.appendChild(b);
        })(i);
      }
      s.appendChild(rz);
      s.appendChild(h('div', { class: 'skala-opis' }, [h('span', { text: '1 — ' + A.SKALA.lewa }), h('span', { text: '6 — ' + A.SKALA.prawa })]));
      s.appendChild(h('div', { class: 'skala-wybor', 'aria-live': 'polite' }));
      var nd = h('button', { type: 'button', class: 'nd', role: 'radio', 'aria-checked': 'false', 'data-w': A.SKALA.nd, text: A.SKALA.ndTekst });
      nd.addEventListener('click', function () { wybierz(q, A.SKALA.nd); });
      s.appendChild(nd);
      karta.appendChild(s);
    } else if (q.typ === 'otwarte') {
      var ta = h('textarea', { maxlength: String(A.MAKS_TEKST), placeholder: 'Napisz kilka zdań…', 'aria-label': q.tekst });
      var lic = h('div', { class: 'licznik', text: '0 / ' + A.MAKS_TEKST });
      ta.addEventListener('input', function () {
        startCzasu();
        dane[q.id] = ta.value;
        lic.textContent = ta.value.length + ' / ' + A.MAKS_TEKST;
        if (ta.value.trim()) karta.classList.remove('brak');
        odswiez(false);
      });
      karta.appendChild(ta);
      karta.appendChild(lic);
    }
    karta.appendChild(h('div', { class: 'komunikat', text: 'To pytanie wymaga odpowiedzi.' }));
    return karta;
  }

  function zbuduj() {
    A.SEKCJE.forEach(function (s) {
      var pyt = A.PYTANIA.filter(function (q) { return q.s === s.id; });
      var blok = h('div', { class: 'sekcja', 'data-s': s.id });
      blok.appendChild(h('h2', { class: 'sekcja-tytul' }, [h('span', { class: 'lit', text: s.id }), h('span', { text: s.tytul })]));
      if (s.id === 'B') blok.appendChild(h('p', { class: 'pod', style: 'margin:-4px 2px 12px;font-size:13px;color:#5B6B62', text: 'W częściach B–E oceniasz twierdzenia: 1 — zdecydowanie się nie zgadzam … 6 — zdecydowanie się zgadzam. Jeśli coś Cię nie dotyczy, wybierz „nie dotyczy / nie wiem”.' }));
      pyt.forEach(function (q) { blok.appendChild(zbudujPytanie(q)); });
      form.appendChild(blok);
    });
  }

  /* ---------- logika wyboru ---------- */
  function wybierz(q, w, wielokrotny) {
    startCzasu();
    if (wielokrotny) {
      var lista = Array.isArray(dane[q.id]) ? dane[q.id].slice() : [];
      var i = lista.indexOf(w);
      if (i >= 0) lista.splice(i, 1);
      else {
        if (q.wylaczna && w === q.wylaczna) lista = [w];
        else {
          if (q.wylaczna) lista = lista.filter(function (x) { return x !== q.wylaczna; });
          if (q.maks && lista.length >= q.maks) return;
          lista.push(w);
        }
      }
      dane[q.id] = lista;
    } else {
      dane[q.id] = w;
    }
    el('p-' + q.id).classList.remove('brak');
    odswiez(true);
  }

  function odpowiedziano(q) {
    var v = dane[q.id];
    if (q.typ === 'otwarte') return typeof v === 'string' && v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }

  function odswiez(zapiszSzkic) {
    var widocznych = 0, wymaganych = 0, gotowych = 0;
    A.PYTANIA.forEach(function (q) {
      var karta = el('p-' + q.id);
      var wid = A.widoczne(q, dane);
      karta.classList.toggle('ukryte', !wid);
      if (!wid) return;
      widocznych++;
      karta.querySelector('.nr').textContent = 'Pytanie ' + widocznych;
      if (q.wymagane) { wymaganych++; if (odpowiedziano(q)) gotowych++; }
      var v = dane[q.id];
      karta.querySelectorAll('[data-w]').forEach(function (b) {
        var w = b.getAttribute('data-w');
        var on = Array.isArray(v) ? v.indexOf(w) >= 0 : String(v) === w;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        if (q.typ === 'wiele' && q.maks) {
          var pelne = Array.isArray(v) && v.length >= q.maks && !on && w !== q.wylaczna;
          b.disabled = !!pelne;
        }
      });
      if (q.typ === 'skala') {
        var opis = karta.querySelector('.skala-wybor');
        opis.textContent = (typeof v === 'number') ? 'Wybrano: ' + v + ' — ' + A.SKALA.etykiety[v - 1] : '';
      }
    });
    A.SEKCJE.forEach(function (s) {
      var blok = form.querySelector('[data-s="' + s.id + '"]');
      var jakies = A.PYTANIA.some(function (q) { return q.s === s.id && A.widoczne(q, dane); });
      blok.classList.toggle('ukryte', !jakies);
    });
    el('postepTxt').textContent = 'Odpowiedzi: ' + gotowych + ' z ' + wymaganych;
    el('postepWyp').style.width = (wymaganych ? Math.round(gotowych / wymaganych * 100) : 0) + '%';
    if (zapiszSzkic !== false) zapisz(KLUCZ_SZKIC, JSON.stringify(dane));
  }

  /* wartość ze szkicu musi nadal istnieć w ankiecie (np. po zmianie listy ról) */
  function wartoscOk(q, v) {
    var o = q.opcje ? q.opcje.map(function (x) { return typeof x === 'string' ? x : x.w; }) : [];
    if (q.typ === 'jeden' || q.typ === 'test') return typeof v === 'string' && o.indexOf(v) >= 0;
    if (q.typ === 'skala') return v === A.SKALA.nd || (typeof v === 'number' && v >= A.SKALA.min && v <= A.SKALA.max);
    if (q.typ === 'wiele') return Array.isArray(v) && v.every(function (x) { return o.indexOf(x) >= 0; }) && (!q.maks || v.length <= q.maks);
    if (q.typ === 'otwarte') return typeof v === 'string';
    return false;
  }

  function wczytajSzkic() {
    var s = czytaj(KLUCZ_SZKIC);
    if (!s) return;
    try {
      var d = JSON.parse(s);
      if (d && typeof d === 'object') {
        dane = {};
        A.PYTANIA.forEach(function (q) { if (wartoscOk(q, d[q.id])) dane[q.id] = d[q.id]; });
      }
      A.PYTANIA.forEach(function (q) {
        if (q.typ === 'otwarte' && typeof dane[q.id] === 'string') {
          var ta = el('p-' + q.id).querySelector('textarea');
          ta.value = dane[q.id];
          ta.parentNode.querySelector('.licznik').textContent = ta.value.length + ' / ' + A.MAKS_TEKST;
        }
      });
    } catch (e) { dane = {}; }
  }

  /* ---------- wysyłka ---------- */
  function brakujace() {
    return A.PYTANIA.filter(function (q) { return A.widoczne(q, dane) && q.wymagane && !odpowiedziano(q); });
  }

  function oznaczBraki(ids) {
    document.querySelectorAll('.pyt.brak').forEach(function (k) { k.classList.remove('brak'); });
    ids.forEach(function (id) { var k = el('p-' + id); if (k) k.classList.add('brak'); });
    if (ids.length) {
      var pierwszy = el('p-' + ids[0]);
      pierwszy.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function wyslij() {
    pokazAlert('');
    var braki = brakujace();
    if (braki.length) {
      pokazAlert('Brakuje odpowiedzi na ' + braki.length + ' ' + (braki.length === 1 ? 'pytanie' : (braki.length < 5 ? 'pytania' : 'pytań')) + '. Zaznaczyłem je na czerwono.');
      oznaczBraki(braki.map(function (q) { return q.id; }));
      return;
    }
    var przycisk = el('wyslij');
    przycisk.disabled = true;
    przycisk.textContent = 'Wysyłam…';
    var czyste = {};
    A.PYTANIA.forEach(function (q) { if (A.widoczne(q, dane) && odpowiedziano(q)) czyste[q.id] = dane[q.id]; });
    fetch('/api/odpowiedz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: kod, dane: czyste, czas: odczytCzasu() }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (wynik) {
        if (wynik.status === 200 && wynik.j.ok) {
          usun(KLUCZ_SZKIC);
          usun(KLUCZ_CZAS);
          czas.stop = true;
          zapisz(KLUCZ_WYSLANA, String(Date.now()));
          ekran('ekranKoniec');
          window.scrollTo(0, 0);
          return;
        }
        pokazAlert(wynik.j.blad || 'Nie wysłałem ankiety. Spróbuj ponownie.');
        if (wynik.j.bledy) oznaczBraki(wynik.j.bledy.map(function (b) { return b.id; }).filter(Boolean));
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function () {
        pokazAlert('Brak połączenia z internetem. Twoje odpowiedzi są zapisane na tym telefonie — kliknij „Wyślij ankietę” jeszcze raz, gdy wróci zasięg.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .then(function () { przycisk.disabled = false; przycisk.textContent = 'Wyślij ankietę'; });
  }

  /* ---------- zegar ----------
     Startuje przy pierwszej odpowiedzi. Liczy tylko sekundy, gdy ankieta jest na ekranie
     (odłożony telefon albo inna aplikacja = zegar stoi). Stan przeżywa odświeżenie strony. */
  var czas = { start: null, aktywne: 0, stop: false };
  (function () {
    try { var c = JSON.parse(czytaj(KLUCZ_CZAS) || 'null'); if (c && c.start) { czas.start = c.start; czas.aktywne = c.aktywne || 0; } } catch (e) { }
  })();
  var IKONA_ZEGARA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  function pokazCzas() { el('czasTxt').innerHTML = czas.start ? IKONA_ZEGARA + A.formatCzas(czas.aktywne) : ''; }
  function zapiszCzas() { zapisz(KLUCZ_CZAS, JSON.stringify({ start: czas.start, aktywne: czas.aktywne })); }
  function startCzasu() { if (!czas.start && !czas.stop) { czas.start = Date.now(); zapiszCzas(); pokazCzas(); } }
  function odczytCzasu() {
    if (!czas.start) return {};
    return { aktywny: Math.round(czas.aktywne), calkowity: Math.round((Date.now() - czas.start) / 1000) };
  }
  setInterval(function () {
    if (!czas.start || czas.stop || document.hidden) return;
    czas.aktywne++;
    pokazCzas();
    zapiszCzas();
  }, 1000);
  document.addEventListener('visibilitychange', function () { if (document.hidden && czas.start) zapiszCzas(); });
  window.addEventListener('pagehide', function () { if (czas.start && !czas.stop) zapiszCzas(); });

  /* ---------- start ---------- */
  zbuduj();
  wczytajSzkic();
  odswiez(false);
  pokazCzas();
  el('wyslij').addEventListener('click', wyslij);
  el('nowyFormularz').addEventListener('click', function () { usun(KLUCZ_WYSLANA); dane = {}; usun(KLUCZ_SZKIC); usun(KLUCZ_CZAS); location.reload(); });

  if (czytaj(KLUCZ_WYSLANA)) ekran('ekranJuz');

  fetch('/api/konfig?k=' + encodeURIComponent(kod)).then(function (r) { return r.json(); }).then(function (k) {
    if (k.zamknieta) {
      el('stopTytul').textContent = 'Ankieta jest zamknięta';
      el('stopTekst').textContent = 'Zbieranie odpowiedzi zakończyło się. Dziękujemy wszystkim, którzy ją wypełnili.';
      ekran('ekranStop');
    } else if (!k.kodOk) {
      el('stopTytul').textContent = 'Link jest niepełny';
      el('stopTekst').textContent = 'Otwórz ankietę z linku, który dostałeś w wiadomości — skopiuj go w całości.';
      ekran('ekranStop');
    }
  }).catch(function () { /* bez połączenia — formularz działa, wysyłka powie, co dalej */ });
})();
