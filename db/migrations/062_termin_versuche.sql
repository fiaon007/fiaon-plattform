-- ═══════════════════════════════════════════════════════════════════════════
-- BUCHUNGSVERSUCHE PROTOKOLLIEREN
--
-- ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
-- „Die Terminbuchung funktioniert unabhängig von der Uhrzeit nicht
-- zuverlässig."
--
-- ── WARUM DIE MELDUNG BISHER NICHT PRÜFBAR WAR ────────────────────────────
-- Ein gescheiterter Buchungsversuch hinterlässt heute NICHTS. Die Route
-- antwortet dem Kunden mit HTTP 409 und schreibt im Fehlerfall eine Zeile auf
-- die Konsole („[TERMIN] buchen:"). Danach ist der Vorgang weg:
--
--   · Kein Datensatz, also keine Häufigkeit.
--   · Kein Grund, also keine Ursache.
--   · Kein Slot, also kein Muster über die Uhrzeit.
--
-- Damit lässt sich „nicht zuverlässig" weder belegen noch widerlegen. Eine
-- Statistik aus Serverlogs zu bauen wäre ein Ratespiel — und die Logs eines
-- neu gestarteten Dienstes sind ohnehin weg.
--
-- ── WAS DIESE TABELLE IST UND WAS NICHT ───────────────────────────────────
-- Sie ist ein PROTOKOLL der Versuche, keine zweite Terminliste. Die Termine
-- stehen weiter in `fiaon_termine`; hier steht nur, wer wann was versucht hat
-- und was dabei herauskam.
--
-- Auch der ERFOLGREICHE Versuch wird geschrieben. Ohne ihn wäre die Ablehnquote
-- nicht berechenbar: 12 Ablehnungen sind bei 15 Versuchen eine Katastrophe und
-- bei 4.000 Versuchen ein Rundungsfehler. Eine Zahl ohne ihren Bezug ist keine
-- Messung.
--
-- ── SCHLANK, WEIL SIE WÄCHST ──────────────────────────────────────────────
-- Jeder Klick auf einen Slot erzeugt eine Zeile. Deshalb keine Texte in
-- Freiform, sondern ein kurzer Grund-Code und die Kennungen — und ein Index,
-- der genau die Frage bedient, die gestellt wird („die letzten sieben Tage").
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_termin_versuche (
  id           SERIAL PRIMARY KEY,
  -- Wann wurde es versucht (nicht: wann sollte der Termin sein).
  versucht_am  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Wer. Beides darf leer sein: Ein abgelaufener Link kennt die Person nicht
  -- mehr, und genau dieser Fall soll zählbar sein.
  person_id    INTEGER,
  lead_id      INTEGER,
  -- Welcher Slot war gewählt? Bei „Link ungültig" gibt es keinen — dann NULL.
  slot_beginn  TIMESTAMPTZ,
  agent_id     INTEGER,
  -- 'gebucht' | 'abgelehnt'
  ergebnis     TEXT NOT NULL,
  -- Der Grund-Code der Ablehnung: 'belegt', 'kein_slot', 'zu_frueh',
  -- 'vergangenheit', 'zu_spaet', 'agent_unbekannt', 'falsche_rolle',
  -- 'zeit_unlesbar', 'nicht_angeboten', 'link_ungueltig', 'keine_auswahl',
  -- 'serverfehler'. Bei 'gebucht' bleibt er leer.
  grund        TEXT,
  -- Woher kam der Versuch: 'nichterreicht_mail' | 'onboarding' |
  -- 'onboarding_call' | 'agent_manuell' | 'portal'
  quelle       TEXT,
  -- Kunde oder Mitarbeiter? Ein Agent, der von Hand einträgt, hat andere
  -- Regeln (kein Vorlauf) — beides in einen Topf zu zählen würde die Quote
  -- verfälschen.
  akteur       TEXT NOT NULL DEFAULT 'kunde',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Die Frage, die die Karte stellt: „die letzten sieben Tage, nach Ergebnis".
CREATE INDEX IF NOT EXISTS fiaon_termin_versuche_zeit_idx
  ON fiaon_termin_versuche (versucht_am DESC);

-- Und die Frage danach: „welcher Grund, welche Uhrzeit?"
CREATE INDEX IF NOT EXISTS fiaon_termin_versuche_grund_idx
  ON fiaon_termin_versuche (ergebnis, grund);

COMMENT ON TABLE fiaon_termin_versuche IS
  'PROTOKOLL der Buchungsversuche (auch der erfolgreichen), damit die Meldung „Buchung unzuverlaessig" belegbar oder widerlegbar wird. KEINE Terminliste — die steht in fiaon_termine.';
