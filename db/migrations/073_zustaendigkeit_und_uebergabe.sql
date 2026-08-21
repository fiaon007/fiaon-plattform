-- ═══════════════════════════════════════════════════════════════════════════
-- ZUSTÄNDIGKEIT VON HAND, ÜBERFÄLLIGKEIT AB TAG 1, ÜBERGABE-BEREITSCHAFT
--
-- ── WAS HIER DAZUKOMMT UND WARUM ──────────────────────────────────────────
--
--   fiaon_persons.inkasso_ab / _von / _grund
--     Der Knopf „Sofort ins Forderungsmanagement" des Betreibers. Er muss in
--     der ABLEITUNG stehen (server/lib/fiaon-zustaendigkeit.ts), nicht in einer
--     Liste daneben: Eine Handmarkierung, die die Ableitung nicht liest, ist
--     ein Knopf ohne Wirkung.
--
--   fiaon_persons.uebergabe_bereit_am / _geprueft_am
--     Drei erfolglose Anrufe machen einen Fall reif für ein externes Inkasso.
--     Der Zeitpunkt wird festgehalten, damit die Liste nicht bei jedem Aufruf
--     neu rechnet — und damit sichtbar ist, wie lange ein Fall schon wartet.
--     `_geprueft_am` merkt sich, dass der Betreiber hingesehen hat; nur dann
--     verschwindet der Fall aus der Liste. NICHTS wird automatisch übergeben.
--
--   fiaon_abo_raten.mahnstufe_bestaetigt_am
--     „Mahnstufen dürfen nur bei bestätigtem Webhook-Versand weiterzählen, nie
--     fire-and-forget." Bis heute wurde `mahnstufe` erhöht und die Mail
--     danebengeschickt — scheiterte sie, war der Kunde eine Stufe weiter, ohne
--     je gemahnt worden zu sein. Ab jetzt zählt die Stufe erst, wenn der
--     Versand bestätigt ist, und dieser Zeitpunkt steht hier.
--
--   fiaon_termine.zustaendige_rolle
--     Die Rolle, die zum ZEITPUNKT der Buchung zuständig war. Die Ableitung
--     antwortet immer für HEUTE; wer im Nachhinein prüfen will, ob eine
--     Vertretung berechtigt war, braucht den damaligen Stand. Ohne diese
--     Spalte ist jede Rückschau eine Schätzung (siehe die Messung vom
--     21.08.2026, die den Zustand von heute für den von damals nehmen musste).
--
-- Additiv und idempotent. Keine Spalte wird entfernt, keine Zeile geändert.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── DER KNOPF DES BETREIBERS ──────────────────────────────────────────────
ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS inkasso_ab    TIMESTAMPTZ;
ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS inkasso_von   TEXT;
ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS inkasso_grund TEXT;

COMMENT ON COLUMN fiaon_persons.inkasso_ab IS
  'Von Hand ins Forderungsmanagement gestellt, unabhaengig vom Faelligkeitsdatum. Wird von zustaendigeRolle() gelesen.';

-- Nur die markierten Zeilen im Index: 4.400 Personen, davon eine Handvoll
-- markiert. Ein Volltext-Index waere hier fast nur Luft.
CREATE INDEX IF NOT EXISTS fiaon_persons_inkasso_ab_idx
  ON fiaon_persons (inkasso_ab) WHERE inkasso_ab IS NOT NULL;

-- ── BEREIT ZUR ÜBERGABE AN EIN EXTERNES INKASSO ───────────────────────────
ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS uebergabe_bereit_am   TIMESTAMPTZ;
ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS uebergabe_geprueft_am TIMESTAMPTZ;
ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS uebergabe_geprueft_von TEXT;

COMMENT ON COLUMN fiaon_persons.uebergabe_bereit_am IS
  'Drei erfolglose Anrufversuche bei offener Rate. Nur eine Meldung — uebergeben wird nichts automatisch.';

CREATE INDEX IF NOT EXISTS fiaon_persons_uebergabe_offen_idx
  ON fiaon_persons (uebergabe_bereit_am)
  WHERE uebergabe_bereit_am IS NOT NULL AND uebergabe_geprueft_am IS NULL;

-- ── MAHNSTUFE NUR BEI BESTÄTIGTEM VERSAND ─────────────────────────────────
ALTER TABLE fiaon_abo_raten ADD COLUMN IF NOT EXISTS mahnstufe_bestaetigt_am TIMESTAMPTZ;
ALTER TABLE fiaon_abo_raten ADD COLUMN IF NOT EXISTS mahnstufe_versuch_am    TIMESTAMPTZ;
ALTER TABLE fiaon_abo_raten ADD COLUMN IF NOT EXISTS mahnstufe_fehler        TEXT;

COMMENT ON COLUMN fiaon_abo_raten.mahnstufe_bestaetigt_am IS
  'Wann der Versand der aktuellen Mahnstufe BESTAETIGT wurde. Ohne diesen Zeitpunkt darf die Stufe nicht weiterzaehlen.';

-- ── DIE ZUSTÄNDIGKEIT ZUM ZEITPUNKT DER BUCHUNG ───────────────────────────
ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS zustaendige_rolle TEXT;
ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS quelle_verworfen  TEXT;

COMMENT ON COLUMN fiaon_termine.zustaendige_rolle IS
  'Welche Rolle war bei der Buchung zustaendig? Die durchfuehrende Person kann abweichen (Vertretung) — die Zustaendigkeit wechselt dabei nie.';
COMMENT ON COLUMN fiaon_termine.quelle_verworfen IS
  'Eine mitgeschickte Terminart (z. B. aus ?art=), die die Ableitung verworfen hat. Nur fuers Protokoll.';

-- ── DIE VERTRETUNGS-WARNUNG ───────────────────────────────────────────────
-- Ab drei Vertretungen an einem Tag geht eine Mail an den Betreiber. Der
-- Zaehler braucht einen Ort, an dem steht, dass sie schon raus ist — sonst
-- kommt sie bei jedem Lauf erneut, und dann filtert sie jemand weg.
CREATE TABLE IF NOT EXISTS fiaon_vertretung_warnungen (
  tag         DATE PRIMARY KEY,
  anzahl      INTEGER NOT NULL,
  gewarnt_am  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiaon_vertretung_warnungen IS
  'Hoechstens eine Vertretungs-Warnung je Tag. Eine Warnung, die stuendlich kommt, wird zur Gewohnheit und dann zum Filter.';
