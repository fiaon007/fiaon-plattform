-- ═══════════════════════════════════════════════════════════════════════════
-- 108 · EIGENE BESUCHERMESSUNG OHNE COOKIES (15.10.2026, E-378)
--
-- Justin: „Besucher hat nie funktioniert … ich brauche super detaillierte
-- Aufschlüsselungen." Clarity liefert nur Summen der letzten drei Tage. Jetzt
-- misst fiaon.com selbst (shared/fiaon-besuch.ts, server/lib/fiaon-besuch.ts).
--
-- ── WAS HIER NIE STEHT ────────────────────────────────────────────────────
--   · die IP-Adresse — nirgends, auch nicht gekürzt;
--   · eine Kennung aus dem Browser — es gibt keine (kein Cookie, kein Speicher);
--   · der Wert einer Klick-Kennung (fbclid/gclid) — nur, OB eine da war.
-- „besucher" ist ein Hash aus Tages-Salz, IP, Browserkennung und Host. Das Salz
-- steht nur für den laufenden Berliner Tag in fiaon_besuch_salz und wird beim
-- Tageswechsel gelöscht — danach lässt sich der Hash keinem Anschluss mehr
-- zuordnen, auch nicht von uns.
--
-- ── DIE VIER TABELLEN ─────────────────────────────────────────────────────
--   fiaon_besuch_salz       ein Salz je Tag (nur heute)
--   fiaon_besuch_sitzungen  eine Zeile je Sitzung (Pause unter 30 Minuten),
--                           mit allem, was die Sitzung ausmacht: Einstieg,
--                           Ausstieg, Kanal, Kampagne, Gerät, Sprache, Land
--   fiaon_besuche           eine Zeile je Seitenaufruf, mit sichtbarer Zeit
--   fiaon_besuch_antraege   welche Antrags-Sitzung (fiaon_antrag_ereignisse.sitzung)
--                           in welcher Besuchs-Sitzung begann — die Brücke zum
--                           Trichter Besuch → Antrag → bezahlt
-- Löschfrist 400 Tage (Lauf besuchAufraeumen). Keine Fremdschlüssel (Hausregel).
--
-- Neue Tabellen, sperren nichts Bestehendes. Dieselbe Datei führt der Server beim
-- ersten Gebrauch aus, falls sie fehlt (ensureBesuchTabellen). Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS fiaon_besuch_salz (
  tag        DATE PRIMARY KEY,
  salz       TEXT NOT NULL,
  angelegt   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiaon_besuch_sitzungen (
  sitzung       VARCHAR(16) PRIMARY KEY,
  besucher      VARCHAR(16) NOT NULL,
  start         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zuletzt       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  einstieg      VARCHAR(160) NOT NULL,
  ausstieg      VARCHAR(160) NOT NULL,
  seiten        INTEGER NOT NULL DEFAULT 1,
  dauer_ms      BIGINT NOT NULL DEFAULT 0,
  antrag        BOOLEAN NOT NULL DEFAULT FALSE,
  kanal         VARCHAR(40) NOT NULL,
  herkunft      VARCHAR(120),
  utm_source    VARCHAR(150),
  utm_medium    VARCHAR(150),
  utm_campaign  VARCHAR(150),
  utm_content   VARCHAR(150),
  utm_term      VARCHAR(150),
  fbclid        BOOLEAN NOT NULL DEFAULT FALSE,
  gclid         BOOLEAN NOT NULL DEFAULT FALSE,
  geraet        VARCHAR(10),
  sprache       VARCHAR(8),
  land          VARCHAR(2)
);
CREATE INDEX IF NOT EXISTS fiaon_besuch_sitzungen_start ON fiaon_besuch_sitzungen (start);
CREATE INDEX IF NOT EXISTS fiaon_besuch_sitzungen_besucher ON fiaon_besuch_sitzungen (besucher, zuletzt DESC);

CREATE TABLE IF NOT EXISTS fiaon_besuche (
  id         BIGSERIAL PRIMARY KEY,
  sitzung    VARCHAR(16) NOT NULL,
  am         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pfad       VARCHAR(160) NOT NULL,
  erste      BOOLEAN NOT NULL DEFAULT FALSE,
  dauer_ms   INTEGER
);
CREATE INDEX IF NOT EXISTS fiaon_besuche_sitzung ON fiaon_besuche (sitzung, am);
CREATE INDEX IF NOT EXISTS fiaon_besuche_am ON fiaon_besuche (am);

CREATE TABLE IF NOT EXISTS fiaon_besuch_antraege (
  sitzung         VARCHAR(16) NOT NULL,
  antrag_sitzung  VARCHAR(40) NOT NULL,
  am              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sitzung, antrag_sitzung)
);
CREATE INDEX IF NOT EXISTS fiaon_besuch_antraege_antrag ON fiaon_besuch_antraege (antrag_sitzung);
