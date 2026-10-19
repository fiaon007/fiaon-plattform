-- ═══════════════════════════════════════════════════════════════════════════
-- 113 · VERTRAGSBESTÄTIGUNG FÜR JEDEN ABSCHLUSSWEG (19.10.2026, E-398)
--
-- fiaon_vertrag_einladungen: die Einladung, den Vertrag zu unterschreiben bzw. zu bestätigen — für Bestellungen, die
-- nicht über /antrag-neu entstanden sind (Betreuer-Anlage, alter Antrag). Eine Zeile je Bestellung (kein Zweitversand).
-- Die Annahme selbst steht wie bei /antrag-neu in fiaon_vertragsannahmen (Vertrag, PDF, Bestätigung).
-- Nur eine neue Tabelle (CREATE TABLE IF NOT EXISTS) — keine Sperre auf bestehende Tabellen (E-254).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fiaon_vertrag_einladungen (
  id            SERIAL PRIMARY KEY,
  ref           VARCHAR NOT NULL,
  person_id     INTEGER,
  modus         VARCHAR(20) NOT NULL,
  email         TEXT,
  gesendet_am   TIMESTAMPTZ,
  fehler        TEXT,
  versuche      INTEGER NOT NULL DEFAULT 0,
  angenommen_am TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_vertrag_einladungen_ref ON fiaon_vertrag_einladungen (ref);
