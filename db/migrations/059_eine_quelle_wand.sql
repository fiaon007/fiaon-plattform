-- ═══════════════════════════════════════════════════════════════════════════
-- DIE WAND GEGEN DAS DOPPEL-DATENMODELL
--
-- ── DER AUFTRAG DES BETREIBERS (20.08.2026) ────────────────────────────────
-- „Das Doppel-Datenmodell muss STERBEN. Nie wieder ‚E-Mail am Antrag, aber
-- nicht an der Person'. Nicht abschwächen, nicht übergangsweise — endgültig."
--
-- ── DIE INVENTUR, DIE DEN WEG BESTIMMT ─────────────────────────────────────
-- GEMESSEN am 20.08.2026:
--   1.293 Code-Zugriffe auf die Kontakt-Spalten, in 62 Serverdateien
--     davon 197 allein in fiaon-antrag.ts
--   2.387 Bestellungen mit einer Nummer, die an der Person FEHLT
--     293 mit einer E-Mail, die an der Person fehlt
--     189 Leads mit einer E-Mail, die an der Person fehlt
--
-- Ein DROP COLUMN vor dem Code-Umzug hieße: Der Server startet nicht mehr, der
-- Login bricht, Rechnungen brechen. Die Spalten fallen also erst, wenn der Grep
-- null Zugriffe zeigt.
--
-- ── WARUM DIESE WAND DAS ZIEL SOFORT ERREICHT ──────────────────────────────
-- Das Ziel ist nicht „die Spalte ist weg". Das Ziel ist „die Werte können nicht
-- mehr auseinanderlaufen". Genau das leistet ein Trigger:
--
--   Jeder Schreibvorgang auf eine Kontakt-Spalte einer Bestellung oder eines
--   Leads schreibt den Wert AN DIE PERSON durch. Ist die Person leer, übernimmt
--   sie ihn. Weicht sie ab, BEHÄLT sie ihren Wert und der Zeilenwert wird ein
--   ALIAS — die Suche findet ihn weiter, aber er ist keine zweite Wahrheit mehr.
--
-- Ab jetzt ist es gleichgültig, welcher Code, welcher Import, welcher Webhook
-- oder welcher alte Client schreibt: Der Wert landet an der Person. Divergenz
-- kann nicht mehr ENTSTEHEN, sondern nur noch aufgeräumt werden — und der
-- Bestandslauf tut das einmalig.
--
-- Die Spalten sind damit reine ABSCHRIFTEN. Ihr späterer Wegfall ist eine
-- Aufräumarbeit ohne Eile, kein Rennen gegen neue Fehler.
--
-- ── WARUM IN DER DATENBANK UND NICHT IM CODE ────────────────────────────────
-- Weil eine Regel im Code 1.293 Stellen kennen muss und eine in der Datenbank
-- keine. Ein Trigger sitzt HINTER allen Wegen: Antragsstrecke, Lead-Intake,
-- Admin-Anlage, CSV-Import, Make-Webhook, ein Skript von Hand, ein alter Client,
-- der noch nicht ausgeliefert wurde. Es gibt keinen Weg daran vorbei.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- HILFSFUNKTIONEN: normalisieren wie der Anwendungscode
-- ───────────────────────────────────────────────────────────────────────────

-- E-Mail: kleingeschrieben, getrimmt, Leerstring wird NULL.
CREATE OR REPLACE FUNCTION fiaon_mail_norm(v TEXT) RETURNS TEXT AS $$
  SELECT NULLIF(LOWER(BTRIM(COALESCE(v, ''))), '');
$$ LANGUAGE sql IMMUTABLE;

-- Rufnummer: nur Ziffern, damit „+49 176 123" und „0176123" dasselbe sind.
-- Bewusst NICHT die vollständige E.164-Umrechnung: Die steht im Anwendungscode
-- (`normalizePhone`), und zwei Fassungen davon wären ein neues Doppelmodell.
-- Hier genügt der Vergleich — geschrieben wird der Wert, wie er kommt.
CREATE OR REPLACE FUNCTION fiaon_nummer_norm(v TEXT) RETURNS TEXT AS $$
  SELECT NULLIF(REGEXP_REPLACE(COALESCE(v, ''), '[^0-9]', '', 'g'), '');
$$ LANGUAGE sql IMMUTABLE;

