-- ═══════════════════════════════════════════════════════════════════════════
-- DIE DUBLETTEN-WURZEL: WENN EINE ADRESSE SCHON EINEM ANDEREN GEHÖRT
--
-- ── DER FUND (20.08.2026) ──────────────────────────────────────────────────
-- Beim Bestandsumzug blieb genau EIN Fall übrig: Die Adresse
-- „agnellom401@gmail.com" stand an einer Bestellung von Person 4683 — und lag
-- als Alias schon bei Person 6509 (aus einem Lead).
--
-- Der Trigger konnte den Alias nicht anlegen: `fiaon_person_email_unique`
-- verbietet dieselbe Adresse bei zwei Menschen. Das ist RICHTIG — eine E-Mail
-- gehört einem Menschen.
--
-- ── DIE ERKENNTNIS ─────────────────────────────────────────────────────────
-- Dieser Index ist ein DOPPELGÄNGER-DETEKTOR. Scheitert der Alias, weil die
-- Adresse einem anderen gehört, dann sind zwei Personen ein Mensch — und zwar
-- genau in dem Muster, das der Betreiber gemeldet hat:
--
--   Bianco:  Antrag (Person 3598, nur Nummer) + Lead (Person 5564, nur Mail)
--   Matzke:  Antrag (Person 3815, nur Nummer) + Lead (Person 5738, nur Mail)
--   Schlabs: Antrag (Person 4782, nur Nummer) + Lead (Person 6474, nur Mail)
--
-- Der Antrag bringt die Nummer, der Lead die E-Mail, das Eingangs-Dedupe
-- verbindet sie nicht — weil sie kein gemeinsames Merkmal haben.
--
-- ── WAS DIESE MIGRATION TUT ────────────────────────────────────────────────
-- Der Trigger schweigt nicht mehr, wenn ein Alias kollidiert. Er schreibt einen
-- KANDIDATEN: „Diese zwei Personen teilen ein Merkmal." Damit wird aus einem
-- stillen Scheitern ein Fund, den die Dubletten-Ansicht zeigt.
--
-- Automatisch zusammengeführt wird NICHT. Ein Merge ist unumkehrbar (er zieht
-- Bestellungen, Termine, Provisionen mit), und zwei Menschen können sich eine
-- Adresse teilen — Eheleute, Vater und Sohn, eine Firmenadresse. Die
-- Entscheidung braucht Augen; das System liefert den Hinweis.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_doppelgaenger (
  id            SERIAL PRIMARY KEY,
  person_a      INTEGER NOT NULL,
  person_b      INTEGER NOT NULL,
  -- Worüber sind sie verbunden? 'email' | 'phone'
  merkmal       TEXT NOT NULL,
  wert          TEXT NOT NULL,
  -- Woher kam der Hinweis? 'trigger' | 'lauf' | 'hand'
  quelle        TEXT NOT NULL DEFAULT 'trigger',
  -- 'offen' | 'zusammengefuehrt' | 'verschieden'
  stand         TEXT NOT NULL DEFAULT 'offen',
  entschieden_von TEXT,
  entschieden_am  TIMESTAMPTZ,
  notiz         TEXT,
  erkannt_am    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ein Paar nur einmal, unabhängig von der Reihenfolge: LEAST/GREATEST macht aus
-- (4683, 6509) und (6509, 4683) denselben Eintrag. Ohne das stünde jeder Fall
-- zweimal in der Liste, und man würde ihn zweimal entscheiden.
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_doppelgaenger_paar_idx
  ON fiaon_doppelgaenger (LEAST(person_a, person_b), GREATEST(person_a, person_b), merkmal, wert);

CREATE INDEX IF NOT EXISTS fiaon_doppelgaenger_offen_idx
  ON fiaon_doppelgaenger (erkannt_am DESC) WHERE stand = 'offen';

COMMENT ON TABLE fiaon_doppelgaenger IS
  'PROTOKOLL der Schreibkollisionen des Triggers, KEINE zweite Kandidatenliste. Die Arbeitsliste ist /admin/dubletten (server/lib/fiaon-dubletten-kandidaten.ts) — sie findet Paare live. Hier steht nur, was der Trigger beim Durchschreiben gefunden hat und sonst still verschluckt haette.';

-- ── EINE KORREKTUR AM EIGENEN ENTWURF (20.08.2026) ─────────────────────────
-- Diese Tabelle war zuerst als Kandidatenliste gedacht, und ein Lauf hat 170
-- Namenspaare hineingeschrieben. Das war falsch: Es gibt längst eine
-- Dubletten-Maschine (server/lib/fiaon-dubletten-kandidaten.ts) mit vier Stufen
-- (Rufnummer, E-Mail, Name+Geburtsdatum, Name), die live sucht und unter
-- /admin/dubletten bedienbar ist.
--
-- Zwei Listen für dieselbe Frage sind genau das Doppelmodell, das dieser
-- Auftrag beseitigen soll — der Fehler wäre also im Namen der Reparatur
-- entstanden.
--
-- Die 170 Einträge stehen auf 'in_bestehender_ansicht' (nicht gelöscht,
-- AGENTS.md). Und der Umzug hat sein Ziel ohnehin erreicht: Weil die E-Mails
-- jetzt an den PERSONEN stehen, findet die bestehende Maschine sie von selbst
-- — GEMESSEN: 3 Kandidaten vorher, 18 danach, davon 15 über die E-Mail.
-- Darunter Bianco.
--
-- Was hier bleibt, ist das, was die bestehende Maschine NICHT sehen kann: eine
-- Kollision im Moment des Schreibens.

-- ───────────────────────────────────────────────────────────────────────────
-- DER TRIGGER MELDET STATT ZU SCHWEIGEN
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fiaon_kontakt_an_person(
  p_person_id INTEGER,
  p_art       TEXT,
  p_wert      TEXT,
  p_quelle    TEXT
) RETURNS VOID AS $$
DECLARE
  v_norm    TEXT;
  v_person  TEXT;
  v_pnorm   TEXT;
  v_fremd   INTEGER;
BEGIN
  IF p_person_id IS NULL THEN RETURN; END IF;

  IF p_art = 'email' THEN
    v_norm := fiaon_mail_norm(p_wert);
    IF v_norm IS NULL THEN RETURN; END IF;
    SELECT primary_email INTO v_person FROM fiaon_persons WHERE id = p_person_id;
    v_pnorm := fiaon_mail_norm(v_person);
    IF v_pnorm IS NULL THEN
      UPDATE fiaon_persons SET primary_email = BTRIM(p_wert), updated_at = NOW()
      WHERE id = p_person_id;
      RETURN;
    END IF;
    IF v_pnorm = v_norm THEN RETURN; END IF;

  ELSIF p_art = 'phone' THEN
    v_norm := fiaon_nummer_norm(p_wert);
    IF v_norm IS NULL OR LENGTH(v_norm) < 6 THEN RETURN; END IF;
    SELECT primary_phone INTO v_person FROM fiaon_persons WHERE id = p_person_id;
    v_pnorm := fiaon_nummer_norm(v_person);
    IF v_pnorm IS NULL THEN
      UPDATE fiaon_persons SET primary_phone = BTRIM(p_wert), updated_at = NOW()
      WHERE id = p_person_id;
      RETURN;
    END IF;
    IF v_pnorm = v_norm OR RIGHT(v_pnorm, 9) = RIGHT(v_norm, 9) THEN RETURN; END IF;
  ELSE
    RETURN;
  END IF;

  -- ── GEHÖRT DER WERT SCHON EINEM ANDEREN MENSCHEN? ────────────────────────
  -- Dann ist es kein Alias-Fall, sondern ein Doppelgänger. Vorher scheiterte
  -- das Einfügen still (ON CONFLICT DO NOTHING) — und der Hinweis war weg.
  SELECT person_id INTO v_fremd FROM fiaon_person_aliases
  WHERE kind = p_art AND value_norm = v_norm AND person_id <> p_person_id
  LIMIT 1;

  IF v_fremd IS NULL THEN
    SELECT id INTO v_fremd FROM fiaon_persons
    WHERE id <> p_person_id AND merged_into_person_id IS NULL
      AND ((p_art = 'email' AND fiaon_mail_norm(primary_email) = v_norm)
        OR (p_art = 'phone' AND RIGHT(fiaon_nummer_norm(primary_phone), 9) = RIGHT(v_norm, 9)))
    LIMIT 1;
  END IF;

  IF v_fremd IS NOT NULL THEN
    INSERT INTO fiaon_doppelgaenger (person_a, person_b, merkmal, wert, quelle)
    VALUES (p_person_id, v_fremd, p_art, v_norm, 'trigger')
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  -- Sonst: der abweichende Wert wird Alias dieses Menschen.
  INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
  VALUES (p_person_id, p_art, v_norm, BTRIM(p_wert), p_quelle)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

