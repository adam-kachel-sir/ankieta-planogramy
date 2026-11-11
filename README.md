# Ankieta: planogramy w pracy sił sprzedaży

Formularz ankiety na telefon, zapis odpowiedzi do bazy PostgreSQL i panel wyników za hasłem.
Postawione pod Railway (hosting) z kodem w GitHubie.

- **Formularz** — `https://TWOJ-ADRES/?k=KOD` — handlowiec otwiera link, wypełnia 27 pytań, klika „Wyślij”. Bez logowania, anonimowo (bez imienia, maila i adresu IP).
- **Panel wyników** — `https://TWOJ-ADRES/panel` — logowanie hasłem; liczy się na żywo: obszary, pytania, test wiedzy, bariery, problemy, tematy szkolenia, odpowiedzi otwarte, lista ankiet, eksport CSV do Excela.

---

## Uruchomienie krok po kroku (ok. 15 minut)

### 1. GitHub — wgranie plików
1. Wejdź na github.com i zaloguj się.
2. Prawy górny róg: **+** → **New repository**. Nazwa: `ankieta-planogramy`. Zaznacz **Private**. Kliknij **Create repository**.
3. Na stronie nowego repozytorium kliknij link **uploading an existing file**.
4. Rozpakuj ZIP na komputerze i przeciągnij **całą zawartość folderu** `ankieta-planogramy` (pliki i foldery `public`, `shared`, `dla-kamila`) do okna przeglądarki.
5. Na dole kliknij **Commit changes**.

### 2. Railway — postawienie strony
1. Wejdź na railway.com → **Login** → **Login with GitHub** (to samo konto).
2. Jeśli Railway poprosi o plan: wybierz **Hobby** (5 $ miesięcznie, w tym 5 $ zużycia — ankieta mieści się w tym limicie).
3. **New Project** → **Deploy from GitHub repo** → wybierz `ankieta-planogramy`. Jeśli repozytorium nie ma na liście, kliknij **Configure GitHub App** i zaznacz je.
4. W tym samym projekcie: **+ Create** (albo **New**) → **Database** → **PostgreSQL**. Poczekaj, aż baza się uruchomi.

### 3. Zmienne (ustawienia ankiety)
Kliknij kafel usługi **ankieta-planogramy** → zakładka **Variables** → **New Variable** i dodaj trzy pozycje:

| Nazwa | Wartość | Po co |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | połączenie z bazą (Railway podpowie to jako „Add Reference”) |
| `PANEL_HASLO` | Twoje hasło, min. 12 znaków | logowanie do panelu wyników |
| `ANKIETA_KOD` | np. `plano26x7` | kod w linku — bez niego nikt z zewnątrz nie wyśle odpowiedzi |

Po zapisaniu Railway sam uruchomi stronę ponownie.

### 4. Adres strony
Usługa **ankieta-planogramy** → **Settings** → **Networking** → **Generate Domain**.
Dostaniesz adres typu `ankieta-planogramy-production.up.railway.app`.
W zakładce **Deployments → View logs** powinien stać napis: `Ankieta planogramy działa na porcie …`.

### 5. Test przed rozesłaniem
1. Otwórz `https://TWOJ-ADRES/panel`, zaloguj się hasłem.
2. Kliknij **Kopiuj link** — to jest link do rozesłania (zawiera już kod).
3. Otwórz go na swoim telefonie i wyślij jedną ankietę testową.
4. W panelu sprawdź, że się pojawiła. Potem zakładka **Lista ankiet** → **Usuń** (dwa kliknięcia) przy ankiecie testowej.

### 6. Rozesłanie
Wklej link z panelu do maila lub SMS-a do handlowców. Panel odświeża się co minutę.

### 7. Zamknięcie ankiety
Variables → dodaj `ANKIETA_ZAMKNIETA` = `1`. Formularz pokaże „Ankieta jest zamknięta”, panel i wyniki zostają.
Po zakończeniu projektu: pobierz CSV, a potem możesz usunąć projekt w Railway (Settings → Danger → Delete), żeby nie płacić.

---

## Wyniki do Excela
- Panel → **Pobierz wyniki do Excela** — gotowy plik w standardzie Stalco (logo, zieleń, Montserrat): arkusze Ankieta, Weryfikacja, Klucz, **Wyniki** (już wypełnione odpowiedziami) i **Podsumowanie** (przelicza się samo po otwarciu w Excelu). Nic nie trzeba wklejać.
- Szablon pliku: `szablony/Ankieta_planogramy_Stalco_2026.xlsx` — serwer wpisuje odpowiedzi w arkusz Wyniki od wiersza 9 (maks. 200 ankiet; przy większej liczbie pełna lista jest w CSV).
- Przycisk **CSV** — surowe dane bez formatowania (kolumny 1:1 z arkuszem Wyniki + data wysłania), np. do własnych analiz.

---

## Dla Kamila (technicznie)
- Node.js ≥ 20, Express, PostgreSQL przez `pg`. Tabela `odpowiedz` (id, utworzono, ankieta, wersja, dane JSONB) tworzy się sama przy starcie.
- `dla-kamila/schema.prisma` — ten sam model w Prismie, gdyby moduł miał wejść do portalu.
- `shared/pytania.js` — jedna definicja pytań dla formularza, walidacji na serwerze i eksportu CSV. Nowa ankieta = nowy plik pytań i nowe `ID`.
- JS i CSS w osobnych plikach (bez skryptów w HTML).
- Panel: sesja w ciasteczku HttpOnly podpisanym HMAC (12 h), hasło z `PANEL_HASLO`. Formularz: kod z `ANKIETA_KOD`, walidacja po stronie serwera, limit wysyłek w pamięci (300/h z adresu — wysoki, bo zespół może wypełniać przez jedno Wi‑Fi). Adres IP nie trafia do bazy.
- Endpointy: `GET /api/konfig`, `POST /api/odpowiedz`, `POST /api/login`, `POST /api/wyloguj`, `GET /api/sesja`, `GET /api/wyniki`, `GET /api/eksport.csv`, `DELETE /api/odpowiedz/:id`, `GET /zdrowie`.
- Lokalnie: `npm install` → `DATABASE_URL=postgresql://… PANEL_HASLO=… node server.js`.