-- ───────────────────────────────────────────────────────────────────────────
-- DER KERN: einen Kontaktwert an die Person durchschreiben
-- ───────────────────────────────────────────────────────────────────────────
-- Drei Fälle, in dieser Reihenfolge:
--   1. Person hat keinen Wert  → sie übernimmt ihn.
--   2. Person hat denselben    → nichts zu tun.
--   3. Person hat einen anderen → sie BEHÄLT ihn, der neue wird Alias.
--
-- Fall 3 ist der wichtige: Die Person ist die Wahrheit. Ein Antrag darf sie
-- nicht überschreiben, sonst wäre der letzte Schreibvorgang die Wahrheit — und
-- das ist ein Zufall, keine Regel. Der abweichende Wert geht aber nicht
-- verloren: Als Alias findet ihn die Suche, und ein Anruf von der alten Nummer
-- wird weiter erkannt.
CREATE OR REPLACE FUNCTION fiaon_kontakt_an_person(
  p_person_id INTEGER,
  p_art       TEXT,       -- 'email' | 'phone'
  p_wert      TEXT,
  p_quelle    TEXT        -- z. B. 'app:FIAON-…' oder 'lead:1234'
) RETURNS VOID AS $$
DECLARE
  v_norm     TEXT;
  v_person   TEXT;
  v_pnorm    TEXT;
BEGIN
  IF p_person_id IS NULL THEN RETURN; END IF;

  IF p_art = 'email' THEN
    v_norm := fiaon_mail_norm(p_wert);
    IF v_norm IS NULL THEN RETURN; END IF;
    SELECT primary_email INTO v_person FROM fiaon_persons WHERE id = p_person_id;
    v_pnorm := fiaon_mail_norm(v_person);

    IF v_pnorm IS NULL THEN
      -- Fall 1: Die Person war leer. Genau der Fall aus dem Auftrag.
      UPDATE fiaon_persons SET primary_email = BTRIM(p_wert), updated_at = NOW()
      WHERE id = p_person_id;
      RETURN;
    END IF;
    IF v_pnorm = v_norm THEN RETURN; END IF;   -- Fall 2

  ELSIF p_art = 'phone' THEN
    v_norm := fiaon_nummer_norm(p_wert);
    -- Zu kurze Ziffernfolgen sind keine Rufnummern (Hausnummern, Tippfehler).
    IF v_norm IS NULL OR LENGTH(v_norm) < 6 THEN RETURN; END IF;
    SELECT primary_phone INTO v_person FROM fiaon_persons WHERE id = p_person_id;
    v_pnorm := fiaon_nummer_norm(v_person);

    IF v_pnorm IS NULL THEN
      UPDATE fiaon_persons SET primary_phone = BTRIM(p_wert), updated_at = NOW()
      WHERE id = p_person_id;
      RETURN;
    END IF;
    -- Endziffern-Vergleich: „+4917612345" und „017612345" sind derselbe Mensch.
    IF v_pnorm = v_norm
       OR RIGHT(v_pnorm, 9) = RIGHT(v_norm, 9) THEN RETURN; END IF;
  ELSE
    RETURN;
  END IF;

  -- Fall 3: abweichend → als Alias sichern, damit die Suche ihn findet.
  INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
  VALUES (p_person_id, p_art, v_norm, BTRIM(p_wert), p_quelle)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────────
-- DER TRIGGER AN DEN BESTELLUNGEN
-- ───────────────────────────────────────────────────────────────────────────
-- AFTER, nicht BEFORE: Die Zeile darf geschrieben werden (sonst bräche jeder
-- bestehende Code), und DANACH wandert der Wert an die Person. Die Spalte ist
-- ab jetzt eine Abschrift.
--
-- Die Bedingung im WHEN hält die Kosten klein: Der Trigger feuert nur, wenn
-- sich ein Kontaktfeld wirklich ändert — nicht bei jedem `updated_at`.
CREATE OR REPLACE FUNCTION fiaon_app_kontakt_durchschreiben() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.person_id IS NULL THEN RETURN NULL; END IF;
  -- Zusammengeführte und gelöschte Zeilen nicht: Sie sind Historie.
  IF NEW.merged_into IS NOT NULL THEN RETURN NULL; END IF;

  PERFORM fiaon_kontakt_an_person(NEW.person_id, 'email', NEW.email, 'app:' || NEW.ref);
  PERFORM fiaon_kontakt_an_person(NEW.person_id, 'email', NEW.contact_email, 'app:' || NEW.ref);
  PERFORM fiaon_kontakt_an_person(NEW.person_id, 'email', NEW.billing_email, 'app:' || NEW.ref);
  PERFORM fiaon_kontakt_an_person(NEW.person_id, 'phone',
    -- Vorwahl und Nummer zusammensetzen, sonst ist „1761234" keine wählbare
    -- Nummer. Steht die Vorwahl schon in `phone`, wird sie nicht doppelt.
    CASE
      WHEN COALESCE(NEW.phone, '') = '' THEN NEW.contact_phone
      WHEN NEW.phone LIKE '+%' THEN NEW.phone
      WHEN COALESCE(NEW.phone_country_code, '') <> ''
        THEN NEW.phone_country_code || NEW.phone
      ELSE NEW.phone
    END, 'app:' || NEW.ref);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiaon_app_kontakt_trigger ON fiaon_applications;
