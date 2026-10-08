-- ═══════════════════════════════════════════════════════════════════════════
-- E-IT-E (08.10.2026), Punkt 10 — KEIN „Agent 0" MEHR IN fiaon_persons
--
-- ── WARUM ─────────────────────────────────────────────────────────────────
-- Der Personen-Merge las den Betreuer jeder Seite als Zahl aus
-- assigned_agent_id — auch wenn dort NULL stand. NULL als Zahl ist 0. Am
-- 05.10.2026 schrieb er so assigned_agent_id = 0 an Person 13458: ein
-- Interessent, der seitdem weder im Pool (IS NULL) noch bei einem Mitarbeiter
-- stand. Es gibt keinen Fremdschlüssel, der das verhindert hätte.
-- Der Code ist repariert (shared/fiaon-betreuer-lage.ts, harte Wand in
-- server/lib/fiaon-person-merge.ts). Diese Migration ist die Wand in der
-- Datenbank: Eine Regel, die man vergessen kann, hat man schon vergessen.
--
-- ── WAS SIE TUT ───────────────────────────────────────────────────────────
-- CHECK fiaon_persons_agent_echt: assigned_agent_id ist NULL oder > 0.
-- Bewusst KEIN Fremdschlüssel — die Löschroute für Mitarbeiter
-- (fiaon-team.ts) hat eigene Reihenfolgen. Bewusst nur fiaon_persons: Die
-- Bestellungen bekommen ihren Betreuer über den Trigger
-- fiaon_person_owner_propagate von hier.
--
-- ── REIHENFOLGE UND SPERREN ───────────────────────────────────────────────
-- Gibt es noch eine Zeile mit 0, setzt diese Migration NICHTS — ein CHECK auf
-- eine solche Zeile ließe jedes spätere UPDATE dieser Person scheitern (auch
-- Läufe, die nur die Stufe nachziehen).
-- Querprüfung 08.10.2026: Bis dahin endete dieser Fall mit NOTICE + RETURN —
-- run-migrations.mjs verbuchte die Datei als angewendet und führte sie NIE
-- wieder aus; die Wand fiel still aus, sobald am Deploy-Tag auch nur eine 0
-- da war (der alte Merge-Code aus main schreibt bis zum Deploy weiter 0 bei
-- gestempelter Pool-Person; gemessen 08.10.: 0 Personen mit 0, aber rund 15
-- Zusammenführungen in 7 Tagen). Jetzt wirft sie eine EXCEPTION: Die
-- Transaktion rollt zurück, im Render-Log steht „FAIL 101_betreuer_nie_null.sql“
-- mit dem Hinweis unten, die Datei bleibt offen und wird bei jedem Start erneut
-- versucht. Der Start selbst läuft weiter (run-migrations: nur Sperrfehler
-- brechen ab). Reparatur: scripts/it-e-einmal.ts --ausfuehren (repariert und
-- setzt denselben CHECK selbst) — danach ist diese Datei ein Leerlauf und wird
-- verbucht. Die Datei ist wiederholbar.
-- Die Sperre: ADD CONSTRAINT … NOT VALID nimmt kurz ACCESS EXCLUSIVE (kein
-- Lesen der Tabelle); VALIDATE liest die rund 6.800 Personen (08.10.2026: 6.755) in
-- Millisekunden. run-migrations.mjs führt die Datei in EINER Transaktion aus —
-- die Sperre hält deshalb bis zum Ende. lock_timeout 2 s: Hält jemand die
-- Tabelle länger, bricht die Migration ab, statt Abfragen hinter sich
-- aufzustauen (E-254), und wird einfach wiederholt.
-- Rückweg: ALTER TABLE fiaon_persons DROP CONSTRAINT IF EXISTS fiaon_persons_agent_echt;
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '2s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiaon_persons_agent_echt') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM fiaon_persons WHERE assigned_agent_id IS NOT NULL AND assigned_agent_id <= 0) THEN
    RAISE EXCEPTION 'fiaon_persons_agent_echt NICHT gesetzt: Es gibt noch Personen mit assigned_agent_id <= 0. PFLICHT: scripts/it-e-einmal.ts --ausfuehren — das Skript repariert und setzt den CHECK selbst; diese Datei bleibt offen und läuft beim nächsten Start erneut.';
  END IF;
  ALTER TABLE fiaon_persons
    ADD CONSTRAINT fiaon_persons_agent_echt CHECK (assigned_agent_id IS NULL OR assigned_agent_id > 0) NOT VALID;
  ALTER TABLE fiaon_persons VALIDATE CONSTRAINT fiaon_persons_agent_echt;
END $$;
