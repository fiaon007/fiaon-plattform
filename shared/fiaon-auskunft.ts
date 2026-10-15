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
  // E-365 (14.10.2026): Privat ist das Produkt die FIAON-Bonitätsauswertung (E-353) — keine Beschaffung, keine
  // Datenkopie, keine Schreiben mehr. Jeder Satz beschreibt, was im Bericht steht (fiaon-finanzauswertung-pdf.ts).
  const privat = [
    // „Kredit“ steht in VERBOTENE_WORTE der Kaltansprache (shared/fiaon-lead-strecke.ts) — diese Sätze gehen auch an Leads.
    "Ihre Bonität aus Sicht einer Bank: Haushaltsrechnung und die neun Merkmale, auf die eine Bank achtet.",
    "Jede Einnahme und jede Ausgabe im Detail — nach Empfänger, Monat für Monat, mit Ampel für sieben Bereiche und Ihrem FIAON-Finanzwert.",
    "Ihr Potenzial und Ihr Plan: was im Monat und im Jahr frei werden kann, mit Hochrechnung auf zwölf Monate.",
    "Rund 25 Seiten, erstellt von Ihrem FIAON-Team aus Ihren eigenen Kontoauszügen — ein Mensch prüft den Bericht und gibt ihn frei.",
    "Als PDF per E-Mail und jederzeit in Ihrem FIAON-Bereich. Ihre Ansprechperson geht ihn mit Ihnen durch und richtet Ihren Weg zur Karte danach aus.",
  ];
  if (art === "privat") return privat;
  return [
    "Wir fordern die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien an (u. a. Creditreform und CRIF) — in Ihrem Auftrag.",
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
  "Ja, Ihre Datenkopie steht Ihnen bei jeder Auskunftei kostenlos zu — die können Sie jederzeit selbst anfordern. "
  + "Die FIAON-Bonitätsauswertung ist etwas anderes: Wir werten Ihre eigenen Kontoauszüge aus und zeigen Ihnen Ihre Bonität "
  + "aus Sicht einer Bank — mit Haushaltsrechnung, jeder Ausgabe im Detail, Ampel, Finanzwert und Plan. "
  + "Laden Sie Ihre Datenkopie dazu hoch, beziehen wir sie ein."

/**
 * Ein Satz für den Verkauf — Karte und Limit, ohne Zusage (die Bank entscheidet).
 * NUR für zahlende Kunden (Segment „kunde", laufendes Paket). Anträge und Leads
 * lesen AUSKUNFT_NUTZEN_SATZ_KARTE.
 */
export const AUSKUNFT_NUTZEN_SATZ =
  "Mit Ihrer Bonitätsauswertung sehen Sie, was eine Bank sieht, bevor sie entscheidet — und wir richten Ihren Weg zu Karte und Wunschlimit genau danach aus."

/**
 * Derselbe Nutzen ohne „Limit" (25.09.2026, E-241) — für fertige, unbezahlte
 * Anträge und Leads (Segmente „antrag"/„lead", Kaufseite und Kaufkarte ohne
 * bezahltes Paket). „Limit" steht in VERBOTENE_WORTE der Kaltansprache
 * (shared/fiaon-lead-strecke.ts): Werbung mit einer Kreditsumme an Menschen
 * ohne Vertrag wäre Werbung für eine erlaubnispflichtige Leistung (§ 34c GewO).
 */
export const AUSKUNFT_NUTZEN_SATZ_KARTE =
  "Mit Ihrer Bonitätsauswertung sehen Sie, was eine Bank sieht, bevor sie entscheidet — und wir richten Ihren Weg zur Karte genau danach aus."

// ═══════════════════════════════════════════════════════════════════════════
// DER BESCHAFFUNGSAUFTRAG (25.09.2026, E-241)
//
// Justin: „Ich kümmere mich heute um die API, bis dahin kaufen wir sie selbst."
// Befund der Beschaffungs-Prüfer: Die „Vollmacht zur Übermittlung" (Haken der
// Bestellseite bis Fassung 2026-09-25, fiaon-schreiben.ts, /app/unterschrift)
// deckt NUR, die kostenlose Datenkopie nach Art. 15 DSGVO zu übermitteln — sie
// schließt ausdrücklich aus, im Namen des Kunden Verträge zu schließen. Den KAUF
// einer (kostenpflichtigen) Auskunft deckt sie nicht. Dieser Satz tut es — und
// steht wortgleich an jeder Kauftür als Pflicht-Haken: Bestellseite
// (/bonitaet-antrag), Kauflink aus der Mail, Kaufkarte im Kundenbereich und die
// Bestätigungsseite nach der Zahlung (/api/fiaon/auskunft/auftrag/:token).
// „Bei den oben genannten Auskunfteien": Jede dieser Seiten nennt sie darüber
// (je Land — AT und CH lesen nie „SCHUFA").
//
// Wer den Wortlaut ändert, erhöht AUSKUNFT_AUFTRAG_FASSUNG (und auf der
// Bestellseite BESTELL_FASSUNG) — die Fassung steht mit jedem Vermerk im Verlauf.
// ═══════════════════════════════════════════════════════════════════════════

/** Die Fassung des Auftragstextes — steht in jedem Vermerk (AUSKUNFT_BESCHAFFUNG_VERMERK). */
// E-365 (14.10.2026): privat ist der Auftrag die Bonitätsauswertung — neue Fassung (Firmen unverändert).
export const AUSKUNFT_AUFTRAG_FASSUNG = "2026-10-15";

/** Der Wortlaut des Beschaffungsauftrags — Pflicht-Haken an jeder Kauftür. */
export function AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT(art: AuskunftArt): string {
  const kosten = "— auch als kostenpflichtige Auskunft der Auskunftei; deren Kosten sind im Preis enthalten. "
    + "Diesen Auftrag kann ich bis zur Beschaffung jederzeit widerrufen.";
  return art === "firma"
    ? "Ich beauftrage und bevollmächtige FIAON, die Bonitätsauskunft meines Unternehmens bei den Wirtschaftsauskunfteien und, "
      + "sofern ich Inhaberin, Inhaber oder Geschäftsführung bin, meine persönliche Bonitätsauskunft bei den oben genannten "
      + `Auskunfteien anzufordern bzw. zu beschaffen ${kosten}`
    : "Ich beauftrage FIAON, aus meinem Ausweis und meinen Kontoauszügen meine FIAON-Bonitätsauswertung zu erstellen. "
      + "Die Unterlagen lade ich nach der Bestellung hoch; FIAON beginnt, sobald sie vorliegen.";
}

// ── DER DATENKOPIE-WEG (Querprüfung 08.10.2026, 74-€-Rückstand, Entscheidung 4a) ──────────────────────────
// Im Datenkopie-Weg kauft FIAON keine Auskunft: Wir fordern die Datenkopie nach Art. 15 DSGVO im Namen des Kunden an,
// die Auskunftei schickt sie per Post an IHN, er lädt sie hoch, wir werten sie aus. Der allgemeine Haken („auch als
// kostenpflichtige Auskunft; deren Kosten sind im Preis enthalten“) beschrieb dort etwas anderes. Eigener Wortlaut, ohne
// „kostenlos“ und ohne „kostenpflichtig“, mit eigener Textfassung im Vermerk (höchstens 20 Zeichen).
export const AUSKUNFT_DATENKOPIE_FASSUNG = "2026-10-08-dk";
export function AUSKUNFT_DATENKOPIE_AUFTRAG_TEXT(art: AuskunftArt): string {
  const rest = "in meinem Namen anzufordern. Die Auskunfteien schicken sie per Post an mich; ich lade sie in meinem Bereich hoch, "
    + "und FIAON wertet sie für mich aus. Diesen Auftrag kann ich bis zur Anforderung jederzeit widerrufen.";
  return art === "firma"
    ? "Ich beauftrage und bevollmächtige FIAON, die Auskünfte meines Unternehmens bei den Wirtschaftsauskunfteien und, sofern ich "
      + "Inhaberin, Inhaber oder Geschäftsführung bin, meine persönliche Datenkopie nach Art. 15 DSGVO bei den oben genannten Auskunfteien " + rest
    : "Ich beauftrage und bevollmächtige FIAON, meine Datenkopie nach Art. 15 DSGVO bei den oben genannten Auskunfteien " + rest;
}

/**
 * Die Marke im Verlauf der Bestellung (fiaon_contact_log, ref = die Auskunft-
 * Bestellung), an der die Beschaffung den Auftrag erkennt — wie
 * AUSKUNFT_VOLLMACHT_VERMERK (fiaon-auskunft-lieferung.ts). Geschrieben wird er
 * nur über beschaffungsauftragVermerken (server/lib/fiaon-auskunft.ts): Marke,
 * Wortlaut, Fassung, Zeit und Weg in einer Zeile.
 */
export const AUSKUNFT_BESCHAFFUNG_VERMERK = "Beschaffungsauftrag ERTEILT";

// ═══════════════════════════════════════════════════════════════════════════
// DIE FIAON-BONITÄTSAUSWERTUNG — DAS PRODUKT HINTER 74 € / 149 € (E-353, E-365)
//
// Justin 14.10.2026: „er zahlt an uns 74 € und wir ersetzen damit die Bonitätsauswertung“ (E-353) und
// „kläre den GESAMTEN Prozess ab … der gesamte Prozess muss ein geschlossenes System sein“ (E-365).
// Privat verkauft FIAON seitdem den Bericht aus Ausweis und Kontoauszug — keine Datenkopie, keine
// Beschaffung. Jede Kauftür, jede Mail, Mara und der Kundenbereich sagen es mit DIESEN Sätzen.
//
// DIE PREISREGEL (eine Quelle: auskunftPreis + auswertungInklusive in server/lib/fiaon-auskunft.ts):
//   · ohne laufendes Paket 149 €, mit laufendem Paket 74 € — einmalig, kein Abo;
//   · wartet der Kartenlink eines zahlenden Paketkunden auf die Bonität (E-363), ist sie INKLUSIVE:
//     Ein Vertragsschritt (Link zum Kartenantrag, PV-2026-10-14 § 3) darf nie an einer Zusatzzahlung
//     hängen — sonst wäre der Paketpreis nicht der Gesamtpreis (§ 3 PAngV, § 5a UWG).
// WORTWAND: „keine Auskunft einer Auskunftei" bleibt stehen (FINANZWERT_KENNZEICHNUNG); nie „Score
// verbessern", nie Garantie, keine Fristen mit Zahl als Werbung, „Limit" nur an zahlende Kunden.
// ═══════════════════════════════════════════════════════════════════════════

/** So heißt das Produkt überall beim Kunden. */
export const AUSWERTUNG_NAME = "FIAON-Bonitätsauswertung";

/** Die Zeile unter dem Namen. */
export const AUSWERTUNG_UNTERZEILE = "Ihre Bonität aus Sicht einer Bank — aus Ihren eigenen Kontoauszügen.";

/** Was der Kunde dafür tut — an jeder Kauftür, in der Bestätigung und im Bereich. */
export const AUSWERTUNG_UNTERLAGEN_SATZ =
  "Dafür brauchen wir nur Ihren Ausweis und Ihre Kontoauszüge der letzten drei Monate. Nach der Bestellung bekommen Sie einen Link zum Hochladen — ohne Anmeldung.";

/** Die ehrliche Abgrenzung — nie weglassen, wo das Produkt beschrieben wird. */
export const AUSWERTUNG_KEINE_AUSKUNFT_SATZ =
  "Die Bonitätsauswertung ist keine Auskunft einer Auskunftei und kein Score. Ihre kostenlose Datenkopie können Sie jederzeit selbst anfordern — laden Sie sie hoch, beziehen wir sie ein.";

/** Für zahlende Paketkunden, deren Kartenlink auf die Bonität wartet (E-363) — dort wird nichts verkauft. */
export const AUSWERTUNG_INKLUSIVE_SATZ =
  "Ihre FIAON-Bonitätsauswertung ist in Ihrem Paket enthalten — sie ist der Schritt vor dem Link unserer Partnerbank für Ihren Kartenantrag. Laden Sie dafür Ihren Ausweis und Ihre Kontoauszüge hoch.";

/** Der Ablauf in vier Schritten — Kaufseite, Kaufkarte, Bestätigung. */
export const AUSWERTUNG_SCHRITTE: { titel: string; text: string }[] = [
  { titel: "Bestellen", text: "Einmalig, kein Abo." },
  { titel: "Hochladen", text: "Ausweis und Kontoauszüge der letzten drei Monate — per Link, ohne Anmeldung." },
  { titel: "Wir entwickeln", text: "Ihr FIAON-Team wertet jede Buchung aus; ein Mensch prüft den Bericht und gibt ihn frei." },
  { titel: "Sie erhalten", text: "Ihren Bericht als PDF per E-Mail und jederzeit in Ihrem FIAON-Bereich." },
];

/** Der Stand der Auswertung beim Kunden — Kundenbereich, Kaufkarte, Mara (auswertungStand im Server). */
export type AuswertungKundenStand =
  | "liegt_vor"        // freigegeben (oder durch eine neuere ersetzt)
  | "wird_entwickelt"  // Unterlagen da, Entwurf oder Lauf beim Team
  | "unterlagen_fehlen" // bezahlt oder inklusive, Ausweis/Kontoauszug fehlen
  | "beginnt_ab"       // bezahlt, Unterlagen da, Beginn vor Fristablauf nicht verlangt
  | "zahlung_offen"    // bestellt, Zahlung aus oder gemeldet
  | "nicht_bestellt";  // weder bezahlt noch inklusive
