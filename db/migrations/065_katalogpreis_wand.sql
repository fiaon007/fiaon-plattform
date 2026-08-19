-- ═══════════════════════════════════════════════════════════════════════════
-- DIE KATALOGPREIS-WAND — 19.08.2026
--
-- ── DER ANLASS ────────────────────────────────────────────────────────────
-- Der Betreiber meldete „Müll-Beträge" (0,80 €, 1,00 €). GEMESSEN
-- (scripts/mess-muell-betraege.ts): Die Zahlen entstanden in der ANZEIGE
-- (Euro als Cent gelesen). Im Bestand stehen sechs Bestellungen mit einem
-- Betrag außerhalb des Katalogs — vier bezahlt, zwei offen.
--
-- Aber die Herkunft ist das Problem, nicht die sechs Zeilen: Ein Weg nahm
-- einen FREI GETIPPTEN Betrag an (Admin-Akte, „Betrag (amount_due, €)"), ein
-- zweiter wechselte das Paket und ließ den Betrag stehen, ein dritter ergänzte
-- ihn aus der Bestellung eines anderen Pakets. Alle drei sind im Code
-- geschlossen. Diese Wand ist die vierte Schicht — für den Weg, den heute
-- niemand kennt: ein Skript von Hand, ein Import, ein alter Client.
--
-- AGENTS.md: „Eine Regel gegen 400 Code-Stellen gehört in die Datenbank."
--
-- ── WARUM EINE TABELLE UND NICHT ACHT ZAHLEN IM TRIGGER ───────────────────
-- Preise im Trigger wären die vierte Preisliste im Haus, und die geht beim
-- ersten Preiswechsel auseinander. Die Tabelle ist ausdrücklich eine
-- ABSCHRIFT von shared/fiaon-pakete.ts: `katalogpreiseSyncen()` zieht sie beim
-- Serverstart nach, und `scripts/pruef-katalogpreis-wand.ts` vergleicht beide
-- Seiten. Weicht sie ab, wird der Prüfstand rot — nicht die Kasse.
--
-- ── WAS DIE WAND NICHT TUT ────────────────────────────────────────────────
-- Sie blockiert BEZAHLTE Bestellungen nicht. Dort hängen Rechnung, Provision
-- und Buchhaltung; vier Altfälle stehen so im Bestand und dürfen nicht dazu
-- führen, dass jede weitere Änderung an dieser Zeile scheitert. Und sie prüft
-- nur, was einen Katalogpreis hat: 103 lebende Bestellungen tragen keinen
-- `pack_key`, und eine fehlende Information wird angezeigt, nicht geraten.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_paketpreise (
  pack_key        TEXT PRIMARY KEY,
  preis_cents     BIGINT NOT NULL CHECK (preis_cents > 0),
  bezeichnung     TEXT,
  abo             BOOLEAN NOT NULL DEFAULT TRUE,
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiaon_paketpreise IS
  'ABSCHRIFT des Katalogs aus shared/fiaon-pakete.ts. Wird beim Serverstart '
  'von katalogpreiseSyncen() nachgezogen. Nicht von Hand pflegen — die eine '
  'Quelle ist die TypeScript-Datei.';

-- Der Erststand, damit die Wand ab der Migration greift und nicht erst nach
-- dem ersten Serverstart. Die Werte sind dieselben wie im Katalog; ON CONFLICT
-- macht die Migration wiederholbar.
INSERT INTO fiaon_paketpreise (pack_key, preis_cents, bezeichnung, abo) VALUES
  ('start',               799,  'FIAON Start',               TRUE),
  ('pro',                 5999, 'FIAON Pro (Standard)',      TRUE),
  ('ultra',               7999, 'FIAON Ultra',               TRUE),
  ('highend',             9999, 'FIAON High-End',            TRUE),
  ('business_starter',    4999, 'FIAON Business Starter',    TRUE),
  ('business_pro',        9999, 'FIAON Business Pro',        TRUE),
  ('business_ultra',      14999,'FIAON Business Ultra',      TRUE),
  ('business_enterprise', 24999,'FIAON Business Enterprise', TRUE),
  ('schufa',              7400, 'Bonitätsauskunft',          FALSE)
ON CONFLICT (pack_key) DO UPDATE
  SET preis_cents = EXCLUDED.preis_cents,
      bezeichnung = EXCLUDED.bezeichnung,
      abo = EXCLUDED.abo,
      aktualisiert_am = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- DER TRIGGER
--
-- Die KATEGORIE entscheidet vor dem Paketschlüssel: Sechs Auskunfts-
-- Bestellungen tragen im pack_key das Stufenpaket ihres Kunden, weil der
-- Dubletten-Merge es dort eingetragen hat. Wer nach pack_key preist, verlangt
-- 99,99 € für eine 74-€-Auskunft — bei zwei Bestellungen ist das passiert.
-- Dieselbe Reihenfolge steht in katalogpreisCents() (TypeScript).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fiaon_katalogpreis_wand() RETURNS TRIGGER AS $wand$
DECLARE
  soll        BIGINT;
  schluessel  TEXT;
  ist         BIGINT;
BEGIN
  -- Ein Entwurf ohne Betrag ist kein Fehler, sondern der Trichter.
  IF NEW.amount_due IS NULL THEN RETURN NEW; END IF;

  -- Nur prüfen, wenn Betrag, Paket oder Kategorie WIRKLICH anders werden.
  -- Sonst scheitert jedes UPDATE an einer Altzeile, die die Wand nie gesehen
  -- hat (AGENTS.md: eine Wand, die man nicht benutzen kann, wird umgangen).
  IF TG_OP = 'UPDATE'
     AND NEW.amount_due IS NOT DISTINCT FROM OLD.amount_due
     AND NEW.pack_key   IS NOT DISTINCT FROM OLD.pack_key
     AND NEW.type       IS NOT DISTINCT FROM OLD.type THEN
    RETURN NEW;
  END IF;

  -- Bezahltes ist Buchhaltung. Vier Altfälle stehen so im Bestand.
  IF COALESCE(NEW.payment_status, '') = 'paid' THEN RETURN NEW; END IF;

  schluessel := CASE
    WHEN COALESCE(NEW.type, '') = 'schufa' OR NEW.ref LIKE 'FIAON-SCHUFA-%' THEN 'schufa'
    ELSE LOWER(TRIM(COALESCE(NEW.pack_key, '')))
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

DROP TRIGGER IF EXISTS trg_fiaon_katalogpreis_wand ON fiaon_applications;
CREATE TRIGGER trg_fiaon_katalogpreis_wand
  BEFORE INSERT OR UPDATE OF amount_due, pack_key, type ON fiaon_applications
  FOR EACH ROW EXECUTE FUNCTION fiaon_katalogpreis_wand();

-- ── HINWEIS ZUM ZURÜCKNEHMEN ──────────────────────────────────────────────
-- Falls die Wand einen echten Betriebsfall blockiert, ist der Ausweg EIN
-- Befehl (und kein Datenverlust):
--   DROP TRIGGER trg_fiaon_katalogpreis_wand ON fiaon_applications;
-- Die Tabelle bleibt dabei stehen; sie ist auch ohne Trigger die Abschrift,
-- gegen die der Pruefstand vergleicht.
