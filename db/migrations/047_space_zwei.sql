-- ═══════════════════════════════════════════════════════════════════════════
-- SPACE 2.0 — Bilder, Akten-Verweise, Pin-Grenze
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_posts
  -- Bild als Datenstrom, nicht als Datei im Dateisystem: Der Server läuft auf
  -- Render mit flüchtigem Speicher — eine hochgeladene Datei wäre nach dem
  -- nächsten Neustart weg, der Beitrag zeigte auf ein Loch.
  ADD COLUMN IF NOT EXISTS bild        BYTEA,
  ADD COLUMN IF NOT EXISTS bild_typ    TEXT,
  -- Der ANGEHÄNGTE KUNDE. Im Feed erscheint davon nur eine neutrale Karte
  -- mit der Referenz; wer darauf klickt und nicht berechtigt ist, bekommt
  -- eine freundliche 404. So können Kollegen über einen Fall reden, ohne
  -- Namen, Beträge oder Nummern in den Freitext zu schreiben.
  ADD COLUMN IF NOT EXISTS akte_ref    TEXT,
  ADD COLUMN IF NOT EXISTS akte_person INTEGER,
  -- Wer wann angepinnt hat — die Grenze von zwei braucht eine Reihenfolge,
  -- damit das System sagen kann, welcher der ältere ist.
  ADD COLUMN IF NOT EXISTS angepinnt_am  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS angepinnt_von TEXT;

CREATE INDEX IF NOT EXISTS fiaon_posts_pin_idx
  ON fiaon_posts (angepinnt_am DESC) WHERE angepinnt AND geloescht_at IS NULL;

-- Bestehende angepinnte Beiträge bekommen einen Zeitpunkt, damit die
-- Verdrängungsfrage von Anfang an eine Reihenfolge kennt.
UPDATE fiaon_posts SET angepinnt_am = created_at
  WHERE angepinnt AND angepinnt_am IS NULL;

-- Der Feed lädt seitenweise nach; ohne Index wird das ab ein paar tausend
-- Beiträgen ein Tabellendurchlauf pro Bildschirmhöhe.
CREATE INDEX IF NOT EXISTS fiaon_posts_feed_idx
  ON fiaon_posts (created_at DESC, id DESC) WHERE geloescht_at IS NULL;
