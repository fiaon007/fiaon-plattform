// ═══════════════════════════════════════════════════════════════════════════
// DIE EREIGNISSE, DIE WIR META MELDEN — EINE QUELLE (22.09.2026, E-210)
//
// Der Pixel im Browser und der Server melden dasselbe Ereignis mit derselben
// Kennung. Meta zählt beide als EINES. Damit die beiden Seiten nie
// auseinanderlaufen, stehen die Namen nur hier — client/src/lib/werbung.ts und
// server/lib/fiaon-meta-capi.ts holen sie sich von hier.
// ═══════════════════════════════════════════════════════════════════════════

/** Die Ereignisse auf der Website (Pixel + Conversions API). */
export const META_EREIGNIS = {
  antragBegonnen: "InitiateCheckout",
  antragFertig: "CompleteRegistration",
  auftrag: "SubmitApplication",
  zahlung: "Purchase",
  termin: "Schedule",
} as const;
export type MetaEreignis = typeof META_EREIGNIS[keyof typeof META_EREIGNIS];

/**
 * Die Stufen eines Leads aus einer Lead-Anzeige. Damit lernt Meta, welche
 * Menschen wirklich zahlen — die Grundlage für Kampagnen auf Conversion-Leads.
 */
export const CRM_EREIGNIS = { antragFertig: "qualified_lead", zahlung: "converted_lead" } as const;
export type CrmEreignis = typeof CRM_EREIGNIS[keyof typeof CRM_EREIGNIS];

/** Wie die Ereignisse bei uns heißen — für jede Anzeige im Haus. */
export const EREIGNIS_TEXT: Record<string, string> = {
  [META_EREIGNIS.antragBegonnen]: "Antrag begonnen",
  [META_EREIGNIS.antragFertig]: "Antrag abgeschickt",
  [META_EREIGNIS.auftrag]: "Auftrag erteilt",
  [META_EREIGNIS.zahlung]: "Zahlung gebucht",
  [META_EREIGNIS.termin]: "Startgespräch gebucht",
  [CRM_EREIGNIS.antragFertig]: "Lead hat den Antrag fertig",
  [CRM_EREIGNIS.zahlung]: "Lead hat bezahlt",
  PageView: "Seite gesehen",
};

/**
 * Die Kennung eines Ereignisses. Browser und Server bilden sie gleich — das
 * ist die ganze Doppel-Erkennung: gleiche Kennung = ein Ereignis.
 */
export function metaEreignisId(name: string, ref: string): string {
  return `${name}.${ref}`.slice(0, 120);
}
