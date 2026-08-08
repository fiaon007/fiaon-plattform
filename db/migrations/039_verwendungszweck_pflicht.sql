-- ═══════════════════════════════════════════════════════════════════════════
-- 039 — Kein Verwendungszweck ist keine Option mehr
--
-- Zwei Schritte:
--   1. Der Altbestand bekommt Verwendungszwecke (5 754 Zeilen ohne).
--   2. Die Spalte wird NOT NULL.
--
-- Schritt 1 steht hier UND in scripts/verwendungszweck-backfill.ts. Das ist
-- Absicht: Das Skript liefert die Vorschau-CSV und den Nachweis, dass die
-- Umsatzbasis unverändert bleibt; diese Migration macht das Deployment
-- selbstheilend. Beide benutzen dieselbe Datenbankfunktion
-- `fiaon_verwendungszweck_neu()` — es gibt genau einen Erzeuger.
--
-- VORAUSSETZUNG: 038 hat den Alt-Bestand markiert. Sonst wandern 69 bezahlte
-- Import-Zeilen (767,91 €) lautlos in den Umsatz.
--
-- NOT NULL ist erst nach dem Trigger aus 037 gefahrlos: Ein INSERT ohne
-- Verwendungszweck wird vorher gefüllt, statt zu scheitern. Ohne diese
-- Reihenfolge hätte die Bedingung die Antragsstrecke gesprengt — ein Kunde, der
-- beim Absenden einen Fehler sieht, ist teurer als jede Unsauberkeit.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  zeile RECORD;
  gesetzt INT := 0;
BEGIN
  -- ZEILENWEISE, mit Absicht. Ein einzelnes Mengen-UPDATE wäre schneller und
  -- falsch: Die Eindeutigkeitsprüfung in `fiaon_verwendungszweck_neu()` liest
  -- den Tabellenstand VOR der Anweisung und sieht die Werte nicht, die dasselbe
  -- UPDATE gerade erzeugt. Bei 5 754 Zeilen aus 887 Millionen Möglichkeiten
  -- liegt die Kollisionswahrscheinlichkeit bei knapp zwei Prozent — und eine
  -- Kollision lässt den eindeutigen Index anschlagen und diese Migration
  -- scheitern. Zwei Prozent Ausfallrisiko beim Deployment für ein paar Sekunden
  -- Laufzeit ist ein schlechter Handel.
  FOR zeile IN SELECT ref FROM fiaon_applications WHERE payment_reference IS NULL LOOP
    UPDATE fiaon_applications
       SET payment_reference = fiaon_verwendungszweck_neu()
     WHERE ref = zeile.ref;
    gesetzt := gesetzt + 1;
  END LOOP;
  IF gesetzt > 0 THEN
    RAISE NOTICE 'Verwendungszweck-Backfill: % Zeile(n) ergaenzt', gesetzt;
  END IF;
END $$;

ALTER TABLE fiaon_applications ALTER COLUMN payment_reference SET NOT NULL;
