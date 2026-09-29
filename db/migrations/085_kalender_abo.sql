-- ═══════════════════════════════════════════════════════════════════════════
-- TERMINE IM EIGENEN KALENDER — 29.09.2026 (E-263)
--
-- Justin: „… ‚Alle Termine zu Kalender hinzufügen' … pflegen sich automatisch
-- ein … wenn ich nochmal drauf klicke und 1 neuer Termin ist hinzugekommen
-- dann nur der 1 Termin, nicht alle anderen doppelt."
--
-- Das leistet nur ein Kalender-ABO (eine Adresse, die Apple/Google selbst
-- abrufen). Jeder Termin trägt dort die feste UID termin-<id>@fiaon.com —
-- neu kommt dazu, verschoben wird geändert, abgesagt verschwindet.
--
-- 1. fiaon_kalender_abo: je Mitarbeiter höchstens EIN aktives Abo je Umfang
--    („eigene"; „team" nur für den Chef). Der Token steht NIRGENDS im Klartext:
--    Er wird aus id + zufall mit SESSION_SECRET abgeleitet, gespeichert ist nur
--    sha256(token). Ein Datenbank-Leck allein reicht nicht, das Geheimnis
--    allein auch nicht. Neuer Link = alte Zeile widerrufen_am + neue Zeile
--    (keine Hard-Deletes).
-- 2. kal_sequenz / kal_geaendert_am an fiaon_termine: die SEQUENCE je Termin.
--    Ein Trigger zählt JEDE Änderung an Zeit, Dauer, Status, Mitarbeiter und
--    Absage — egal über welchen Weg (das Verschieben durch Mitarbeiter setzt
--    nicht einmal updated_at). Der Trigger ist die eine Stelle, die alle
--    Schreibwege sieht.
-- 3. (Gegenprüfung 29.09.2026) Ein Trigger an fiaon_agents widerruft jedes
--    Abo, das durch eine Sperre, eine Deaktivierung oder den Entzug der Stufe
--    „inhaber" unzulässig wird — egal über welchen Weg (Team-Seite, Kündigung,
--    Löschen, SQL von Hand). Die Regel ist dieselbe wie kontoDarfAbo in
--    server/lib/fiaon-kalender-abo.ts, die zusätzlich JEDEN Abruf prüft:
--      eigene  nicht gesperrt UND (aktiv ODER Stufe inhaber)
--      team    nicht gesperrt UND Stufe inhaber
--    Widerrufen heißt: Ein späteres Entsperren belebt den alten Link nicht.
--
-- SPERREN (E-254): Die Spalten werden nur angelegt, wenn sie im Katalog
-- fehlen (ADD COLUMN nimmt ACCESS EXCLUSIVE auch dann, wenn die Spalte schon
-- da ist); mit konstantem Default ist das in PG 18 nur ein Katalogeintrag.
-- Die Trigger entstehen nur, wenn sie fehlen (SHARE ROW EXCLUSIVE, kurz — an
-- fiaon_agents hält das nur Schreiber auf, nie die Leser der Anmeldung). Der
-- Migrationsläufer setzt lock_timeout 5 s mit drei Versuchen.
-- Wiederholbar: nur IF NOT EXISTS / Katalogprüfung / CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_kalender_abo (
  id                   BIGSERIAL PRIMARY KEY,
  agent_id             INTEGER NOT NULL,
  umfang               TEXT NOT NULL DEFAULT 'eigene' CHECK (umfang IN ('eigene', 'team')),
  zufall               TEXT NOT NULL,
  token_hash           TEXT NOT NULL UNIQUE,
  erstellt_am          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erstellt_von         TEXT,
  widerrufen_am        TIMESTAMPTZ,
  widerrufen_von       TEXT,
  zuletzt_abgerufen_am TIMESTAMPTZ,
  abrufe               INTEGER NOT NULL DEFAULT 0,
  letzter_client       TEXT
);

