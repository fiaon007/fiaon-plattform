-- ═══════════════════════════════════════════════════════════════════════════
-- MAIL-WAHRHEIT — die Plattform darf über Zustellung nichts BEHAUPTEN
--
-- Bis heute stand auf /admin/events bei rund zehn Ereignissen „MAKE-ZWEIG
-- FEHLT". Diese Aussage kam aus einer Heuristik, die prüfte, ob das Wort
-- „Betreiber-TODO" in unserer EIGENEN Beschreibung steht. Die Plattform hat
-- also ihre eigenen Notizzettel gelesen und daraus eine Behauptung über die
-- Einrichtung des Betreibers gemacht — bei 23 von 33 Ereignissen. Alle 21
-- Zweige waren in Wahrheit aktiv.
--
-- Ab jetzt gibt es nur noch GEMESSENE Zustellwahrheit: Ein Zweig gilt als
-- bestätigt, wenn ein Testversand nachweislich bei Brevo angekommen ist.
-- Alles andere heißt „noch nicht geprüft" — und das ist eine ehrliche Aussage
-- über UNSEREN Kenntnisstand, keine über den Betreiber.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Was wir über jedes Ereignis WISSEN ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiaon_mail_events (
  event              TEXT PRIMARY KEY,
  -- Die Brevo-Vorlage, die dieses Ereignis rendert. Vom Betreiber in
  -- /admin/events zugeordnet; NULL heißt „noch nicht zugeordnet".
  brevo_template_id  INTEGER,
  brevo_template_name TEXT,
  -- Ergebnis der letzten Zweig-Prüfung. NULL = nie geprüft.
  verifiziert_am     TIMESTAMPTZ,
  -- Zeitpunkt des letzten Prüfversuchs, auch wenn er scheiterte.
  geprueft_am        TIMESTAMPTZ,
  -- Klartext des letzten Prüfergebnisses.
  pruef_ergebnis     TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Zustellstatus je einzelner Mail ────────────────────────────────────────
-- Bisher stand im Protokoll „versandt", sobald Make die Anfrage angenommen
-- hatte. Das ist keine Zustellung, das ist eine Hoffnung: Make kann annehmen
-- und danach an einem fehlenden Zweig scheitern, Brevo kann eine Vorlage
-- nicht finden, die Adresse kann hart bouncen. Diese Spalten tragen, was
-- Brevo TATSÄCHLICH gemeldet hat.
ALTER TABLE fiaon_mail_log
  -- angenommen | zugestellt | geoeffnet | geklickt | gebounct | blockiert | spam
  ADD COLUMN IF NOT EXISTS zustellung        TEXT,
  ADD COLUMN IF NOT EXISTS zustellung_am     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zustellung_grund  TEXT,
  -- Die Message-ID von Brevo, sofern wir selbst gesendet haben (Freitext).
  ADD COLUMN IF NOT EXISTS brevo_message_id  TEXT,
  -- Wann der Abgleich diese Zeile zuletzt angesehen hat. Verhindert, dass
  -- der stündliche Lauf ewig dieselben alten Zeilen abfragt.
  ADD COLUMN IF NOT EXISTS abgeglichen_am    TIMESTAMPTZ,
  -- Freitext-Mails aus der Mail-Zentrale: Betreff und wer sie schrieb.
  ADD COLUMN IF NOT EXISTS betreff           TEXT,
  -- test = Prüfversand, echt = an einen Menschen.
  ADD COLUMN IF NOT EXISTS art               TEXT NOT NULL DEFAULT 'echt';

CREATE INDEX IF NOT EXISTS fiaon_mail_log_abgleich_idx
  ON fiaon_mail_log (abgeglichen_am NULLS FIRST, created_at DESC)
  WHERE status = 'versandt';

-- ── Testeinträge bei KUNDEN ────────────────────────────────────────────────
-- `fiaon_agents.is_test_account` gibt es seit langem. Für Kunden gab es das
-- nicht: Die zehn „Justin Schwarzott"-Zeilen standen als echte Kunden in
-- Listen, Verteilung, Dubletten und Kennzahlen.
--
-- Bewusst ein Zeitstempel statt eines Wahrheitswerts: „wann und von wem" ist
-- die Frage, die man drei Wochen später stellt.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS ist_test_am    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ist_test_grund TEXT,
  ADD COLUMN IF NOT EXISTS ist_test_von   TEXT;

CREATE INDEX IF NOT EXISTS fiaon_persons_test_idx
  ON fiaon_persons (ist_test_am) WHERE ist_test_am IS NOT NULL;

-- ── Zugang retten ──────────────────────────────────────────────────────────
-- Einmal-Passwort für den Telefonfall: Der Kunde hängt in der Leitung, findet
-- keine Mail, und jemand muss ihm JETZT helfen können.
ALTER TABLE fiaon_applications
  ADD COLUMN IF NOT EXISTS einmal_passwort_bis   TIMESTAMPTZ,
  -- Nach dem ersten Login mit dem Einmal-Passwort MUSS ein neues gesetzt
  -- werden. Ohne diesen Zwang bleibt ein am Telefon diktiertes Passwort für
  -- immer gültig.
  ADD COLUMN IF NOT EXISTS passwort_wechsel_noetig BOOLEAN NOT NULL DEFAULT FALSE;
