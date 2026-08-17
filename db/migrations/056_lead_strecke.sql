-- ═══════════════════════════════════════════════════════════════════════════
-- DIE EWIGE LEAD-STRECKE
--
-- ── DIE REGEL DES BETREIBERS ───────────────────────────────────────────────
-- „Leads ohne Antrag bekommen eine E-Mail-Strecke, die NIE endet."
--
-- ── WAS HEUTE PASSIERT (gemessen am 18.08.2026) ────────────────────────────
-- Die Strecke endet nach sechs Mails (Tag 1, 2, 4, 7, 14, 21) und markiert den
-- Lead danach als „tot". Stand der Datenbank:
--
--   3.820 Leads, davon 3.686 in der Strecke
--   1.483 Leads stehen bei Mail 8 — am Ende, sie bekommen NICHTS mehr
--   2.700 lebende Leads ohne Antrag warten auf eine Fortsetzung
--
-- Und die Konversion nach Mail-Nummer zeigt, warum das teuer ist: 23 Kunden
-- kamen erst nach der achten Mail. Wer bei sechs aufhört, verliert die.
--
-- ── WAS DIESE MIGRATION HINZUFÜGT ──────────────────────────────────────────
-- Eine Strecke, die nie endet, braucht drei Dinge, die es noch nicht gibt:
--
--   1. Eine ABMELDUNG. Eine Endlos-Strecke ohne Abmelde-Weg ist rechtlich
--      heikel und praktisch respektlos. Der Link steht ab jetzt in jeder Mail.
--   2. Einen BOUNCE-MERKER. Eine tote Adresse ewig anzuschreiben schadet der
--      Domain-Reputation — und damit jeder anderen Mail, die wir verschicken.
--   3. Die STUFE getrennt vom alten Zähler, damit die Inhalte rotieren können,
--      ohne die bisherige Zählung zu verfälschen.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_leads
  -- ── DIE ABMELDUNG ────────────────────────────────────────────────────────
  -- Ein Klick, und es ist vorbei. Kein „Bestätigen Sie noch einmal", kein
  -- Anmelden. Der Zeitstempel ist der Nachweis.
  ADD COLUMN IF NOT EXISTS abgemeldet_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS abgemeldet_grund TEXT,

  -- ── DIE TOTE ADRESSE ─────────────────────────────────────────────────────
  -- Ein harter Bounce heißt: Diese Adresse existiert nicht. Weiter zu senden
  -- schadet der Zustellbarkeit ALLER Mails des Hauses.
  ADD COLUMN IF NOT EXISTS bounce_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_grund TEXT,

  -- ── DIE STUFE DER EWIGEN STRECKE ─────────────────────────────────────────
  -- `lead_reminder_count` zählt die alten sechs Mails und wird weiter
  -- gepflegt. `strecke_stufe` zählt die Mails der EWIGEN Strecke — getrennt,
  -- damit die Auswertung „konvertiert nach Mail-Nummer" nicht zwei
  -- verschiedene Dinge in einen Topf wirft.
  ADD COLUMN IF NOT EXISTS strecke_stufe INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strecke_letzte_am TIMESTAMPTZ,
  -- Welche Inhalts-Variante ging zuletzt raus? Verhindert, dass zweimal
  -- dieselbe kommt.
  ADD COLUMN IF NOT EXISTS strecke_letzte_variante TEXT,
  -- Wann wurde der Lead in die ewige Strecke eingereiht?
  ADD COLUMN IF NOT EXISTS strecke_seit TIMESTAMPTZ,
  -- Warum die Strecke aufgehört hat. NULL = läuft.
  -- 'antrag' | 'kunde' | 'abgemeldet' | 'bounce' | 'dsgvo' | 'test' | 'hand'
  ADD COLUMN IF NOT EXISTS strecke_stopp TEXT,
  ADD COLUMN IF NOT EXISTS strecke_stopp_am TIMESTAMPTZ;

COMMENT ON COLUMN fiaon_leads.strecke_stopp IS
  'Warum die ewige Strecke endete. NULL = laeuft. STOPP heisst STOPP.';

-- Der Tageslauf sucht „wer ist dran?" — ohne Index ein Tabellendurchlauf über
-- 3.820 Zeilen bei jedem Lauf.
CREATE INDEX IF NOT EXISTS fiaon_leads_strecke_idx
  ON fiaon_leads (strecke_letzte_am NULLS FIRST, erstellt_am DESC)
  WHERE strecke_stopp IS NULL;

CREATE INDEX IF NOT EXISTS fiaon_leads_abmeldung_idx
  ON fiaon_leads (abgemeldet_am) WHERE abgemeldet_am IS NOT NULL;

-- ── DAS PROTOKOLL DER STRECKE ──────────────────────────────────────────────
-- Welche Variante ging an wen, wann, mit welchem Ergebnis? Ohne diese Tabelle
-- lässt sich „manche kommen erst bei Mail 20" nicht belegen — und eine
-- Behauptung, die man nicht prüfen kann, steuert nichts.
CREATE TABLE IF NOT EXISTS fiaon_lead_strecke_log (
  id           SERIAL PRIMARY KEY,
  lead_id      INTEGER NOT NULL,
  stufe        INTEGER NOT NULL,
  variante     TEXT NOT NULL,
  empfaenger   TEXT,
  -- 'versandt' | 'fehlgeschlagen' | 'uebersprungen'
  status       TEXT NOT NULL,
  grund        TEXT,
  gesendet_am  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fiaon_lead_strecke_log_lead_idx
  ON fiaon_lead_strecke_log (lead_id, stufe);
CREATE INDEX IF NOT EXISTS fiaon_lead_strecke_log_zeit_idx
  ON fiaon_lead_strecke_log (gesendet_am DESC);

-- ── DIE ABMELDUNG BRAUCHT EINEN SCHLÜSSEL ──────────────────────────────────
-- Der Abmelde-Link darf keine Lead-Kennung im Klartext enthalten: Sonst könnte
-- jemand durch Hochzählen fremde Menschen abmelden. Der Schlüssel ist ein
-- Zufallswert je Lead, einmal erzeugt und dann stabil.
ALTER TABLE fiaon_leads
  ADD COLUMN IF NOT EXISTS abmelde_schluessel TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS fiaon_leads_abmelde_schluessel_idx
  ON fiaon_leads (abmelde_schluessel) WHERE abmelde_schluessel IS NOT NULL;
