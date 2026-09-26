// ═══════════════════════════════════════════════════════════════════════════
// NUMMER UNZUSTELLBAR — EINE REGEL (26.09.2026, E-244)
//
// Befund 26.09.2026: 72 Vorlagen von Mara scheiterten mit „Message
// undeliverable" (Meta-Code 131026: kein WhatsApp, veraltete App oder
// Nutzungsbedingungen nicht angenommen) — an nur 39 Nummern, 23 davon mehrfach,
// 10 an drei Tagen hintereinander. Die BASIS der WA-Zentrale zählte gescheiterte
// Vorlagen nicht als „angeschrieben", der Mensch kam am nächsten Tag wieder dran.
//
// Die Regel:
//   · Eine Nummer ist UNZUSTELLBAR, wenn an sie eine Nachricht mit Code 131026
//     bzw. „undeliverable" scheiterte und seitdem weder eine Nachricht von ihr
//     kam noch eine unserer Nachrichten zugestellt oder gelesen wurde. Schreibt
//     der Mensch uns später, ist sie wieder frei.
//   · Code 131049 (Metas Grenze für Werbenachrichten je Empfänger): 7 Tage Pause
//     für diese Nummer, danach wieder frei.
//
// Benutzt von der BASIS der WA-Zentrale (alle Gruppen) und der WhatsApp-Eignung
// des Auskunft-Verkaufstakts (dort geht dann nur die Mail).
//
// Verglichen wird die VOLLE Nummer (Gegenlesen 26.09.2026): die Nummer, an die
// wir heute senden würden (NUMMER_FUER_VERSAND_SQL = nummerFuerVersand mit dem
// Land der Person, shared/fiaon-whatsapp-erlaubnis.ts), gegen die Nummer des
// Fehlversuchs (fiaon_whatsapp.nummer, Ziffern ohne Plus). Die erste Fassung
// verglich die letzten 9 Ziffern — dann sperrte ein Fehlversuch an 49 664 …
// (ein Österreicher, früher mit +49 verschickt) auch die richtige 43 664 …;
// in Produktion sechs Personen. Genauso sperrt ein Fehlversuch an +1 512 …
// (deutsche Handynummer als US-Nummer gelesen) die richtige +49 nicht.
// Fehlertexte in fiaon_whatsapp.fehler seit E-244: „(#<code>) <Titel> — <Details>"
// (waFehlerText). Ältere Zeilen tragen nur den Titel; die Regel liest beides.
// ═══════════════════════════════════════════════════════════════════════════

import { NUMMER_FUER_VERSAND_SQL } from "@shared/fiaon-whatsapp-erlaubnis";

/** Meta: Empfänger nicht erreichbar (kein WhatsApp, alte App, AGB nicht angenommen). */
export const WA_CODE_UNZUSTELLBAR = 131026;
/** Meta: Grenze für Werbenachrichten je Empfänger erreicht. */
export const WA_CODE_MARKETING_GRENZE = 131049;
/** Pause je Nummer nach 131049. */
export const WA_MARKETING_PAUSE_TAGE = 7;

/** „(#131026) Message undeliverable — Unable to deliver …" aus einem Meta-Fehlerobjekt (Status-Webhook). */
export function waFehlerText(fehler: any, ersatz = "abgelehnt"): string {
  const code = Number(fehler?.code);
  const titel = String(fehler?.title ?? fehler?.message ?? "").trim() || ersatz;
  const details = String(fehler?.error_data?.details ?? "").trim();
  const kopf = Number.isFinite(code) && code > 0 ? `(#${code}) ` : "";
  return `${kopf}${titel}${details && details !== titel ? ` — ${details}` : ""}`.slice(0, 300);
}

/** Der Code aus einem gespeicherten Fehlertext — oder null (Altzeilen ohne Code). */
export function waFehlerCode(text: unknown): number | null {
  const m = /^\(#(\d+)\)/.exec(String(text ?? ""));
  return m ? Number(m[1]) : null;
}

/**
 * Die vollen Nummern (Ziffern ohne Plus, wie fiaon_whatsapp.nummer), die heute
 * nicht angeschrieben werden (SQL-Unterabfrage ohne Bezug nach außen — Postgres
 * rechnet sie einmal je Abfrage als Hash-Liste).
 */
export const WA_GESPERRTE_NUMMERN_SQL = `(
  SELECT wu.nummer FROM fiaon_whatsapp wu
   WHERE wu.richtung = 'raus' AND wu.status = 'fehler' AND wu.nummer IS NOT NULL
     AND (wu.fehler LIKE '(#${WA_CODE_UNZUSTELLBAR})%' OR wu.fehler ILIKE '%undeliverable%')
     AND NOT EXISTS (
       SELECT 1 FROM fiaon_whatsapp wl WHERE wl.nummer = wu.nummer
          AND ((wl.richtung = 'rein' AND wl.created_at > wu.created_at)
               OR (wl.richtung = 'raus' AND GREATEST(wl.zugestellt_am, wl.gelesen_am) > wu.created_at)))
  UNION
  SELECT wm.nummer FROM fiaon_whatsapp wm
   WHERE wm.richtung = 'raus' AND wm.status = 'fehler' AND wm.nummer IS NOT NULL
     AND wm.fehler LIKE '(#${WA_CODE_MARKETING_GRENZE})%'
     AND wm.created_at > NOW() - INTERVAL '${WA_MARKETING_PAUSE_TAGE} days'
)`;

/**
 * DER BAUSTEIN: TRUE, wenn die Nummer, an die wir die Person heute schreiben
 * würden (Telefon-Ausdruck + Land-Ausdruck, dieselbe Rechnung wie der Versand),
 * unzustellbar ist oder in der 131049-Pause steht. Leere/ungültige Nummer → FALSE.
 * Der Land-Ausdruck muss derselbe sein, mit dem der Versand rechnet (WA-Zentrale:
 * fiaon_persons.country).
 */
export const WA_NUMMER_UNZUSTELLBAR_SQL = (telefon: string, land: string) =>
  `COALESCE(${NUMMER_FUER_VERSAND_SQL(telefon, land)} IN ${WA_GESPERRTE_NUMMERN_SQL}, FALSE)`;
