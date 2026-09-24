// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSKUNFT ALS PRODUKT — EINE QUELLE (24.09.2026, E-240)
//
// Justin: „Ohne Abo, Einmalzahlung, Auskunft aus allen verfügbaren Dateien im
// jeweiligen Land … mit Handlungsplan … inkl. aufgesetzter Schreiben für
// Löschfristen und co. — ohne ABO 149 €, mit ABO 74 €. Für Unternehmen 349 €
// ohne ABO und 199 € mit ABO."
//
// ── WARUM EINE DATEI ──────────────────────────────────────────────────────
// Der Preis 74 € stand an 139 Stellen in 53 Dateien, die Auskunfteien in zwei
// Listen, die nicht übereinstimmten (Selbstauskunft-Werkzeug ohne CRIF DE,
// Löschantrag ohne CH). Seite, Mail, Mara und Kundenbereich lesen ab jetzt
// hier: Preis, was geliefert wird und bei wem angefragt wird.
//
// ── WAS WIR VERSPRECHEN DÜRFEN (Wortwand, shared/fiaon-wortverbote.ts) ─────
// Erlaubt: anfordern (mit Vollmacht zur Übermittlung), jede Zeile erklären,
// Speicherfristen prüfen, Handlungsplan, fertige Schreiben zur Freigabe.
// Verboten: Garantie, Löschzusage, „Score verbessern", Fristen mit Zahl
// („in 24 h", „am selben Werktag"), „anwaltlich geprüft" ohne LEXR-Beleg.
// Das Recht auf die kostenlose Datenkopie (Art. 15 DSGVO) wird nie verschwiegen
// und nie kleingeredet: Wer fragt, bekommt die ehrliche Antwort — wir nehmen
// ihm Anforderung, Auswertung und Schreiben ab, das ist die Leistung.
// ═══════════════════════════════════════════════════════════════════════════

export type AuskunftArt = "privat" | "firma";
export type AuskunftLand = "DE" | "AT" | "CH";

/**
 * Die vier Preise in Cent. „mitAbo" gilt für jeden Menschen mit einem bezahlten,
 * laufenden Paket (Abo) — die Server-Funktion `auskunftPreis` entscheidet das,
 * nie der Browser.
 */
export const AUSKUNFT_PREISE_CENTS: Record<AuskunftArt, { einzeln: number; mitAbo: number }> = {
  privat: { einzeln: 14900, mitAbo: 7400 },
  firma: { einzeln: 34900, mitAbo: 19900 },
};

/**
 * Die Katalogschlüssel (shared/fiaon-pakete.ts) — sie landen in
 * `fiaon_applications.pack_key` der Auskunft-Zeile. „schufa" bleibt der
 * Privatpreis mit Abo, weil rund 60 Stellen und alle Altbestellungen ihn tragen.
 */
export const AUSKUNFT_SCHLUESSEL: Record<AuskunftArt, { einzeln: string; mitAbo: string }> = {
  privat: { einzeln: "auskunft_privat", mitAbo: "schufa" },
  firma: { einzeln: "auskunft_firma", mitAbo: "auskunft_firma_abo" },
};

export const ALLE_AUSKUNFT_SCHLUESSEL: string[] = [
  AUSKUNFT_SCHLUESSEL.privat.einzeln, AUSKUNFT_SCHLUESSEL.privat.mitAbo,
  AUSKUNFT_SCHLUESSEL.firma.einzeln, AUSKUNFT_SCHLUESSEL.firma.mitAbo,
];

export function istAuskunftSchluessel(key: unknown): boolean {
  return ALLE_AUSKUNFT_SCHLUESSEL.includes(String(key ?? "").trim().toLowerCase());
}

export function auskunftPreisCents(art: AuskunftArt, mitAbo: boolean): number {
  return AUSKUNFT_PREISE_CENTS[art][mitAbo ? "mitAbo" : "einzeln"];
}

