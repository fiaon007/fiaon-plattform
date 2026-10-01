-- ═══════════════════════════════════════════════════════════════════════════
-- FIAON GLOBAL — AUFRUFE DES PERSÖNLICHEN ANGEBOTSLINKS (01.10.2026, E-268 Nachtrag)
-- Angebot-Aufrufe (01.10.2026)
--
-- Justin: „Ich will sehen, wann er es wie oft und wo geöffnet hat — und
-- benachrichtigt werden!"
--
-- ── WAS DIESE MIGRATION TUT ───────────────────────────────────────────────
-- 1. fiaon_global_angebot_aufrufe — eine Zeile je Abruf des Kundenlinks
--    (Seite, Seite nachgeladen, Vertrag-PDF, Prüfbericht-PDF): Zeitpunkt,
--    HTTP-Antwort, IP GEKÜRZT (IPv4 letztes Oktett 0, IPv6 /48), Gerät aus der
--    Browserkennung, Land/Region/Stadt nur aus Kopfzeilen des Netzbetreibers
--    (geo_quelle nennt, welche), intern/automatisch, ob diese Zeile die Meldung
--    an Justin ausgelöst hat und mit welchem Ergebnis.
-- 2. fiaon_chef_anschluesse — Anschlüsse aus Chefbüro-Sitzungen der letzten
--    30 Tage, NUR als HMAC der IP (nie im Klartext; IPv6 als /64, weil
--    Datenschutz-Adressen den hinteren Teil wechseln): Justins eigene Aufrufe
--    zählen auch ohne Cookie als „du".
--
-- Speicherdauer: 90 Tage nach Annahme, Rückzug bzw. Ende der Gültigkeit
-- (Aufrufe), 30 Tage (Anschlüsse) — es löscht der Stundenlauf
-- globalAngebotLauf → aufrufeAufraeumen (server/lib/fiaon-global-angebot-aufrufe.ts).
-- Derselbe Lauf leert dann auch die Kopien in Justins Aufgabe
-- (fiaon_betreiber_todos, Schlüssel global-angebot:<ref>:geoeffnet: neutraler
-- Titel/Text, Systembeiträge weg) — Gegenprüfung 01.10.2026, F1.
--
-- ── SPERRARM ──────────────────────────────────────────────────────────────
-- Nur neue Tabellen und ihre Indizes, kein ALTER an bestehenden Tabellen,
-- bewusst KEIN Fremdschlüssel auf fiaon_global_angebote (der nähme beim Anlegen
-- eine Sperre auf die Angebotstabelle; Angebote werden nie gelöscht, Waisen
-- räumt der Stundenlauf). Wiederholbar (IF NOT EXISTS). Dieselbe DDL legt der
-- Server beim ersten Gebrauch selbst an (ensureAufrufTabellen, über die
-- DDL-Wache am sqlPool) — die Reihenfolge Code/Migration ist gleichgültig.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_global_angebot_aufrufe (
  id BIGSERIAL PRIMARY KEY,
  angebot_id INTEGER NOT NULL,          -- fiaon_global_angebote.id
  am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  art VARCHAR NOT NULL,                 -- seite | auswahl | vertrag_pdf | pruefbericht_pdf
  antwort SMALLINT,                     -- HTTP-Status der Antwort an den Aufrufer
  ip_gekuerzt VARCHAR,                  -- 203.0.113.0 bzw. 2001:db8:abcd::/48
  geraet TEXT,                          -- „iPhone · Safari", „Android · In-App (WhatsApp)"
  land VARCHAR(2),
  region TEXT,
  stadt TEXT,
  geo_quelle TEXT,                      -- welche Kopfzeilen den Ort lieferten (z. B. „cf-ipcountry")
  intern BOOLEAN NOT NULL DEFAULT FALSE,
  intern_grund VARCHAR,                 -- chefbuero | mitarbeiter | chef-anschluss
  intern_agent_id INTEGER,
  roboter BOOLEAN NOT NULL DEFAULT FALSE,
  gemeldet BOOLEAN NOT NULL DEFAULT FALSE,
  meldung_ergebnis TEXT                 -- „Aufgabe #… · Mail an js@fiaon.com gesendet" bzw. der Grund
);
CREATE INDEX IF NOT EXISTS fiaon_global_angebot_aufrufe_angebot_idx ON fiaon_global_angebot_aufrufe (angebot_id, am DESC);

CREATE TABLE IF NOT EXISTS fiaon_chef_anschluesse (
  ip_hash VARCHAR PRIMARY KEY,          -- HMAC-SHA256(SESSION_SECRET, „chef-anschluss:" + IP), 40 Zeichen
  agent_id INTEGER,                     -- NULL = altes Admin-Cookie (Inhaber)
  zuletzt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
