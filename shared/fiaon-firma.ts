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
