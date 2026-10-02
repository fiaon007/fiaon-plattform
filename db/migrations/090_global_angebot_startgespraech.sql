-- ═══════════════════════════════════════════════════════════════════════════
-- FIAON GLOBAL — INDIVIDUALANGEBOT: DAS STARTGESPRÄCH BUCHT DAS SYSTEM (02.10.2026, E-273)
--
-- Justin an Herrn Hildbrand (WhatsApp, 02.10.2026): „… sobald dieser angenommen
-- wurde von Ihnen bucht das System automatisch den nächsten freien Termin, dann
-- können wir direkt mit der Umsetzung starten.“ Nach der Annahme bucht der
-- Server deshalb das Startgespräch (server/lib/fiaon-global-angebot-startgespraech.ts)
-- — höchstens EINES je Angebot. Diese Spalten halten es am Angebot fest.
--
-- ── WAS DIESE MIGRATION TUT ───────────────────────────────────────────────
-- Sieben Spalten: der gebuchte Termin (fiaon_termine.id), sein Beginn, in wessen
-- Kalender, der letzte Versuch und die Zahl der Versuche, der Grund, wenn nicht
-- gebucht werden konnte („kein_platz: …“, „keine_person: …“, „technik: …“), und
-- wann der Kunde Tag und Uhrzeit per Mail bekommen hat.
--
-- ── SPERRARM ──────────────────────────────────────────────────────────────
-- Nur ADD COLUMN IF NOT EXISTS ohne Vorgabewert (reine Katalogänderung, kein
-- Umschreiben der Tabelle), kein DROP, kein Fremdschlüssel. Wiederholbar.
-- Dieselbe DDL legt der Server beim ersten Gebrauch selbst an
-- (ensureAngebotTabellen, über die DDL-Wache am sqlPool) — die Reihenfolge
-- Code/Migration ist gleichgültig. Die Spaltenliste, die Angebot und Kundenseite
-- lesen (OHNE_PDF), bleibt unverändert: Die neuen Spalten liest nur das
-- Startgespräch selbst.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_global_angebote
  ADD COLUMN IF NOT EXISTS startgespraech_termin_id INTEGER,
  ADD COLUMN IF NOT EXISTS startgespraech_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS startgespraech_agent_id INTEGER,
  ADD COLUMN IF NOT EXISTS startgespraech_versuch_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS startgespraech_versuche INTEGER,
  ADD COLUMN IF NOT EXISTS startgespraech_fehler TEXT,
  ADD COLUMN IF NOT EXISTS startgespraech_mail_am TIMESTAMPTZ;
