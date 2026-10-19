// ═══════════════════════════════════════════════════════════════════════════
// DER GROSSE HAUSPUTZ — DIE REGELN (E-397, 19.10.2026)
//
// Gemessen am 19.10.2026: 2.180 offene Aufgaben (1.498 Aufträge, 682 „Zu tun“),
// nur 5,6 % jünger als 7 Tage, rund 1.250 per Regel erledigt oder doppelt.
//
// Diese Datei ist REIN (keine Datenbank): Die Kandidaten-Abfragen als Text und
// die Bewertung je Zeile. So rechnen Plattform-Lauf und Probelauf DIESELBEN
// Regeln — der Probelauf auf der Plattform (server/lib/fiaon-hausputz.ts) und,
// nur lesend, die Nachrechnung vom Mac (scripts/hausputz-probelauf.ts).
//
// LEITPLANKEN (Justin, 19.10.2026):
//   · Erstattung schließt NIE das System — auch nicht beim Testkonto.
//   · Heikles (Widerruf, Anwalt, Beschwerde, Löschantrag, Recht, Geld) schließt
//     der Hausputz nur beim Testkonto; Kündigung nur als reiner Kündigungs-Fall
//     mit gebuchter Kündigung; Eskalation nur bei beendetem Vertrag ohne Rate.
//   · Doppel werden ZUSAMMENGEFÜHRT (Text wandert in den neuesten), nie gelöscht.
//   · Einträge bei gesperrten Mitarbeitern werden UMGEHÄNGT, nicht geschlossen.
//   · Offene Frage oder von Hand wieder geöffnet: Der Hausputz fasst nichts an.
//   · Jede Schließung trägt ihren Grund und ist 30 Tage lang rückholbar.
// ═══════════════════════════════════════════════════════════════════════════
import { ERGEBNIS_LISTE } from "./fiaon-kontakt-ergebnis-liste";
import { STUFE_A_GEMELDET_TAGE } from "./fiaon-wiedervorlage";
import {
  ALARM_QUELLEN, AUFTRAG_ARTEN, HEIKLE_ARTEN, artNachInhalt, ereignisAusErgebnis, ereignisSchliesstArt, heikelArt,
  istAuftragArt, istErstattung, nurKuendigung, type AuftragArt, type AuftragArtRegel,
} from "./fiaon-auftrag-arten";

export type HausputzTabelle = "auftrag" | "vermerk" | "rueckruf";
export type HausputzAktion = "schliessen" | "zusammenfuehren" | "umhaengen";

export interface HausputzRegel { id: string; label: string; grund: string; aktion: HausputzAktion }

