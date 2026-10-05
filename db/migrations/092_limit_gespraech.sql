-- ═══════════════════════════════════════════════════════════════════════════
-- LIMIT-GESPRÄCH: HÖCHSTENS EIN OFFENES JE PERSON — 05.10.2026 (E-283)
--
-- Justin: „Limit-Gespräch muss der Kunde buchen in der App, also sowas wie
-- ‚Limit-Erhöhung anfragen', das geht aber nur alle 3 Monate."
--
-- Der Kunde bucht im Kundenbereich (/app/mehr/limit); der Server prüft vorher,
-- dass KEIN gebuchtes Limit-Gespräch offen ist (shared/fiaon-limit-gespraech.ts).
-- Zwei Anfragen in derselben Sekunde (Doppelklick, zwei Geräte) lesen beide
-- „keines offen" und buchen beide — die Grenze gehört deshalb in die
-- Datenbank, nicht in den Code (AGENTS.md, „Ein Teilindex …").
--
-- Ein Verstoß kommt als 23505 mit constraint_name fiaon_termine_ein_limit_offen
-- in terminBuchen an (server/lib/fiaon-termine.ts) und wird dort zum Code
-- „limit_offen" — mit einem Satz, nicht als „gerade vergeben".
--
-- ── SPERRARM, WIEDERHOLBAR ────────────────────────────────────────────────
-- Nur CREATE UNIQUE INDEX IF NOT EXISTS, kein Fremdschlüssel, kein DROP. Die
-- Bedingung trifft heute keine Zeile (die Art entsteht mit diesem Stand) —
-- der Index kann deshalb nicht an Altbestand scheitern. Kein ON CONFLICT
-- benutzt ihn; Prädikat und Abfrage müssen also nicht übereinstimmen.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS fiaon_termine_ein_limit_offen
  ON fiaon_termine (person_id)
  WHERE quelle = 'limit_gespraech' AND status = 'gebucht';
