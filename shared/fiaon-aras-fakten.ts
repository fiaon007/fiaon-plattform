// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Fakten zum Kunden-Weg, die ARAS am Telefon sagt (EINE Quelle; Go-live E-408, 20.10.2026)
//
// Hier steht nur, was stimmt und was ARAS wörtlich (in ihren Worten, mit gleichem Inhalt) sagen darf. Ändert sich ein Fakt,
// ändert er sich hier — und nur hier. Maras Texte und die Website ändern sich dadurch NICHT von selbst; vorerst liest nur
// ARAS diese Datei (Koordination 20.10.2026 abends).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Kartenversand — Stand: Justin 20.10.2026, DKB-Absprache („mit der DKB verhandelt, das ist neu“): Mit der Aktivierung, also
 * der ersten Monatsrate, ist der Kartenversand dabei; die Karte braucht dann ungefähr 3 bis 5 Werktage. Das ist der Versand
 * — nie ein Kartenrahmen, nie ein Limit (das bleibt sein WUNSCHLIMIT, E-373).
 */
export const KARTENVERSAND = {
  stand: "Justin 20.10.2026, DKB-Absprache",
  werktage: "3 bis 5 Werktage",
  satz: "Mit der Aktivierung — also Ihrer ersten Monatsrate — ist der Kartenversand gleich dabei. Die Karte braucht dann ungefähr 3 bis 5 Werktage, bis sie bei Ihnen ist.",
} as const;

/**
 * Willkommen nach dem unterschriebenen Antrag (Justin 20.10.2026) — was am Kundenkonto stimmt: Er ist FIAON-Kunde, sein
 * Kundenkonto ist eröffnet und freigeschaltet; aktiv wird es mit der ersten Monatsrate (Aktivierung); danach bekommt er
 * automatisch einen festen Betreuer. Nie: „Ihr Antrag ist genehmigt/bewilligt“ (über die Karte entscheidet die Partnerbank).
 */
export const WILLKOMMEN = {
  stand: "Justin 20.10.2026",
  konto: "Sie wurden von uns als Kunde angenommen, und Ihr Kundenkonto wird gerade eröffnet — freigeschaltet sind Sie bei uns im System bereits.",
  aktivierung: "Damit Ihr Kundenkonto startet, fehlt nur noch die Aktivierung, also Ihre erste Monatsrate",
  betreuer: "Sobald Ihre Aktivierung da ist, bekommen Sie automatisch einen festen Betreuer — der bespricht dann alles noch einmal im Detail mit Ihnen.",
  limitSpaeter: "Das lässt sich später erhöhen.",
} as const;
