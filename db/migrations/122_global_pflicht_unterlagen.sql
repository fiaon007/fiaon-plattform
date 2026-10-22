-- ═══════════════════════════════════════════════════════════════════════════
-- 122 · DOKUMENTE ZUR UNTERSCHRIFT JE GLOBAL-MANDAT (22.10.2026, „die vollständige Akte“)
-- Der Server macht dasselbe beim ersten Gebrauch (server/lib/fiaon-global-akte-komplett.ts, ensureAkteKomplett,
-- und fiaon-global-mandat.ts). Nur neue Spalten, nichts wird gelöscht.
--   pflicht_key            ordnet ein Dokument einem amtlichen Formular zu (shared/fiaon-global-akte.ts,
--                          GLOBAL_PFLICHT_UNTERLAGEN: irs_ss4, irs_8821) — daraus die Vollständigkeit je Mandat.
--   unterschrift_nachweis  leer: der Prüfbericht der Unterschrift (E-SIGN-konform), den eine spätere Scheibe füllt.
-- Stand: vorbereitet (intern) → zur Unterschrift (unterschrift_gefordert, sichtbar) → unterschrieben (unterschrieben_am).
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE fiaon_global_dokumente ADD COLUMN IF NOT EXISTS pflicht_key TEXT;
ALTER TABLE fiaon_global_dokumente ADD COLUMN IF NOT EXISTS unterschrift_nachweis JSONB;
