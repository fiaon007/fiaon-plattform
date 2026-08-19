-- ═══════════════════════════════════════════════════════════════════════════
-- WEM GEHÖRT EIN ANRUF? — DIE HERKUNFT DER ZUORDNUNG (19.08.2026)
--
-- ── DIE MELDUNG ───────────────────────────────────────────────────────────
-- In Lucas Böhnerts Gespräche-Tab stand ein Anruf, in dem „Herr Boyschenko"
-- spricht — Nikitas Gespräch bei Lucas.
--
-- ── DER BEFUND (scripts/mess-anruf-zuordnung.ts) ──────────────────────────
-- 1.552 Anrufe, davon 1.403 ausgehend und 149 eingehend.
--
--   · AUSGEHEND ist richtig: `agent_id` ist `req.agent.id`, also die Sitzung,
--     die gewählt hat. 186 Anrufe gehen vom Betreuer ab — das ist KEIN Fehler,
--     sondern ein Kollege, der für jemanden angerufen hat.
--   · EINGEHEND ist eine VERMUTUNG: `zustaendigFuer()` leitet den Agenten aus
--     Inkasso-Zuständigkeit, Termin, BETREUER und „wer zuletzt sprach" ab. Das
--     beantwortet „wer sollte rangehen", nicht „wer hat gesprochen". Bei 123
--     der 149 eingehenden Anrufe ist `agent_id` genau der Betreuer.
--
-- ── WARUM DER BESTAND NICHT UMGEHÄNGT WIRD ────────────────────────────────
-- Weil niemand weiß, wohin. Es gibt kein Ereignis „Anruf angenommen", keine
-- zweite Agenten-Spalte und kein Sitzungs-Protokoll der Annahme. Ein Umhängen
-- wäre Raten, und ein geratener Anruf im Profil eines Menschen ist schlimmer
-- als ein fehlender: Er wird als Leistungsnachweis gelesen.
--
-- Was sich SEHR WOHL belegen lässt: Wer das ERGEBNIS erfasst hat. Die Route
-- POST /telefon/:id/ergebnis lehnt fremde Anrufe ausdrücklich ab („Das ist
-- nicht dein Anruf"). Ein Anruf mit Ergebnis hat also einen belegten
-- Bearbeiter — 1.339 von 1.552.
--
-- ── DESHALB: DIE HERKUNFT WIRD MITGESCHRIEBEN ─────────────────────────────
-- Nicht die Zuordnung wird geraten, sondern ihre Verlässlichkeit wird SICHTBAR.
-- Drei Werte:
--
--   'gewaehlt'       — die Sitzung hat gewählt. Belegt.
--   'ergebnis'       — die Sitzung hat das Ergebnis erfasst. Belegt.
--   'zustaendigkeit' — abgeleitet aus der Zuständigkeit. NICHT belegt.
--
-- Die Gespräche-Ansicht schreibt das an die Zeile. Damit steht im Profil kein
-- fremdes Gespräch mehr ohne Kennzeichnung — und der Betreiber sieht mit einem
-- Blick, welche Zeile eine Behauptung ist.
--
-- AGENTS.md: „Eine sichtbare Lücke ist ehrlich; eine gefüllte Lücke ist eine
-- Behauptung."
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_calls
  ADD COLUMN IF NOT EXISTS zuordnung_herkunft TEXT,
  -- Wer war nach der Ableitung ZUSTÄNDIG? Bei eingehenden Anrufen dieselbe
  -- Kennung wie agent_id — aber getrennt festgehalten, damit ein späteres
  -- Umhängen von agent_id die Ableitung nicht überschreibt.
  ADD COLUMN IF NOT EXISTS zustaendig_agent_id INTEGER;

COMMENT ON COLUMN fiaon_calls.zuordnung_herkunft IS
  'Woher kommt agent_id: gewaehlt (Sitzung hat gewaehlt) | ergebnis (Sitzung hat '
  'das Ergebnis erfasst) | zustaendigkeit (abgeleitet, NICHT belegt).';

-- ── DER BESTAND BEKOMMT SEINE HERKUNFT ──────────────────────────────────────
-- Ableitbar ohne jede Vermutung:
--   ausgehend                      → gewaehlt
--   eingehend MIT Ergebnis         → ergebnis   (die Route hat die Sitzung geprueft)
--   eingehend OHNE Ergebnis        → zustaendigkeit
UPDATE fiaon_calls
SET zuordnung_herkunft = CASE
      WHEN COALESCE(richtung, 'raus') <> 'eingehend' THEN 'gewaehlt'
      WHEN ergebnis IS NOT NULL THEN 'ergebnis'
      ELSE 'zustaendigkeit'
    END
WHERE zuordnung_herkunft IS NULL;

-- Bei eingehenden Anrufen war agent_id die abgeleitete Zustaendigkeit.
UPDATE fiaon_calls
SET zustaendig_agent_id = agent_id
WHERE richtung = 'eingehend' AND zustaendig_agent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_fiaon_calls_herkunft
  ON fiaon_calls (agent_id, zuordnung_herkunft);
