-- ═══════════════════════════════════════════════════════════════════════════
-- FIAON GLOBAL — DAS INDIVIDUALANGEBOT (01.10.2026, E-268)
-- Individualangebot (01.10.2026)
--
-- ── WAS DIESE MIGRATION TUT ───────────────────────────────────────────────
-- 1. Die zwei Tabellen des Individualangebots — dieselbe DDL, die
--    server/lib/fiaon-global-angebot.ts (ensureAngebotTabellen) beim ersten
--    Gebrauch anlegt. Hier dokumentiert und vorab angelegt, damit die Wand (3.)
--    die Teile-Tabelle sicher vorfindet.
-- 2. fiaon_global_auftraege.angebot_id — die Akte von Teil 1 kennt ihr Angebot.
-- 3. Die Katalogpreis-Wand (Migration 065, Fassung 083) prüft auch den neuen
--    Schlüssel „global_individuell": Er hat KEINEN Katalogpreis (preis_cents 0
--    stünde gegen den CHECK der Abschrift und steht deshalb nicht in
--    fiaon_paketpreise). Sein Betrag muss genau dem angenommenen Angebotsteil
--    entsprechen, der VOR dem Betrag an die Bestellzeile gebunden wird
--    (fiaon_global_angebot_teile.bestell_ref). Ohne gebundenen Teil kein Betrag.
--    Alles andere bleibt Wort für Wort wie in 083 (Auskunft-Kategorie zuerst).
--
-- ── REIHENFOLGE OHNE HARTE ABHÄNGIGKEIT ───────────────────────────────────
-- Erst geht der Code live: Ohne diese Migration lässt die 083-Wand den Schlüssel
-- durch (kein Katalogpreis), und es gilt die Wand im Code (bestellungFuerAntrag
-- nimmt den Betrag nur aus dem gebundenen Teil). Danach diese Migration — dann
-- gilt auch die Datenbank-Wand. Prüfstand: scripts/pruef-individualangebot.ts
-- (Rot-Probe: Betrag einer Teilzeile auf 1 € ändern → die Wand wirft).
--
-- Wiederholbar: IF NOT EXISTS und CREATE OR REPLACE. Kein DROP, keine Änderung
-- vorhandener Zeilen.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_global_angebote (
  id SERIAL PRIMARY KEY,
  angebot_ref VARCHAR NOT NULL UNIQUE,
  person_id INTEGER,
  fassung VARCHAR NOT NULL,
  sprache VARCHAR NOT NULL DEFAULT 'de',
  kunde JSONB NOT NULL,
  parameter JSONB NOT NULL,
  buergin JSONB NOT NULL,
  pruefbericht JSONB,
  status VARCHAR NOT NULL DEFAULT 'offen',
  gueltig_bis DATE NOT NULL,
  erstellt_von TEXT,
  zurueckgezogen_am TIMESTAMPTZ,
  zurueckgezogen_von TEXT,
  zurueckgezogen_grund TEXT,
  angenommen_am TIMESTAMPTZ,
  ip VARCHAR,
  user_agent TEXT,
  text_hash VARCHAR,
  schalter JSONB,
  vertrag_pdf BYTEA,
  auftrag_ref VARCHAR UNIQUE,
  frist_beginn DATE,
  frist_ende DATE,
  frist_hemmung_tage INTEGER NOT NULL DEFAULT 0,
  frist_warnung_14_am TIMESTAMPTZ,
  frist_warnung_3_am TIMESTAMPTZ,
  frist_abgelaufen_am TIMESTAMPTZ,
  erstattung_ausgeloest_am TIMESTAMPTZ,
  erstattung_ausgeloest_von TEXT,
  erstattet_am DATE,
  erstattung_notiz TEXT,
  bestaetigung_mail_am TIMESTAMPTZ,
  bestaetigung_mail_fehler TEXT,
  start_mail_am TIMESTAMPTZ,
  nacharbeit_fehler TEXT,
  verlauf JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiaon_global_angebot_teile (
  id SERIAL PRIMARY KEY,
  angebot_id INTEGER NOT NULL REFERENCES fiaon_global_angebote(id),
  nr INTEGER NOT NULL CHECK (nr BETWEEN 1 AND 2),
  titel TEXT NOT NULL,
  betrag_cents BIGINT NOT NULL CHECK (betrag_cents > 0),
  faelligkeit VARCHAR NOT NULL CHECK (faelligkeit IN ('sofort', 'meilenstein')),
  zahlungsziel_tage INTEGER NOT NULL DEFAULT 0,
  bestell_ref VARCHAR UNIQUE,
  meilenstein_am DATE,
  meilenstein_art VARCHAR,
  meilenstein_beleg TEXT,
  meilenstein_von TEXT,
  eingetragen_am DATE,
  rechnung_am TIMESTAMPTZ,
  rechnung_mail_am TIMESTAMPTZ,
  bezahlt_am TIMESTAMPTZ,
  bezahlt_mail_am TIMESTAMPTZ,
  anruf_aufgabe_am TIMESTAMPTZ,
  entfallen_am TIMESTAMPTZ,
  entfallen_grund TEXT,
  UNIQUE (angebot_id, nr)
);

CREATE INDEX IF NOT EXISTS fiaon_global_angebote_status_idx ON fiaon_global_angebote (status, created_at DESC);

-- Die Akte gibt es erst nach dem ersten Global-Auftrag (ensureGlobalTabelle) — dann die Spalte, sonst nichts.
DO $akte$
BEGIN
  IF to_regclass('public.fiaon_global_auftraege') IS NOT NULL THEN
    SET LOCAL lock_timeout = '3s';
    ALTER TABLE fiaon_global_auftraege ADD COLUMN IF NOT EXISTS angebot_id INTEGER;
  END IF;
END
$akte$;

CREATE OR REPLACE FUNCTION fiaon_katalogpreis_wand() RETURNS TRIGGER AS $wand$
DECLARE
  soll        BIGINT;
  schluessel  TEXT;
  ist         BIGINT;
  paket_roh   TEXT;
BEGIN
  -- Ein Entwurf ohne Betrag ist kein Fehler, sondern der Trichter.
  IF NEW.amount_due IS NULL THEN RETURN NEW; END IF;

  -- Nur prüfen, wenn Betrag, Paket oder Kategorie WIRKLICH anders werden.
  IF TG_OP = 'UPDATE'
     AND NEW.amount_due IS NOT DISTINCT FROM OLD.amount_due
     AND NEW.pack_key   IS NOT DISTINCT FROM OLD.pack_key
     AND NEW.type       IS NOT DISTINCT FROM OLD.type THEN
    RETURN NEW;
  END IF;

  -- Bezahltes ist Buchhaltung. Vier Altfälle stehen so im Bestand.
  IF COALESCE(NEW.payment_status, '') = 'paid' THEN RETURN NEW; END IF;

  paket_roh := LOWER(TRIM(COALESCE(NEW.pack_key, '')));

  -- E-268: Das Individualangebot misst sich am angenommenen Teil, nicht am Katalog.
  IF paket_roh = 'global_individuell' THEN
    SELECT betrag_cents INTO soll FROM fiaon_global_angebot_teile WHERE bestell_ref = NEW.ref;
    IF soll IS NULL THEN
      RAISE EXCEPTION
        'Individualangebot ohne angenommenen Teil: %. Der Betrag kommt aus dem Angebotsteil (fiaon_global_angebot_teile.bestell_ref), nicht aus einer Eingabe.',
        NEW.ref
        USING ERRCODE = 'check_violation';
    END IF;
    ist := ROUND(NEW.amount_due * 100);
    IF ist <> soll THEN
      RAISE EXCEPTION
        'Betrag % Cent passt nicht zum angenommenen Angebotsteil % Cent für %.',
        ist, soll, NEW.ref
        USING ERRCODE = 'check_violation',
              HINT = 'Der Betrag eines Individualangebots steht im Vertrag. Soll er sich ändern, braucht es ein neues Angebot.';
    END IF;
    RETURN NEW;
  END IF;

  schluessel := CASE
    WHEN COALESCE(NEW.type, '') = 'schufa' OR NEW.ref LIKE 'FIAON-SCHUFA-%' THEN
      CASE WHEN paket_roh IN ('schufa', 'auskunft_privat', 'auskunft_firma', 'auskunft_firma_abo')
           THEN paket_roh ELSE 'schufa' END
    ELSE paket_roh
  END;

  SELECT preis_cents INTO soll FROM fiaon_paketpreise WHERE pack_key = schluessel;
  -- Kein Katalogpaket: nichts zu prüfen. Eine sichtbare Lücke ist ehrlich.
  IF soll IS NULL THEN RETURN NEW; END IF;

  ist := ROUND(NEW.amount_due * 100);
  IF ist <> soll THEN
    RAISE EXCEPTION
      'Betrag % Cent passt nicht zum Katalogpreis % Cent für %. Beträge kommen aus dem Katalog (shared/fiaon-pakete.ts), nicht aus einer Eingabe.',
      ist, soll, schluessel
      USING ERRCODE = 'check_violation',
            HINT = 'Soll der Kunde etwas anderes zahlen, gehoert das Paket geaendert.';
  END IF;

  RETURN NEW;
END;
$wand$ LANGUAGE plpgsql;
