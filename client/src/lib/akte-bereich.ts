// E-315 (09.10.2026): Aus welchem Bereich kam man? Wer im Office arbeitet und dort einen Akten-Link anklickt, bleibt im
// Office — auch wenn er zusätzlich im Chefbüro angemeldet ist (Florentine, Daniel). Gemerkt je Browser-Tab. Bewusst ein
// eigenes, winziges Modul: App.tsx bindet es ein, ohne Chefbüro-Stile ins Paket der Website zu ziehen.
const SCHLUESSEL = "fiaon_letzter_bereich";

export function bereichMerken(pfad: string): void {
  try {
    if (/^\/agent(\/|$)/.test(pfad)) sessionStorage.setItem(SCHLUESSEL, "office");
    else if (/^\/chef(\/|$)/.test(pfad)) sessionStorage.setItem(SCHLUESSEL, "chef");
  } catch { /* egal */ }
}

export function kommtAusOffice(): boolean {
  try { return sessionStorage.getItem(SCHLUESSEL) === "office"; } catch { return false; }
}
