-- ═══════════════════════════════════════════════════════════════════════════
-- 120 · ZUSATZDIENSTE VON FIAON GLOBAL (22.10.2026, Scheibe 1 „Ihr US-Büro“)
-- Der Server legt die Tabelle beim ersten Gebrauch selbst an (server/lib/fiaon-global-zusatz.ts, ensureZusatzTabelle) —
-- diese Migration ist wortgleich. Je Buchung eine Zeile: Mandat (ref), Dienst (zusatz_key aus shared/fiaon-global-zusatz.ts),
-- eigene Bestellzeile (bestell_ref → fiaon_applications.ref, pack_key global_zusatz_*), Status gebucht → bezahlt → aktiv | storniert.
-- Höchstens EINE nicht stornierte Buchung je Mandat und Dienst (Teilindex; ON CONFLICT nennt dasselbe Prädikat).
-- Keine Löschung: Storno ist ein Status.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fiaon_global_zusatz (
  id BIGSERIAL PRIMARY KEY,
  ref VARCHAR NOT NULL,
  zusatz_key TEXT NOT NULL,
  bestell_ref VARCHAR UNIQUE,
  status TEXT NOT NULL DEFAULT 'gebucht' CHECK (status IN ('gebucht', 'bezahlt', 'aktiv', 'storniert')),
  preis_cents INTEGER NOT NULL CHECK (preis_cents > 0),
  abrechnung TEXT NOT NULL,
  angabe TEXT,
  notiz TEXT,
  gebucht_ip TEXT,
  rechnung_am TIMESTAMPTZ,
  rechnung_mail_am TIMESTAMPTZ,
  rechnung_mail_fehler TEXT,
  bezahlt_am TIMESTAMPTZ,
  bezahlt_von TEXT,
  aktiv_am TIMESTAMPTZ,
  aktiv_von TEXT,
  storniert_am TIMESTAMPTZ,
  storniert_von TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_global_zusatz_eins_idx ON fiaon_global_zusatz (ref, zusatz_key) WHERE status <> 'storniert';
CREATE INDEX IF NOT EXISTS fiaon_global_zusatz_ref_idx ON fiaon_global_zusatz (ref, created_at DESC);