/** Die Regeln in der Reihenfolge, in der sie greifen (die erste passende gewinnt). */
export const HAUSPUTZ_REGELN: readonly HausputzRegel[] = [
  { id: "test", label: "Testkonto", grund: "Testkonto — hier ist nichts zu tun", aktion: "schliessen" },
  { id: "alarm", label: "System-Alarm (Lead-Motor, KI-Pause, WhatsApp, Telefon, Lauf-Wächter)", grund: "System-Alarm — steht seit E-397 als EINE Zeile in der Ampel im Lagezimmer und geht dort von selbst aus", aktion: "schliessen" },
  { id: "termintreue", label: "Termintreue-Meldung", grund: "Termintreue — steht seit E-397 als Ampel im Lagezimmer (verpasst/verspätet je Mitarbeiter)", aktion: "schliessen" },
  { id: "kopie", label: "Kopie „Zur Kenntnis“ (das Original liegt beim Mitarbeiter)", grund: "Kopie „Zur Kenntnis“ — das Original liegt beim Mitarbeiter und bleibt offen", aktion: "schliessen" },
  { id: "meldung_alt", label: "Technik-Meldung oder Bau-Notiz älter als 30 Tage", grund: "Technik-Meldung älter als 30 Tage — längst überholt", aktion: "schliessen" },
  { id: "entwickler_alt", label: "Entwickler-Notizen vom August an Justin", grund: "Entwickler-Notiz vom August an Justin — seit 15.10. gilt „keine Aufgaben an Justin“; jeder Punkt steht im Logbuch (E-397) und läuft dort weiter", aktion: "schliessen" },
  { id: "archiviert", label: "Kunde archiviert (alle Bestellungen)", grund: "Kunde archiviert — alle Bestellungen stehen im Archiv", aktion: "schliessen" },
  { id: "kuendigung_gebucht", label: "Kündigung gebucht (reiner Kündigungs-Fall)", grund: "Kündigung ist gebucht — es ging nur um die Kündigung", aktion: "schliessen" },
  { id: "bezahlt", label: "Zahlung gebucht (Zahlungs-Klärung, Erstzahlung unzustellbar)", grund: "Die Zahlung ist gebucht — damit ist die Klärung erledigt", aktion: "schliessen" },
  { id: "eskalation_beendet", label: "Eskalation: Vertrag beendet und keine Rate offen", grund: "Vertrag beendet und keine Rate mehr offen — nichts mehr einzufordern", aktion: "schliessen" },
  { id: "vertrag_beendet", label: "Vertrag beendet, keine Rate offen (Verkauf, Karte, Unterlagen, Nachfassen)", grund: "Vertrag beendet und keine Rate offen — Verkauf, Karte, Unterlagen und Nachfassen sind überflüssig", aktion: "schliessen" },
  { id: "erreicht", label: "Kunde danach vom Zuständigen erreicht", grund: "Der Zuständige hat den Kunden danach erreicht (Gesprächsergebnis) — der Kontakt ist erledigt", aktion: "schliessen" },
  { id: "unterlagen_geprueft", label: "„Unterlagen eingegangen“: alles geprüft oder Vertrag beendet", grund: "Unterlagen sind geprüft (oder der Vertrag ist beendet) — nichts mehr zu prüfen", aktion: "schliessen" },
  { id: "frist_gerissen", label: "Hinweis „Frist gerissen“ (der Rückruf selbst bleibt)", grund: "Hinweis „Frist gerissen“ — der Rückruf selbst steht in der Rückruf-Liste", aktion: "schliessen" },
  { id: "rueckruf_doppel", label: "„Rückruf binnen 24 h“ (steht in der Rückruf-Liste)", grund: "Doppel zur Rückruf-Liste (/agent/rueckrufe) — dort zählt der Rückruf", aktion: "schliessen" },
  { id: "postmeister_alt", label: "Alter Postmeister-Hinweis vom 01./02.09. (ohne Heikles)", grund: "Alter Postmeister-Hinweis vom 01./02.09. — seitdem läuft jede Mail über die Aufträge", aktion: "schliessen" },
  { id: "system_alt", label: "Alte Systemkarten (Terminseite, Termin übernommen, Warnung Termintreue)", grund: "Alte Systemkarte — die Sache ist vorbei", aktion: "schliessen" },
  { id: "nicht_erreicht_alt", label: "„Nicht erreicht – entscheiden“: bezahlt, beendet oder archiviert", grund: "Inzwischen bezahlt, beendet oder archiviert — keine Entscheidung mehr nötig", aktion: "schliessen" },
  { id: "gemeldet_alt", label: "„Zahlung gemeldet, nicht erreicht – entscheiden“ älter als 14 Tage", grund: "Gemeldete Zahlung älter als 14 Tage ohne Eingang — gilt seit E-368 als unbezahlt; die Klärung läuft seit E-303 als Auftrag „Zahlung gemeldet, nicht da – klären“", aktion: "schliessen" },
  { id: "haertefall", label: "Härtefall: keine Rate mehr offen", grund: "Keine Rate mehr offen — der Härtefall ist erledigt", aktion: "schliessen" },
  { id: "rueckruf_alt", label: "Rückruf: Kunde danach erreicht oder Vertrag beendet", grund: "Kunde danach erreicht oder Vertrag beendet — der Rückruf-Wunsch ist erledigt", aktion: "schliessen" },
  { id: "doppel", label: "Doppel (gleicher Kunde, gleiche Art) — zusammengeführt", grund: "Doppel — Text und Verlauf stehen im neuesten Auftrag dieses Kunden", aktion: "zusammenfuehren" },
  { id: "gesperrt", label: "Lag bei gesperrtem Mitarbeiter — umgehängt", grund: "Lag bei einem gesperrten Mitarbeiter — an den Betreuer bzw. die passende Rolle umgehängt", aktion: "umhaengen" },
];
export function hausputzRegel(id: string): HausputzRegel | null {
  return HAUSPUTZ_REGELN.find((r) => r.id === id) ?? null;
}

/** E-368: Eine gemeldete Zahlung ohne Eingang gilt nach so vielen Tagen als unbezahlt (dieselbe Zahl wie Mara-Aktion und Dossier). */
const STUFE_A_TAGE = STUFE_A_GEMELDET_TAGE;

/** Gesprächsergebnisse, die „erreicht“ heißen (dieselbe Ableitung wie das Ereignis ergebnis_erreicht). */
export const ERREICHT_ERGEBNISSE: readonly string[] = ERGEBNIS_LISTE.filter((a) => ereignisAusErgebnis(a.art) === "ergebnis_erreicht").map((a) => a.art);

/**
 * Geld im Text (Zahlung, Überweisung, Betrag, Euro …): Nach dem Vertragsende kann das eine Rückzahlungs- oder
 * Überzahlungsfrage sein — dann schließt „Vertrag beendet“ NICHT (Gegenlesen am Produktionsabzug 19.10.).
 */
// „Konto“ allein zählt nicht (sonst träfe es „Konto & Karte“); „auf mein Konto zurück“ fängt istErstattung.
const GELD_WORTE = /(zahl|überweis|ueberweis|betrag|\beuro\b|€|geld|abbuch|lastschrift|iban|rate\b|raten\b)/i;

