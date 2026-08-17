-- ═══════════════════════════════════════════════════════════════════════════
-- DER VERLAUF BRAUCHT EINEN PERSONENBEZUG
--
-- ── DER BEFUND (16.08.2026, gefunden vom Prüfstand) ───────────────────────
-- An VIER Stellen im Bestand steht seit Längerem:
--
--   INSERT INTO fiaon_contact_log (person_id, …) VALUES (…)
--       ` .catch(() => {});
--
-- Die Spalte `person_id` GIBT ES NICHT. Postgres antwortet mit
-- „column person_id of relation fiaon_contact_log does not exist" — und das
-- `.catch(() => {})` schluckt es. Vier Sorten Vermerk sind deshalb NIE
-- entstanden. GEMESSEN am 16.08.2026:
--
--   0  „Als bezahlt gebucht von … Beleg: …"    (Vertriebsleitung)
--   0  „Stammdaten der Person aktualisiert"     (Änderungsnachweis)
--   0  „Aufnahme von Anruf … angehört."         (Datenschutz-Zugriffsnachweis)
--   1  „Kunde gelöscht (DSGVO) …"               (über einen anderen Weg)
--
-- Die beiden letzten sind NACHWEISE. Wer eine Anrufaufnahme anhört, hinterlässt
-- eine Spur — das war die Absicht, und sie hat nie funktioniert.
--
-- ── WARUM DIE SPALTE UND NICHT DIE VIER AUFRUFE ───────────────────────────
-- Man könnte an vier Stellen `person_id` entfernen. Zwei davon haben aber gar
-- keinen `ref`: Eine DSGVO-Löschung anonymisiert die Bestellungen, und ein
-- Anruf kann zu einer Person ohne Bestellung gehören. Ohne Personenbezug ist
-- der Vermerk dort nicht schreibbar — genau deshalb hat der ursprüngliche Autor
-- `person_id` geschrieben. Die Spalte war die richtige Absicht; sie fehlte nur.
--
-- Additiv, `NULL` erlaubt: Die 11.000 bestehenden Zeilen hängen weiter an `ref`.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_contact_log
  ADD COLUMN IF NOT EXISTS person_id INTEGER;

COMMENT ON COLUMN fiaon_contact_log.person_id IS
  'Personenbezug fuer Vermerke ohne Bestellung (DSGVO-Loeschung, Aufnahme-Zugriff, Stammdaten).';

-- Rückwärts füllen, wo es eindeutig ist: Der `ref` kennt seine Person.
-- Das macht die Akten-Ansicht vollständig, ohne eine Zeile zu erfinden.
UPDATE fiaon_contact_log l
SET person_id = a.person_id
FROM fiaon_applications a
WHERE l.ref = a.ref AND l.person_id IS NULL AND a.person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS fiaon_contact_log_person_idx
  ON fiaon_contact_log (person_id, created_at DESC) WHERE person_id IS NOT NULL;
