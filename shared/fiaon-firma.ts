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
} as const;
