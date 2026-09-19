// ═══════════════════════════════════════════════════════════════════════════
// ZWEI WELTEN: PRIVATKUNDEN UND BUSINESS (19.09.2026)
//
// Justin: „Wenn man auf /business ist, muss alles für die Business-Kunden
// ausgelegt sein — Menü, Startseite, Fußzeile. Wenn man aufs Logo klickt, die
// Startseite von Business (bei den Privatkunden auf Privatkunden!). Business-
// Kunden sollen nicht auf die Privatkunden-Seite (mit den Bonitäten und so)."
//
// Der Bereich ergibt sich aus der Adresse — ohne Speicher auf dem Gerät:
//   · alles unter /business und /en/business ist Business,
//   · gemeinsame Seiten (Impressum, Datenschutz, Cookie-Einstellungen, die
//     Zahlungsseite eines Global-Auftrags) zeigen den Business-Rahmen, wenn sie
//     mit ?bereich=business aufgerufen werden — so verlinkt sie die Business-
//     Fußzeile. Ein Geschäftskunde verlässt die Business-Welt nie aus Versehen.
// ═══════════════════════════════════════════════════════════════════════════
import { useLocation, useSearch } from "wouter";

export const BUSINESS_PARAM = "bereich=business";

export function istBusinessBereich(pfad: string, suche = ""): boolean {
  return /^\/(en\/)?business(\/|$)/.test(pfad) || new URLSearchParams(suche).get("bereich") === "business";
}

/** Für Rahmen-Bausteine (Menü, Fußzeile): Liegt die aktuelle Seite im Business-Bereich? */
export function useBusinessBereich(): boolean {
  const [pfad] = useLocation();
  const suche = useSearch();
  // wouter kennt nur den Teil hinter der Basis; beim ersten Zeichnen im Browser gilt die echte Adresse.
  const echt = typeof window !== "undefined" ? window.location : null;
  return istBusinessBereich(echt?.pathname ?? pfad, echt?.search ?? suche);
}

/** Ein Link auf eine gemeinsame Seite, der den Business-Rahmen behält. */
export function mitBereich(href: string): string {
  const [pfad, anker] = href.split("#");
  return `${pfad}${pfad.includes("?") ? "&" : "?"}${BUSINESS_PARAM}${anker ? `#${anker}` : ""}`;
}