-- Höchstens ein aktives Abo je Mitarbeiter und Umfang. Das Prädikat steht
-- wörtlich so im ON CONFLICT von aboHolen (fiaon-kalender-abo.ts) — sonst
-- kann PostgreSQL den Teilindex nicht als Schiedsrichter nehmen (42P10).
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_kalender_abo_aktiv
  ON fiaon_kalender_abo (agent_id, umfang) WHERE widerrufen_am IS NULL;

DO $$
BEGIN
  IF to_regclass('public.fiaon_termine') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_attribute
                    WHERE attrelid = 'public.fiaon_termine'::regclass AND attname = 'kal_sequenz' AND NOT attisdropped) THEN
      ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS kal_sequenz INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute
                    WHERE attrelid = 'public.fiaon_termine'::regclass AND attname = 'kal_geaendert_am' AND NOT attisdropped) THEN
      ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS kal_geaendert_am TIMESTAMPTZ;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fiaon_termin_kal_sequenz() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.beginn IS DISTINCT FROM OLD.beginn
     OR NEW.dauer_min IS DISTINCT FROM OLD.dauer_min
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
     OR NEW.abgesagt_am IS DISTINCT FROM OLD.abgesagt_am THEN
    NEW.kal_sequenz := COALESCE(OLD.kal_sequenz, 0) + 1;
    NEW.kal_geaendert_am := NOW();
  END IF;
  RETURN NEW;
END $f$;

DO $$
BEGIN
  IF to_regclass('public.fiaon_termine') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgrelid = 'public.fiaon_termine'::regclass AND tgname = 'fiaon_termine_kal_sequenz' AND NOT tgisinternal) THEN
      CREATE TRIGGER fiaon_termine_kal_sequenz
        BEFORE UPDATE ON fiaon_termine
        FOR EACH ROW EXECUTE FUNCTION fiaon_termin_kal_sequenz();
    END IF;
  END IF;
END $$;

-- ── 3. Konto zu → Abo zu (Gegenprüfung 29.09.2026) ─────────────────────────
-- Wirft nie: Eine Sperre oder Deaktivierung darf an diesem Zusatz nicht
-- scheitern (die Abruf-Prüfung kontoDarfAbo greift ohnehin).
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
                               WHEN umfang = 'team' THEN 'System (Stufe Inhaber entzogen)'
                               ELSE 'System (Konto deaktiviert)' END
   WHERE agent_id = NEW.id AND widerrufen_am IS NULL
     AND (gesperrt OR (umfang = 'team' AND NOT inhaber) OR (umfang = 'eigene' AND NOT aktiv AND NOT inhaber));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fiaon_kalender_abo_konto_zu: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $f$;

DO $$
BEGIN
  -- Nur, wenn fiaon_agents die drei Spalten trägt (admin_stufe legt der Chef-Zugang lazy an).
  IF to_regclass('public.fiaon_agents') IS NOT NULL
     AND (SELECT COUNT(*) FROM pg_attribute
           WHERE attrelid = 'public.fiaon_agents'::regclass AND NOT attisdropped
             AND attname IN ('active', 'zugang_gesperrt_am', 'admin_stufe')) = 3 THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgrelid = 'public.fiaon_agents'::regclass AND tgname = 'fiaon_agents_kalender_abo_zu' AND NOT tgisinternal) THEN
      CREATE TRIGGER fiaon_agents_kalender_abo_zu
        AFTER UPDATE OF active, zugang_gesperrt_am, admin_stufe ON fiaon_agents
        FOR EACH ROW
        WHEN (OLD.active IS DISTINCT FROM NEW.active
              OR OLD.zugang_gesperrt_am IS DISTINCT FROM NEW.zugang_gesperrt_am
              OR OLD.admin_stufe IS DISTINCT FROM NEW.admin_stufe)
        EXECUTE FUNCTION fiaon_kalender_abo_konto_zu();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgrelid = 'public.fiaon_agents'::regclass AND tgname = 'fiaon_agents_kalender_abo_weg' AND NOT tgisinternal) THEN
      CREATE TRIGGER fiaon_agents_kalender_abo_weg
        AFTER DELETE ON fiaon_agents
        FOR EACH ROW EXECUTE FUNCTION fiaon_kalender_abo_konto_zu();
    END IF;
  END IF;
END $$;
