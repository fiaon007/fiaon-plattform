-- ═══════════════════════════════════════════════════════════════════════════
-- DIE ONBOARDING-PFLICHT UND DIE ARBEITSFLUSS-FIXES
--
-- Die Geschäftsregel: Antrag → Zahlung gebucht → Kunde bekommt Zugang →
-- PFLICHT-Startgespräch mit dem Onboarding-Team → erst nach ERLEDIGTEM
-- Gespräch ist der Account voll freigeschaltet.
--
-- Additiv und wiederholbar. Kein DROP, kein DELETE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. DIE KONTO-STUFE ─────────────────────────────────────────────────────
-- `account_status` kannte drei Werte: pending, active, suspended. Es fehlte
-- die Stufe dazwischen: bezahlt und eingelassen, aber noch nicht durch das
-- Startgespräch.
--
-- Warum eine EIGENE Spalte und nicht ein vierter Wert in `account_status`:
-- Dieses Feld ist die Zugangsschranke (`suspended` sperrt hart). Wer die
-- Onboarding-Stufe dort hineinschreibt, riskiert, dass eine der vielen
-- Abfragen auf `account_status = 'active'` einen zahlenden Kunden aussperrt,
-- der nur sein Gespräch noch vor sich hat. Die Stufe ist eine ZUSÄTZLICHE
-- Auskunft, keine Ersetzung.
ALTER TABLE fiaon_applications
  -- 'wartet_auf_onboarding' | 'voll_aktiv'
  ADD COLUMN IF NOT EXISTS onboarding_stufe TEXT,
  -- Wann wurde voll freigeschaltet, und durch wen?
  ADD COLUMN IF NOT EXISTS freigeschaltet_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freigeschaltet_von TEXT,
  ADD COLUMN IF NOT EXISTS freigabe_grund TEXT,
  -- Gilt die HARTE Pflicht (kein „Später")? Für neu aktivierte Kunden ja,
  -- für den Bestand nein — der Betreiber kann es pro Fall setzen.
  ADD COLUMN IF NOT EXISTS onboarding_pflicht BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN fiaon_applications.onboarding_stufe IS
  'wartet_auf_onboarding = bezahlt, Portal eingeschraenkt. voll_aktiv = Startgespraech erledigt.';

-- ── 2. DER BESTAND BEKOMMT KEINE HARTE PFLICHT ─────────────────────────────
-- GEMESSEN am 16.08.2026: 349 bezahlte Paketkunden, davon **null** mit einem
-- Startgespräch — es gibt in der ganzen Datenbank keinen einzigen Termin der
-- Quelle 'onboarding_call'.
--
-- Eine harte Sperre für alle hätte also am Tag des Deploys 349 ZAHLENDE
-- Kunden aus ihrem Portal ausgesperrt, mit einer Aufforderung zu einem
-- Gespräch, für das es noch kein Team-Verfahren gab. Das ist Support-Feuer,
-- kein Onboarding.
--
-- Deshalb: Der Bestand steht auf 'voll_aktiv' und behält seinen Zugang. Er
-- bekommt einen dauerhaften Banner und eine Einladung. Die harte Pflicht
-- (`onboarding_pflicht = TRUE`) gilt nur für Kunden, die AB JETZT aktiviert
-- werden — und der Betreiber kann sie pro Fall über die Akte setzen.
UPDATE fiaon_applications
SET onboarding_stufe = 'voll_aktiv'
WHERE onboarding_stufe IS NULL
  AND payment_status = 'paid'
  AND merged_into IS NULL;

-- Wer schon ein erledigtes Startgespräch hat, ist ohnehin voll aktiv.
UPDATE fiaon_applications a
SET onboarding_stufe = 'voll_aktiv',
    freigeschaltet_am = COALESCE(a.freigeschaltet_am, t.erledigt_am),
    freigeschaltet_von = COALESCE(a.freigeschaltet_von, 'Bestand (Startgespräch war erledigt)')
FROM fiaon_termine t
WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt'
  AND a.merged_into IS NULL;

CREATE INDEX IF NOT EXISTS fiaon_applications_onboarding_idx
  ON fiaon_applications (onboarding_stufe) WHERE payment_status = 'paid';

-- ── 3. TERMINE: ABSAGEN BLEIBEN SICHTBAR, UND WER IST DER ZUSTÄNDIGE? ──────
-- Ein abgesagter Termin verschwand sofort aus jeder Ansicht. Der Zuständige
-- erfuhr nie, dass der Kunde abgesagt hat — er saß zur vereinbarten Zeit da.
ALTER TABLE fiaon_termine
  -- Wer hat abgesagt: 'kunde' | 'agent' | 'system'
  ADD COLUMN IF NOT EXISTS abgesagt_von TEXT,
  -- Wurde der Zuständige über Buchung bzw. Absage benachrichtigt?
  ADD COLUMN IF NOT EXISTS gemeldet_buchung_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gemeldet_absage_am TIMESTAMPTZ,
  -- Das Ergebnis-Protokoll des Cockpits: welche Agenda-Schritte wurden
  -- abgehakt, und was wurde je Schritt notiert.
  ADD COLUMN IF NOT EXISTS agenda_stand JSONB,
  -- Gesprächsdauer in Sekunden — für die Ø-Dauer im Kennzahlen-Kopf.
  ADD COLUMN IF NOT EXISTS dauer_sek INTEGER;

-- Der Kalender fragt „was ist zwischen X und Y" und filtert nach Status.
CREATE INDEX IF NOT EXISTS fiaon_termine_zeit_idx
  ON fiaon_termine (agent_id, beginn) WHERE status IN ('gebucht', 'abgesagt', 'verpasst');

-- ── 4. WARTET AUF DEN KUNDEN ───────────────────────────────────────────────
-- GEMESSEN: 224 Nummern-Anfragen verschickt, 185 ohne Antwort, 120 davon
-- älter als sieben Tage. Alle 185 standen weiter JEDEN TAG in der
-- Arbeitsliste — bei einem Kunden, dessen Nummer nicht stimmt und der erst
-- antworten muss. Das ist die Sorte Karte, die man lernt zu überblättern.
ALTER TABLE fiaon_persons
  -- Worauf warten wir: 'nummer' (Kunde soll Nummer nachtragen) | 'termin'
  ADD COLUMN IF NOT EXISTS wartet_auf TEXT,
  ADD COLUMN IF NOT EXISTS wartet_seit TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS fiaon_persons_wartet_idx
  ON fiaon_persons (assigned_agent_id) WHERE wartet_auf IS NOT NULL;

-- ── 5. RÜCKRUFE MIT FRIST ──────────────────────────────────────────────────
-- Hintergrund: Ein Kunde rief an, es wurde „notiert", und niemand meldete
-- sich. GEMESSEN: 23 offene Rückruf-Termine, 19 überfällig, **18 länger als
-- 24 Stunden** — ohne Eskalation, ohne dass es jemand erfährt.
CREATE TABLE IF NOT EXISTS fiaon_rueckrufe (
  id             SERIAL PRIMARY KEY,
  person_id      INTEGER,
  ref            TEXT,
  -- Woher kommt der Wunsch: 'mail_inbound' | 'telefon' | 'manuell' | 'portal'
  quelle         TEXT NOT NULL,
  -- Die Quelle im Original, damit man nachlesen kann (Mail-Kennung o. Ä.).
  quelle_id      TEXT,
  -- Was der Kunde will, in seinen Worten.
  anliegen       TEXT NOT NULL,
  kontakt        TEXT,
  zustaendig_agent_id INTEGER,
  -- Die Frist: 24 Stunden ab Eingang. Nicht verhandelbar, deshalb eine Spalte
  -- und keine Rechnung in vier Abfragen.
  frist_bis      TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'offen',
  -- Erledigen NUR mit Ergebnis-Notiz. Die Spalte ist der Grund, warum die
  -- Route eine verlangen kann.
  ergebnis_notiz TEXT,
  erledigt_am    TIMESTAMPTZ,
  erledigt_von   TEXT,
  -- Wann wurde eskaliert (Karte im Admin + Nachricht an die Leitung)?
  eskaliert_am   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fiaon_rueckrufe_offen_idx
  ON fiaon_rueckrufe (frist_bis) WHERE status = 'offen';
CREATE INDEX IF NOT EXISTS fiaon_rueckrufe_agent_idx
  ON fiaon_rueckrufe (zustaendig_agent_id, status);
CREATE INDEX IF NOT EXISTS fiaon_rueckrufe_person_idx
  ON fiaon_rueckrufe (person_id);

-- ── 6. EIN ANRUF-ERGEBNIS BRAUCHT EINE NOTIZ ───────────────────────────────
-- „Erreicht — Sonstiges" ohne Notiz ist keine Dokumentation, sondern ein
-- erledigter Haken. GEMESSEN: siebenmal im Telefon-Panel gedrückt, wo es
-- überhaupt kein Notizfeld gibt.
ALTER TABLE fiaon_calls
  ADD COLUMN IF NOT EXISTS ergebnis_notiz TEXT;
