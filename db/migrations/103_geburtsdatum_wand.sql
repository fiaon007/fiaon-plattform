-- ═══════════════════════════════════════════════════════════════════════════
-- GEBURTSDATUM: DIE WAND IN DER DATENBANK — 08.10.2026 (E-IT-G, Punkt 14)
--
-- Seit E-IT-G geht jede Geburtsdatum-Eingabe durch EINEN Leser
-- (shared/fiaon-geburtsdatum.ts): drei Felder TT · MM · JJJJ, „63“ → 1963,
-- echter Kalendertag, nicht in der Zukunft, nicht vor 1900. Die Server-Wege
-- prüfen vor dem Schreiben. Diese Wand fängt, was trotzdem durchkäme — etwa
-- „0063-11-17“ aus einem Datumsfeld des Browsers in einem Weg, den niemand
-- umgestellt hat.
--
-- Gemessen am 08.10.2026 (nur lesend, alle Zeilen inkl. zusammengeführter und
-- Testzeilen): 2.793 Bestellungen und 3.358 Personen mit Geburtsdatum,
-- 0 Verstöße gegen das Muster, 0 falsche Kalendertage; 0 Mitarbeiter mit
-- birth_date. VALIDATE läuft deshalb durch.
--
-- Gegenprüfung 08.10.: Bis zum Umschalten bedient der ALTE Code — dessen
-- Akten (type=date) können genau „0063-11-17“ schreiben. Ein einziger solcher
-- Wert zwischen Messung und Deploy ließe VALIDATE scheitern, und weil
-- run-migrations die ganze Datei in EINER Transaktion fährt, fehlte dann auch
-- die Spalte identifiziert_ueber (Kündigungsseite → 500). Darum steht jedes
-- VALIDATE in einem eigenen Block, der einen Verstoß nur meldet (WARNING):
-- Die Bedingung bleibt dann NOT VALID, schützt aber jeden NEUEN Schreibvorgang,
-- und Spalte und Datei gehen trotzdem durch. scripts/it-g-einmal.ts (Teil A)
-- zeigt „NICHT geprüft“, nennt die Verstöße und das VALIDATE zum Nachholen.
-- Zusätzlich legt cancellation.ts die Spalte selbst an, falls sie fehlt.
--
-- Sperrarm: Der Lauf setzt lock_timeout = 5 s (scripts/run-migrations.mjs).
-- ADD CONSTRAINT … NOT VALID braucht die Tabellensperre nur einen Augenblick;
-- weil VALIDATE in derselben Transaktion läuft, hält sie bis zum Ende der
-- Datei — bei rund 4.000 bzw. 6.000 Zeilen Millisekunden. Alles idempotent.
--
-- Dazu die Spalte identifiziert_ueber an den Kündigungsanträgen: Fehlt bei uns
-- jedes Geburtsdatum, nimmt /abo-kuendigen die Kündigung über Name und E-Mail
-- an (Justin, 08.10.2026) — der Antrag trägt dann 'name_email', und das Team
-- prüft die Identität. Sonst 'geburtsdatum'. Altbestand bleibt NULL.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.cancellation_requests') IS NOT NULL THEN
    ALTER TABLE cancellation_requests ADD COLUMN IF NOT EXISTS identifiziert_ueber VARCHAR;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiaon_app_geburt_iso') THEN
    ALTER TABLE fiaon_applications ADD CONSTRAINT fiaon_app_geburt_iso
      CHECK (birthdate IS NULL OR birthdate ~ '^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiaon_person_geburt_iso') THEN
    ALTER TABLE fiaon_persons ADD CONSTRAINT fiaon_person_geburt_iso
      CHECK (birthdate IS NULL OR birthdate ~ '^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiaon_agent_geburt_ab_1900') THEN
    ALTER TABLE fiaon_agents ADD CONSTRAINT fiaon_agent_geburt_ab_1900
      CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01') NOT VALID;
  END IF;
END $$;

-- Jedes VALIDATE für sich: ein Altwert meldet sich, statt die Datei zurückzurollen.
DO $$
BEGIN
  ALTER TABLE fiaon_applications VALIDATE CONSTRAINT fiaon_app_geburt_iso;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'E-IT-G: fiaon_app_geburt_iso bleibt NOT VALID — Altwerte, siehe scripts/it-g-einmal.ts';
END $$;

DO $$
BEGIN
  ALTER TABLE fiaon_persons VALIDATE CONSTRAINT fiaon_person_geburt_iso;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'E-IT-G: fiaon_person_geburt_iso bleibt NOT VALID — Altwerte, siehe scripts/it-g-einmal.ts';
END $$;

DO $$
BEGIN
  ALTER TABLE fiaon_agents VALIDATE CONSTRAINT fiaon_agent_geburt_ab_1900;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'E-IT-G: fiaon_agent_geburt_ab_1900 bleibt NOT VALID — Altwerte, siehe scripts/it-g-einmal.ts';
END $$;