/** Verkauf, Karte, Unterlagen, Nachfassen — nach beendetem Vertrag ohne offene Rate überflüssig (nie Heikles). */
export const VERTRAG_ENDE_ARTEN: readonly AuftragArt[] = [
  "konto_karte", "einladung_fehlt", "unterlage", "mara_auskunft", "stufe_a_klaeren", "unzustellbar_erstzahlung", "unzustellbar_rate",
  "mara_hinweis", "mara_rueckruf", "mara_wa_anliegen", "mara_wa_pruefung", "mara_wa_rueckruf", "kontakt", "mara_aufgabe", "mara_mail",
];

// ═══════════════════════════════════════════════════════════════════════════
// DIE KANDIDATEN — reine SELECTs (nur lesen), je Tabelle eine Abfrage
// ═══════════════════════════════════════════════════════════════════════════
const sqlText = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
const sqlListe = (l: readonly string[]) => `ARRAY[${l.map(sqlText).join(", ")}]::text[]`;

/** Gemeinsamer Kopf: Wurzel je Person, Lage je Wurzel (Bestellungen, Raten, Test, Zahlungen, Gespräche). */
function kopf(): string {
  return `
WITH RECURSIVE wurzel AS (
  SELECT id, id AS start, merged_into_person_id AS nxt, 0 AS tiefe FROM fiaon_persons
  UNION ALL
  SELECT p.id, w.start, p.merged_into_person_id, w.tiefe + 1 FROM wurzel w JOIN fiaon_persons p ON p.id = w.nxt WHERE w.tiefe < 5
),
wz AS (SELECT DISTINCT ON (start) start AS person_id, id AS root FROM wurzel ORDER BY start, tiefe DESC),
app AS (
  SELECT a.ref, a.person_id, wz.root, a.archived_at, a.gekuendigt_am, a.cancelled_at, a.abo_gestoppt_am, a.payment_status, a.paid_at,
         a.kuendigung_zurueckgenommen_am
    FROM fiaon_applications a JOIN wz ON wz.person_id = a.person_id
   WHERE a.merged_into IS NULL AND COALESCE(a.ist_entwurf, FALSE) = FALSE
),
lage AS (
  SELECT root,
         BOOL_AND(archived_at IS NOT NULL) AS alle_archiviert,
         BOOL_AND(gekuendigt_am IS NOT NULL OR cancelled_at IS NOT NULL OR archived_at IS NOT NULL OR abo_gestoppt_am IS NOT NULL) AS alle_beendet,
         MAX(CASE WHEN kuendigung_zurueckgenommen_am IS NULL THEN GREATEST(gekuendigt_am, cancelled_at) END) AS kuendigung_am,
         MAX(GREATEST(gekuendigt_am, cancelled_at, abo_gestoppt_am, archived_at)) AS ende_am
    FROM app GROUP BY root
),
raten AS (
  SELECT app.root, COUNT(*)::int AS offen
    FROM fiaon_abo_raten r JOIN app ON app.ref = r.ref
   WHERE r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL
   GROUP BY app.root
),
zahl AS (
  SELECT app.root, MAX(z.am) AS letzte_zahlung FROM (
    SELECT r.ref, r.bezahlt_am AS am FROM fiaon_abo_raten r WHERE r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL
    UNION ALL
    SELECT a.ref, COALESCE(a.paid_at, a.completed_at) FROM fiaon_applications a WHERE a.payment_status = 'paid'
  ) z JOIN app ON app.ref = z.ref GROUP BY app.root
),
test AS (SELECT p.id AS root FROM fiaon_persons p WHERE p.ist_test_am IS NOT NULL),
erreicht AS (
  SELECT app.root, c.agent_id, c.created_at
    FROM fiaon_contact_log c JOIN app ON app.ref = c.ref
   WHERE c.type = 'result' AND c.voided_at IS NULL AND c.outcome = ANY(${sqlListe(ERREICHT_ERGEBNISSE)})
),
gesperrt AS (
  SELECT ag.id FROM fiaon_agents ag
   WHERE COALESCE(ag.active, TRUE) = FALSE OR ag.zugang_gesperrt_am IS NOT NULL OR COALESCE(ag.is_test_account, FALSE) = TRUE
)`;
}

