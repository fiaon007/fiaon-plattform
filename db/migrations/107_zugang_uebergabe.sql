-- ═══════════════════════════════════════════════════════════════════════════
-- 107 · ZUGANG DIGITAL ÜBERGEBEN (08.10.2026)
--
-- Justin: „Bau dafür eine Seite, alles soll sich auf der Plattform abspielen …
-- das temporäre Passwort muss angezeigt werden, sonst kann sie sich nicht
-- einloggen." Bisher: ein Übergabe-PDF mit Handfeld für das Start-Passwort.
--
-- Eine Zeile je Übergabe. Die Leitung trägt im Chefbüro (Team-Zentrale, Reiter
-- „Zugang übergeben") Name, Rolle, Zugang, Anmeldeadresse und das Start-Passwort
-- ein; das System erzeugt einen Einmal-Link (48 Stunden) und einen sechsstelligen
-- Code. Die Empfängerseite /zugang/uebergabe zeigt das Passwort erst nach dem Code.
--
-- ── WAS HIER NIE STEHT ────────────────────────────────────────────────────
--   · das Passwort im Klartext — nur AES-256-GCM (Schlüssel ZUGANG_SCHLUESSEL,
--     je Übergabe mit dem Link-Token abgeleitet), Format v1.<iv>.<tag>.<chiffre>;
--   · das Link-Token — nur sein SHA-256;
--   · der Code — nur ein HMAC mit dem Server-Schlüssel (6 Ziffern wären als
--     reiner Hash in einer Sekunde durchprobiert).
--
-- ── DIE WÄNDE IN DER TABELLE ──────────────────────────────────────────────
--   · passwort_geheim hat das Format des Chiffrats — Klartext passt nicht hinein;
--   · bestätigt, gesperrt oder gelöscht heißt: passwort_geheim ist leer.
-- Gelöscht wird keine Zeile (keine Hard-Deletes): Nach Bestätigung, Ablauf,
-- drei Fehlversuchen oder Zurückziehen wird nur das Chiffrat geleert; die
-- Zeile bleibt als Nachweis (wer hat ausgestellt, wann angesehen, wann bestätigt).
--
-- Neue Tabelle, sperrt nichts Bestehendes. Dieselbe Datei führt der Server
-- beim ersten Gebrauch aus, falls sie fehlt (ensureZugangUebergabeTabelle,
-- server/lib/fiaon-zugang-uebergabe.ts). Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS fiaon_zugang_uebergaben (
  id                        SERIAL PRIMARY KEY,
  token_hash                TEXT NOT NULL UNIQUE,
  code_hmac                 TEXT NOT NULL,
  name                      TEXT NOT NULL,
  rolle                     TEXT,
  zugang                    TEXT NOT NULL,
  anmeldeadresse            TEXT NOT NULL,
  ansprech_name             TEXT,
  ansprech_funktion         TEXT,
  ansprech_email            TEXT,
  ansprech_telefon          TEXT,
  passwort_geheim           TEXT,
  fehlversuche              INTEGER NOT NULL DEFAULT 0,
  gueltig_bis               TIMESTAMPTZ NOT NULL,
  ausgestellt_am            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ausgestellt_von_agent_id  INTEGER,
  ausgestellt_von_name      TEXT,
  ausgestellt_von_stufe     TEXT,
  angesehen_am              TIMESTAMPTZ,
  angesehen_zuletzt_am      TIMESTAMPTZ,
  ansichten                 INTEGER NOT NULL DEFAULT 0,
  bestaetigt_am             TIMESTAMPTZ,
  gesperrt_am               TIMESTAMPTZ,
  geloescht_am              TIMESTAMPTZ,
  geloescht_grund           TEXT,
  zurueckgezogen_von_name   TEXT,
  ersetzt_durch_id          INTEGER,
  CONSTRAINT fiaon_zugang_uebergaben_chiffrat CHECK (
    passwort_geheim IS NULL
    OR passwort_geheim ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT fiaon_zugang_uebergaben_geleert CHECK (
    passwort_geheim IS NULL
    OR (bestaetigt_am IS NULL AND gesperrt_am IS NULL AND geloescht_am IS NULL)
  ),
  CONSTRAINT fiaon_zugang_uebergaben_grund CHECK (
    geloescht_grund IS NULL
    OR geloescht_grund IN ('bestaetigt', 'abgelaufen', 'gesperrt', 'zurueckgezogen', 'ersetzt')
  )
);

CREATE INDEX IF NOT EXISTS fiaon_zugang_uebergaben_ausgestellt_idx
  ON fiaon_zugang_uebergaben (ausgestellt_am DESC);
CREATE INDEX IF NOT EXISTS fiaon_zugang_uebergaben_offen_idx
  ON fiaon_zugang_uebergaben (gueltig_bis) WHERE passwort_geheim IS NOT NULL;
