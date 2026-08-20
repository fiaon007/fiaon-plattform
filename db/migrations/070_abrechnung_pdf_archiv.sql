-- ═══════════════════════════════════════════════════════════════════════════
-- DIE BELEG-WAND STAND AN DER FALSCHEN STELLE (20.08.2026)
--
-- ── DER BEFUND AUS PRODUKTION ─────────────────────────────────────────────
-- FIAON-COM-2026-0011 (Nikita Boychenko, 386,40 €, ausgezahlt) hatte KEIN PDF.
-- Der Abruf antwortete `PDF_FEHLT` mit dem Hinweis, es sei „über Neu erzeugen
-- erstellbar, solange die Auszahlung nicht abgeschlossen ist" — und genau das
-- war sie. Ergebnis: eine ausgezahlte Provision ohne Beleg, und das System
-- verweigerte die Herstellung.
--
-- ── DER DENKFEHLER ────────────────────────────────────────────────────────
-- Die Wand sollte vor ÜBERSCHREIBEN schützen. Sie verbot aber auch das
-- ERSTELLEN. Das sind zwei verschiedene Dinge:
--
--   Es gibt kein PDF        → Erst-Erzeugung. Kein Eingriff in einen Beleg,
--                             sondern seine Herstellung. IMMER erlaubt.
--   PDF da, ausgezahlt      → Überschreiben eines Belegs. Verboten (409).
--   PDF da, nicht ausgezahlt → Neudruck erlaubt, alte Fassung ARCHIVIERT.
--
-- ── WOZU DIESE SPALTEN ────────────────────────────────────────────────────
-- Für den dritten Fall: Wird ein PDF ersetzt, darf das alte nicht verschwinden
-- (Hausregel: keine Hard-Deletes). Es wandert nach `pdf_base64_ersetzt` und
-- bekommt einen Vermerk, wann und durch welche Prüfsumme es ersetzt wurde.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_commission_statements
  -- Die vorherige Fassung des Dokuments. Kein Hard-Delete eines Belegs.
  ADD COLUMN IF NOT EXISTS pdf_base64_ersetzt TEXT,
  ADD COLUMN IF NOT EXISTS pdf_ersetzt_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_ersetzt_von VARCHAR,
  -- Die Pruefsumme der alten Fassung — damit im Vermerk steht, WAS ersetzt wurde.
  ADD COLUMN IF NOT EXISTS doc_hash_ersetzt VARCHAR,
  -- Wann wurde das PDF ERSTMALS erzeugt? Bei den Altzeilen unbekannt (NULL);
  -- ab jetzt gesetzt, damit „nachtraeglich hergestellt" erkennbar bleibt.
  ADD COLUMN IF NOT EXISTS pdf_erzeugt_am TIMESTAMPTZ,
  -- War es eine NACHTRAEGLICHE Herstellung (Beleg fehlte)? Das gehoert
  -- festgehalten: Ein Beleg, der Wochen nach der Auszahlung entstand, ist
  -- inhaltlich richtig, aber sein Entstehungszeitpunkt ist eine Tatsache.
  ADD COLUMN IF NOT EXISTS pdf_nachtraeglich BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN fiaon_commission_statements.pdf_nachtraeglich IS
  'TRUE, wenn das PDF nach der Auszahlung hergestellt wurde, weil bei der '
  'Freigabe keines entstand. Der Beleg zeigt den Stand von damals; nur sein '
  'Druckdatum liegt spaeter.';

COMMENT ON COLUMN fiaon_commission_statements.pdf_base64_ersetzt IS
  'Die vorherige Fassung. Ein ersetztes Dokument wird nicht geloescht.';
