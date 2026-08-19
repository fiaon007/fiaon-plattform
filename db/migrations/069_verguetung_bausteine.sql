-- ═══════════════════════════════════════════════════════════════════════════
-- VERGÜTUNGSBAUSTEINE JE MENSCH (20.08.2026)
--
-- ── DIE MELDUNG ───────────────────────────────────────────────────────────
-- Der Reiter „Vergütung & Stunden" ist „völlig dumm": zwei Felder (Stundensatz,
-- Prämie je Rate) und ein orangener Kasten mit einem Grammatikfehler darüber.
--
-- ── WAS ES HEUTE GIBT (gemessen, scripts/mess-verguetung.ts) ──────────────
-- Fünf Spalten an `fiaon_agents`: commission_rate_bp, override_rate_bp,
-- stundensatz_cents, inkasso_praemie_art, inkasso_praemie_wert.
-- Bestand: 9 aktive Menschen, 6 mit Provisionssatz, 1 mit Stundensatz,
-- 1 mit Raten-Prämie. Das Startgespräch-Pauschale (15 €) steht HART IM CODE.
--
-- Was fehlt: ein monatliches Fixum, ein Festbetrag je Abschluss statt Prozent,
-- eine Staffelung nach Paket, konfigurierbare Pauschalen je Tätigkeit, einmalige
-- Gutschriften und Abzüge — und für alles: eine Gültigkeit AB WANN, ein Vermerk
-- und eine Spur, wer es geändert hat.
--
-- ── WARUM EINE TABELLE UND NICHT ZEHN SPALTEN MEHR ────────────────────────
-- Weil jeder Baustein eine ZEIT hat. Ein Feld an der Person kennt nur den
-- aktuellen Wert; sobald jemand fragt „was galt im Juli", ist die Antwort weg.
-- Und weil mehrere gleichzeitig gelten (Fixum UND Provision UND Pauschalen),
-- teils mehrfach je Typ (eine Pauschale je Anlass, ein Satz je Paket).
--
-- ── DAS EINFRIER-PRINZIP BLEIBT ───────────────────────────────────────────
-- Ein Baustein wirkt auf ZUKÜNFTIGE Positionen. Bereits gebuchte Provisionen
-- und Pauschalen bleiben unberührt — sie tragen ihren Betrag selbst
-- (`fiaon_commissions.amount_cents`). Ein Baustein wird deshalb nie geändert,
-- sondern ABGELÖST: der alte bekommt `entfernt_am`, der neue eine neue
-- `gueltig_ab`. So bleibt lesbar, was wann galt.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_verguetung_bausteine (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,

  -- ── WELCHE ART BAUSTEIN ─────────────────────────────────────────────────
  --   fixum        Monatlicher Festbetrag
  --   provision    Anteil am Abschluss (Prozent ODER Festbetrag)
  --   pauschale    Betrag je Tätigkeit (Startgespräch, eingezogene Rate, …)
  --   stundensatz  Betrag je Stunde
  --   einmalig     Gutschrift oder Abzug, wirkt auf die nächste Abrechnung
  typ VARCHAR NOT NULL,

  -- Ein abgeschalteter Baustein bleibt STEHEN. Löschen würde die Frage
  -- „was galt letzten Monat" unbeantwortbar machen.
  aktiv BOOLEAN NOT NULL DEFAULT TRUE,

  -- ── DER WERT ────────────────────────────────────────────────────────────
  -- Immer in CENT, nie in Euro-Numerik: Die Umrechnung passiert an EINER
  -- Stelle (fiaon-verguetung.ts). Bei Prozent steht der Satz in Basispunkten
  -- (2000 = 20,00 %) — dieselbe Einheit wie commission_rate_bp.
  betrag_cents INTEGER,
  satz_bp INTEGER,

  -- Nur bei typ = provision: „prozent" oder „festbetrag".
  modus VARCHAR,

  -- Staffelung: NULL heisst „gilt fuer alle Pakete". Sonst der Paketname.
  paket VARCHAR,

  -- Nur bei typ = pauschale: der Anlass im Klartext. Er steht spaeter genau so
  -- im PDF unter „Pauschalvergütungen".
  anlass VARCHAR,

  -- ── NUR BEI FIXUM: DER RECHTSGRUND ──────────────────────────────────────
  -- „dienstvertrag" | „anstellung" | „sonstiges".
  --
  -- Das ist keine Formalie: Bei einer ANSTELLUNG laeuft das Fixum ueber die
  -- Lohnabrechnung und darf NICHT als Provisionsgutschrift gebucht werden —
  -- sonst entsteht eine Gutschrift im Gutschriftverfahren fuer Arbeitslohn.
  -- Deshalb wird ein Fixum mit Rechtsgrund „anstellung" nur ANGEZEIGT
  -- (buchen = FALSE), nicht gebucht.
  rechtsgrund VARCHAR,
  buchen BOOLEAN NOT NULL DEFAULT TRUE,
  auszahlungstag INTEGER,

  -- ── ZEIT ────────────────────────────────────────────────────────────────
  gueltig_ab DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Nur bei typ = einmalig: auf welche Abrechnung es wirkt.
  wirkt_am DATE,

  -- Pflicht bei einmalig (Gutschrift oder Abzug ohne Grund ist ein Streit).
  vermerk TEXT,

  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erstellt_von VARCHAR,
  geaendert_am TIMESTAMPTZ,
  geaendert_von VARCHAR,
  -- Kein Hard-Delete (Hausregel).
  entfernt_am TIMESTAMPTZ,
  entfernt_von VARCHAR,
  -- Wenn dieser Baustein einen aelteren abloest: dessen Kennung.
  loest_ab_id INTEGER
);

CREATE INDEX IF NOT EXISTS fiaon_verguetung_bausteine_agent_idx
  ON fiaon_verguetung_bausteine (agent_id, typ) WHERE entfernt_am IS NULL;

CREATE INDEX IF NOT EXISTS fiaon_verguetung_bausteine_gueltig_idx
  ON fiaon_verguetung_bausteine (gueltig_ab);

COMMENT ON COLUMN fiaon_verguetung_bausteine.buchen IS
  'FALSE bei Fixum mit Rechtsgrund Anstellung: laeuft ueber die Lohnabrechnung '
  'und darf nicht als Provisionsgutschrift gebucht werden.';

COMMENT ON COLUMN fiaon_verguetung_bausteine.satz_bp IS
  'Basispunkte wie commission_rate_bp (2000 = 20,00 %). Eine zweite Einheit '
  'fuer denselben Begriff waere eine zweite Wahrheit.';

-- ── DER BESTAND WANDERT NICHT AUTOMATISCH ─────────────────────────────────
-- Die fuenf Spalten an `fiaon_agents` bleiben, und die Buchungslogik liest sie
-- weiter, solange kein Baustein existiert. Ein Umzug per Migration waere ein
-- stiller Eingriff in Verguetungsdaten von neun Menschen — das entscheidet der
-- Betreiber, nicht ein Skript. `server/lib/fiaon-verguetung.ts` liest deshalb
-- BEIDES: den Baustein, wenn es einen gibt, sonst das Feld an der Person.
