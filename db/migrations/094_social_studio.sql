-- ═══════════════════════════════════════════════════════════════════════════
-- 094 · SOCIAL-STUDIO (06.10.2026, E-294)
--
-- Justin: „alles über die Plattform steuern: Claude spielt die Posts ein, wir
-- prüfen, bearbeiten und posten dort". Ort: Reiter „Social" im Mara-Steuerpult.
--
-- Fünf Tabellen, alle nur additiv (CREATE … IF NOT EXISTS):
--   fiaon_social_posts     — ein Post je extern_id (= meta.json „id"), mit Fassung,
--                            Status, Texten, Wort-Check, Checkliste, Freigabe.
--   fiaon_social_dateien   — die Bytes (BYTEA, Hausweg wie fiaon_dokumente; KEIN
--                            Objektspeicher, KEINE Render-Disk, nichts im Repo —
--                            das Repo ist öffentlich). STORAGE EXTERNAL, damit die
--                            Range-Auslieferung per substring schnell bleibt.
--   fiaon_social_verlauf   — jede Aktion und jede Fassung (wer, was, vorher/nachher).
--   fiaon_social_profile   — Profile je (kanal, marke) — Scheibe 2.
--   fiaon_social_follower  — Follower je Tag — Scheibe 4 (Tacho 1 Mio.).
--
-- Keine Hard-Deletes: eine neue Fassung bekommt neue Datei-Zeilen, die alten
-- bleiben über den Verlauf abrufbar. Listen lesen NIE die Spalte inhalt.
-- Server-Wächter: server/lib/fiaon-social.ts (ensureSocialTabellen) führt genau
-- diese Datei aus, falls die Tabellen fehlen.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_social_posts (
  id SERIAL PRIMARY KEY,
  extern_id TEXT NOT NULL UNIQUE,
  schema TEXT NOT NULL DEFAULT 'fiaon-social-post/1',
  ordner TEXT,
  -- Optimistic Locking: +1 bei JEDER Änderung (Import oder Studio).
  version INTEGER NOT NULL DEFAULT 1,
  -- Fassung des Inhalts: +1 nur, wenn Claude einen geänderten Inhalt einspielt.
  fassung INTEGER NOT NULL DEFAULT 1,
  import_hash CHAR(64),
  zuletzt_importiert_am TIMESTAMPTZ,
  im_studio_bearbeitet BOOLEAN NOT NULL DEFAULT FALSE,

  serie TEXT,
  titel TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('reel','karussell','bild','story','dokument','text')),
  welt TEXT,
  marke TEXT NOT NULL CHECK (marke IN ('fiaon','global')),
  kanaele TEXT[] NOT NULL DEFAULT '{}',
  themen TEXT[] NOT NULL DEFAULT '{}',

  plan_datum DATE NOT NULL,
  plan_zeit TIME,
  -- Nur gesetzt, wenn eine Uhrzeit da ist (ein reines Datum ist NICHT 00:00 Uhr).
  plan_zeitpunkt TIMESTAMPTZ,
  zeitzone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  reihenfolge INTEGER,
  plan_im_studio_geaendert BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'zur_freigabe'
    CHECK (status IN ('entwurf','zur_freigabe','freigegeben','eingeplant','veroeffentlicht','ausgewertet','verworfen')),

  caption TEXT NOT NULL DEFAULT '',
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  erster_kommentar TEXT,
  alt_text TEXT,
  bildtexte JSONB NOT NULL DEFAULT '[]'::jsonb,
  link TEXT,
  -- Geordnete Liste der AKTUELLEN Dateien: [{datei_id, pos, rolle, dateiname, sha256, sekunden}]
  dateien JSONB NOT NULL DEFAULT '[]'::jsonb,

  ki_noetig BOOLEAN NOT NULL DEFAULT FALSE,
  ki_grund TEXT,
  -- Nur Schlüssel aus SOCIAL_AUSNAHMEN (shared/fiaon-social.ts), nie Freitext.
  ausnahmen TEXT[] NOT NULL DEFAULT '{}',
  ausnahmen_unbekannt TEXT[] NOT NULL DEFAULT '{}',
  wortcheck JSONB,
  wortcheck_manifest JSONB,
  -- Abgehakt je Kanal: {instagram: {ki_info: {am, von}}}
  checkliste JSONB NOT NULL DEFAULT '{}'::jsonb,

  freigegeben_von TEXT,
  freigegeben_von_agent INTEGER,
  freigegeben_am TIMESTAMPTZ,
  freigabe_grund TEXT,
  freigabe_trotz_rot BOOLEAN NOT NULL DEFAULT FALSE,
  zurueck_notiz TEXT,
  verworfen_grund TEXT,

  -- Je Kanal: {instagram: {am, permalink, plattform_id, von}}
  veroeffentlicht JSONB NOT NULL DEFAULT '{}'::jsonb,
  veroeffentlicht_am TIMESTAMPTZ,
  -- Phase 2/3 (Meta-Veröffentlichung, Kennzahlen) — schon offen.
  plattform_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  kennzahlen JSONB NOT NULL DEFAULT '{}'::jsonb,
  website_sichtbar BOOLEAN NOT NULL DEFAULT FALSE,
  -- Scheibe 2 (ICS-Kategorie „Social", UID social-<id>@fiaon.com).
  kal_sequenz INTEGER NOT NULL DEFAULT 0,
  kal_geaendert_am TIMESTAMPTZ,

  notizen TEXT,
  meta_roh JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_social_posts_plan_idx ON fiaon_social_posts (plan_datum, plan_zeit);
CREATE INDEX IF NOT EXISTS fiaon_social_posts_status_idx ON fiaon_social_posts (status);
CREATE INDEX IF NOT EXISTS fiaon_social_posts_kanaele_idx ON fiaon_social_posts USING GIN (kanaele);
CREATE INDEX IF NOT EXISTS fiaon_social_posts_veroeff_idx ON fiaon_social_posts (status, veroeffentlicht_am DESC);

CREATE TABLE IF NOT EXISTS fiaon_social_dateien (
  id BIGSERIAL PRIMARY KEY,
  post_id INTEGER,
  pos SMALLINT NOT NULL DEFAULT 1,
  rolle TEXT NOT NULL CHECK (rolle IN ('bild','video','cover','dokument','story')),
  variante TEXT NOT NULL DEFAULT 'original' CHECK (variante IN ('original','web_480','web_1080','poster','web_loop')),
  quelle_id BIGINT,
  dateiname TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 CHAR(64) NOT NULL,
  breite INTEGER,
  hoehe INTEGER,
  sekunden NUMERIC(6,2),
  farbe TEXT,
  -- Später ein Objektspeicher: ablage='extern' + extern_schluessel, inhalt geleert.
  ablage TEXT NOT NULL DEFAULT 'db' CHECK (ablage IN ('db','extern')),
  extern_schluessel TEXT,
  inhalt BYTEA,
  inhalt_geleert_am TIMESTAMPTZ,
  hochgeladen_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hochgeladen_von TEXT,
  ersetzt_durch BIGINT,
  geloescht_am TIMESTAMPTZ
);
ALTER TABLE fiaon_social_dateien ALTER COLUMN inhalt SET STORAGE EXTERNAL;
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_social_dateien_einmal_idx ON fiaon_social_dateien (post_id, sha256, variante) WHERE geloescht_am IS NULL;
CREATE INDEX IF NOT EXISTS fiaon_social_dateien_sha_idx ON fiaon_social_dateien (sha256);

CREATE TABLE IF NOT EXISTS fiaon_social_verlauf (
  id BIGSERIAL PRIMARY KEY,
  post_id INTEGER,
  profil_schluessel TEXT,
  version INTEGER,
  fassung INTEGER,
  art TEXT NOT NULL,
  von_agent_id INTEGER,
  -- 'import-token' | 'chef:<id>' | 'inhaber' | 'system'
  von TEXT NOT NULL,
  vorher JSONB,
  nachher JSONB,
  grund TEXT,
  am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_social_verlauf_post_idx ON fiaon_social_verlauf (post_id, am DESC);

CREATE TABLE IF NOT EXISTS fiaon_social_profile (
  kanal TEXT NOT NULL,
  marke TEXT NOT NULL CHECK (marke IN ('fiaon','global')),
  handle TEXT,
  name TEXT,
  bio TEXT,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  kategorie TEXT,
  profilbild_datei_id BIGINT,
  banner_datei_id BIGINT,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  felder_eingetragen JSONB NOT NULL DEFAULT '{}'::jsonb,
  wortcheck JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kanal, marke)
);

CREATE TABLE IF NOT EXISTS fiaon_social_follower (
  id BIGSERIAL PRIMARY KEY,
  kanal TEXT NOT NULL,
  marke TEXT NOT NULL DEFAULT 'fiaon',
  datum DATE NOT NULL,
  anzahl INTEGER NOT NULL CHECK (anzahl >= 0),
  quelle TEXT NOT NULL DEFAULT 'manuell' CHECK (quelle IN ('manuell','api')),
  erfasst_von TEXT,
  erfasst_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kanal, marke, datum)
);
