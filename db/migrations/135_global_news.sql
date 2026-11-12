-- ═══════════════════════════════════════════════════════════════════════════
-- GLOBAL-LAGE — NEWS AUS AMTLICHEN QUELLEN (E-508 Scheibe 2, 12.11.2026)
--
-- Ausfall: Was sich bei US-Notenbank, EZB, IRS, FinCEN, USCIS und den Aufsichten
-- in Österreich und der Schweiz ändert, musste jemand von Hand zusammensuchen.
--
-- Fix: Ein Lauf holt die amtlichen Feeds alle paar Stunden ab und legt je Meldung
-- eine Zeile an (Quelle, Titel, Link, Datum, Text des Feeds). Die KI ergänzt eine
-- kurze deutsche Fassung, einen Satz „Was heißt das für unsere Mandanten“ und eine
-- Stufe 0–3. Fehlt die KI (Pause, Deckel), bleibt die Meldung im Original sichtbar.
--
-- Der Link ist eindeutig — derselbe Abruf legt nie zwei Zeilen zur selben Meldung
-- an. Ausgeblendet wird weich (ausgeblendet_am). Nichts hiervon geht an Kunden.
-- Wiederholbar: nur IF NOT EXISTS. Rein additiv, keine Sperre auf Bestandstabellen.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_global_news (
  id                BIGSERIAL PRIMARY KEY,
  quelle            TEXT NOT NULL,
  thema             TEXT NOT NULL,
  titel             TEXT NOT NULL,
  link              TEXT NOT NULL,
  veroeffentlicht_am TIMESTAMPTZ,
  text_roh          TEXT,
  kurz_de           TEXT,
  bedeutung_de      TEXT,
  relevanz          SMALLINT,
  ki_am             TIMESTAMPTZ,
  ki_modell         TEXT,
  ki_versuche       INTEGER NOT NULL DEFAULT 0,
  ki_fehler         TEXT,
  erstellt_am       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ausgeblendet_am   TIMESTAMPTZ,
  ausgeblendet_von  TEXT,
  CONSTRAINT fiaon_global_news_link UNIQUE (link)
);

-- „Die neuesten sichtbaren Meldungen" — die Anzeige der Global-Lage.
CREATE INDEX IF NOT EXISTS fiaon_global_news_neu_idx
  ON fiaon_global_news (COALESCE(veroeffentlicht_am, erstellt_am) DESC) WHERE ausgeblendet_am IS NULL;
