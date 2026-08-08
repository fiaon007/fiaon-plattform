-- ═══════════════════════════════════════════════════════════════════════════
-- 037 — Der Verwendungszweck entsteht mit der Bestellung, nicht später
--
-- DER SCHADEN, DEN DAS ABSTELLT
-- Dreimal an einem Tag gemeldet: Ein Kunde bestellt ohne E-Mail. Der Agent
-- trägt die Adresse nach. Es gibt aber keinen Verwendungszweck, weil der erst
-- beim Aufruf von /payment-order entsteht — und der lief nie. Der Kunde
-- überweist ohne Referenz, und in der Buchhaltung steht Geld ohne Namen:
-- „der hat zweimal überwiesen", „wer bekommt die Provision?".
--
-- WARUM EIN TRIGGER UND NICHT NUR CODE
-- Bestellungen entstehen an mehreren Stellen (Antragsstrecke, Bonitäts-
-- Bestellung, Admin-Testkunde, Importe, SQL von Hand). Jede einzelne zu
-- ändern behebt das Problem heute; der nächste neue Weg vergisst es wieder.
-- Der Trigger ist die Stelle, die niemand vergessen kann — auch ein `INSERT`
-- aus einem Skript oder aus psql bekommt einen Verwendungszweck.
--
-- Das Format bleibt `FIAON-XXXXXX` (Zeichensatz ohne 0/1/O/I/L, damit am
-- Telefon nichts verwechselt wird). Es wird NICHT geändert: 784 vorhandene
-- Referenzen stehen auf gedruckten Rechnungen und im Bankabgleich.
-- ═══════════════════════════════════════════════════════════════════════════

-- Ein Kandidat aus dem verwechslungsfreien Zeichensatz.
CREATE OR REPLACE FUNCTION fiaon_verwendungszweck_kandidat() RETURNS TEXT AS $$
  SELECT 'FIAON-' || string_agg(
    substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 6);
$$ LANGUAGE sql VOLATILE;

-- Ein garantiert freier Verwendungszweck. Bei Kollision wird neu gewürfelt —
-- 31^6 sind 887 Millionen Möglichkeiten, die Schleife läuft praktisch nie
-- zweimal. Sie ist trotzdem da: „passiert praktisch nie" ist bei einem
-- eindeutigen Index kein Argument, sondern ein Ausfall.
CREATE OR REPLACE FUNCTION fiaon_verwendungszweck_neu() RETURNS TEXT AS $$
DECLARE
  kandidat TEXT;
  versuche INT := 0;
BEGIN
  LOOP
    versuche := versuche + 1;
    kandidat := fiaon_verwendungszweck_kandidat();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM fiaon_applications WHERE payment_reference = kandidat
    );
    IF versuche >= 25 THEN
      RAISE EXCEPTION 'Kein eindeutiger Verwendungszweck nach % Versuchen', versuche;
    END IF;
  END LOOP;
  RETURN kandidat;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- BEFORE INSERT: füllt die Lücke, überschreibt aber NIEMALS einen mitgegebenen
-- Wert. Wer eine Referenz kennt (Import, Wiederherstellung), behält sie.
CREATE OR REPLACE FUNCTION fiaon_verwendungszweck_setzen() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_reference IS NULL OR btrim(NEW.payment_reference) = '' THEN
    NEW.payment_reference := fiaon_verwendungszweck_neu();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiaon_verwendungszweck_trigger ON fiaon_applications;
CREATE TRIGGER fiaon_verwendungszweck_trigger
  BEFORE INSERT ON fiaon_applications
  FOR EACH ROW EXECUTE FUNCTION fiaon_verwendungszweck_setzen();
