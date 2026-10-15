-- ═══════════════════════════════════════════════════════════════════════════
-- 110 · META-AUTOMATIK: POSTEN UND ANZEIGEN-PARAMETER (15.10.2026, E-380)
--
-- Justin: „mach mit META die gesamte Verbindung und Rechte so, dass auch die
-- Posts automatisch gehen … achte dabei, dass wir nichts kaputt machen".
-- Regeln: shared/fiaon-social-meta.ts. Läufe: server/lib/fiaon-social-meta.ts
-- (Posten) und server/lib/fiaon-meta-utm.ts (Anzeigen-Parameter).
--
--   fiaon_social_meta_auftraege  ein Auftrag je Post, Kanal und Fassung — der
--                                eindeutige Index ist die Sperre gegen doppeltes
--                                Posten (auch wenn zwei Server gleichzeitig laufen)
--   fiaon_meta_utm_protokoll     je Anzeige höchstens EIN Wechsel der Fassung
--
-- Neue Tabellen, sperren nichts Bestehendes. Dieselbe Datei führt der Server beim
-- ersten Gebrauch aus, falls sie fehlt. Wiederholbar. Keine Fremdschlüssel (Hausregel).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_social_meta_auftraege (
  id            BIGSERIAL PRIMARY KEY,
  post_id       INTEGER NOT NULL,
  kanal         VARCHAR(20) NOT NULL,
  fassung       INTEGER NOT NULL,
  -- laeuft | warten (Container wird verarbeitet) | ok | fehler | unklar
  zustand       VARCHAR(12) NOT NULL DEFAULT 'laeuft',
  -- wer den Auftrag gerade bearbeitet (Zufallskennung je Lauf) — zwei Server holen nie denselben
  halter        VARCHAR(40),
  container_id  VARCHAR(64),
  kinder        JSONB,
  media_id      VARCHAR(64),
  permalink     TEXT,
  ki_gesetzt    BOOLEAN,
  versuche      INTEGER NOT NULL DEFAULT 0,
  fehler        TEXT,
  begonnen_am   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fertig_am     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_social_meta_auftraege_eins ON fiaon_social_meta_auftraege (post_id, kanal, fassung);
CREATE INDEX IF NOT EXISTS fiaon_social_meta_auftraege_zustand ON fiaon_social_meta_auftraege (zustand, aktualisiert_am);

CREATE TABLE IF NOT EXISTS fiaon_meta_utm_protokoll (
  anzeige_id    VARCHAR(40) PRIMARY KEY,
  anzeige_name  TEXT,
  alte_fassung  VARCHAR(40),
  neue_fassung  VARCHAR(40),
  ergebnis      VARCHAR(12) NOT NULL DEFAULT 'offen',
  versuche      INTEGER NOT NULL DEFAULT 0,
  fehler        TEXT,
  am            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
