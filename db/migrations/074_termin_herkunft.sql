-- ═══════════════════════════════════════════════════════════════════════════
-- DER BUCHUNGSWEG WIRD MITGEFÜHRT — fiaon_termine.herkunft (24.08.2026)
--
-- ── WAS VORHER GALT ───────────────────────────────────────────────────────
-- Der Weg, auf dem ein Mensch zu seinem Terminlink kam, hinterliess keine
-- Spur. Zwei Lagen standen im Bestand identisch da:
--
--   · Ein Kunde, der VOR der Zahlung aus der Antragsstrecke heraus bucht
--     (server/routes/fiaon-antrag-termin.ts).
--   · Ein Kunde, der nach vergeblichen Anrufen die Mail „Wir haben Sie nicht
--     erreicht" bekommt (server/lib/fiaon-nicht-erreicht.ts).
--
-- Beide bekamen `quelle='nichterreicht_mail'`. Und der Weg über die
-- Nummern-Korrektur (server/fiaon-number-update.ts) hinterliess gar nichts:
-- Der Wert `nummer_korrektur` steht in den Anzeige-Wörterbüchern
-- (server/routes/fiaon-termin-zentrale.ts, shared/fiaon-termin-art.ts), wurde
-- aber NIE geschrieben — der Admin-Filter „Nach Nummern-Korrektur" lieferte
-- deshalb garantiert null Treffer.
--
-- ── WARUM EINE ZWEITE SPALTE UND NICHT NEUE QUELLWERTE ────────────────────
-- `quelle` beschreibt die ZUSTÄNDIGKEIT — welche Art Gespräch (Onboarding,
-- Vertrieb, Forderungsmanagement) — und steuert Rollen-, Slot- und
-- Dauer-Logik (server/lib/fiaon-termine.ts, server/lib/fiaon-zustaendigkeit.ts).
-- Wer den Buchungsweg dort hineinschreibt, verschiebt die Vergabe: Ein Wort
-- über die Herkunft entschiede plötzlich, WER den Kunden anruft. Genau dieser
-- Fehler wurde am 21.08.2026 mit `?art=` abgestellt.
--
-- `herkunft` steuert NICHTS. Sie ist reine Buchführung und darf es bleiben.
--
-- ── DIE ERLAUBTEN WERTE ───────────────────────────────────────────────────
-- Sie stehen im Code (HERKUENFTE in server/lib/fiaon-termine.ts) und werden
-- dort geprüft — alles Unbekannte wird zu `unbekannt`. BEWUSST KEIN
-- CHECK-Constraint und kein Default: Ein neuer Weg soll eine Codezeile kosten
-- und keine Sperre auf einer Produktionstabelle, und NULL heisst ehrlich
-- „vor dem 24.08.2026 gebucht, Weg nicht erfasst".
--
--   antrag_vor_zahlung   Terminlink aus der Antragsstrecke (vor der Zahlung)
--   nicht_erreicht_mail  Mail „Wir haben Sie nicht erreicht"
--   nummer_korrektur     Mail zur Nummern-Korrektur
--   onboarding_einladung Einladung zum Startgespräch
--   termin_verpasst_mail Einladung nach einem verpassten Termin
--   wiedereinstieg_mail  Wiedereinstiegs-Mail nach langer Funkstille
--   agent                Von einem Mitarbeiter weitergegeben oder eingetragen
--   unbekannt            Weg nicht mitgeführt
--
-- Additiv und idempotent. Keine Spalte wird entfernt, keine Zeile geändert.
-- Der Code legt die Spalte zusätzlich lazy an (ensureHerkunftSpalte in
-- server/lib/fiaon-termine.ts, Muster: ensureVertriebSpalten) — diese Datei
-- ist die nachvollziehbare Fassung derselben Änderung.
-- ═══════════════════════════════════════════════════════════════════════════

-- lock_timeout: Ein ALTER, das hinter einer langen Transaktion wartet, zwingt
-- ALLE folgenden Abfragen auf fiaon_termine in dieselbe Warteschlange — der
-- Kalender stünde. Lieber nach 3 s aufgeben und erneut ausführen.
SET lock_timeout = '3s';

ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS herkunft VARCHAR;

COMMENT ON COLUMN fiaon_termine.herkunft IS
  'Der WEG zur Buchung (Antragsstrecke, Nicht-erreicht-Mail, Nummern-Korrektur, Onboarding-Einladung, Mitarbeiter, ...). Rein beschreibend: steuert weder Rolle noch Slots noch Dauer. Die Gespraechsart steht in quelle.';

-- Der Index trägt nur die erfassten Zeilen: Der Bestand vor dem 24.08.2026 ist
-- NULL und würde den Index sonst fast nur mit Luft füllen.
CREATE INDEX IF NOT EXISTS fiaon_termine_herkunft_idx
  ON fiaon_termine (herkunft) WHERE herkunft IS NOT NULL;

RESET lock_timeout;
