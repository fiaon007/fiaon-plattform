// ═══════════════════════════════════════════════════════════════════════════
// DIE WORTWAND DER MAIL „IHR VORSORGE-ÜBERBLICK“ (E-487 (09.11.2026)) — rein, für den Prüfstand (scripts/pruef-vorsorge.ts)
//
// Eigene Datei, damit der Mail-Motor (server/mail/motor.ts → vorlagen/vorsorge.ts) die große Ton-Regel (shared/fiaon-mara-ton.ts)
// nicht mitladen muss. Geprüft wird alles, was der Kunde liest: Betreff, Vorschauzeile und Text der gerenderten Mail.
// Zur Laufzeit läuft sie bewusst NICHT über jede Mail: Die Vorlage ist fest, und ein Nachname wie „Du“ hielte sonst einen
// Kunden auf — die Wand gehört an den Text, den wir schreiben.
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen } from "@shared/fiaon-wortverbote";
import { BANK_SATZ_MUSTER } from "@shared/fiaon-mara-ton";

/** Jeder Verstoß als Klartext — leer = sauber. */
export function vorsorgeMailWand(text: string): string[] {
  const t = String(text ?? "");
  const funde: string[] = [];
  if (/\bbis zu\b/i.test(t)) funde.push("„bis zu“");
  if (BANK_SATZ_MUSTER.test(t)) funde.push("Bank-Satz");
  if (/finanzierung|\bkredit/i.test(t)) funde.push("Finanzierung oder Kredit");
  if (/\bchance/i.test(t)) funde.push("„Chancen“ (keine Verknüpfung von Absicherung und Finanzierung)");
  if (/absicherung[^.!?]{0,60}\b(erhöh|steiger|verbesser|hilft)/i.test(t)) funde.push("Absicherung als Hebel");
  if (/\bempfehl/i.test(t) || /\bempfiehlt\b(?!\s+keine)/i.test(t)) funde.push("FIAON empfiehlt");
  if (/\bgarantie|\bgarantier/i.test(t)) funde.push("Garantie");
  if (/\bdu\b|\bdein|\bdich\b|\bdir\b/i.test(t)) funde.push("Du-Form");
  for (const w of wandPruefen(t)) if (w.art !== "floskel") funde.push(`Wortwand: ${w.treffer}`);
  return funde;
}
