// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE DREI ERGEBNISSE EINES GESPRÄCHS (29.10.2026, E-458 Nr. 11)
//
// Kalender der Mitarbeiter (client/src/pages/agent/calendar.tsx) und Chefbüro
// › Global-Kunden › Gespräche (ChefGlobalGespraeche.tsx) zeigen dieselben drei
// Knöpfe mit demselben Satz darunter — wer klickt, soll vorher wissen, was das
// Unternehmen bekommt. Die Folgen selbst stehen im Server
// (server/lib/fiaon-global-gespraech.ts, fiaon-global-termin.ts). Team-Texte: du.
// ═══════════════════════════════════════════════════════════════════════════

export type GlobalErgebnisWahl = "stattgefunden" | "nicht_erreicht" | "verschoben";

export const GLOBAL_ERGEBNIS_WAHL: { key: GlobalErgebnisWahl; text: string; folge: string }[] = [
  { key: "stattgefunden", text: "Stattgefunden", folge: "Die Firma steht im Firmen-Cockpit, Wiedervorlage morgen." },
  { key: "nicht_erreicht", text: "Nicht erreicht", folge: "Das Unternehmen bekommt einmal eine Mail mit dem Link für eine neue Zeit — außer du hast es schon persönlich angeschrieben (Haken). Bitte heute noch einmal anrufen." },
  { key: "verschoben", text: "Verschoben", folge: "Neue Zeit eintragen — das Unternehmen bekommt die Bestätigung, die Erinnerungen laufen neu." },
];

// ── E-490 F6 (09.11.2026): „Nicht erreicht“ mit dem Haken „schon persönlich angeschrieben“ ───────────────────────────────
// Vorher fragte ein Bestätigungsfenster nur „Nicht erreicht?“ — die Mail ging immer. Hatte jemand das Unternehmen schon selbst
// angeschrieben (am 09.11. so passiert), bekam es zwei Mails. Jetzt fragt die Seite in einer Zeile, mit dem Haken (Standard
// aus); der Server lässt die Mail dann weg und vermerkt es im Verlauf (globalTerminErgebnis, ohneMail).
/** Der Satz in der Rückfrage vor „Nicht erreicht“ — der Klick schickt (ohne Haken) eine Kundenmail. */
export const NICHT_ERREICHT_SATZ = "Das Unternehmen bekommt EINMAL eine gesiezte Mail „Wir haben Sie nicht erreicht“ mit dem Link für eine neue Zeit. Danach rufst du an.";
/** Der Haken (Standard aus). */
export const OHNE_MAIL_HAKEN = "Kunde schon persönlich angeschrieben — keine Mail";
/** Was der Haken bewirkt. */
export const OHNE_MAIL_HINWEIS = "Dann geht keine automatische Mail raus, und im Verlauf steht, dass das Unternehmen schon persönlich angeschrieben wurde.";

/** Warum ein Global-Gespräch nicht zustande kam — die Gründe des X im Kalender, mit der Folge für das Unternehmen. */
export const GLOBAL_GRUENDE: { key: string; label: string; folge: string }[] = [
  { key: "nicht_erschienen", label: "Nicht erreicht", folge: "Einmal eine Mail mit dem Link für eine neue Zeit — außer mit dem Haken „schon persönlich angeschrieben“." },
  { key: "nummer_falsch", label: "Telefonnummer stimmt nicht", folge: "Dieselbe Mail — das Unternehmen sieht die Nummer und antwortet (außer mit dem Haken „schon persönlich angeschrieben“)." },
  { key: "abgesagt", label: "Hat abgesagt / passte nicht", folge: "Keine Mail. Die Firma steht heute wieder oben im Firmen-Cockpit." },
  { key: "kein_interesse", label: "Kein Interesse mehr", folge: "Keine Mail. Die Firma steht im Cockpit auf „kein Interesse“." },
];
/** E-490 F6: Diese Gründe schicken die Mail „nicht erreicht“ — nur bei ihnen zählt der Haken „schon persönlich angeschrieben“. */
export const GLOBAL_GRUENDE_MIT_MAIL: readonly string[] = ["nicht_erschienen", "nummer_falsch"];
