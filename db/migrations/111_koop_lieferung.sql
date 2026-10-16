-- ═══════════════════════════════════════════════════════════════════════════
-- 111 · LIEFERSTRECKE KOOPERATIONSVERTRAG „TERMINE FÜR IHRE BERATUNG“ (16.10.2026, E-386)
--
-- Der Vertrag (E-384, Präfix IA-KOOP-) verspricht qualifizierte Kontakte: Einwilligung + Wunschthema + fester Termin.
-- Regeln: shared/fiaon-koop-lieferung.ts · Ablauf: server/lib/fiaon-koop-lieferung.ts.
--
--   fiaon_koop_einwilligungen  jede Einwilligung und jedes Interesse mit Datum, Uhrzeit, Wortlaut, Kanal und Fassung —
--                              der Nachweis nach Ziffer 8 des Vertrags. Widerruf als Stempel an der Zeile, nie gelöscht.
--   fiaon_koop_kontakte        ein qualifizierter Kontakt je Interessent, Partner, Thema und Termin — mit Übermittlung,
--                              Reklamation und der Monatsrechnung, in der er steht
--   fiaon_koop_rechnungen      eine Zeile je Partner und Monat (auch „nichts zu berechnen“) — die Sperre gegen doppelte
--                              Monatsrechnungen; die Rechnung selbst ist eine Bestellzeile (fiaon_applications, koop_kontakte)
--
-- Neue Tabellen, sperren nichts Bestehendes. Dieselbe Datei führt der Server beim ersten Gebrauch aus, falls sie fehlt.
-- Wiederholbar. Keine Fremdschlüssel (Hausregel).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_koop_einwilligungen (
  id              BIGSERIAL PRIMARY KEY,
  person_id       INTEGER NOT NULL,
  -- interesse: „FIAON darf mich dazu anrufen“ · uebermittlung: „Daten an Partner X“ · abgelehnt: „kein Interesse“
  art             VARCHAR(16) NOT NULL CHECK (art IN ('interesse', 'uebermittlung', 'abgelehnt')),
  -- an welchen Partner (Kooperationsvertrag); NULL beim Interesse ohne Partner
  angebot_id      INTEGER,
  thema           TEXT,
  kanal           VARCHAR(16) NOT NULL CHECK (kanal IN ('telefon', 'kundenbereich')),
  wortlaut        TEXT NOT NULL,
  fassung         VARCHAR(40) NOT NULL,
  erteilt_am      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erteilt_von     TEXT,
  agent_id        INTEGER,
  ip              VARCHAR(64),
  user_agent      TEXT,
  widerrufen_am   TIMESTAMPTZ,
  widerruf_kanal  VARCHAR(24),
  widerruf_von    TEXT,
  widerruf_grund  TEXT
);
CREATE INDEX IF NOT EXISTS fiaon_koop_einwilligungen_person ON fiaon_koop_einwilligungen (person_id, erteilt_am DESC);

CREATE TABLE IF NOT EXISTS fiaon_koop_kontakte (
  id                    BIGSERIAL PRIMARY KEY,
  angebot_id            INTEGER NOT NULL,
  person_id             INTEGER NOT NULL,
  einwilligung_id       BIGINT NOT NULL,
  thema                 TEXT NOT NULL,
  termin_beginn         TIMESTAMPTZ NOT NULL,
  termin_dauer_min      INTEGER NOT NULL DEFAULT 60,
  termin_art            VARCHAR(12) NOT NULL DEFAULT 'telefon',
  notiz                 TEXT,
  -- was der Partner bekommt (eingefroren beim Speichern): Name, Telefon, E-Mail
  vorname               TEXT,
  nachname              TEXT,
  telefon               TEXT,
  email                 TEXT,
  status                VARCHAR(16) NOT NULL DEFAULT 'geplant' CHECK (status IN ('geplant', 'uebermittelt', 'reklamiert', 'storniert')),
  preis_cents           INTEGER NOT NULL,
  -- Ersatz für einen reklamierten Kontakt (Ziffer 7): zählt nicht gegen Wunschmenge und Start-Rahmen
  ersatz_fuer_id        BIGINT,
  angelegt_von          TEXT,
  agent_id              INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uebermittelt_am       TIMESTAMPTZ,
  mail_message_id       TEXT,
  mail_fehler           TEXT,
  mail_versuche         INTEGER NOT NULL DEFAULT 0,
  kunde_mail_am         TIMESTAMPTZ,
  storniert_am          TIMESTAMPTZ,
  storniert_grund       TEXT,
  -- Reklamation (Ziffer 7)
  reklamiert_am         TIMESTAMPTZ,
  reklamation_grund     VARCHAR(32),
  reklamation_text      TEXT,
  reklamation_wahl      VARCHAR(12),
  reklamation_ergebnis  VARCHAR(12),
  reklamation_begruendung TEXT,
  -- der Partner meldet: Interessent wünscht keinen Kontakt mehr (Ziffer 5)
  kein_kontakt_am       TIMESTAMPTZ,
  -- Abrechnung: Monat der Übermittlung, die Rechnung, in der er steht, und ggf. die Gutschrift in einer späteren
  abrechnung_monat      VARCHAR(7),
  rechnung_id           BIGINT,
  gutschrift_rechnung_id BIGINT
);
CREATE INDEX IF NOT EXISTS fiaon_koop_kontakte_angebot ON fiaon_koop_kontakte (angebot_id, status, uebermittelt_am);
CREATE INDEX IF NOT EXISTS fiaon_koop_kontakte_person ON fiaon_koop_kontakte (person_id, thema);

CREATE TABLE IF NOT EXISTS fiaon_koop_rechnungen (
  id              BIGSERIAL PRIMARY KEY,
  angebot_id      INTEGER NOT NULL,
  monat           VARCHAR(7) NOT NULL,
  -- Bestellzeile (fiaon_applications.ref) — NULL, wenn im Monat nichts zu berechnen war
  ref             VARCHAR,
  anzahl          INTEGER NOT NULL DEFAULT 0,
  summe_cents     INTEGER NOT NULL DEFAULT 0,
  gutschrift_cents INTEGER NOT NULL DEFAULT 0,
  betrag_cents    INTEGER NOT NULL DEFAULT 0,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mail_am         TIMESTAMPTZ,
  mail_fehler     TEXT,
  erinnert_am     TIMESTAMPTZ,
  UNIQUE (angebot_id, monat)
);
