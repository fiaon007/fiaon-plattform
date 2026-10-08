-- ═══════════════════════════════════════════════════════════════════════════
-- DOPPELBUCHUNGEN ZÄHLEN NICHT DOPPELT — DIE FEHLVERSUCH-MARKE (E-IT-A, 08.10.2026)
--
-- Befund (Produktion, nur lesend, 07.10.2026): Bei Nikita folgten 131 von 653
-- „nicht erreicht/Mailbox" binnen 30 Minuten auf einen vorherigen Eintrag
-- derselben Person, 98 davon binnen 2 Minuten — meist ein Softphone-Ergebnis
-- UND ein zweiter Eintrag aus der Akte für denselben Anruf. Beide laufen über
-- ergebnisAnwenden, der Zähler unreachable_count stieg zweimal, die Staffel
-- sprang zu früh (Pause, Ruhe).
--
-- Justins Entscheidung (08.10.2026): Doppelbuchungen (gleiches Ergebnis binnen
-- Minuten) zählen nicht doppelt.
--
-- ── WARUM EINE EIGENE KLEINE TABELLE UND KEINE SPALTE AN fiaon_persons ─────
-- fiaon_persons ist die meistgelesene Tabelle. ADD COLUMN nimmt dort ACCESS
-- EXCLUSIVE — genau die Sperre, die am 28.09.2026 (E-254) das Agentenportal
-- stehen ließ. Eine neue Tabelle sperrt NICHTS Bestehendes. Kein Fremdschlüssel
-- (ein REFERENCES nähme eine Sperre auf fiaon_persons); die Bindung trägt die
-- person_id, gelesen und geschrieben wird nur über server/lib/fiaon-fehlversuch.ts.
--
-- Eine Zeile je Person: Wann wurde zuletzt ein Fehlversuch GEZÄHLT? Ein weiterer
-- binnen ENTPRELLUNG_MINUTEN (shared/fiaon-wiedervorlage.ts, 30) zählt nicht.
-- Gelöscht wird nichts: „erreicht" setzt die Marke auf '-infinity'.
--
-- Dieselbe Tabelle legt der Server beim ersten Gebrauch selbst an
-- (fehlversuchTabelle) — die Reihenfolge Code/Migration ist gleichgültig.
-- Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS fiaon_fehlversuch_marke (
  person_id  INTEGER PRIMARY KEY,
  am         TIMESTAMPTZ NOT NULL
);
