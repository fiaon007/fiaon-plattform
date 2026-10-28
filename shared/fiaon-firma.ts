// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAGSPARTNER — FIAON LTD (18.09.2026, E-188)
//
// Name, Sitz und Registernummer standen bisher nur im Server (fiaon-invoice.ts,
// FIAON_ENTITY). Seit die Seite /business den Vertragspartner zeigt — so, wie
// eine Bank oder Kanzlei ihn im Kopf jeder Seite nennt —, braucht ihn auch die
// Oberfläche. Eine Quelle: Rechnung, Vertrag und Seite lesen von hier.
// ═══════════════════════════════════════════════════════════════════════════

export const FIAON_FIRMA = {
  name: "FIAON LTD",
  strasse: "128 City Road",
  ortZeile: "London, EC1V 2NX",
  land: "United Kingdom",
  companyNo: "17318250",
  register: "Companies House (England and Wales)",
  director: "Justin Schwarzott",
  email: "support@fiaon.com",
  // 19.09.2026: Die Support-Nummer stand nur in shared/fiaon-wissen.ts (SUPPORT) — seitdem sie in die
  // Widerrufsbelehrung gehört (Pflichtangabe seit 2022) und die Business-Welt sie zeigt, steht sie hier.
  telefon: "+41 44 244 93 01",
  telefonTel: "+41442449301",
} as const;

// 28.10.2026 (E-454): KI-Suchen verwechselten FIAON mit ähnlich klingenden Namen. Ein Satz, der das klärt —
// für das Schema (disambiguatingDescription) und /llms.txt. Nur die Namen, keine Aussage über diese Anbieter.
const VERWECHSLUNG_NAMEN = { de: "FXON, Fxonet, Fiona (fiona.com) oder FIA Global", en: "FXON, Fxonet, Fiona (fiona.com) or FIA Global" } as const;
const FIRMA_KENNUNG = `${FIAON_FIRMA.name} (London, Companies House ${FIAON_FIRMA.companyNo})`;

/** Der Klärungssatz fürs Schema: wer FIAON ist und mit wem es nicht verwandt ist. `wer` = Subjekt (Standard: FIAON LTD mit Registernummer). */
export function fiaonVerwechslung(sprache: "de" | "en", wer: string = FIRMA_KENNUNG): string {
  return sprache === "en" ? `${wer} — not related to ${VERWECHSLUNG_NAMEN.en}.` : `${wer} — nicht verwandt mit ${VERWECHSLUNG_NAMEN.de}.`;
}

/** Für /llms.txt: „Nicht zu verwechseln mit …“ als ganzer Satz. */
export function fiaonVerwechslungSatz(sprache: "de" | "en"): string {
  return sprache === "en"
    ? `Not to be confused with ${VERWECHSLUNG_NAMEN.en}: ${FIRMA_KENNUNG} is neither related to nor affiliated with them.`
    : `Nicht zu verwechseln mit ${VERWECHSLUNG_NAMEN.de}: Die ${FIRMA_KENNUNG} ist mit ihnen weder verwandt noch verbunden.`;
}
