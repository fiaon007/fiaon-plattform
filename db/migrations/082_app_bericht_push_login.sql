-- ═══════════════════════════════════════════════════════════════════════════
-- 082 · Kundenbereich /app — Monatsbericht, Push, Anmelde-Link, Ereignisse (06.09.2026)
--
-- Scheibe 6. Jedes Modul trägt seinen Abschnitt hier ein (## A Bericht,
-- ## B Push, ## C Anmelde-Link, ## E Ereignisprotokoll). KEIN ALTER an fremden
-- Tabellen (Hausregel). Idempotent (IF NOT EXISTS). Dieselbe DDL steht je Modul
-- in der memoisierten ensure-Funktion des zugehörigen Servermoduls und läuft
-- beim ersten Aufruf nach dem Deploy.
-- ═══════════════════════════════════════════════════════════════════════════

-- ## C — Anmelde-Link ohne Passwort (server/routes/fiaon-app-login.ts)
-- Eine Zeile je angefordertem Link. `token_hash` ist SHA-256 über 32 Zufallsbytes —
-- der Klartext steht nur in der Mail, nie in der Datenbank. Gültig 60 Minuten
-- (gueltig_bis), genau einmal (genutzt_am). Ein nicht versendbarer Link wird
-- sofort als genutzt markiert, damit kein einlösbares Geheimnis liegen bleibt.
-- `ref` ist das Konto nach derselben Auswahlregel wie der Passwort-Login
-- (fiaon-login-logic.ts, pickAccountRow). ip/user_agent: bei Anforderung
-- gesetzt, bei Einlösung überschrieben.
CREATE TABLE IF NOT EXISTS fiaon_login_links (
  id          BIGSERIAL PRIMARY KEY,
  ref         TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gueltig_bis TIMESTAMPTZ NOT NULL,
  genutzt_am  TIMESTAMPTZ,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS fiaon_login_links_ref_idx ON fiaon_login_links (ref, erstellt_am DESC);

-- ## B — Push-Mitteilungen (server/lib/fiaon-push.ts, server/routes/fiaon-app-push.ts)
-- fiaon_push_abos: ein Browser-Abo je Gerät (endpoint ist weltweit eindeutig →
-- UNIQUE, UPSERT darüber). p256dh/auth sind die Schlüssel des Browsers für die
-- verschlüsselte Nutzlast. Abmelden setzt NUR geloescht_am; antwortet der
-- Push-Dienst mit 404/410, setzt der Server geloescht_am selbst; andere Fehler
-- zählen in fehler_folge, ab 5 in Folge ebenfalls geloescht_am. Ein neues Abo
-- mit demselben Endpunkt hebt die Löschung wieder auf. Endpunkte nur bei den
-- echten Push-Diensten (ENDPUNKT_HOSTS in fiaon-push.ts), höchstens 10 aktive
-- Abos je Person — ältere werden stillgelegt.
-- Schlüssel des Hauses (VAPID) liegen NIE hier, nur in der Umgebung.
CREATE TABLE IF NOT EXISTS fiaon_push_abos (
  id                BIGSERIAL PRIMARY KEY,
  person_id         BIGINT NOT NULL,
  endpoint          TEXT NOT NULL UNIQUE,
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  user_agent        TEXT,
  erstellt_am       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  letzter_erfolg_am TIMESTAMPTZ,
  letzter_fehler    TEXT,
  fehler_folge      INTEGER NOT NULL DEFAULT 0,   -- Fehler in Folge (nicht 404/410); ab 5 → geloescht_am
  geloescht_am      TIMESTAMPTZ
);
ALTER TABLE fiaon_push_abos ADD COLUMN IF NOT EXISTS fehler_folge INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS fiaon_push_abos_person_idx ON fiaon_push_abos (person_id) WHERE geloescht_am IS NULL;

-- fiaon_push_log: eine Zeile je Sendeversuch — die Tagesbremse zählt nur
-- ergebnis = 'gesendet' je Berliner Tag und Person. Weitere Ergebnisse:
-- 'nachtruhe' (21–8 Uhr Berlin, still verworfen, NICHT nachgeholt),
-- 'tagesbremse' (zweite Mitteilung am selben Tag), 'wand' (Wortwand griff),
-- 'fehler' (kein Abo erreichbar). Kein Nachrichtentext, nur Anlass und Titel.
CREATE TABLE IF NOT EXISTS fiaon_push_log (
  id        BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL,
  anlass    TEXT NOT NULL,
  titel     TEXT NOT NULL,
  am        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ergebnis  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fiaon_push_log_person_idx ON fiaon_push_log (person_id, am DESC);

-- ## A — Monatsbericht (server/lib/fiaon-monatsbericht.ts, ensureBerichtTabelle)
-- Ein Bericht je Person und Monat — ein BELEG, keine Anzeige: einmal gespeichert,
-- wird er nie neu gerechnet. `monat` ist der erste Tag des Berichtsmonats.
-- grosse_zahl_cents = Summe der im Monat bewilligten MONATLICHEN Beträge (nie die
-- eigene Rate); beantragt_cents = Summe der Beträge offener Vorgänge (versandt/
-- nachfrage) am Erstellungstag; gezahlt_cents = im Monat gezahlte Raten.
-- kennzahlen (JSONB): monatText, heuteIso, posten[], einmaligCents, unterwegs[],
-- beantragtMonatlichCents, beantragtEinmaligCents, raten{anzahl,puenktlich,gezahltCents},
-- weg{erledigt,gesamt,vormonatErledigt}, naechstes.
-- versandt_am: Mail app_monatsbericht ist raus (nur bei fiaon_settings.app_bericht_mail = 'an');
-- gelesen_am: der Kunde hat den Bericht in der App geöffnet.
CREATE TABLE IF NOT EXISTS fiaon_monatsberichte (
  id                 BIGSERIAL PRIMARY KEY,
  person_id          BIGINT NOT NULL,
  monat              DATE NOT NULL,
  grosse_zahl_cents  INTEGER NOT NULL DEFAULT 0,
  grosse_zahl_text   TEXT NOT NULL,
  beantragt_cents    INTEGER NOT NULL DEFAULT 0,
  gezahlt_cents      INTEGER NOT NULL DEFAULT 0,
  kennzahlen         JSONB NOT NULL DEFAULT '{}'::jsonb,
  erzeugt_am         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  versandt_am        TIMESTAMPTZ,
  gelesen_am         TIMESTAMPTZ,
  UNIQUE (person_id, monat)
);
CREATE INDEX IF NOT EXISTS fiaon_monatsberichte_person_idx ON fiaon_monatsberichte (person_id, monat DESC);

-- ## E — Ereignisprotokoll der App (server/routes/fiaon-app-bericht.ts, ensureEreignisTabelle)
-- Bauvorlage 8.3: nur Bildschirm, Knopf und Zeit — keine Inhalte, keine Beträge,
-- kein freier Text. Whitelist im Router (bildschirm ∈ heute, weg, brief, geld, mehr,
-- vorgaenge, ansprueche, unterlagen, zahlen, bericht, hilfe, termine, vollmacht,
-- mitteilungen, daten, abo, konto; ereignis ∈ geoeffnet, knopf, fertig).
-- Deckel 60 je Person und Stunde.
CREATE TABLE IF NOT EXISTS fiaon_app_ereignisse (
  id          BIGSERIAL PRIMARY KEY,
  person_id   BIGINT NOT NULL,
  bildschirm  TEXT NOT NULL,
  ereignis    TEXT NOT NULL,
  am          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_app_ereignisse_person_idx ON fiaon_app_ereignisse (person_id, am DESC);