export function auskunftSchluessel(art: AuskunftArt, mitAbo: boolean): string {
  return AUSKUNFT_SCHLUESSEL[art][mitAbo ? "mitAbo" : "einzeln"];
}

/** Ein Betrag in Cent als „149 €" / „74 €" / „199,50 €". */
export function euroText(cents: number): string {
  const e = cents / 100;
  return Number.isInteger(e) ? `${e} €` : `${e.toFixed(2).replace(".", ",")} €`;
}

/**
 * Beide Preise nebeneinander — nie als Streichpreis (PAngV § 11: ein
 * „statt 149 €" wäre ein früherer Preis, den es so nie gab).
 */
export function auskunftPreisZeile(art: AuskunftArt): string {
  const p = AUSKUNFT_PREISE_CENTS[art];
  return `${euroText(p.einzeln)} einzeln · ${euroText(p.mitAbo)} für FIAON-Kunden mit Paket`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BEI WEM ANGEFRAGT WIRD — JE LAND
//
// Nur Anschriften, die das Haus schon benutzt (fiaon-bonitaet-schreiben.ts,
// Selbstauskunft-Werkzeug). Weitere Auskunfteien (z. B. infoscore/Experian in
// DE, ZEK/IKO in CH) erst nach geprüfter Anschrift und geprüftem Weg aufnehmen.
// ═══════════════════════════════════════════════════════════════════════════
export interface Auskunftei {
  key: string;
  land: AuskunftLand;
  /** So heißt sie im Text an den Kunden. */
  kurz: string;
  name: string;
  anschrift: [string, string];
  /** Rechtsgrundlage der Datenkopie. */
  recht: string;
}

export const AUSKUNFTEIEN: Auskunftei[] = [
  { key: "schufa", land: "DE", kurz: "SCHUFA", name: "SCHUFA Holding AG", anschrift: ["Kormoranweg 5", "65201 Wiesbaden"], recht: "Art. 15 DSGVO" },
  // Selbstauskünfte nimmt CRIF Deutschland über das „Team Selbstauskunft" in Hamburg an
  // (crif.de, 24.09.2026) — München ist der Firmensitz. Firmen (juristische Personen):
  // archivauskunft.de@crif.com. Creditreform: Eigenauskunft für Unternehmen schriftlich
  // bei der zuständigen Geschäftsstelle (creditreform.de, „Selbstauskunft Unternehmen").
  { key: "crif-de", land: "DE", kurz: "CRIF", name: "CRIF GmbH, Team Selbstauskunft", anschrift: ["Friesenweg 22", "22763 Hamburg"], recht: "Art. 15 DSGVO" },
  { key: "boniversum", land: "DE", kurz: "Creditreform Boniversum", name: "Creditreform Boniversum GmbH", anschrift: ["Hellersbergstraße 11", "41460 Neuss"], recht: "Art. 15 DSGVO" },
  { key: "ksv", land: "AT", kurz: "KSV1870", name: "KSV1870 Information GmbH", anschrift: ["Wagenseilgasse 7", "1120 Wien"], recht: "Art. 15 DSGVO" },
  { key: "crif-at", land: "AT", kurz: "CRIF", name: "CRIF GmbH", anschrift: ["Rothschildplatz 3", "1020 Wien"], recht: "Art. 15 DSGVO" },
  { key: "crif-ch", land: "CH", kurz: "CRIF", name: "CRIF AG", anschrift: ["Hagenholzstrasse 81", "8050 Zürich"], recht: "Art. 25 DSG" },
  { key: "intrum-ch", land: "CH", kurz: "Intrum", name: "Intrum AG", anschrift: ["Eschenstrasse 12", "8603 Schwerzenbach"], recht: "Art. 25 DSG" },
];

/** Das Land der Auskunft aus einem Ländercode — alles außer AT/CH ist Deutschland. */
export function auskunftLand(country: unknown): AuskunftLand {
  const c = String(country ?? "").trim().toUpperCase();
  return c === "AT" || c === "AUT" || c === "ÖSTERREICH" ? "AT" : c === "CH" || c === "CHE" || c === "SCHWEIZ" ? "CH" : "DE";
}

export function auskunfteienFuer(land: AuskunftLand): Auskunftei[] {
  return AUSKUNFTEIEN.filter((a) => a.land === land);
}

/**
 * Die Auskunfteien eines Landes als Satzteil: „SCHUFA, CRIF und Creditreform
 * Boniversum". Österreicher lesen nie „SCHUFA" (am 24.09. bekamen 111 von ihnen
 * die „SCHUFA-Datenkopie" angemahnt).
 */
export function auskunfteienText(land: AuskunftLand): string {
  const n = auskunfteienFuer(land).map((a) => a.kurz);
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} und ${n[n.length - 1]}`;
}

/** Das Wort, das der Kunde kennt: „SCHUFA-Auskunft" (DE), „KSV-Auskunft" (AT), „Bonitätsauskunft" (CH). */
export function auskunftWort(land: AuskunftLand): string {
  return land === "DE" ? "SCHUFA-Auskunft" : land === "AT" ? "KSV-Auskunft" : "Bonitätsauskunft";
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS GELIEFERT WIRD — jeder Satz ist wahr und wortwand-fest
// ═══════════════════════════════════════════════════════════════════════════
export function auskunftLeistung(art: AuskunftArt, land: AuskunftLand): string[] {
  const bei = auskunfteienText(land);
  const privat = [
    `Wir fordern Ihre Datenkopien bei ${bei} an — mit Ihrer Vollmacht zur Übermittlung, Sie müssen keinen Brief schreiben.`,
    "Wir erklären jeden Eintrag in klaren Worten und prüfen, ob Speicherfristen abgelaufen sind.",
    "Ihr persönlicher Handlungsplan: was Sie konkret tun können, in welcher Reihenfolge.",
    "Fertige Schreiben (z. B. Löschung nach Fristablauf, Berichtigung falscher Daten) — Sie geben frei, wir übermitteln.",
    "Ihr Betreuer geht die Auswertung mit Ihnen durch und richtet Ihren Weg zu Karte und Limit danach aus.",
  ];
  if (art === "privat") return privat;
  return [
    "Wir fordern die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien an (u. a. Creditreform und CRIF) — mit Ihrer Vollmacht.",
    `Dazu die persönliche Datenkopie der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei ${bei}.`,
    "Wir erklären jeden Eintrag, prüfen Fristen und falsche oder veraltete Firmendaten.",
    "Ihr Handlungsplan für das Unternehmen: was Sie konkret tun können, in welcher Reihenfolge.",
    "Fertige Schreiben zur Berichtigung und Löschung — Sie geben frei, wir übermitteln.",
  ];
}

/**
 * Die ehrliche Antwort auf „Das kann ich doch kostenlos selbst anfordern?" —
 * für Mara, Betreuer und die FAQ. Wahr, ohne die eigene Leistung zu entwerten.
 */
export const AUSKUNFT_KOSTENLOS_ANTWORT =
  "Ja, die Datenkopie steht Ihnen bei jeder Auskunftei kostenlos zu — das bleibt so. "
  + "Wir nehmen Ihnen die Arbeit ab: Wir fordern sie bei allen Auskunfteien Ihres Landes an, "
  + "erklären jeden Eintrag, prüfen die Fristen und liefern Handlungsplan und fertige Schreiben.";

/** Ein Satz für den Verkauf — Karte und Limit, ohne Zusage (die Bank entscheidet). */
export const AUSKUNFT_NUTZEN_SATZ =
  "Mit Ihrer Auskunft sehen wir, was die Bank sieht — und richten Ihren Weg zu Karte und Wunschlimit genau danach aus.";
