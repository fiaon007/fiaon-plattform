-- ═══════════════════════════════════════════════════════════════════════════
-- SPACE V3 — bearbeiten, löschen, antworten
--
-- Der Betreiber: „Wenn ich bei SPACE einen Post abgebe, soll ich ihn auch
-- widerrufen bzw. löschen können!" — und Antworten auf Kommentare.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_posts
  -- Bearbeitet: Der Zeitpunkt trägt die Marke im Feed. Ein Beitrag, der sich
  -- lautlos ändert, nachdem ihn jemand gelesen hat, ist eine Falle.
  ADD COLUMN IF NOT EXISTS bearbeitet_am TIMESTAMPTZ,
  -- Wer gelöscht hat. Bei Moderation durch Admin oder Leitung steht hier ein
  -- anderer Name als der Autor — das muss nachvollziehbar bleiben.
  ADD COLUMN IF NOT EXISTS geloescht_von TEXT,
  ADD COLUMN IF NOT EXISTS geloescht_grund TEXT;

ALTER TABLE fiaon_post_kommentare
  -- Die Antwort auf einen Kommentar. GENAU EINE Ebene: Ein Kommentar mit
  -- Elternteil kann selbst keine Kinder haben — Antworten darauf reihen sich
  -- beim selben Elternteil ein. Tiefere Bäume sind auf 380 px unlesbar und
  -- niemand findet mehr, worauf sich etwas bezieht.
  ADD COLUMN IF NOT EXISTS antwort_auf INTEGER REFERENCES fiaon_post_kommentare(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bearbeitet_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geloescht_von TEXT;

CREATE INDEX IF NOT EXISTS fiaon_post_kommentare_antwort_idx
  ON fiaon_post_kommentare (antwort_auf) WHERE antwort_auf IS NOT NULL;

-- ── REAKTIONEN AUF ZWEI REDUZIERT ──────────────────────────────────────────
-- Vier Marken (Daumen, Herz, Stern, Blitz) klangen nach Auswahl und waren
-- keine: Niemand konnte sagen, wofür „Stern" statt „Herz" steht, und die
-- Zahlen verteilten sich auf vier Töpfe, sodass keiner aussagekräftig war.
--
-- „Gefällt mir" und „Gefällt mir nicht" sind eindeutig. Die alten Marken
-- werden NICHT gelöscht, sondern zusammengeführt — eine Reaktion ist eine
-- Willensäusserung eines Menschen, die wirft man nicht weg.
UPDATE fiaon_post_reaktionen SET art = 'gut'
 WHERE art IN ('daumen', 'herz', 'stern', 'blitz');

-- Nach der Zusammenführung kann eine Person zweimal dieselbe Marke haben
-- (etwa vorher Herz UND Stern). Die Doppelten entfernen, die älteste bleibt.
DELETE FROM fiaon_post_reaktionen a
 USING fiaon_post_reaktionen b
 WHERE a.post_id = b.post_id AND a.agent_id = b.agent_id
   AND a.art = b.art AND a.id > b.id;
