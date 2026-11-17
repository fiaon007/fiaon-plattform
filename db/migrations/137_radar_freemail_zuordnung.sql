-- ═══════════════════════════════════════════════════════════════════════════
-- 137 · FIRMEN-RADAR: FALSCH ZUGEORDNETE EINGÄNGE ÜBER FREEMAIL-DOMÄNEN AUFRÄUMEN (17.11.2026)
--
-- Florentine (17.11.): „Sämtliche E-Mails an welcome@ landen in der Akte einer Firma.“ Ursache: Der Radar ordnete eingehende
-- Mails auch über die Domäne der Kontaktadresse zu — lag die bei einem Freemail-Anbieter (gmail.com, gmx.net …), gehörte
-- jede Mail von diesem Anbieter der einen Firma. Der Code ist repariert (server/lib/fiaon-radar-faden.ts). Diese Migration
-- räumt die Folgen auf, ohne etwas endgültig zu verlieren:
--   1. Eingänge, die NUR über eine Freemail-Domäne an eine Firma kamen (Absender-Domäne Freemail, Absender ≠ Kontaktadresse,
--      nicht im Faden der Erstmail, nicht in einem Faden, in dem FIAON dieser Firma geschrieben hat), wandern in die Ablage
--      fiaon_radar_post_falsch (vollständige Kopie) und verschwinden aus „Gespräche“. Die Original-Mails liegen weiter im Postfach.
--   2. Hatte so ein fremder Eingang eine Firma umgeschaltet (Status „gesperrt“ oder „antwort“) und bleibt danach KEIN eigener
--      Eingang übrig, steht die Firma wieder auf „versendet“; die Sperren, die der Radar dabei für ihre Domäne/Adresse setzte
--      (Grund „im Radar gesperrt“, nach dem ersten fremden Eingang), werden aufgehoben.
-- Idempotent; ohne Radar-Tabellen (frische Datenbank) tut sie nichts. Keine Namen oder Adressen im Text (öffentliches Repo).
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.fiaon_radar_post') IS NULL OR to_regclass('public.fiaon_radar_firmen') IS NULL THEN
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS fiaon_radar_post_falsch (LIKE fiaon_radar_post INCLUDING DEFAULTS);
  ALTER TABLE fiaon_radar_post_falsch ADD COLUMN IF NOT EXISTS verschoben_am TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE fiaon_radar_post_falsch ADD COLUMN IF NOT EXISTS grund TEXT;

  CREATE TEMP TABLE _frei (d TEXT PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO _frei (d) VALUES
    ('gmail.com'),('googlemail.com'),('gmx.de'),('gmx.net'),('gmx.at'),('gmx.ch'),('gmx.li'),('web.de'),('t-online.de'),('yahoo.com'),('yahoo.de'),
    ('yahoo.at'),('yahoo.ch'),('hotmail.com'),('hotmail.de'),('hotmail.at'),('hotmail.ch'),('outlook.com'),('outlook.de'),('outlook.at'),('live.com'),
    ('live.de'),('live.at'),('msn.com'),('icloud.com'),('me.com'),('mac.com'),('aon.at'),('a1.net'),('chello.at'),('bluewin.ch'),('hispeed.ch'),
    ('sunrise.ch'),('freenet.de'),('posteo.de'),('mail.de'),('arcor.de'),('online.de'),('email.de'),('aol.com'),('aol.de'),('proton.me'),
    ('protonmail.com'),('protonmail.ch'),('pm.me'),('yandex.com'),('mail.ru'),('zoho.com')
  ON CONFLICT DO NOTHING;

  CREATE TEMP TABLE _falsch ON COMMIT DROP AS
    SELECT p.id, p.firma_id, p.datum
      FROM fiaon_radar_post p
      JOIN fiaon_radar_firmen f ON f.id = p.firma_id
     WHERE p.richtung = 'ein'
       AND lower(split_part(substring(p.von from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+'), '@', 2)) IN (SELECT d FROM _frei)
       AND lower(coalesce(substring(p.von from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+'), '')) <> lower(coalesce(f.email, ''))
       AND p.thread_id IS DISTINCT FROM COALESCE(f.gmail_thread_id, f.gmail_nachricht_id)
       AND NOT EXISTS (SELECT 1 FROM fiaon_radar_post a WHERE a.firma_id = p.firma_id AND a.richtung = 'aus' AND a.thread_id = p.thread_id);

  INSERT INTO fiaon_radar_post_falsch
    SELECT p.*, NOW(), 'Freemail-Domäne fälschlich als Firmen-Domäne zugeordnet (Migration 137)'
      FROM fiaon_radar_post p WHERE p.id IN (SELECT id FROM _falsch)
  ON CONFLICT DO NOTHING;
  DELETE FROM fiaon_radar_post WHERE id IN (SELECT id FROM _falsch);

  -- 2. Firmen, die ein fremder Eingang umgeschaltet hatte und die jetzt keinen eigenen Eingang mehr haben
  CREATE TEMP TABLE _betroffen ON COMMIT DROP AS
    SELECT f.id, f.domain, lower(coalesce(f.email, '')) AS email, min(x.datum) AS ab
      FROM fiaon_radar_firmen f JOIN _falsch x ON x.firma_id = f.id
     WHERE f.status IN ('gesperrt', 'antwort')
       AND NOT EXISTS (SELECT 1 FROM fiaon_radar_post p WHERE p.firma_id = f.id AND p.richtung = 'ein')
     GROUP BY f.id, f.domain, f.email;

  IF to_regclass('public.fiaon_radar_sperre') IS NOT NULL THEN
    DELETE FROM fiaon_radar_sperre s
     USING _betroffen b
     WHERE s.grund = 'im Radar gesperrt'
       AND s.created_at >= b.ab
       AND (lower(s.wert) = lower(b.domain) OR (b.email <> '' AND lower(s.wert) = b.email));
  END IF;
  UPDATE fiaon_radar_firmen f SET status = 'versendet', updated_at = NOW()
    FROM _betroffen b WHERE f.id = b.id;
END $$;
