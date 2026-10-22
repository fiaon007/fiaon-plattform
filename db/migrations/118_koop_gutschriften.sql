-- ═══════════════════════════════════════════════════════════════════════════
-- 118 · MONATSABRECHNUNG DER PARTNER-PROVISION PER GUTSCHRIFT (22.10.2026, E-420)
-- Der Server legt die Tabelle beim ersten Gebrauch selbst an (server/lib/fiaon-koop-empfehlung.ts, ensureGutschriftTabelle).
-- Je Partner und Monat höchstens eine Gutschrift (FIAON-GS-JJJJ-NNNNN, Zähler fiaon_counters „gutschrift-JJJJ“); auftrag_id = Zahlungs-
-- auftrag im FIAON Banking (fiaon_buch_auftrag) — ausgezahlt erst, wenn die Buchhaltung ihn ausgeführt hat.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fiaon_koop_gutschriften (
  id BIGSERIAL PRIMARY KEY,
  angebot_id INTEGER NOT NULL,
  monat VARCHAR(7) NOT NULL,
  nummer TEXT NOT NULL UNIQUE,
  prozent NUMERIC(5,2) NOT NULL,
  betrag_cents INTEGER NOT NULL,
  posten JSONB NOT NULL DEFAULT '[]'::jsonb,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mail_am TIMESTAMPTZ,
  mail_ergebnis TEXT,
  auftrag_id INTEGER,
  aufgabe_am TIMESTAMPTZ,
  UNIQUE (angebot_id, monat)
);