/** Offene Aufträge (fiaon_betreiber_todos) mit allem, was die Bewertung braucht. */
export function hausputzAuftraegeSql(): string {
  return `${kopf()},
t AS (
  SELECT t.id, t.art, t.status, t.titel, LEFT(t.text, 8000) AS text, t.schluessel, t.quelle, t.bereich, t.zustaendig_art, t.zustaendig_agent_id,
         t.zustaendig_name, t.ref AS auftrag_ref, t.prioritaet,
         (t.status = 'wartet' OR COALESCE(t.frage_offen, FALSE) OR COALESCE(t.frage_an_agent, FALSE)) AS frage,
         (COALESCE(t.wieder_offen_grund, '') ~ '^von .+ wieder geöffnet') AS von_hand_offen,
         COALESCE(t.eingang_am, t.created_at) AS eing, t.created_at,
         COALESCE(wz.root, (SELECT app.root FROM app WHERE app.ref = t.ref LIMIT 1)) AS root
    FROM fiaon_betreiber_todos t LEFT JOIN wz ON wz.person_id = t.person_id
   WHERE t.status <> 'erledigt'
)
SELECT t.id, t.art, t.titel, t.text, t.schluessel, t.quelle, t.bereich, t.zustaendig_art, t.zustaendig_agent_id, t.zustaendig_name,
       t.auftrag_ref, t.prioritaet, t.frage, t.von_hand_offen, t.eing, t.root,
       EXTRACT(EPOCH FROM (NOW() - t.eing)) / 86400 AS alter_tage,
       (t.root IN (SELECT root FROM test)) AS ist_test,
       COALESCE(l.alle_archiviert, FALSE) AS alle_archiviert, COALESCE(l.alle_beendet, FALSE) AS alle_beendet,
       COALESCE(r.offen, 0) AS offene_raten,
       (l.kuendigung_am IS NOT NULL AND l.kuendigung_am > t.eing) AS kuendigung_danach,
       (l.ende_am IS NOT NULL AND l.ende_am > t.eing) AS ende_danach,
       (t.zustaendig_art = 'agent' AND t.zustaendig_agent_id IN (SELECT id FROM gesperrt)) AS zust_gesperrt,
       -- Die Zahlung DER Bestellung dieses Auftrags (Schlüssel antrag:<ref>:…, sonst die Referenz am Auftrag).
       EXISTS (SELECT 1 FROM fiaon_applications a
                WHERE a.ref = COALESCE(substring(t.schluessel from '^antrag:([^:]+):'), t.auftrag_ref)
                  AND a.payment_status = 'paid' AND COALESCE(a.paid_at, a.completed_at) > t.eing) AS bestellung_bezahlt_danach,
       EXISTS (SELECT 1 FROM erreicht e WHERE e.root = t.root AND e.created_at > t.eing AND e.agent_id = t.zustaendig_agent_id) AS erreicht_vom_zustaendigen,
       EXISTS (SELECT 1 FROM fiaon_postmeister p JOIN wz w2 ON w2.person_id = p.person_id
                WHERE w2.root = t.root AND p.gesendet_am IS NULL
                  AND p.aktion IN ('entwurf', 'fehler', 'versand_wartet', 'versand_fehlgeschlagen', 'sendet')
                  AND NOT (p.aktion = 'fehler' AND p.created_at < NOW() - INTERVAL '14 days')) AS entwurf_wartet,
       (t.schluessel ~ ':(betreiber|vertreter)$' AND EXISTS (
          SELECT 1 FROM fiaon_betreiber_todos o WHERE o.schluessel = regexp_replace(t.schluessel, ':(betreiber|vertreter)$', ''))) AS kopie_mit_original,
       (t.schluessel ~ ':(betreiber|vertreter)$' AND EXISTS (
          SELECT 1 FROM fiaon_betreiber_todos o WHERE o.schluessel = regexp_replace(t.schluessel, ':(betreiber|vertreter)$', '')
             AND o.status <> 'erledigt')) AS kopie_original_offen,
       -- Doppel: gleicher Kunde und gleiche Art (Kopien zählen nicht mit) — der neueste ist das Ziel.
       CASE WHEN t.root IS NOT NULL AND t.art IS NOT NULL AND COALESCE(t.schluessel, '') !~ ':(betreiber|vertreter)$'
            THEN ROW_NUMBER() OVER (PARTITION BY t.root, t.art, (COALESCE(t.schluessel, '') ~ ':(betreiber|vertreter)$') ORDER BY t.eing DESC, t.id DESC) END AS doppel_rang,
       CASE WHEN t.root IS NOT NULL AND t.art IS NOT NULL AND COALESCE(t.schluessel, '') !~ ':(betreiber|vertreter)$'
            THEN FIRST_VALUE(t.id) OVER (PARTITION BY t.root, t.art, (COALESCE(t.schluessel, '') ~ ':(betreiber|vertreter)$') ORDER BY t.eing DESC, t.id DESC) END AS doppel_ziel,
       -- Ohne Kunde und ohne Schlüssel: gleicher Titel.
       CASE WHEN t.root IS NULL AND t.schluessel IS NULL THEN ROW_NUMBER() OVER (PARTITION BY (t.root IS NULL AND t.schluessel IS NULL), t.titel ORDER BY t.eing DESC, t.id DESC) END AS titel_rang,
       CASE WHEN t.root IS NULL AND t.schluessel IS NULL THEN FIRST_VALUE(t.id) OVER (PARTITION BY (t.root IS NULL AND t.schluessel IS NULL), t.titel ORDER BY t.eing DESC, t.id DESC) END AS titel_ziel
  FROM t LEFT JOIN lage l ON l.root = t.root LEFT JOIN raten r ON r.root = t.root
 ORDER BY t.id`;
}

