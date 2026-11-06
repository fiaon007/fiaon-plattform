// ═══════════════════════════════════════════════════════════════════════════
// DIE BANK-REFERENZ DER BUCHHALTUNG — EINE REGEL FÜR SERVER UND SEITE (E-484, 06.11.2026)
//
// Die Bank-Referenz ist freiwillig (Entscheidung des Inhabers vom 06.11.2026). Ist sie angegeben, gilt:
//   · höchstens 60 Zeichen; erlaubt sind Buchstaben (auch Umlaute), Ziffern, Leerzeichen und die im
//     SEPA-Verkehr üblichen Zeichen . , / _ : + # - ( ) ? ' — eine Referenz aus dem Onlinebanking darf nicht
//     erst nach dem Absenden scheitern, nur weil sie eine Klammer trägt;
//   · „nie zweimal dieselbe Überweisung“ vergleicht nur den KERN: Buchstaben und Ziffern in Großschrift.
//     „AB 1234“, „ab-1234“ und „AB1234“ sind dieselbe Referenz. Der Kern braucht mindestens vier Zeichen.
//
// Der Server speichert den Kern in einer eigenen Spalte mit eindeutigem Index (server/lib/fiaon-buchhaltung.ts);
// die Bestätigungsseite der Buchhaltung prüft mit DERSELBEN Regel schon beim Tippen.
// Die Sätze enthalten bewusst nicht das Wort „ungültig“ — darauf bremst die Route Fehlversuche am Link.
// ═══════════════════════════════════════════════════════════════════════════

export const BANKREF_MIN_KERN = 4;
export const BANKREF_MAX = 60;

const ERLAUBT = /^[A-Za-z0-9ÄÖÜäöüß .,/_:+#()?'-]+$/;

/** Der Vergleichskern: Großschrift, nur Buchstaben und Ziffern. */
export function bankReferenzKern(roh: string): string {
  return String(roh ?? "").toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g, "");
}

export type BankReferenzErgebnis = { ok: true; wert: string | null; kern: string | null } | { ok: false; grund: string };

/** Liest die Eingabe: leer → { wert: null } (erlaubt), sonst gesäubert mit Kern — oder ein Satz, was nicht passt. */
export function bankReferenzPruefen(roh: unknown): BankReferenzErgebnis {
  const s = String(roh ?? "").replace(/\s+/g, " ").trim();
  if (!s) return { ok: true, wert: null, kern: null };
  if (s.length > BANKREF_MAX) {
    return { ok: false, grund: `Die Bank-Referenz hat mehr als ${BANKREF_MAX} Zeichen. Bitte prüfen — oder das Feld leer lassen.` };
  }
  if (!ERLAUBT.test(s)) {
    return { ok: false, grund: "Die Bank-Referenz enthält Zeichen, die wir nicht übernehmen können (erlaubt: Buchstaben, Ziffern, Leerzeichen und . , / _ : + # - ( ) ? '). Bitte prüfen — oder das Feld leer lassen." };
  }
  const kern = bankReferenzKern(s);
  if (kern.length < BANKREF_MIN_KERN) {
    return { ok: false, grund: `Die Bank-Referenz braucht mindestens ${BANKREF_MIN_KERN} Buchstaben oder Ziffern. Bitte prüfen — oder das Feld leer lassen.` };
  }
  return { ok: true, wert: s, kern };
}
