-- ═══════════════════════════════════════════════════════════════════════════
-- E-029 (24.08.2026) — DER AUSTAUSCH ZWISCHEN BETREIBER UND MITARBEITER
--
-- Justins Auftrag, wörtlich: „bei /agent/aufgaben — ich muss eine Aufgabe auch
-- als erledigt markieren können, oder drauf antworten, das es Austausch
-- zwischen Admins und Mitarbeiter gibt."
--
-- ── WAS VORHER DA WAR ─────────────────────────────────────────────────────
--   fiaon_betreiber_todos mit status / zustaendig_* / frage_offen (E-028) und
--   fiaon_betreiber_todo_beitraege als Zeitleiste. Der Mitarbeiter konnte
--   annehmen, fragen, ein Ergebnis melden. Justin konnte antworten.
--
-- ── WAS FEHLTE, UND WARUM ES HIER DAZUKOMMT ───────────────────────────────
--
--   frage_an_agent
--     Justin konnte KEINE Frage stellen, die eine Antwort verlangt — seine
--     Nachricht war immer nur ein Kommentar, den niemand beantworten musste.
--     Ein Austausch, der nur in eine Richtung eine Pflicht kennt, ist ein
--     Briefkasten. Steht die Marke, sieht der Mitarbeiter „Justin fragt dich"
--     und hat einen Antwort-Knopf; seine nächste Nachricht löscht sie.
--
--   agent_gelesen_am / betreiber_gelesen_am
--     Niemand sah, ob die Gegenseite das Geschriebene schon gelesen hat. Der
--     Mitarbeiter wusste nicht, dass Justin geantwortet hatte, bis er zufällig
--     die Zeitleiste aufklappte.
--
--     Bewusst ZEITPUNKTE statt Zähler: Was nach dem Lesezeitpunkt geschrieben
--     wurde, ist neu — sonst nicht. So verschwindet die Marke zwangsläufig,
--     sobald jemand hingesehen hat, und kann nie eine Zahl anzeigen, die es
--     nicht mehr gibt. Genau das hat Justin am 24.08. an anderer Stelle
--     bemängelt: Marken, die stehen bleiben, nachdem alles erledigt ist.
--
-- Additiv und idempotent. Keine Spalte wird entfernt, keine Bestandszeile
-- geändert: NULL in den beiden Lesezeitpunkten heißt „noch nie gelesen", und
-- das ist für Aufträge aus der Zeit vor heute die richtige Aussage.
--
-- Der Server legt dieselben Spalten beim Start selbst an
-- (ensureAustauschSpalten in server/routes/fiaon-betreiber-todo.ts, Vorbild
-- ensureVertriebSpalten). Diese Datei ist die nachlesbare Fassung davon.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_betreiber_todos
  ADD COLUMN IF NOT EXISTS frage_an_agent       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS agent_gelesen_am     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS betreiber_gelesen_am TIMESTAMPTZ;

COMMENT ON COLUMN fiaon_betreiber_todos.frage_an_agent IS
  'Der Betreiber hat eine Frage gestellt, die der zustaendige Mitarbeiter beantworten muss. Seine naechste Nachricht ist die Antwort und loescht die Marke.';
COMMENT ON COLUMN fiaon_betreiber_todos.agent_gelesen_am IS
  'Wann der zustaendige Mitarbeiter den Verlauf zuletzt gesehen hat. NULL heisst: noch nie. Wird bei Uebergabe an einen anderen Mitarbeiter zurueckgesetzt.';
COMMENT ON COLUMN fiaon_betreiber_todos.betreiber_gelesen_am IS
  'Wann der Betreiber den Verlauf zuletzt gesehen hat. Aus dem Zeitpunkt wird die Marke abgeleitet, statt sie zu zaehlen.';

-- Die Liste des Mitarbeiters fragt immer denselben Ausschnitt ab: meine
-- Auftraege, die noch nicht erledigt sind. Ein Teilindex darauf ist ein paar
-- Dutzend Zeilen gross statt der ganzen Tabelle.
CREATE INDEX IF NOT EXISTS fiaon_betreiber_todos_agent_offen_idx
  ON fiaon_betreiber_todos (zustaendig_agent_id)
  WHERE zustaendig_art = 'agent' AND status <> 'erledigt';