/** Offene „Zu tun“-Einträge (fiaon_vermerke, art = 'aufgabe'). */
export function hausputzVermerkeSql(): string {
  return `${kopf()},
v AS (
  SELECT v.id, v.text, v.ref, v.zustaendig_agent_id, v.fuer_betreiber, v.sicht, v.autor_art, v.autor_name, v.created_at,
         (SELECT app.root FROM app WHERE app.ref = v.ref LIMIT 1) AS root,
         CASE WHEN v.text LIKE 'Unterlagen eingegangen%' THEN 'unterlagen'
              WHEN v.text LIKE 'Postmeister:%' THEN 'postmeister_alt'
              WHEN v.text LIKE 'FRIST GERISSEN%' THEN 'frist_gerissen'
              WHEN v.text LIKE 'RÜCKRUF binnen%' THEN 'rueckruf_24h'
              WHEN v.autor_name LIKE 'Automatik: nicht erreicht%' THEN 'nicht_erreicht'
              WHEN v.autor_name = 'Terminseite' THEN 'terminseite'
              WHEN v.text LIKE 'Härtefall%' THEN 'haertefall'
              WHEN v.text LIKE 'Termin übernommen%' THEN 'termin_uebernommen'
              WHEN v.autor_name = 'Website' THEN 'website'
              WHEN v.text LIKE 'Warnung Termintreue%' THEN 'warnung_termintreue'
              ELSE 'sonstige' END AS typ
    FROM fiaon_vermerke v
   WHERE v.art = 'aufgabe' AND v.status = 'offen' AND v.entfernt_am IS NULL
)
SELECT v.id, LEFT(v.text, 8000) AS text, v.ref, v.zustaendig_agent_id, v.fuer_betreiber, v.sicht, v.typ, v.root, v.created_at,
       EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 86400 AS alter_tage,
       (v.root IN (SELECT root FROM test)) AS ist_test,
       COALESCE(l.alle_archiviert, FALSE) AS alle_archiviert, COALESCE(l.alle_beendet, FALSE) AS alle_beendet,
       COALESCE(r.offen, 0) AS offene_raten,
       (l.kuendigung_am IS NOT NULL AND l.kuendigung_am > v.created_at) AS kuendigung_danach,
       (z.letzte_zahlung IS NOT NULL AND z.letzte_zahlung > v.created_at) AS bezahlt_danach,
       (v.zustaendig_agent_id IN (SELECT id FROM gesperrt)) AS zust_gesperrt,
       -- Der Rückruf hinter einem Rückruf-Hinweis: über den Menschen ODER über den Anliegen-Text, den der Hinweis wörtlich
       -- trägt („RÜCKRUF binnen 24 h: <Anliegen>“ bzw. „… Anliegen: <Anliegen>“) — viele Hinweise haben keine Referenz.
       EXISTS (SELECT 1 FROM fiaon_rueckrufe rr LEFT JOIN wz w3 ON w3.person_id = rr.person_id
                WHERE rr.status = 'offen'
                  AND ((v.root IS NOT NULL AND w3.root = v.root)
                    OR (v.typ IN ('frist_gerissen', 'rueckruf_24h') AND length(rr.anliegen) >= 20
                        AND strpos(v.text, LEFT(rr.anliegen, 200)) > 0))) AS rueckruf_offen,
       (SELECT COUNT(*)::int FROM fiaon_dokumente d JOIN wz w2 ON w2.person_id = d.person_id
         WHERE w2.root = v.root AND d.art = 'unterlage' AND d.quelle = 'kunde'
           AND d.geprueft_am IS NULL AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL) AS unterlagen_ungeprueft,
       CASE WHEN v.root IS NOT NULL AND v.typ <> 'sonstige'
            THEN ROW_NUMBER() OVER (PARTITION BY v.root, v.typ, (v.typ = 'sonstige') ORDER BY v.created_at DESC, v.id DESC) END AS doppel_rang,
       CASE WHEN v.root IS NOT NULL AND v.typ <> 'sonstige'
            THEN FIRST_VALUE(v.id) OVER (PARTITION BY v.root, v.typ, (v.typ = 'sonstige') ORDER BY v.created_at DESC, v.id DESC) END AS doppel_ziel
  FROM v LEFT JOIN lage l ON l.root = v.root LEFT JOIN raten r ON r.root = v.root LEFT JOIN zahl z ON z.root = v.root
 ORDER BY v.id`;
}

