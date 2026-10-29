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
  { key: "nicht_erreicht", text: "Nicht erreicht", folge: "Das Unternehmen bekommt einmal eine Mail mit dem Link für eine neue Zeit. Bitte heute noch einmal anrufen." },
  { key: "verschoben", text: "Verschoben", folge: "Neue Zeit eintragen — das Unternehmen bekommt die Bestätigung, die Erinnerungen laufen neu." },
];

/** Die Rückfrage vor „Nicht erreicht“ — der Klick schickt eine Kundenmail. */
export const NICHT_ERREICHT_FRAGE = "Nicht erreicht?\n\nDas Unternehmen bekommt EINMAL eine gesiezte Mail „Wir haben Sie nicht erreicht“ mit dem Link für eine neue Zeit. Danach rufst du an.";

/** Warum ein Global-Gespräch nicht zustande kam — die Gründe des X im Kalender, mit der Folge für das Unternehmen. */
export const GLOBAL_GRUENDE: { key: string; label: string; folge: string }[] = [
  { key: "nicht_erschienen", label: "Nicht erreicht", folge: "Einmal eine Mail mit dem Link für eine neue Zeit." },
  { key: "nummer_falsch", label: "Telefonnummer stimmt nicht", folge: "Dieselbe Mail — das Unternehmen sieht die Nummer und antwortet." },
  { key: "abgesagt", label: "Hat abgesagt / passte nicht", folge: "Keine Mail. Die Firma steht heute wieder oben im Firmen-Cockpit." },
  { key: "kein_interesse", label: "Kein Interesse mehr", folge: "Keine Mail. Die Firma steht im Cockpit auf „kein Interesse“." },
];
