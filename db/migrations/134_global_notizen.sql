-- ═══════════════════════════════════════════════════════════════════════════
-- GLOBAL-LAGE — GESPRÄCHSNOTIZEN UND WIEDERVORLAGEN (E-508, 12.11.2026)
--
-- Ausfall: Was mit einem Mandanten gesprochen wurde und wann nachgefasst wird,
-- stand bisher außerhalb der Plattform (Listen von Hand). Im Chefbüro gab es
-- dafür keinen Ort, der für Angebote OHNE Akte funktioniert — eine Akte entsteht
-- erst mit der Annahme, nachgefasst wird aber vorher.
--
-- Fix: eine Notiz je Bezug (Angebot, Akte, Anfrage, Partner oder frei) mit
-- freiwilliger Wiedervorlage (Tag + kurzer Satz). Die Global-Lage zeigt die
-- Notiz im Feed des Tages und die offene Wiedervorlage unter „Wir warten auf“.
--
-- Eine Notiz verschickt nichts, bucht nichts und ändert keinen Vertrag.
-- bezug_id ist Text (Angebots-Nummer, Akten-Kennung, Anfrage-Nummer) und trägt
-- bewusst keinen Fremdschlüssel: Eine Notiz darf nie eine Abfrage der Angebote
-- oder Akten zum Scheitern bringen. Gelöscht wird weich (entfernt_am).
-- Wiederholbar: nur IF NOT EXISTS. Rein additiv, keine Sperre auf Bestandstabellen.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_global_notizen (
  id                 BIGSERIAL PRIMARY KEY,
  bezug_art          TEXT NOT NULL,
  bezug_id           TEXT NOT NULL DEFAULT '',
  art                TEXT NOT NULL DEFAULT 'gespraech',
  text               TEXT NOT NULL DEFAULT '',
  wiedervorlage_am   DATE,
  wiedervorlage_text TEXT,
  erledigt_am        TIMESTAMPTZ,
  erledigt_von       TEXT,
  erstellt_von       TEXT,
  erstellt_agent_id  INTEGER,
  erstellt_am        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entfernt_am        TIMESTAMPTZ,
  entfernt_von       TEXT,
  CONSTRAINT fiaon_global_notizen_bezug CHECK (bezug_art IN ('angebot', 'akte', 'anfrage', 'partner', 'frei')),
  CONSTRAINT fiaon_global_notizen_art CHECK (art IN ('gespraech', 'notiz', 'wiedervorlage'))
);

-- „Was steht an diesem Mandanten?" — jede Karte der Global-Lage fragt so.
CREATE INDEX IF NOT EXISTS fiaon_global_notizen_bezug_idx
  ON fiaon_global_notizen (bezug_art, bezug_id, erstellt_am DESC) WHERE entfernt_am IS NULL;

-- „Welche Wiedervorlagen sind offen?" — die Liste „Wir warten auf“.
CREATE INDEX IF NOT EXISTS fiaon_global_notizen_offen_idx
  ON fiaon_global_notizen (wiedervorlage_am) WHERE entfernt_am IS NULL AND erledigt_am IS NULL AND wiedervorlage_am IS NOT NULL;
