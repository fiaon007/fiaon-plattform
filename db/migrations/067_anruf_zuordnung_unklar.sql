-- ═══════════════════════════════════════════════════════════════════════════
-- „ZUORDNUNG UNKLAR" — EINE SICHTBARE LÜCKE STATT EINES FALSCHEN NAMENS
--
-- ── DIE MELDUNG (19.08.2026) ──────────────────────────────────────────────
-- „Gespräche-Tab zeigt fremde Anrufe + Kundenname stimmt nicht zum Gespräch.
-- Bei ALLEN Mitarbeitern sind die Telefongespräche vertauscht."
--
-- ── DIE MESSUNG (scripts/mess-anruf-vertauscht.ts) ────────────────────────
-- Der Auftrag rechnete mit einer Massen-Verwechslung aus wochenlangem
-- Stale-State. GEMESSEN über alle 1.608 Anrufe:
--
--     1.584  gewählte Nummer gehört zur verknüpften Person
--         3  gehört NICHT dazu          ← die echten Fälle
--        19  ohne Person (unbekannte Nummer, kein Fehler)
--
-- Die drei stammen vom 10., 11. und 12.08. — also VOR dem Fix vom 17.08.2026
-- (Commit 7a91c8c, „der Anruf folgt der gewählten Nummer"). Nach Tagen
-- aufgeschlüsselt liegt die Abweichung ab dem 13.08. bei 0 %. Der Fix wirkt.
--
-- Es gibt also keinen Massenbestand zum Umhängen. Und umhängen liesse sich
-- ohnehin keiner der drei: Zu keiner der drei gewählten Nummern gehört eine
-- Person im Bestand. Wohin also?
--
-- ── DESHALB KEINE VERMUTUNG, SONDERN EINE MARKE ───────────────────────────
-- AGENTS.md: „Fehlende Information wird ANGEZEIGT, nicht gefüllt. Eine
-- sichtbare Lücke ist ehrlich; eine gefüllte Lücke ist eine Behauptung."
--
-- Diese Zeilen behalten ihre Person NICHT als Behauptung, sondern tragen eine
-- Marke. Profil und Akte zeigen dann „Zuordnung unklar" statt eines Namens, der
-- nicht zum Gespräch gehört.
--
-- Die Person wird NICHT gelöscht (kein Hard-Delete, AGENTS.md): Sie bleibt als
-- `person_id` stehen, damit der Vorgang auffindbar bleibt, und die Marke sagt,
-- dass man ihr nicht glauben darf.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_calls
  -- Wann wurde festgestellt, dass die Nummer nicht zur Person passt?
  ADD COLUMN IF NOT EXISTS zuordnung_unklar_am TIMESTAMPTZ,
  -- Warum? Klartext für die Anzeige, damit niemand rätselt.
  ADD COLUMN IF NOT EXISTS zuordnung_unklar_grund TEXT,
  -- Wohin wurde umgehängt, falls eindeutig? Die alte Person bleibt hier
  -- stehen, damit ein Umhängen nachvollziehbar und umkehrbar ist.
  ADD COLUMN IF NOT EXISTS person_vorher_id INTEGER,
  ADD COLUMN IF NOT EXISTS umgehaengt_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS umgehaengt_stapel VARCHAR;

COMMENT ON COLUMN fiaon_calls.zuordnung_unklar_am IS
  'Gesetzt, wenn die gewaehlte Nummer nicht zur verknuepften Person gehoert und '
  'keine eindeutige andere Person zu finden war. Anzeige: „Zuordnung unklar".';

COMMENT ON COLUMN fiaon_calls.person_vorher_id IS
  'Die Person, an der der Anruf vor dem Umhaengen hing — fuer Nachvollzug und '
  'Rueckabwicklung ueber umgehaengt_stapel.';

CREATE INDEX IF NOT EXISTS fiaon_calls_unklar_idx
  ON fiaon_calls (zuordnung_unklar_am) WHERE zuordnung_unklar_am IS NOT NULL;

-- ── WARUM HIER KEIN UPDATE STEHT ──────────────────────────────────────────
-- Die Marke wird NICHT in der Migration gesetzt. Sie ist eine fachliche
-- Bewertung („passt die Nummer?"), und diese Regel steht in
-- `server/lib/fiaon-anruf-pruefung.ts` — einmal, für Messung, Bereinigung,
-- Anzeige und Wand. Eine zweite Fassung als SQL in einer Migration würde beim
-- ersten Nachschärfen auseinanderlaufen.
--
-- Gesetzt wird sie von `scripts/anruf-zuordnung-bereinigen.ts` (Vorschau, dann
-- --schreiben) und laufend von der Wand in `pruef-anruf-zuordnung.ts`.
