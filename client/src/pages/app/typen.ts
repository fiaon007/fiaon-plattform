// Gemeinsame Typen des Kundenbereichs /app — Spiegel der Antwort von
// GET /api/fiaon/kunde/:ref/bereich (fiaon-kunde-bereich.ts) und der /app-Endpunkte.
import type { AuskunftKauf } from "@/components/kunde/AuskunftKauf";
export interface Etappe { key: string; titel: string; text: string; stand: "fertig" | "jetzt" | "kommt"; datum: string | null; stempel: string | null; href?: string | null }
export interface Rate { nr: number; betragCents: number; faelligAm: string | null; faelligIso: string | null; status: string; bezahltAm: string | null; referenz?: string | null }
export interface Bereich {
  kunde: { ref: string; vorname: string; nachname: string; email: string; telefon: string; strasse: string; plz: string; ort: string; land: string; geburtsdatum: string | null; kundeSeit: string | null };
  paket: { key: string | null; name: string; abo: boolean; rahmen: number | null; wunschlimit: number | null; monatlichCents: number | null; zahlungsstatus: string; zahlungsreferenz: string | null; faelligAm: string | null; jahresvertrag?: boolean };
  stufe: { stufe: string | null; text: string | null; naechsterSchritt: string | null; vollAktiv: boolean; bezahlt: boolean };
  // 24.09.2026 (E-240): `darfKaufen` heißt hier „der Kunde ist bei der Auskunft am Zug"
  // (nichts bestellt, oder Zahlung offen) — so liest es der Weg, Schritt 6. Ob die
  // Kaufkarte steht, sagt `auskunft.darfKaufen`. `preisEuro` ist der Preis für diesen
  // Menschen (74 € mit laufendem Paket, sonst 149 €) statt fest 74.
  bonitaet: { stufe: string; fuerKunden: string; naechsterSchritt: string; bezahlt: boolean; hatDokument: boolean; geprueft: boolean; darfKaufen: boolean; darfHochladen: boolean; preisEuro: number; auskunftStufe?: string | null } | null;
  /** E-240: Stufe, Preis, Leistung, Zahlungsseite der Bonitätsauskunft — null ohne Person. */
  auskunft?: AuskunftKauf | null;
  /** `auskunftKauf` ist derselbe Block wie `auskunft` — der Unterlagen-Schirm bekommt nur `unterlagen`. */
  unterlagen: { kontoauszug: boolean; ausweis: boolean; auskunft: boolean; auskunftKauf?: AuskunftKauf | null; erneutKontoauszug?: boolean; erneutAusweis?: boolean; kycStatus: string; kontoStatus: string; hinweise?: string[] };
  /** 07.09.2026: Kündigung sichtbar — null, solange keine vorliegt. */
  vertrag?: { gekuendigtAm: string | null; endeAm: string | null; letzteRateNr: number | null; beendet: boolean } | null;
  abo: { verlaengerung?: { gefragt: boolean; entschieden: boolean; verlaengert: boolean; beendet: boolean; bezahlteRaten: number }; naechste: { nr: number; betragCents: number; faelligAm: string | null; status: string; referenz: string } | null; offen: number; bezahlt: number; raten: Rate[] };
  termin: { beginn: string; status: string; agent: string | null } | null;
  onboardingGelaufen?: boolean;
  fahrplan: Etappe[];
  naechsterSchritt: { key: string; titel: string; text: string; href: string | null } | null;
  ansprechpartner: { name: string; rolle: string | null; avatar?: string | null } | null;
  kontoVerbunden: boolean;
  karte?: { bereit: boolean; esFehlt?: string[]; verschickt?: boolean; tore: { titel: string; erfuellt: boolean; warum: string | null }[] } | null;
  // Schritt 10 des Weges (06.09.2026): die gemeldete oder vom Kooperations-
  // partner bestätigte Kontoeröffnung aus fiaon_konto_karte. Ohne Meldung null —
  // dann bleibt der Schritt offen, wie bisher.
  konto?: { eroeffnet: boolean; am?: string | null } | null;
  passwortGesetzt?: boolean;
  finanzen?: any;
}
export interface Vorgang { id: number; art: string; artText: string; titel: string; stand: string; standText: string; fristAm: string | null; versandtAm: string | null; empfaenger: string | null; zustaendig: string | null; aktenzeichen?: string | null; eingegangenAm: string | null; aktualisiertAm: string | null; dokumente: number; offen: boolean }