/** Offene Rückruf-Wünsche (fiaon_rueckrufe). */
export function hausputzRueckrufeSql(): string {
  return `${kopf()}
SELECT r.id, r.anliegen, r.zustaendig_agent_id, r.created_at, wz.root,
       EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400 AS alter_tage,
       (wz.root IN (SELECT root FROM test)) AS ist_test,
       COALESCE(l.alle_archiviert, FALSE) AS alle_archiviert, COALESCE(l.alle_beendet, FALSE) AS alle_beendet,
       COALESCE(ra.offen, 0) AS offene_raten,
       EXISTS (SELECT 1 FROM erreicht e WHERE e.root = wz.root AND e.created_at > r.created_at) AS erreicht_danach
  FROM fiaon_rueckrufe r LEFT JOIN wz ON wz.person_id = r.person_id
  LEFT JOIN lage l ON l.root = wz.root LEFT JOIN raten ra ON ra.root = wz.root
 WHERE r.status = 'offen'
 ORDER BY r.id`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE BEWERTUNG — je Zeile höchstens eine Regel (die erste passende)
// ═══════════════════════════════════════════════════════════════════════════
export interface HausputzEntscheid {
  tabelle: HausputzTabelle; id: number; regel: string; aktion: HausputzAktion;
  /** Zusammenführen: in diese Zeile. */
  ziel?: number | null;
  /** Für die Zählung: lag es bei Justin (Board / „für den Betreiber“)? */
  beiJustin: boolean;
  /** Umhängen: der Kunde (Wurzel), dessen Betreuer bzw. Rolle übernimmt. */
  root?: number | null;
}

const zahlWert = (v: unknown) => Number(v ?? 0) || 0;
const wahr = (v: unknown) => v === true || v === "t" || v === "true";

/** Ein Auftrag: welche Regel greift? null = bleibt, wie er ist. */
export function auftragBewerten(t: any): HausputzEntscheid | null {
  const id = Number(t.id);
  const beiJustin = t.zustaendig_art !== "agent";
  const ent = (regel: string, extra: Partial<HausputzEntscheid> = {}): HausputzEntscheid =>
    ({ tabelle: "auftrag", id, regel, aktion: hausputzRegel(regel)!.aktion, beiJustin, ...extra });
  if (wahr(t.frage) || wahr(t.von_hand_offen)) return null;
  const inhalt = `${t.titel || ""}\n${t.text || ""}`;
  const erstattung = istErstattung(inhalt);
  const quelle = String(t.quelle || "").trim().toLowerCase();
  const schluessel = String(t.schluessel || "");
  const alter = zahlWert(t.alter_tage);
  // Erstattung: KEINE Schließ-Regel greift — egal aus welcher Quelle (Prüfstand B10). Nur Zusammenführen und Umhängen
  // (beides hält den Auftrag offen) bleiben möglich — und die Kopie, deren ORIGINAL nachweislich offen bleibt (die
  // Erstattung selbst geht damit nicht zu, sie steht beim Mitarbeiter).
  if (erstattung) {
    if (wahr(t.kopie_original_offen)) return ent("kopie");
    if (zahlWert(t.doppel_rang) > 1 && t.doppel_ziel && Number(t.doppel_ziel) !== id) return ent("doppel", { ziel: Number(t.doppel_ziel) });
    return wahr(t.zust_gesperrt) ? ent("gesperrt", { root: t.root != null ? Number(t.root) : null }) : null;
  }
  if (wahr(t.ist_test)) return ent("test");
  // Alarme: nicht die Sammelaufgaben mit echten Nachrichten aus einer Pause (ki-pause-wa-…, wa-pause-wa-…).
  if (ALARM_QUELLEN.includes(quelle) && !/^(ki-pause-wa-|wa-pause-wa-)/.test(schluessel)) return ent("alarm");
  if (quelle === "termintreue") return ent("termintreue");
  if (wahr(t.kopie_mit_original)) return ent("kopie");
  if (alter > 30 && ((quelle === "meldung" && /^it-mail-/.test(schluessel)) || quelle === "office-bau")) return ent("meldung_alt");
  // Die Entwickler-Liste vom 22.08. (Schlüssel ohne Doppelpunkt, quelle „system“) und Claudes Notizen vom 24.08. an Justin.
  if (beiJustin && alter > 45 && ((quelle === "system" && /^[a-z0-9-]+$/.test(schluessel)) || /^claude/.test(quelle))) return ent("entwickler_alt");
  const art: AuftragArt = artNachInhalt(t.art, { schluessel: t.schluessel, quelle: t.quelle, bereich: t.bereich, titel: t.titel, text: t.text });
  const regel: AuftragArtRegel = AUFTRAG_ARTEN[art];
  const heikel = HEIKLE_ARTEN.includes(art) || !!heikelArt(inhalt);
  if (!erstattung) {
    if (wahr(t.alle_archiviert) && ereignisSchliesstArt("kunde_archiviert", art, t)) return ent("archiviert");
    if (wahr(t.kuendigung_danach) && ereignisSchliesstArt("kuendigung_gebucht", art, t)) return ent("kuendigung_gebucht");
    if ((art === "unzustellbar_erstzahlung" || art === "stufe_a_klaeren") && wahr(t.bestellung_bezahlt_danach)) return ent("bezahlt");
    const nichtsOffen = wahr(t.alle_beendet) && zahlWert(t.offene_raten) === 0;
    if (art === "mara_eskalation" && nichtsOffen) return ent("eskalation_beendet");
    // Reine Zahlungs-/Adressklärungen (Stufe A, unzustellbar) sind mit dem Vertragsende erledigt; alles andere nur ohne Geld im Text.
    const reineKlaerung = art === "stufe_a_klaeren" || art === "unzustellbar_erstzahlung" || art === "unzustellbar_rate";
    if (nichtsOffen && wahr(t.ende_danach) && VERTRAG_ENDE_ARTEN.includes(art) && !heikel && (reineKlaerung || !GELD_WORTE.test(inhalt))) return ent("vertrag_beendet");
    if (t.zustaendig_art === "agent" && wahr(t.erreicht_vom_zustaendigen) && !regel.nurHand && !heikel
      && regel.schliesstBei.includes("ergebnis_erreicht") && !(regel.nurOhneOffenenEntwurf && wahr(t.entwurf_wartet))) return ent("erreicht");
  }
  // Doppel: nie löschen — der Text wandert in den neuesten Auftrag desselben Kunden und derselben Art.
  if (zahlWert(t.doppel_rang) > 1 && t.doppel_ziel && Number(t.doppel_ziel) !== id) return ent("doppel", { ziel: Number(t.doppel_ziel) });
  if (zahlWert(t.titel_rang) > 1 && t.titel_ziel && Number(t.titel_ziel) !== id) return ent("doppel", { ziel: Number(t.titel_ziel) });
  if (wahr(t.zust_gesperrt)) return ent("gesperrt", { root: t.root != null ? Number(t.root) : null });
  return null;
}

/** Ein „Zu tun“-Eintrag (Vermerk). */
export function vermerkBewerten(v: any): HausputzEntscheid | null {
  const id = Number(v.id);
  const beiJustin = wahr(v.fuer_betreiber) || v.zustaendig_agent_id == null;
  const ent = (regel: string, extra: Partial<HausputzEntscheid> = {}): HausputzEntscheid =>
    ({ tabelle: "vermerk", id, regel, aktion: hausputzRegel(regel)!.aktion, beiJustin, ...extra });
  const text = String(v.text || "");
  const erstattung = istErstattung(text);
  const heikel = !!heikelArt(text);
  const alter = zahlWert(v.alter_tage);
  const typ = String(v.typ || "sonstige");
  const nichtsOffen = wahr(v.alle_beendet) && zahlWert(v.offene_raten) === 0;
  // Erstattung: keine Schließ-Regel — außer für die zwei Rückruf-Hinweise, deren Sache NACHWEISLICH offen weiterläuft
  // (ein offener Rückruf dieses Menschen in /agent/rueckrufe; die Rückruf-Regel schließt ihn bei Erstattung nie). Sonst nur Umhängen.
  if (erstattung) {
    if ((typ === "frist_gerissen" || typ === "rueckruf_24h") && wahr(v.rueckruf_offen)) return ent(typ === "frist_gerissen" ? "frist_gerissen" : "rueckruf_doppel");
    return wahr(v.zust_gesperrt) ? ent("gesperrt", { root: v.root != null ? Number(v.root) : null }) : null;
  }
  if (wahr(v.ist_test)) return ent("test");
  // Hinweise, deren Sache woanders weiterlebt (der Rückruf in fiaon_rueckrufe) — auch bei heiklem Anliegen.
  if (typ === "frist_gerissen") return ent("frist_gerissen");
  if (typ === "rueckruf_24h") return ent("rueckruf_doppel");
  if (!erstattung) {
    if (typ === "unterlagen" && (zahlWert(v.unterlagen_ungeprueft) === 0 || nichtsOffen)) return ent("unterlagen_geprueft");
    if (typ === "postmeister_alt" && (!heikel || (wahr(v.kuendigung_danach) && nurKuendigung(text)))) return ent("postmeister_alt");
    if ((typ === "terminseite" && alter > 14) || (typ === "termin_uebernommen" && alter > 7) || (typ === "warnung_termintreue" && alter > 30)) return ent("system_alt");
    if (typ === "nicht_erreicht" && (wahr(v.bezahlt_danach) || nichtsOffen || wahr(v.alle_archiviert))) return ent("nicht_erreicht_alt");
    if (typ === "nicht_erreicht" && alter > STUFE_A_TAGE && /^Zahlung gemeldet/.test(text) && !heikel) return ent("gemeldet_alt");
    if (typ === "haertefall" && zahlWert(v.offene_raten) === 0 && v.root != null) return ent("haertefall");
    if (wahr(v.alle_archiviert) && !heikel && typ !== "website") return ent("archiviert");
    if (wahr(v.kuendigung_danach) && nurKuendigung(text)) return ent("kuendigung_gebucht");
  }
  // Nur System-Einträge (bekannter Typ) werden zusammengeführt — zwei handgeschriebene Aufgaben zu einem Kunden können zwei Dinge sein.
  if (typ !== "sonstige" && zahlWert(v.doppel_rang) > 1 && v.doppel_ziel && Number(v.doppel_ziel) !== id) return ent("doppel", { ziel: Number(v.doppel_ziel) });
  if (wahr(v.zust_gesperrt)) return ent("gesperrt", { root: v.root != null ? Number(v.root) : null });
  return null;
}

/** Ein Rückruf-Wunsch (fiaon_rueckrufe). */
export function rueckrufBewerten(r: any): HausputzEntscheid | null {
  const id = Number(r.id);
  const ent = (regel: string): HausputzEntscheid => ({ tabelle: "rueckruf", id, regel, aktion: "schliessen", beiJustin: r.zustaendig_agent_id == null });
  if (istErstattung(r.anliegen)) return null;
  if (wahr(r.ist_test)) return ent("test");
  if (wahr(r.erreicht_danach) || (wahr(r.alle_beendet) && zahlWert(r.offene_raten) === 0) || wahr(r.alle_archiviert)) return ent("rueckruf_alt");
  return null;
}

export interface HausputzDaten { auftraege: any[]; vermerke: any[]; rueckrufe: any[] }

/**
 * Alle Zeilen bewerten. Zweiter Durchgang: Ein Doppel wird nur in ein Ziel geführt, das OFFEN bleibt — geht das
 * Ziel selbst durch eine Regel zu (z. B. „Kündigung gebucht“), bleibt das Doppel offen, wie es ist. Sonst landete
 * etwa ein Widerruf-Text in einem geschlossenen Auftrag.
 */
export function hausputzBewerten(d: HausputzDaten): HausputzEntscheid[] {
  const roh: HausputzEntscheid[] = [];
  for (const t of d.auftraege) { const e = auftragBewerten(t); if (e) roh.push(e); }
  for (const v of d.vermerke) { const e = vermerkBewerten(v); if (e) roh.push(e); }
  for (const r of d.rueckrufe) { const e = rueckrufBewerten(r); if (e) roh.push(e); }
  const zu = new Set(roh.filter((e) => e.aktion !== "umhaengen").map((e) => `${e.tabelle}:${e.id}`));
  return roh.filter((e) => e.aktion !== "zusammenfuehren" || (e.ziel != null && !zu.has(`${e.tabelle}:${e.ziel}`)));
}

export interface HausputzZahlen {
  vorher: { auftraege: number; vermerke: number; rueckrufe: number; gesamt: number; beiJustin: number };
  nachher: { auftraege: number; vermerke: number; rueckrufe: number; gesamt: number; beiJustin: number };
  jeRegel: { regel: string; label: string; aktion: HausputzAktion; auftraege: number; vermerke: number; rueckrufe: number; beiJustin: number; summe: number }[];
  bleibenHeikel: number;
}

/** Die Zahlen je Regel — „gesamt“ = Aufträge + „Zu tun“ (wie im Audit 2.180); Rückrufe stehen extra. */
export function hausputzZaehlen(d: HausputzDaten, ent: HausputzEntscheid[]): HausputzZahlen {
  const justinA = d.auftraege.filter((t) => t.zustaendig_art !== "agent").length;
  const justinV = d.vermerke.filter((v) => wahr(v.fuer_betreiber) || v.zustaendig_agent_id == null).length;
  const weg = ent.filter((e) => e.aktion !== "umhaengen");
  const wegA = weg.filter((e) => e.tabelle === "auftrag").length;
  const wegV = weg.filter((e) => e.tabelle === "vermerk").length;
  const wegR = weg.filter((e) => e.tabelle === "rueckruf").length;
  const wegJustin = weg.filter((e) => e.beiJustin && e.tabelle !== "rueckruf").length;
  const jeRegel = HAUSPUTZ_REGELN.map((r) => {
    const l = ent.filter((e) => e.regel === r.id);
    return {
      regel: r.id, label: r.label, aktion: r.aktion,
      auftraege: l.filter((e) => e.tabelle === "auftrag").length, vermerke: l.filter((e) => e.tabelle === "vermerk").length,
      rueckrufe: l.filter((e) => e.tabelle === "rueckruf").length, beiJustin: l.filter((e) => e.beiJustin && e.tabelle !== "rueckruf").length, summe: l.length,
    };
  }).filter((x) => x.summe > 0);
  const betroffen = new Set(weg.filter((e) => e.tabelle === "auftrag").map((e) => e.id));
  const bleibenHeikel = d.auftraege.filter((t) => !betroffen.has(Number(t.id)) && (istAuftragArt(t.art) && HEIKLE_ARTEN.includes(t.art))).length;
  return {
    vorher: { auftraege: d.auftraege.length, vermerke: d.vermerke.length, rueckrufe: d.rueckrufe.length, gesamt: d.auftraege.length + d.vermerke.length, beiJustin: justinA + justinV },
    nachher: {
      auftraege: d.auftraege.length - wegA, vermerke: d.vermerke.length - wegV, rueckrufe: d.rueckrufe.length - wegR,
      gesamt: d.auftraege.length + d.vermerke.length - wegA - wegV, beiJustin: justinA + justinV - wegJustin,
    },
    jeRegel, bleibenHeikel,
  };
}
