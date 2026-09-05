// Gemeinsame Typen des Kundenbereichs /app — Spiegel der Antwort von
// GET /api/fiaon/kunde/:ref/bereich (fiaon-kunde-bereich.ts) und der /app-Endpunkte.
export interface Etappe { key: string; titel: string; text: string; stand: "fertig" | "jetzt" | "kommt"; datum: string | null; stempel: string | null; href?: string | null }
export interface Rate { nr: number; betragCents: number; faelligAm: string | null; faelligIso: string | null; status: string; bezahltAm: string | null; referenz?: string | null }
export interface Bereich {
  kunde: { ref: string; vorname: string; nachname: string; email: string; telefon: string; strasse: string; plz: string; ort: string; land: string; geburtsdatum: string | null; kundeSeit: string | null };
  paket: { key: string | null; name: string; abo: boolean; rahmen: number | null; wunschlimit: number | null; monatlichCents: number | null; zahlungsstatus: string; zahlungsreferenz: string | null; faelligAm: string | null };
  stufe: { stufe: string | null; text: string | null; naechsterSchritt: string | null; vollAktiv: boolean; bezahlt: boolean };
  bonitaet: { stufe: string; fuerKunden: string; naechsterSchritt: string; bezahlt: boolean; hatDokument: boolean; geprueft: boolean; darfKaufen: boolean; darfHochladen: boolean; preisEuro: number } | null;
  unterlagen: { kontoauszug: boolean; ausweis: boolean; auskunft: boolean; erneutKontoauszug?: boolean; erneutAusweis?: boolean; kycStatus: string; kontoStatus: string; hinweise?: string[] };
  abo: { verlaengerung?: { gefragt: boolean; entschieden: boolean; verlaengert: boolean; beendet: boolean; bezahlteRaten: number }; naechste: { nr: number; betragCents: number; faelligAm: string | null; status: string; referenz: string } | null; offen: number; bezahlt: number; raten: Rate[] };
  termin: { beginn: string; status: string; agent: string | null } | null;
  onboardingGelaufen?: boolean;
  fahrplan: Etappe[];
  naechsterSchritt: { key: string; titel: string; text: string; href: string | null } | null;
  ansprechpartner: { name: string; rolle: string | null; avatar?: string | null } | null;
  lastschrift: { mandat: string | null; status: string | null; aktiv: boolean };
  kontoVerbunden: boolean;
  karte?: { bereit: boolean; esFehlt?: string[]; verschickt?: boolean; tore: { titel: string; erfuellt: boolean; warum: string | null }[] } | null;
  passwortGesetzt?: boolean;
  finanzen?: any;
}
export interface Vorgang { id: number; art: string; artText: string; titel: string; stand: string; standText: string; fristAm: string | null; versandtAm: string | null; empfaenger: string | null; zustaendig: string | null; aktenzeichen?: string | null; eingegangenAm: string | null; aktualisiertAm: string | null; dokumente: number; offen: boolean }
