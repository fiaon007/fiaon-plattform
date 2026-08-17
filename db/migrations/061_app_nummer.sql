-- ═══════════════════════════════════════════════════════════════════════════
-- DIE WÄHLBARE NUMMER EINER BESTELLZEILE
--
-- ── WARUM DAS EINE EIGENE MIGRATION IST ────────────────────────────────────
-- Diese Funktion entstand zuerst IM BESTANDSSKRIPT und wurde dann an das Ende
-- von Migration 060 gehängt. Beides war falsch:
--
--   Im Skript: Nach einem Neuaufsetzen der Datenbank hätte sie gefehlt, und
--   der Prüfstand wäre mit „Funktion existiert nicht" gescheitert.
--
--   In 060: Die Migration war zu diesem Zeitpunkt schon angewendet. Der Runner
--   überspringt sie („already applied") — die Ergänzung wäre in DIESER Datenbank
--   nie gelaufen und nur in neuen aufgetaucht. Zwei Umgebungen, zwei Stände.
--
-- Eine angewendete Migration wird nicht nachträglich verändert. Sie bekommt
-- eine Nachfolgerin.
-- ═══════════════════════════════════════════════════════════════════════════
-- Diese Funktion entstand zuerst IM BESTANDSSKRIPT — und damit an der falschen
-- Stelle: Nach einem Neuaufsetzen der Datenbank hätte sie gefehlt, und der
-- Prüfstand wäre mit „Funktion existiert nicht" gescheitert.
--
-- ── WOZU SIE DA IST ────────────────────────────────────────────────────────
-- Der Trigger setzt Vorwahl und Nummer zusammen, bevor er durchschreibt
-- („+49" + „1761234" = „+491761234"). Die Zählprobe prüfte anfangs `phone`
-- ALLEIN gegen die Person und meldete 74 Fehler, obwohl der Alias mit der
-- zusammengesetzten Nummer längst dastand.
--
-- Zwei Fassungen derselben Regel — genau das, was in diesem Auftrag sterben
-- soll. Also steht sie hier einmal, und Trigger, Lauf und Prüfstand benutzen
-- sie gemeinsam.
CREATE OR REPLACE FUNCTION fiaon_app_nummer(
  p_phone TEXT, p_cc TEXT, p_contact TEXT
) RETURNS TEXT AS $$
  SELECT CASE
    WHEN COALESCE(p_phone, '') = '' THEN p_contact
    WHEN p_phone LIKE '+%' THEN p_phone
    WHEN COALESCE(p_cc, '') <> '' THEN p_cc || p_phone
    ELSE p_phone
  END;
$$ LANGUAGE sql IMMUTABLE;
