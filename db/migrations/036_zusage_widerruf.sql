-- ═══════════════════════════════════════════════════════════════════════════
-- 036 — Eine Unterschrift entwerten, ohne sie zu löschen
--
-- In einer Test-Session hat ein Playwright-Roboter die Verpflichtungserklärung
-- Fassung 2.0 als „Daniel Stripling" gegen die PRODUKTIONSdatenbank angenommen
-- (IP 127.0.0.1, HeadlessChrome). Dieser Nachweis ist wertlos: Niemand hat den
-- Text gelesen, niemand hat unterschrieben.
--
-- WARUM NICHT LÖSCHEN
-- Die Hausregel lautet: keine Hard-Deletes, nirgends. Bei einem RECHTSNACHWEIS
-- gilt sie doppelt. Würde die Zeile verschwinden, wäre in einem Jahr nicht mehr
-- erklärbar, warum in den Protokollen eine Annahme vom 06.08. auftaucht, die es
-- in der Tabelle nicht gibt. Ein entwerteter Eintrag beantwortet beide Fragen:
-- Es gab eine Unterschrift, und sie war keine.
--
-- Wirkung: `zusageStand` zählt widerrufene Annahmen nicht mehr. Daniel wird beim
-- nächsten Öffnen des Bereichs erneut gefragt und unterschreibt dann selbst.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_vertrieb_zusagen
  ADD COLUMN IF NOT EXISTS widerrufen_am  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS widerruf_grund TEXT,
  ADD COLUMN IF NOT EXISTS widerrufen_von TEXT;

-- Gültige Annahmen sind der Normalfall; der Teilindex bleibt klein.
CREATE INDEX IF NOT EXISTS fiaon_zusagen_gueltig_idx
  ON fiaon_vertrieb_zusagen (agent_id, version)
  WHERE widerrufen_am IS NULL;