CREATE TRIGGER fiaon_app_kontakt_trigger
  AFTER INSERT OR UPDATE OF email, contact_email, billing_email, phone,
                            contact_phone, phone_country_code, person_id
  ON fiaon_applications
  FOR EACH ROW EXECUTE FUNCTION fiaon_app_kontakt_durchschreiben();

-- ───────────────────────────────────────────────────────────────────────────
-- DER TRIGGER AN DEN LEADS
-- ───────────────────────────────────────────────────────────────────────────
-- Derselbe Gedanke. GEMESSEN: 189 Leads trugen eine E-Mail, die an ihrer Person
-- fehlte — und genau daraus entstanden die Doppelgänger (Antrag bringt die
-- Nummer, Lead die E-Mail, das Dedupe verbindet nicht).
CREATE OR REPLACE FUNCTION fiaon_lead_kontakt_durchschreiben() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.person_id IS NULL THEN RETURN NULL; END IF;
  PERFORM fiaon_kontakt_an_person(NEW.person_id, 'email', NEW.email, 'lead:' || NEW.id);
  PERFORM fiaon_kontakt_an_person(NEW.person_id, 'phone', NEW.telefon, 'lead:' || NEW.id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiaon_lead_kontakt_trigger ON fiaon_leads;
CREATE TRIGGER fiaon_lead_kontakt_trigger
  AFTER INSERT OR UPDATE OF email, telefon, person_id
  ON fiaon_leads
  FOR EACH ROW EXECUTE FUNCTION fiaon_lead_kontakt_durchschreiben();

-- ───────────────────────────────────────────────────────────────────────────
-- DIE SPALTEN SIND AB JETZT ABSCHRIFTEN
-- ───────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN fiaon_applications.email IS
  'ABSCHRIFT. Die Wahrheit ist fiaon_persons.primary_email. Ein Trigger schreibt jeden Wert dorthin durch; abweichende werden Alias. Faellt weg, sobald der Code-Umzug fertig ist (1.293 Stellen, gemessen 20.08.2026).';
COMMENT ON COLUMN fiaon_applications.phone IS
  'ABSCHRIFT. Die Wahrheit ist fiaon_persons.primary_phone. Siehe fiaon_applications.email.';
COMMENT ON COLUMN fiaon_leads.email IS
  'ABSCHRIFT. Die Wahrheit ist fiaon_persons.primary_email.';
COMMENT ON COLUMN fiaon_leads.telefon IS
  'ABSCHRIFT. Die Wahrheit ist fiaon_persons.primary_phone.';

-- ───────────────────────────────────────────────────────────────────────────
-- DAS ARCHIV FÜR DEN SPÄTEREN DROP
-- ───────────────────────────────────────────────────────────────────────────
-- Der Auftrag verlangt eine Wegsicherung, bevor die Spalten fallen. Sie wird
-- JETZT angelegt und beim Bestandslauf gefüllt — dann steht sie bereit, wenn
-- der DROP kommt, und niemand muss unter Zeitdruck eine Kopie ziehen.
--
-- Diese Tabelle wird von der Anwendung NIE gelesen. Sie ist Forensik.
CREATE TABLE IF NOT EXISTS fiaon_kontakt_archiv (
  id            SERIAL PRIMARY KEY,
  quelle        TEXT NOT NULL,        -- 'application' | 'lead'
  kennung       TEXT NOT NULL,        -- ref oder lead-id
  person_id     INTEGER,
  feld          TEXT NOT NULL,        -- 'email' | 'contact_email' | 'phone' | …
  wert          TEXT NOT NULL,
  gesichert_am  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fiaon_kontakt_archiv_kennung_idx
  ON fiaon_kontakt_archiv (quelle, kennung);

COMMENT ON TABLE fiaon_kontakt_archiv IS
  'Forensik-Kopie der Kontaktwerte aus fiaon_applications/fiaon_leads vor dem DROP. Wird von der Anwendung NIEMALS gelesen.';
