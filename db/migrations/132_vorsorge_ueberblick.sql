-- ═══════════════════════════════════════════════════════════════════════════
-- 132 · „IHR VORSORGE-ÜBERBLICK“ (E-487, 09.11.2026)
--
-- Die FIAON-eigene Leistung hinter Maras Mail und der Kundenbereich-Karte: Der Kunde hält fest, welche Vorsorge-Themen ihm
-- wichtig sind (nur das Thema — FIAON empfiehlt nichts). Regeln und Texte: shared/fiaon-vorsorge.ts · Ablauf:
-- server/lib/fiaon-vorsorge.ts. Die Einwilligung zum Partner-Gespräch steht NICHT hier, sondern wie bisher in
-- fiaon_koop_einwilligungen (Kanal „kundenbereich“, Fassung KOOP-EW-SELBST-2026-11-09).
--
--   fiaon_vorsorge_ueberblick  eine Zeile je Mensch: gewählte Themen (jsonb-Liste von Texten), woher (persönlicher Link oder
--                              Kundenbereich), wann gespeichert — dazu, ob und wie oft der persönliche Link geöffnet wurde
--                              (Trichter im Chefbüro › Mailwerk: versandt → geöffnet → Überblick → Termin)
--
-- Neue Tabelle, sperrt nichts Bestehendes. Dieselbe Datei führt der Server beim ersten Gebrauch aus, falls sie fehlt.
-- Wiederholbar. Keine Fremdschlüssel (Hausregel).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_vorsorge_ueberblick (
  person_id          INTEGER PRIMARY KEY,
  themen             JSONB NOT NULL DEFAULT '[]'::jsonb,
  quelle             VARCHAR(16) CHECK (quelle IS NULL OR quelle IN ('link', 'kundenbereich')),
  gespeichert_am     TIMESTAMPTZ,
  link_geoeffnet_am  TIMESTAMPTZ,
  link_aufrufe       INTEGER NOT NULL DEFAULT 0,
  erstellt_am        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geaendert_am       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
