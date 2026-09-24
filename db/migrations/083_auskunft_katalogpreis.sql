-- ═══════════════════════════════════════════════════════════════════════════
-- DIE KATALOGPREIS-WAND KENNT DIE VIER AUSKUNFT-PREISE — 25.09.2026 (E-240)
--
-- ── DER ANLASS ────────────────────────────────────────────────────────────
-- Seit E-240 hat die Bonitätsauskunft vier Preise: privat 74 € mit laufendem
-- Paket (Schlüssel „schufa") und 149 € einzeln („auskunft_privat"), Firma
-- 199 € mit Paket („auskunft_firma_abo") und 349 € einzeln („auskunft_firma").
-- Der Schlüssel steht im pack_key der Auskunft-Zeile, den Preis wählt der
-- Server (server/lib/fiaon-auskunft.ts, auskunftPreis).
--
-- Die Wand aus Migration 065 ordnete aber JEDE Auskunft-Zeile (type = schufa
-- oder Referenz FIAON-SCHUFA-) dem Schlüssel „schufa" zu — 7.400 Cent. Jede
-- Bestellung zu 149, 199 oder 349 € scheiterte deshalb mit „Betrag 14900 Cent
-- passt nicht zum Katalogpreis 7400 Cent für schufa": in der Produktion
-- nachgewiesen (Trigger aktiv, fiaon_paketpreise.schufa = 7400) und lokal in
-- einer zurückgerollten Transaktion nachgestellt. Betroffen: Kauflink aus der
-- Mail, Kaufkarte im Bereich, öffentliche Bestellseite, Mara, Betreuer.
--
-- ── DIE REGEL JETZT ───────────────────────────────────────────────────────
-- Weiter zuerst die KATEGORIE: Eine Auskunft-Zeile wird an einem Auskunft-
-- Preis gemessen, nie an einem Stufenpaket (der Befund aus 065 — sechs
-- Auskunft-Zeilen tragen vom Dubletten-Merge das Stufenpaket im pack_key).
-- Neu: Steht dort einer der vier AUSKUNFT-Schlüssel, gilt dessen Preis;
-- sonst wie bisher „schufa". Dieselbe Regel in TypeScript:
-- katalogpreisCents (server/lib/fiaon-massgebliche-bestellung.ts) und die
-- Betragswahl in bestellungFuerAntrag (server/routes/fiaon-antrag.ts).
-- Prüfstand: scripts/pruef-katalogpreis-wand.ts (spielt 065 und 083 ein).
--
-- Wiederholbar: CREATE OR REPLACE und ON CONFLICT. Kein DROP, kein Umbau
-- vorhandener Zeilen.
-- ═══════════════════════════════════════════════════════════════════════════

-- Der Erststand der drei neuen Schlüssel — damit die Wand ab der Migration
-- greift und nicht erst nach dem ersten Serverstart (katalogpreiseSyncen zieht
-- die Abschrift danach ohnehin aus shared/fiaon-pakete.ts nach).
INSERT INTO fiaon_paketpreise (pack_key, preis_cents, bezeichnung, abo) VALUES
  ('auskunft_privat',    14900, 'Bonitätsauskunft (einzeln)',            FALSE),
  ('auskunft_firma',     34900, 'Firmen-Bonitätsauskunft (einzeln)',     FALSE),
  ('auskunft_firma_abo', 19900, 'Firmen-Bonitätsauskunft (Kundenpreis)', FALSE)
ON CONFLICT (pack_key) DO UPDATE
  SET preis_cents = EXCLUDED.preis_cents,
      bezeichnung = EXCLUDED.bezeichnung,
      abo = EXCLUDED.abo,
      aktualisiert_am = NOW();

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
