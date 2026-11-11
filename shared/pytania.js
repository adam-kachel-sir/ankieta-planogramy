/* Ankieta: planogramy w pracy sił sprzedaży — definicja pytań.
   Jeden plik dla formularza (przeglądarka) i serwera (Node), żeby walidacja i eksport
   zawsze liczyły się z tej samej listy. Treść 1:1 z arkusza „Ankieta” (wersja 2, 27 pytań). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ANKIETA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ID = 'planogramy-2026';
  var WERSJA = 2;
  var TYTUL = 'Planogramy w pracy sił sprzedaży';
  var NIE_KORZYSTAM = 'Nie korzystam';

  var SEKCJE = [
    { id: 'A', tytul: 'O Tobie i Twojej pracy z planogramem', obszar: 'Metryczka i rezultat' },
    { id: 'B', tytul: 'Łatwość korzystania', obszar: '1. Łatwość korzystania' },
    { id: 'C', tytul: 'Zrozumiałość karty konceptu', obszar: '2. Zrozumiałość funkcji' },
    { id: 'D', tytul: 'Wpływ na efektywność pracy', obszar: '3. Wpływ na efektywność pracy' },
    { id: 'E', tytul: 'Zgodność z potrzebami klienta i ludzi w punkcie', obszar: '4. Zgodność z potrzebami klienta i ludzi w punkcie' },
    { id: 'F', tytul: 'Problemy techniczne', obszar: '5. Problemy techniczne' },
    { id: 'G', tytul: 'Co blokuje pracę z planogramem', obszar: 'Bariery: szkolenie czy system' },
    { id: 'H', tytul: 'Twoje propozycje', obszar: '6. Propozycje usprawnień i uwagi' }
  ];

  /* Struktura obecna (przed nominacjami RM): przedstawiciel handlowy, koordynator, dyrektor handlowy + inne osoby */
  var ROLE = ['Przedstawiciel handlowy (PH)', 'Koordynator', 'Dyrektor handlowy', 'Inna'];
  var CZESTOTLIWOSC = ['Kilka razy w tygodniu', 'Kilka razy w miesiącu', 'Rzadziej', NIE_KORZYSTAM];
  var WDROZENIA = ['0', '1–2', '3–5', '6–10', 'Powyżej 10'];
  var KONTROLA = ['We wszystkich', 'W części', 'W żadnym', 'Nie dotyczy'];
  var PROBLEMY = ['Brak dostępu do planogramu w terenie', 'Plik nie otwiera się lub jest za ciężki na telefon',
    'Rysunek nieczytelny po wydruku', 'Nieaktualne indeksy lub EAN', 'Towar z planogramu niedostępny na magazynie',
    'Brak wymiarów regału i miejsca potrzebnego na podłodze', 'Problem z zamówieniem elementów regałowych',
    'Regał zmontowany niezgodnie z rysunkiem', 'Brak informacji o nowej wersji konceptu', 'Żaden', 'Inne'];
  var BARIERY = [
    'Nie wiem, czego firma ode mnie oczekuje przy planogramach (ile konceptów, w jakich punktach, w jakim czasie).',
    'Brakuje mi warunków: czasu, towaru, wsparcia przy montażu, dostępu do plików.',
    'Nie wiem, jak przeprowadzić rozmowę z klientem z planogramem w ręku.',
    'Nie widzę, co mi to daje (wynik, prowizja, oszczędność czasu).',
    'Nic mi nie przeszkadza.'];
  var BARIERY_KLUCZ = [
    { przyczyna: 'Nie wie, CO robić (cel)', reakcja: 'Cel i standard: ile konceptów, w jakich punktach, w jakim czasie', kto: 'Koordynator + Dział Wizualizacji' },
    { przyczyna: 'Nie może (warunki)', reakcja: 'Usunięcie przeszkody: dostęp, towar, montaż', kto: 'Dział Wizualizacji, logistyka, IT' },
    { przyczyna: 'Nie umie (kompetencja)', reakcja: 'Szkolenie i coaching w terenie', kto: 'Szkolenie z planogramów' },
    { przyczyna: 'Nie chce (motywacja)', reakcja: 'Rozmowa o powodzie i o systemie premiowym', kto: 'Dyrektor handlowy, koordynator' },
    { przyczyna: 'Brak bariery', reakcja: '—', kto: '—' }];
  var TEMATY = ['Czytanie karty konceptu', 'Dobór konceptu do punktu', 'Rozmowa z właścicielem o regale',
    'Kontrola zgodności półki', 'Szkolenie sprzedawców w punkcie', 'Liczenie efektu sprzedaży po wdrożeniu', 'Inne'];

  var SKALA = {
    min: 1, max: 6, nd: 'nd',
    lewa: 'zdecydowanie się nie zgadzam', prawa: 'zdecydowanie się zgadzam',
    etykiety: ['zdecydowanie się nie zgadzam', 'nie zgadzam się', 'raczej się nie zgadzam', 'raczej się zgadzam', 'zgadzam się', 'zdecydowanie się zgadzam'],
    ndTekst: 'nie dotyczy / nie wiem'
  };

  /* typ: jeden | skala | test | wiele | otwarte
     pomin: pytanie znika, gdy A2 = „Nie korzystam” (przejście do części G)
     tylkoNieKorzystam: pytanie pokazuje się tylko przy A2 = „Nie korzystam” */
  var PYTANIA = [
    { id: 'A1', s: 'A', typ: 'jeden', tekst: 'Twoja rola:', opcje: ROLE, wymagane: true, csv: 'A1 Rola' },
    { id: 'A2', s: 'A', typ: 'jeden', tekst: 'Jak często korzystasz z planogramów?', opcje: CZESTOTLIWOSC, wymagane: true, csv: 'A2 Częstotliwość',
      podpowiedz: 'Jeśli nie korzystasz, przejdziesz od razu do części „Co blokuje pracę z planogramem”.' },
    { id: 'A3', s: 'A', typ: 'jeden', tekst: 'W ilu punktach w ostatnich 6 miesiącach wprowadziłeś koncept regałowy na podstawie planogramu?', opcje: WDROZENIA, wymagane: true, pomin: true, csv: 'A3 Wdrożenia 6 mies.' },
    { id: 'A4', s: 'A', typ: 'jeden', tekst: 'W ilu z tych punktów sprawdziłeś po montażu, czy półka nadal zgadza się z planogramem?', opcje: KONTROLA, wymagane: true, pomin: true, csv: 'A4 Kontrola po montażu' },

    { id: 'B1', s: 'B', typ: 'skala', tekst: 'Aktualny planogram dla danego konceptu znajduję w mniej niż 2 minuty.', wymagane: true, pomin: true },
    { id: 'B2', s: 'B', typ: 'skala', tekst: 'Planogram czytam bez problemu na telefonie lub tablecie, przy kliencie.', wymagane: true, pomin: true },
    { id: 'B3', s: 'B', typ: 'skala', tekst: 'Przed rozmową z klientem muszę dzwonić do Działu Wizualizacji, żeby dopytać o szczegóły.', wymagane: true, pomin: true, odwrocone: true },
    { id: 'B4', s: 'B', typ: 'skala', tekst: 'Numery miejsc na rysunku łatwo łączę z pozycjami w tabeli towarów.', wymagane: true, pomin: true },

    { id: 'C1', s: 'C', typ: 'skala', tekst: 'Rozumiem każdą kolumnę w specyfikacji towarów (EAN, symbol, ilość, miejsce na regale).', wymagane: true, pomin: true },
    { id: 'C2', s: 'C', typ: 'skala', tekst: 'Nie jest dla mnie jasne, które elementy są w standardzie, a które opcjonalne, ani jak je zamówić.', wymagane: true, pomin: true, odwrocone: true },
    { id: 'C3', s: 'C', typ: 'skala', tekst: 'Umiem wyjaśnić właścicielowi punktu, dlaczego produkty stoją na regale w tej kolejności.', wymagane: true, pomin: true },
    { id: 'C4', s: 'C', typ: 'test', tekst: 'W karcie konceptu elementy opcjonalne to:', wymagane: true, pomin: true, poprawna: 'a', csv: 'C4 test',
      opcje: [{ w: 'a', t: 'grafiki i oświetlenie' }, { w: 'b', t: 'blachy perforowane i podest' }, { w: 'c', t: 'listwy cenowe i zawieszki' }, { w: 'd', t: 'nie wiem' }] },
    { id: 'C5', s: 'C', typ: 'test', tekst: 'Kolumna „Miejsce na regale” oznacza:', wymagane: true, pomin: true, poprawna: 'b', csv: 'C5 test',
      opcje: [{ w: 'a', t: 'numer półki od dołu' }, { w: 'b', t: 'numer pozycji na rysunku, na której zawiesza się dany indeks' }, { w: 'c', t: 'liczbę sztuk na zawieszce' }, { w: 'd', t: 'nie wiem' }] },

    { id: 'D1', s: 'D', typ: 'skala', tekst: 'Z planogramem szybciej przygotowuję ofertę wejścia z regałem.', wymagane: true, pomin: true },
    { id: 'D2', s: 'D', typ: 'skala', tekst: 'Planogram pomaga mi doprowadzić do decyzji klienta o postawieniu regału.', wymagane: true, pomin: true },
    { id: 'D3', s: 'D', typ: 'skala', tekst: 'W punktach, gdzie koncept stoi zgodnie z planogramem, sprzedaż kategorii rośnie.', wymagane: true, pomin: true },
    { id: 'D4', s: 'D', typ: 'skala', tekst: 'Kontrola zgodności półki z planogramem zabiera więcej czasu, niż przynosi korzyści.', wymagane: true, pomin: true, odwrocone: true },

    { id: 'E1', s: 'E', typ: 'skala', tekst: 'Dobór produktów w planogramie odpowiada temu, co rotuje w moich punktach.', wymagane: true, pomin: true },
    { id: 'E2', s: 'E', typ: 'skala', tekst: 'Sprzedawcy w punkcie potrafią sami uzupełniać półkę według planogramu.', wymagane: true, pomin: true },
    { id: 'E3', s: 'E', typ: 'skala', tekst: 'Karta konceptu zawiera argumenty, które przekonują właściciela punktu (rotacja, marża, korzyść dla jego klientów).', wymagane: true, pomin: true },
    { id: 'E4', s: 'E', typ: 'skala', tekst: 'Ilości startowe w planogramie nie pasują do możliwości zakupowych moich klientów.', wymagane: true, pomin: true, odwrocone: true },

    { id: 'F1', s: 'F', typ: 'wiele', tekst: 'Z czym spotkałeś się w ostatnich 3 miesiącach?', podpowiedz: 'Można zaznaczyć kilka.', opcje: PROBLEMY, wylaczna: 'Żaden', wymagane: true, pomin: true, csv: 'F1 Problemy' },
    { id: 'F2', s: 'F', typ: 'otwarte', tekst: 'Opisz jeden konkretny przypadek: co się stało i jaki był skutek u klienta.', wymagane: false, pomin: true, csv: 'F2 Przypadek' },

    { id: 'G1', s: 'G', typ: 'wiele', tekst: 'Co najbardziej przeszkadza Ci w pracy z planogramem?', podpowiedz: 'Wybierz maksymalnie dwie odpowiedzi.', opcje: BARIERY, maks: 2, wylaczna: 'Nic mi nie przeszkadza.', wymagane: true, csv: 'G1 Bariery' },
    { id: 'G2', s: 'G', typ: 'otwarte', tekst: 'Dlaczego nie korzystasz z planogramów?', wymagane: true, tylkoNieKorzystam: true, csv: 'G2 Dlaczego nie' },

    { id: 'H1', s: 'H', typ: 'otwarte', tekst: 'Co zmieniłbyś lub dodał w karcie planogramu, żeby postawić regał bez dzwonienia do Działu Wizualizacji? Inne uwagi.', wymagane: false, csv: 'H1 Usprawnienia' },
    { id: 'H2', s: 'H', typ: 'wiele', tekst: 'Czego chcesz się nauczyć na szkoleniu?', podpowiedz: 'Można zaznaczyć kilka.', opcje: TEMATY, wymagane: true, csv: 'H2 Tematy szkolenia' }
  ];

  var MAKS_TEKST = 2000;

  function pytanie(id) {
    for (var i = 0; i < PYTANIA.length; i++) if (PYTANIA[i].id === id) return PYTANIA[i];
    return null;
  }

  function widoczne(q, dane) {
    var nie = dane && dane.A2 === NIE_KORZYSTAM;
    if (q.tylkoNieKorzystam) return nie;
    if (q.pomin && nie) return false;
    return true;
  }

  function wartosciOpcji(q) {
    return q.opcje.map(function (o) { return typeof o === 'string' ? o : o.w; });
  }

  /* Zwraca { ok, bledy: [{id, komunikat}], czyste } — pytania niewidoczne są usuwane. */
  function waliduj(dane) {
    var bledy = [], czyste = {};
    if (!dane || typeof dane !== 'object' || Array.isArray(dane)) return { ok: false, bledy: [{ id: '', komunikat: 'Brak danych' }], czyste: {} };
    PYTANIA.forEach(function (q) {
      if (!widoczne(q, dane)) return;
      var v = dane[q.id];
      var pusta = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (pusta) {
        if (q.wymagane) bledy.push({ id: q.id, komunikat: 'Brak odpowiedzi' });
        return;
      }
      if (q.typ === 'jeden' || q.typ === 'test') {
        if (typeof v !== 'string' || wartosciOpcji(q).indexOf(v) < 0) { bledy.push({ id: q.id, komunikat: 'Nieprawidłowa odpowiedź' }); return; }
        czyste[q.id] = v;
      } else if (q.typ === 'skala') {
        if (v === SKALA.nd) { czyste[q.id] = SKALA.nd; return; }
        var n = Number(v);
        if (!(n >= SKALA.min && n <= SKALA.max && Math.floor(n) === n)) { bledy.push({ id: q.id, komunikat: 'Nieprawidłowa ocena' }); return; }
        czyste[q.id] = n;
      } else if (q.typ === 'wiele') {
        if (!Array.isArray(v)) { bledy.push({ id: q.id, komunikat: 'Nieprawidłowa odpowiedź' }); return; }
        var dozw = wartosciOpcji(q), uniq = [];
        for (var i = 0; i < v.length; i++) {
          if (typeof v[i] !== 'string' || dozw.indexOf(v[i]) < 0) { bledy.push({ id: q.id, komunikat: 'Nieprawidłowa odpowiedź' }); return; }
          if (uniq.indexOf(v[i]) < 0) uniq.push(v[i]);
        }
        if (q.maks && uniq.length > q.maks) { bledy.push({ id: q.id, komunikat: 'Maksymalnie ' + q.maks }); return; }
        if (q.wylaczna && uniq.indexOf(q.wylaczna) >= 0 && uniq.length > 1) { bledy.push({ id: q.id, komunikat: '„' + q.wylaczna + '” nie łączy się z innymi' }); return; }
        uniq.sort(function (a, b) { return dozw.indexOf(a) - dozw.indexOf(b); });
        czyste[q.id] = uniq;
      } else if (q.typ === 'otwarte') {
        if (typeof v !== 'string') { bledy.push({ id: q.id, komunikat: 'Nieprawidłowa odpowiedź' }); return; }
        var t = v.replace(/\u0000/g, '').trim().slice(0, MAKS_TEKST);
        if (!t) { if (q.wymagane) bledy.push({ id: q.id, komunikat: 'Brak odpowiedzi' }); return; }
        czyste[q.id] = t;
      }
    });
    return { ok: bledy.length === 0, bledy: bledy, czyste: czyste };
  }

  /* Kolumny eksportu = kolejność kolumn arkusza „Wyniki” w Excelu (A..AB) + data na końcu. */
  var KOLEJNOSC_CSV = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'C5',
    'D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'E4', 'F1', 'G1', 'H2', 'F2', 'G2', 'H1'];

  function naglowkiCsv() {
    return ['Lp'].concat(KOLEJNOSC_CSV.map(function (id) { return pytanie(id).csv || id; })).concat(['Data wysłania']);
  }

  function wierszCsv(lp, dane, data) {
    var w = [lp];
    KOLEJNOSC_CSV.forEach(function (id) {
      var v = dane[id];
      if (v === undefined || v === null || v === SKALA.nd) w.push('');
      else if (Array.isArray(v)) w.push(v.join(' | '));
      else w.push(v);
    });
    w.push(data || '');
    return w;
  }

  return {
    ID: ID, WERSJA: WERSJA, TYTUL: TYTUL, NIE_KORZYSTAM: NIE_KORZYSTAM,
    SEKCJE: SEKCJE, PYTANIA: PYTANIA, SKALA: SKALA, ROLE: ROLE,
    BARIERY_KLUCZ: BARIERY_KLUCZ, MAKS_TEKST: MAKS_TEKST,
    pytanie: pytanie, widoczne: widoczne, waliduj: waliduj,
    naglowkiCsv: naglowkiCsv, wierszCsv: wierszCsv
  };
});
