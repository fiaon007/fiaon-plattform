// ═══════════════════════════════════════════════════════════════════════════
// /business/privatpersonen — DIE STARTSEITE FÜR PRIVATPERSONEN (19.09.2026, E-196)
//
// Justin: „Die Privatperson, die gründet, soll auch die anderen Pakete zur
// Auswahl bekommen — vom Design her wie eine Startseite für Privatpersonen,
// viel hochwertiger und konversionsstärker." Bis heute war die Adresse eine
// Unterseite aus dem Register (shared/fiaon-global-seiten/privat.ts) mit einem
// einzigen Paket. Jetzt ist sie dieselbe Startseite wie /business — Kopf,
// Nachrichtenlage, Weg, alle vier Pakete, Jahresbetreuung, Kalender, Uhren,
// Fragen — mit den Texten für Privatpersonen und dem Auftrag als Privatperson.
// Der Registereintrag bleibt für Kopfdaten, FAQ-Markup und Sitemap zuständig.
// ═══════════════════════════════════════════════════════════════════════════
import { BusinessSeite } from "@/pages/site/business";

export default function BusinessPrivatPage() {
  return <BusinessSeite zielgruppe="privat" />;
}
