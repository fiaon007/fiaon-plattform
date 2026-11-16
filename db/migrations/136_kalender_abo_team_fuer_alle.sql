-- ═══════════════════════════════════════════════════════════════════════════
-- 136 — DAS TEAM-ABO FÜR JEDEN AKTIVEN MITARBEITER (E-516, 16.11.2026)
--
-- Justin (16.11.2026, Florentines Wunsch nach einem Teamkalender): „Alle mit
-- Namen" — jeder aktive Mitarbeiter sieht die Termine des Teams, im Calendar
-- und im Handy-Kalender (Abo „FIAON · Termine des Teams").
--
-- VORHER (085): team nur bei Stufe „inhaber"; der Trigger widerrief ein
-- Team-Abo, sobald active/zugang_gesperrt_am/admin_stufe sich änderten und die
-- Stufe nicht „inhaber" war.
-- NACHHER: team = eigene — widerrufen wird bei Sperre oder Deaktivierung
-- (außer Inhaber), nicht mehr wegen der Stufe. Die Abruf-Prüfung kontoDarfAbo
-- (server/lib/fiaon-kalender-abo.ts) sagt dasselbe.
--
-- Nur CREATE OR REPLACE der Funktion — Trigger, Tabelle und Daten bleiben.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fiaon_kalender_abo_konto_zu() RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE
  gesperrt BOOLEAN;
  inhaber  BOOLEAN;
  aktiv    BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE fiaon_kalender_abo SET widerrufen_am = NOW(), widerrufen_von = 'System (Konto gelöscht)'
     WHERE agent_id = OLD.id AND widerrufen_am IS NULL;
    RETURN OLD;
  END IF;
  gesperrt := NEW.zugang_gesperrt_am IS NOT NULL;
  inhaber  := COALESCE(TRIM(NEW.admin_stufe), '') = 'inhaber';
  aktiv    := COALESCE(NEW.active, FALSE);
  UPDATE fiaon_kalender_abo
     SET widerrufen_am = NOW(),
         widerrufen_von = CASE WHEN gesperrt THEN 'System (Zugang gesperrt)'
                               ELSE 'System (Konto deaktiviert)' END
   WHERE agent_id = NEW.id AND widerrufen_am IS NULL
     AND (gesperrt OR (NOT aktiv AND NOT inhaber));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fiaon_kalender_abo_konto_zu: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $f$;
