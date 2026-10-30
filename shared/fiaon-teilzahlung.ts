// ═══════════════════════════════════════════════════════════════════════════
// TEILZAHLUNGEN — DER SATZ FÜR KUNDEN (E-469, 30.10.2026). Rein: keine Datenbank, kein Netz.
// Datenbank und Wege: server/lib/fiaon-teilzahlung.ts. Gesiezt, ohne Interna (kein Bankbuch, keine Aufgabe).
// ═══════════════════════════════════════════════════════════════════════════

const eur = (c: number) => `${(Math.round(c) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const tagText = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Ein Satz für Mails und Hinweise: „Ihre Teilzahlung über 1.500,00 € ist eingegangen — vielen Dank. Offen sind noch 2.400,00 €, zahlbar bis zum TT.MM.JJJJ.“ */
export function teilzahlungSatz(t: { bezahltCents: number; offenCents: number; zahlungen?: unknown[] }, faelligIso: string | null, sprache: "de" | "en" = "de"): string {
  const n = t.zahlungen?.length ?? 1;
  if (sprache === "en") {
    const e = (c: number) => "€" + (c / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const bis = faelligIso ? new Date(`${faelligIso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }) : null;
    return `${n > 1 ? "Your part payments" : "Your part payment"} of ${e(t.bezahltCents)} ${n > 1 ? "have" : "has"} arrived — thank you. ${e(t.offenCents)} remain${bis ? ` outstanding, payable by ${bis}` : " outstanding"}.`;
  }
  return `${n > 1 ? "Ihre Teilzahlungen" : "Ihre Teilzahlung"} über ${eur(t.bezahltCents)} ${n > 1 ? "sind" : "ist"} eingegangen — vielen Dank. Offen ${t.offenCents === 1 ? "ist" : "sind"} noch ${eur(t.offenCents)}${faelligIso ? `, zahlbar bis zum ${tagText(faelligIso)}` : ""}.`;
}

