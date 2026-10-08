-- ═══════════════════════════════════════════════════════════════════════════
-- KONTO & KARTE — DIE EINLADUNG ERNEUT SENDEN (E-IT-B, 08.10.2026)
--
-- Justin, 08.10.2026: „Konto & Karte erneut senden: jeder berechtigte
-- Mitarbeiter in der Kundenakte; nur die bestehende Einladung (gleicher Link),
-- kein neuer Vorgang; protokolliert …“
--
-- Der erneute Versand schreibt die EINE Zeile der Einladung fort — nie eine
-- neue (sonst wären die 10 € doppelt vorgemerkt) und nie gesendet_am (das
-- bleibt der Tag des Erstversands; bisher rückte Mara ihn bei jedem erneuten
-- Versand vor). Gezählt wird, wie oft, wann zuletzt und von wem:
--   erneut_anzahl       wie oft die Einladung erneut ging (Akte, Mara, Verwaltung)
--   zuletzt_erneut_am   wann zuletzt — zugleich die Sperre gegen Doppelklick
--                       (bedingtes UPDATE in karteEinladungErneut)
--   zuletzt_erneut_von  wer zuletzt
-- Der vollständige Verlauf steht im Mail-Protokoll (fiaon_mail_log:
-- ausgeloest_von, created_at, empfaenger, zustellung) — hier keine Kopie davon.
--
-- ── SPERREN ───────────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS; der Vorgabewert 0 ist ab PostgreSQL 11 eine reine
-- Katalogänderung (keine Tabelle wird umgeschrieben). Die Tabelle hat rund 370
-- Zeilen. lock_timeout begrenzt das Warten auf die kurze ACCESS-EXCLUSIVE-
-- Sperre (E-254). fiaon_konto_karte legt der Server selbst an
-- (ensureKartenTabelle, server/lib/fiaon-konto-karte.ts) — auf einer frischen
-- Datenbank gibt es sie beim Lauf der Migrationen noch nicht; deshalb der
-- DO-Block mit to_regclass. Dieselbe DDL steht im Server und läuft dort nur,
-- wenn eine Spalte fehlt. Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.fiaon_konto_karte') IS NOT NULL THEN
    ALTER TABLE fiaon_konto_karte
      ADD COLUMN IF NOT EXISTS erneut_anzahl INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS zuletzt_erneut_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS zuletzt_erneut_von TEXT;
  END IF;
END $$;
