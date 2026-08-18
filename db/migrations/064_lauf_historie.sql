-- ═══════════════════════════════════════════════════════════════════════════
-- LAUF-HISTORIE: WANN LIEF WAS, WIE LANGE, MIT WELCHEM ERGEBNIS?
--
-- ── DER VORFALL (30.08.2026) ───────────────────────────────────────────────
-- `followup_last_run` stand auf dem 03.08.2026, der Kalender zeigte den 18.08.
-- FÜNFZEHN TAGE. In dieser Zeit wurde keine Einstufung nachgezogen, keine
-- gebrochene Zahlungszusage eskaliert, kein herrenloser Kunde verteilt.
--
-- Aufgefallen ist es NICHT durch eine Warnung, sondern beiläufig: bei der Frage,
-- warum 188 gespeicherte Stufen von der Ableitung abwichen.
--
-- ── WARUM DAS SO LANGE UNSICHTBAR BLEIBEN KONNTE ──────────────────────────
-- Von acht registrierten Läufen schrieben DREI irgendwo hin, dass sie liefen —
-- und zwar jeder anders: ein Datum in `fiaon_settings`, ein Slot-Text, ein
-- weiteres Datum. Die anderen fünf hinterließen NICHTS. Ob sie liefen, war nur
-- an ihren Wirkungen zu erraten (erzeugte Raten, verschickte Mails), und
-- „nichts getan" sieht dabei genauso aus wie „nicht gelaufen".
--
-- Ein Zustand, den man nur erraten kann, wird nicht überwacht.
--
-- ── WAS DIESE TABELLE IST ─────────────────────────────────────────────────
-- Eine Zeile je AUSFÜHRUNG, nicht je Tag. Damit lässt sich unterscheiden:
--
--   erfolg         durchgelaufen, Ergebnis in `meldung`
--   fehler         abgebrochen, Grund in `fehler`
--   uebersprungen  bewusst nicht gelaufen (noch nicht fällig, Lock belegt,
--                  Motor abgeschaltet) — das ist KEIN Ausfall und darf keine
--                  Warnung erzeugen
--
-- Die Unterscheidung ist der ganze Punkt: Ein Lauf, der zehnmal am Tag sagt
-- „noch nicht fällig", ist gesund. Ein Lauf, der zehnmal sagt „Fehler", ist es
-- nicht. Wer beides als „lief nicht" zählt, bekommt eine Ampel, die immer rot
-- ist — und eine Ampel, die immer rot ist, wird abgeschaltet.
--
-- ── SIE WÄCHST, ALSO BLEIBT SIE SCHLANK ───────────────────────────────────
-- Acht Läufe, teils im 20-Minuten-Takt: etwa 2.000 Zeilen am Tag, wenn man die
-- übersprungenen mitschreibt. Deshalb werden ÜBERSPRUNGENE nur geschrieben,
-- wenn sich der Grund ändert — und ein Aufräumen hält 90 Tage.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_lauf_historie (
  id         SERIAL PRIMARY KEY,
  -- Der Name aus `tageslauf(...)` — die eine Kennung, unter der ein Lauf im
  -- ganzen Haus bekannt ist.
  name       TEXT NOT NULL,
  begonnen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  beendet    TIMESTAMPTZ,
  dauer_ms   INTEGER,
  -- 'erfolg' | 'fehler' | 'uebersprungen'
  ergebnis   TEXT NOT NULL DEFAULT 'laeuft',
  -- Klartext für den Betreiber: „12 Raten angelegt, 3 Rechnungen versandt".
  meldung    TEXT,
  -- Nur bei 'fehler': die Fehlermeldung, gekürzt.
  fehler     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Die Frage der Ampel: „wann lief <name> zuletzt ERFOLGREICH?"
CREATE INDEX IF NOT EXISTS fiaon_lauf_historie_erfolg_idx
  ON fiaon_lauf_historie (name, begonnen DESC)
  WHERE ergebnis = 'erfolg';

-- Die Frage der Diagnose: „was ist zuletzt überhaupt passiert?"
CREATE INDEX IF NOT EXISTS fiaon_lauf_historie_name_idx
  ON fiaon_lauf_historie (name, begonnen DESC);

COMMENT ON TABLE fiaon_lauf_historie IS
  'Eine Zeile je AUSFUEHRUNG eines registrierten Laufs (server/lib/fiaon-crons.ts). Grundlage der Ampel auf dem Admin-Dashboard und der Warn-Mail bei Ausfall. „uebersprungen" ist KEIN Ausfall.';

-- ── DIE WARN-SPERRE ────────────────────────────────────────────────────────
-- Eine Warn-Mail je Lauf und Tag, nicht je Takt. Ohne diesen Merker bekäme der
-- Betreiber bei einem 20-Minuten-Takt 72 Mails am Tag — und würde die 73.
-- ungelesen wegwischen, samt der echten Meldung darin.
CREATE TABLE IF NOT EXISTS fiaon_lauf_warnungen (
  name       TEXT PRIMARY KEY,
  gewarnt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stunden    INTEGER
);

COMMENT ON TABLE fiaon_lauf_warnungen IS
  'Wann wurde zuletzt wegen dieses Laufs gewarnt? Hoechstens eine Mail je Lauf und Tag — sonst erzeugt ein 20-Minuten-Takt 72 Mails, und die 73. wird ungelesen weggewischt.';
