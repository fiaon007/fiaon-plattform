-- ═══════════════════════════════════════════════════════════════════════════
-- FIAON GLOBAL — INDIVIDUALANGEBOT MIT KREDITGARANTIE (01.10.2026 abends, E-271)
--
-- Justin: „Der Vertrag soll sagen ‚Kredit garantiert‘ … WIR GARANTIEREN ES IHM.“
-- FIAON garantiert Kreditrahmen + Business-Kreditkarten binnen der Frist; sonst
-- alles Gezahlte zurück (Teil 1 und ein bezahlter Teil 2), eine offene
-- Teil-2-Rechnung entfällt (Vertrag Ziffer 3 Abs. 1, Ziffer 6).
--
-- ── WAS DIESE MIGRATION TUT ───────────────────────────────────────────────
-- Fünf Spalten für „Garantie erfüllt“ (Datum, eingetragener Kreditrahmen in USD,
-- Zahl der Karten, Beleg, wer, wann) und eine für den Erstattungsbetrag im
-- Garantiefall (Teil 1 + ggf. Teil 2, in Cent).
--
-- ── SPERRARM ──────────────────────────────────────────────────────────────
-- Nur ADD COLUMN IF NOT EXISTS ohne Vorgabewert (reine Katalogänderung, kein
-- Umschreiben der Tabelle), kein DROP. Wiederholbar. Dieselbe DDL legt der
-- Server beim ersten Gebrauch selbst an (ensureAngebotTabellen, über die
-- DDL-Wache am sqlPool) — die Reihenfolge Code/Migration ist gleichgültig.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_global_angebote
  ADD COLUMN IF NOT EXISTS garantie_erfuellt_am DATE,
  ADD COLUMN IF NOT EXISTS garantie_rahmen_usd BIGINT,
  ADD COLUMN IF NOT EXISTS garantie_karten INTEGER,
  ADD COLUMN IF NOT EXISTS garantie_beleg TEXT,
  ADD COLUMN IF NOT EXISTS garantie_von TEXT,
  ADD COLUMN IF NOT EXISTS garantie_eingetragen_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erstattung_cents BIGINT;
