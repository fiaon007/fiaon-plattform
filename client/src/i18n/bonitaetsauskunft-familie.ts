// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft — DIE SEITENFAMILIE DER BONITÄTSAUSKUNFT: TEXTE
// (25.09.2026, E-241)
//
// Justin: „Die Boni-Seite komplett überarbeiten und mehrere Seiten anlegen,
// dass, wenn man auf Bonitätsauskunft geht, alles perfekt ist — wirklich HIGH
// END, der ganze Ablauf, und wir direkt verkaufen können."
//
// ── WAS HIER STEHT ────────────────────────────────────────────────────────
// Die Wörter aller acht Seiten (Übersicht, Deutschland, Österreich, Schweiz,
// Unternehmen, Ablauf, Handlungsplan, Fragen) und der gemeinsamen Bausteine
// (Unternavigation, Bestellkarte, Kaufleiste, Abschluss). Die Fragen stehen in
// bonitaetsauskunft-fragen.ts.
//
// ── WAS NICHT HIER STEHT ──────────────────────────────────────────────────
// Preise, Auskunfteien und die Leistungsliste kommen aus shared/fiaon-auskunft.ts,
// Leistungszeit, Steuersatz und der Unternehmer-Satz aus
// shared/fiaon-auskunft-widerruf.ts — dieselben Sätze wie Bestellseite, Mail und
// Mara. Ein Preiswechsel dort zieht jede Seite hier mit.
//
// ── SEO-TABELLE ───────────────────────────────────────────────────────────
// H1, Einleitung und die H2 der Abschnitte stehen ein zweites Mal in
// shared/fiaon-seo-seiten.ts (Vorab-HTML für Suchmaschinen). Die Tabelle darf
// keine Client-Datei lesen — .pruef/e241-seiten.ts vergleicht beide Fassungen
// Wort für Wort. Wer hier eine Überschrift ändert, zieht die Tabelle nach.
//
// ── WORTWAND (shared/fiaon-wortverbote.ts) ────────────────────────────────
// Keine Zusage, keine Löschzusage, kein „Score verbessern", keine Frist mit
// Zahl als FIAON-Versprechen, kein „anwaltlich geprüft", keine Karten- oder
// Limitzusage. FIAON ist kein Partner der Auskunfteien — nie so wirken lassen,
// keine Logos. Österreich und Schweiz lesen nie „SCHUFA". Das Beispiel eines
// Handlungsplans ist als erfunden gekennzeichnet — kein echter Kunde.
// Die kostenlose Datenkopie wird ehrlich genannt, nie als Hauptweg.
// ═══════════════════════════════════════════════════════════════════════════
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, AUSKUNFT_PREISE_CENTS, auskunfteienText, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { AUSKUNFT_KEIN_WIDERRUF, AUSKUNFT_PREIS_STEUER, auskunftLeistungszeit } from "@shared/fiaon-auskunft-widerruf";

export type BxSeite = "hub" | "schufa" | "oesterreich" | "schweiz" | "unternehmen" | "ablauf" | "handlungsplan" | "fragen";

export const BX_PFAD: Record<BxSeite, string> = {
  hub: "/bonitaetsauskunft",
  schufa: "/bonitaetsauskunft/schufa",
  oesterreich: "/bonitaetsauskunft/oesterreich",
  schweiz: "/bonitaetsauskunft/schweiz",
  unternehmen: "/bonitaetsauskunft/unternehmen",
  ablauf: "/bonitaetsauskunft/ablauf",
  handlungsplan: "/bonitaetsauskunft/handlungsplan",
  fragen: "/bonitaetsauskunft/fragen",
};

/** Die Unternavigation — dieselbe Reihenfolge in Kopfleiste, Seitenleiste und „Weiter". */
export const BX_FAMILIE: { seite: BxSeite; kurz: string; satz: string }[] = [
  { seite: "hub", kurz: "Übersicht", satz: "Leistung, Preis, Beispiel" },
  // Ohne „SCHUFA" — die Zeile steht auch auf den Seiten für Österreich und die Schweiz.
  { seite: "schufa", kurz: "Deutschland", satz: "Drei Auskunfteien, ein Auftrag" },
  { seite: "oesterreich", kurz: "Österreich", satz: "KSV1870 und CRIF" },
  { seite: "schweiz", kurz: "Schweiz", satz: "CRIF und Intrum" },
  { seite: "unternehmen", kurz: "Unternehmen", satz: "Firmendaten und Inhaber" },
  { seite: "ablauf", kurz: "Ablauf", satz: "Was nach der Bestellung passiert" },
  { seite: "handlungsplan", kurz: "Handlungsplan", satz: "Was drinsteht, welche Schreiben" },
  { seite: "fragen", kurz: "Fragen", satz: "Preis, Dauer, Score, Widerruf" },
];

/** Der eine Bestellweg (E-240): /bonitaet-antrag liest ?art= und ?land= vor. */
export function bestellPfad(art: AuskunftArt = "privat", land?: AuskunftLand): string {
  const q: string[] = [];
  if (art === "firma") q.push("art=firma");
  if (land) q.push(`land=${land}`);
  return `/bonitaet-antrag${q.length ? `?${q.join("&")}` : ""}`;
}

const P = AUSKUNFT_PREISE_CENTS;
/** Die vier Preise als Text — nur aus shared/fiaon-auskunft.ts. */
export const BX_PREIS = {
  privat: euroText(P.privat.einzeln),
  privatPaket: euroText(P.privat.mitAbo),
  firma: euroText(P.firma.einzeln),
  firmaPaket: euroText(P.firma.mitAbo),
  // PAngV: neben dem Preis steht, dass die Steuer drin ist — Wortlaut wie AGB § 5 Abs. 1 und Bestellseite.
  steuer: `${AUSKUNFT_PREIS_STEUER}.`,
};
export const bxPreis = (art: AuskunftArt) => (art === "firma"
  ? { einzeln: BX_PREIS.firma, paket: BX_PREIS.firmaPaket }
  : { einzeln: BX_PREIS.privat, paket: BX_PREIS.privatPaket });

export const LAND_NAME: Record<AuskunftLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

// ═══════════════════════════════════════════════════════════════════════════
// GEMEINSAME BAUSTEINE
// ═══════════════════════════════════════════════════════════════════════════
export const BX = {
  familieAria: "Bonitätsauskunft: alle Seiten",
  familieBestellen: "Bestellen",
  weiterTitel: "Weiter in der Bonitätsauskunft",
  zurueck: "Zurück",
  weiter: "Weiter",

  knopfBestellen: "Bonitätsauskunft bestellen",
  knopfBestellenFirma: "Für Ihr Unternehmen bestellen",
  knopfAblauf: "So läuft es ab",
  knopfFragen: "Alle Fragen",
  knopfPlan: "Zum Handlungsplan",

  // ── Die Bestellkarte (die eine Navy-Glas-Fläche der Unterseiten) ──
  karteTag: "Ihre Bonitätsauskunft",
  karteTagFirma: "Bonitätsauskunft für Unternehmen",
  karteEinmal: "einmalig · kein Abo",
  kartePaket: (paket: string) => `${paket} für FIAON-Kunden mit laufendem Paket`,
  karteBei: "Angefragt bei",
  karteFirmaBei: "Firmendaten u. a. bei",
  kartePersoenlich: "Persönliche Datenkopie bei",
  karteAlle: "Angefragt bei den großen Auskunfteien Ihres Landes — Deutschland, Österreich oder Schweiz.",
  karteAlleFirma: "Dazu die persönliche Datenkopie im Land des Firmensitzes.",
  kartePunkte: [
    "Jeder Eintrag in klaren Worten erklärt",
    "Speicherfristen geprüft",
    "Handlungsplan und fertige Schreiben — Sie geben frei",
  ],
  karteAblauf: "So läuft es ab",
  karteSeitenTitel: "Mehr zur Bonitätsauskunft",

  // ── Die Kaufleiste am Handy ──
  leisteWas: "Bonitätsauskunft",
  leisteWasFirma: "Für Unternehmen",
  leistePaket: (paket: string) => `mit Paket ${paket}`,
  leisteKnopf: "Bestellen",

  // ── Der Abschluss jeder Seite ──
  schlussPille: "Einmalig · kein Abo",
  schlussTitel: "Wissen, was die Bank sieht.",
  // Gegenlesen E-241: AUSKUNFT_NUTZEN_SATZ beginnt mit „… sehen wir, was die Bank sieht" — direkt
  // unter diesem Titel stand dieselbe Wendung zweimal. Hier die Leistung in einem Satz.
  schlussSatz: "Ihre Datenkopien von den großen Auskunfteien Ihres Landes, jeder Eintrag erklärt, die Fristen geprüft — und ein Plan mit fertigen Schreiben für das, was Sie jetzt tun können.",
  schlussSatzFirma: "Mit der Auskunft sehen Sie, was Lieferanten, Banken und Kartenanbieter über Ihr Unternehmen lesen — und was Sie daran berichtigen lassen können.",
  schlussPreis: (einzeln: string, paket: string) => `${einzeln} einzeln · ${paket} für FIAON-Kunden mit Paket`,
  schlussFuss: "FIAON ist keine Rechtsberatung, verspricht keine Löschung berechtigter Einträge und ist unabhängig — kein Partner der genannten Auskunfteien. Über Konto, Karte und Rahmen entscheidet immer die Bank.",

  // ── Die Bestellseite /bonitaet-antrag: Kopf der Familie (nur Optik) ──
  antragZurueck: "Bonitätsauskunft: Leistung, Ablauf, Fragen",
  antragWegAria: "Ihr Weg zur Auskunft",
  antragMehr: [
    { href: "/bonitaetsauskunft/fragen", t: "Alle Fragen zur Bonitätsauskunft" },
    { href: "/bonitaetsauskunft/ablauf", t: "Der Ablauf im Detail" },
    { href: "/bonitaetsauskunft/handlungsplan", t: "Was im Handlungsplan steht" },
  ],

  // ── Kleine Zeilen ──
  preisEinmal: "einmalig",
  preisMitPaket: (paket: string) => `${paket} für FIAON-Kunden mit laufendem Paket`,
  weiterlesen: "Weiterlesen",
  stand: "Stand September 2026 — keine Rechtsberatung im Einzelfall.",
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE ÜBERSICHT /bonitaetsauskunft
// ═══════════════════════════════════════════════════════════════════════════
export const BX_HUB = {
  pille: "Bonitätsauskunft · DE · AT · CH",
  h1a: "Ihre Bonitätsauskunft —",
  h1b: "erklärt, mit Handlungsplan.",
  lead: "Wir fordern Ihre Datenkopien bei den großen Auskunfteien Ihres Landes an, erklären jeden Eintrag, prüfen die Speicherfristen und legen Ihnen Handlungsplan und fertige Schreiben bereit. Sie geben frei, wir übermitteln.",
  fakten: ["Die großen Auskunfteien Ihres Landes", "Eigenauskunft — keine Kreditanfrage", "Einmalig, kein Abo"],

  // Die Mappe im Kopf: zeigt den AUFBAU der Lieferung, keine Daten.
  mappeAria: "Darstellung: So ist Ihre Bonitätsauskunft aufgebaut — Datenkopien, Erklärung je Eintrag, Handlungsplan",
  mappeBlaetter: [
    // Gegenlesen E-241: Von den hinteren Blättern sind nur rund 110 px sichtbar — kurze Titel,
    // sonst schneidet das vordere Blatt mitten im Wort ab.
    { tag: "Datenkopien", titel: "je Auskunftei" },
    { tag: "Erklärung", titel: "je Eintrag" },
    { tag: "Handlungsplan", titel: "Ihr nächster Schritt, in Reihenfolge" },
  ],
  mappePlan: [
    { ton: "gruen", t: "Positivmerkmal" },
    { ton: "gelb", t: "Frist abgelaufen · Schreiben bereit" },
    { ton: "blau", t: "Berichtigung · Schreiben bereit" },
    { ton: "grau", t: "berechtigt · bleibt bis Fristende" },
  ],
  mappeUnter: "Darstellung des Aufbaus",
  tafelTag: "Ihre Bonitätsauskunft",
  tafelLandAria: "Land wählen",

  // 01 — Was Sie bekommen
  bekommenMarke: "Was Sie bekommen",
  bekommenTitel: "Was Sie bekommen",
  bekommenText: `Angefragt wird bei den großen Auskunfteien Ihres Landes — in Deutschland bei ${auskunfteienText("DE")}, in Österreich bei ${auskunfteienText("AT")}, in der Schweiz bei ${auskunfteienText("CH")}.`,
  artAria: "Für wen",
  arten: { privat: "Für mich privat", firma: "Für mein Unternehmen" } as Record<AuskunftArt, string>,

  // 02 — Für wen
  werTitel: "Für wen",
  werText: "Für Privatpersonen in Deutschland, Österreich und der Schweiz — und für Unternehmen, mit einer eigenen Variante für die Firmendaten.",
  werZeilen: [
    { seite: "schufa" as BxSeite, name: "Deutschland", bei: `${auskunfteienText("DE")}`, art: "privat" as AuskunftArt },
    { seite: "oesterreich" as BxSeite, name: "Österreich", bei: `${auskunfteienText("AT")}`, art: "privat" as AuskunftArt },
    { seite: "schweiz" as BxSeite, name: "Schweiz", bei: `${auskunfteienText("CH")}`, art: "privat" as AuskunftArt },
    { seite: "unternehmen" as BxSeite, name: "Unternehmen", bei: "Firmendaten u. a. bei Creditreform und CRIF, dazu die persönliche Datenkopie der Inhaber", art: "firma" as AuskunftArt },
  ],

  // 03 — Ablauf
  ablaufTitel: "Der Ablauf in vier Schritten",
  ablaufText: "Bestellen, bezahlen — dann arbeiten wir. Handlungsplan und Schreiben finden Sie in Ihrem Kundenbereich.",
  ablaufMehr: "Der Ablauf im Detail",

  // 04 — Beispiel
  beispielTitel: "So sieht ein Handlungsplan aus",
  beispielText: "Ein Beispiel mit erfundenen Daten: jeder Eintrag eingeordnet, der nächste Schritt benannt, das passende Schreiben bereit zur Freigabe.",
  beispielMehr: "Was im Handlungsplan steht",

  // 05 — Kostenlos oder von uns
  kostenlosTitel: "Kostenlos selbst anfordern — oder von uns?",
  kostenlosZitat: AUSKUNFT_KOSTENLOS_ANTWORT,
  selbstTitel: "Selbst anfordern",
  selbstPreis: "0 €",
  selbstZeilen: [
    "Sie schreiben jede Auskunftei einzeln an.",
    "Sie erhalten Rohdaten mit Fachbegriffen und Abkürzungen.",
    "Fristen prüfen und Schreiben aufsetzen Sie selbst.",
  ],
  selbstLink: "Das kostenlose Anschreiben dafür",
  fiaonTitel: "Von FIAON anfordern lassen",
  fiaonZeilen: [
    "Wir fordern bei den großen Auskunfteien Ihres Landes an — in Ihrem Auftrag.",
    "Jeder Eintrag in klaren Worten erklärt, die Speicherfristen geprüft.",
    "Handlungsplan und fertige Schreiben — Sie geben frei, wir übermitteln.",
  ],

  // 06 — Fragen
  fragenTitel: "Häufige Fragen",
  fragenMehr: "Alle Fragen zur Bonitätsauskunft",

  // Zwischenruf
  bandSatz: "Bestellen dauert wenige Minuten. Danach arbeiten wir.",
};

/** Die vier Schritte — Übersicht, Ablauf-Seite und Bestellseite sprechen gleich. */
export const BX_SCHRITTE: { kurz: string; titel: string; wann: string; text: string }[] = [
  { kurz: "Bestellen", titel: "Bestellen", wann: "wenige Minuten", text: "Ihre Angaben und Ihr Auftrag — mehr braucht es nicht." },
  { kurz: "Bezahlen", titel: "Bezahlen", wann: "direkt danach", text: "Per Überweisung, einmalig. Ihre Zahlungsseite öffnet sich gleich nach der Bestellung." },
  { kurz: "Wir fordern an", titel: "Wir fordern an", wann: "nach Zahlungseingang", text: "Wir übermitteln Ihre Anfragen an die großen Auskunfteien Ihres Landes. Sie müssen nichts schreiben." },
  { kurz: "Auswertung", titel: "Auswertung und Plan", wann: "sobald die Antworten da sind", text: "Jeder Eintrag erklärt, Fristen geprüft, Handlungsplan und fertige Schreiben in Ihrem Kundenbereich." },
];

// ═══════════════════════════════════════════════════════════════════════════
// DAS BEISPIEL EINES HANDLUNGSPLANS — ERFUNDEN, SO GEKENNZEICHNET
// Keine Person, kein Eintrag hier ist echt. Die Einordnungen folgen dem
// Hauswissen (Academy Kapitel 6: Löschung nach Fristablauf, Berichtigung).
// ═══════════════════════════════════════════════════════════════════════════
export const BX_BEISPIEL = {
  kopf: "FIAON · Handlungsplan",
  fuer: "Beispielperson · Deutschland",
  stempel: "Beispiel mit erfundenen Daten",
  spalten: ["Eintrag", "Einordnung", "Nächster Schritt"],
  zeilen: [
    { stelle: "SCHUFA", eintrag: "Girokonto, geführt seit 2016", einordnung: "Positivmerkmal", ton: "gruen", schritt: "Nichts zu tun." },
    { stelle: "SCHUFA", eintrag: "Forderung Versandhandel, 380 €, erledigt am 12.03.2022", einordnung: "Speicherfrist abgelaufen", ton: "gelb", schritt: "Schreiben „Löschung nach Fristablauf“ liegt bereit — Ihre Freigabe genügt." },
    { stelle: "CRIF", eintrag: "Anschrift aus dem Jahr 2019", einordnung: "veraltet", ton: "blau", schritt: "Schreiben „Berichtigung“ mit Ihrer aktuellen Anschrift liegt bereit." },
    { stelle: "Creditreform Boniversum", eintrag: "Forderung Mobilfunk, 214 €, offen", einordnung: "berechtigt gemeldet", ton: "grau", schritt: "Begleichen oder Ratenzahlung vereinbaren. Der Eintrag bleibt bis zum Ende seiner Frist." },
  ],
  planTitel: "Ihre Reihenfolge",
  plan: [
    "Berichtigung der Anschrift freigeben — damit die Auskunfteien Sie sicher zuordnen.",
    "Löschung nach Fristablauf freigeben.",
    "Die offene Forderung klären: begleichen oder Ratenzahlung vereinbaren.",
    "Mit Ihrem Betreuer den Weg zu Konto und Karte danach ausrichten.",
  ],
  fuss: "Beispielperson und alle Einträge sind erfunden. Keine Rechtsberatung, keine Löschzusage — ob gelöscht wird, entscheidet die Auskunftei.",
  aria: "Beispiel eines Handlungsplans mit erfundenen Daten: vier Einträge mit Einordnung und nächstem Schritt",
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE LÄNDERSEITEN
// ═══════════════════════════════════════════════════════════════════════════
export interface BxLandTexte {
  seite: BxSeite;
  land: AuskunftLand;
  bild: string;
  krume: string;
  pille: string;
  h1a: string;
  h1b: string;
  lead: string;
  beiTitel: string;
  beiText: string;
  bekommenTitel: string;
  bekommenText: string;
  bandSatz: string;
  /** Ein dritter, landeseigener Abschnitt. */
  eigenMarke: string;
  eigenTitel: string;
  eigenText: string;
  eigenPunkte?: string[];
  fragenTitel: string;
  weiter: { href: string; t: string }[];
}

export const BX_LAENDER: Record<"DE" | "AT" | "CH", BxLandTexte> = {
  DE: {
    seite: "schufa", land: "DE", bild: "/kino/datenraum.jpg", krume: "Deutschland",
    pille: "Bonitätsauskunft · Deutschland",
    h1a: "SCHUFA-Auskunft mit Handlungsplan —",
    h1b: "dazu CRIF und Creditreform Boniversum.",
    lead: "In Deutschland fragen wir bei den drei Auskunfteien an, deren Wege wir geprüft haben: SCHUFA, CRIF und Creditreform Boniversum. Jede Datenkopie erklärt, die Speicherfristen geprüft, dazu Ihr Handlungsplan mit fertigen Schreiben.",
    beiTitel: "Bei wem wir anfragen",
    beiText: "Drei Auskunfteien, ein Auftrag. Jede Datenkopie verlangen wir nach Art. 15 DSGVO — in Ihrem Auftrag. Sie müssen keinen Brief schreiben.",
    bekommenTitel: "Was Sie bekommen",
    // Gegenlesen E-241: „wie auf der Bestellseite, Satz für Satz" sprach zum Team, nicht zum Kunden.
    bekommenText: "Ein Auftrag, ein Preis — für alle drei Auskunfteien zusammen.",
    bandSatz: "Bestellen dauert wenige Minuten — danach fragen wir bei allen drei für Sie an.",
    eigenMarke: "Einordnung",
    eigenTitel: "Warum nicht nur die SCHUFA?",
    eigenText: "Händler, Vermieter, Mobilfunkanbieter und Banken arbeiten mit unterschiedlichen Auskunfteien. Ein Eintrag kann bei einer Auskunftei stehen und bei der anderen fehlen — oder dort anders gemeldet sein. Wer nur eine Datenkopie liest, sieht nur einen Ausschnitt.",
    eigenPunkte: [
      "Die Auskunft ist kein Bonitätszertifikat zum Vorzeigen beim Vermieter — sie ist die vollständige Datenkopie für Sie.",
      "Sie ist keine Kreditanfrage: Nach Angaben der Auskunfteien fließt die Eigenauskunft nicht in Ihre Bewertung ein.",
      "Sie ist keine Löschzusage: Ob ein Eintrag gelöscht wird, entscheidet die Auskunftei.",
    ],
    fragenTitel: "Fragen zur Auskunft in Deutschland",
    weiter: [
      { href: "/schufa-score-verstehen", t: "Was der SCHUFA-Score bedeutet" },
      { href: "/ratgeber/schufa-selbstauskunft-lesen", t: "SCHUFA-Selbstauskunft lesen" },
      { href: "/ratgeber/schufa-loeschfristen-uebersicht", t: "SCHUFA-Löschfristen im Überblick" },
      { href: "/schufa-eintrag-loeschen", t: "SCHUFA-Eintrag löschen lassen" },
      { href: "/auskunfteien", t: "Die Auskunfteien im Vergleich" },
    ],
  },
  AT: {
    seite: "oesterreich", land: "AT", bild: "/kino/wien.jpg", krume: "Österreich",
    pille: "Bonitätsauskunft · Österreich",
    h1a: "KSV-Auskunft und CRIF —",
    h1b: "für Österreich, mit Handlungsplan.",
    lead: "In Österreich fragen wir bei KSV1870 und CRIF an. Beide Datenkopien erklärt, die Speicherfristen geprüft, dazu Ihr Handlungsplan mit fertigen Schreiben — zum selben Preis wie überall.",
    beiTitel: "Bei wem wir anfragen",
    beiText: "KSV1870 und CRIF, beide in Wien. Die Datenkopie verlangen wir nach Art. 15 DSGVO, die in Österreich unmittelbar gilt — in Ihrem Auftrag.",
    bekommenTitel: "Was Sie bekommen",
    bekommenText: "Ein Auftrag, ein Preis — für KSV1870 und CRIF zusammen.",
    bandSatz: "Bestellen dauert wenige Minuten — danach fragen wir bei KSV1870 und CRIF für Sie an.",
    eigenMarke: "Preis",
    eigenTitel: "Derselbe Preis, derselbe Weg",
    eigenText: "Die Auskunft kostet in Österreich dasselbe wie in Deutschland und der Schweiz: einmalig, kein Abo, per Überweisung. Bestellen Sie mit Wohnsitz in Österreich, fragen wir bei KSV1870 und CRIF an.",
    fragenTitel: "Fragen zur Auskunft in Österreich",
    weiter: [
      { href: "/ratgeber/ksv-auskunft-oesterreich", t: "KSV-Auskunft in Österreich" },
      { href: "/ratgeber/bonitaet-in-oesterreich-grundlagen", t: "Bonität in Österreich: KSV1870 und CRIF" },
      { href: "/ratgeber/ksv-eintrag-loeschen", t: "KSV-Eintrag löschen lassen" },
      { href: "/oesterreich", t: "FIAON in Österreich" },
      { href: "/auskunfteien", t: "Die Auskunfteien im Vergleich" },
    ],
  },
  CH: {
    seite: "schweiz", land: "CH", bild: "/kino/zuerich.jpg", krume: "Schweiz",
    pille: "Bonitätsauskunft · Schweiz",
    h1a: "Bonitätsauskunft Schweiz —",
    h1b: "CRIF und Intrum, mit Handlungsplan.",
    lead: "In der Schweiz fragen wir bei CRIF und Intrum an — nach Art. 25 DSG, dem Auskunftsrecht des revidierten Datenschutzgesetzes. Beide Auskünfte erklärt, die Einträge geprüft, dazu Ihr Handlungsplan mit fertigen Schreiben.",
    beiTitel: "Bei wem wir anfragen",
    beiText: "CRIF in Zürich und Intrum in Schwerzenbach, jeweils nach Art. 25 DSG — in Ihrem Auftrag.",
    bekommenTitel: "Was Sie bekommen",
    bekommenText: "Ein Auftrag, ein Preis — für CRIF und Intrum zusammen.",
    bandSatz: "Bestellen dauert wenige Minuten — danach fragen wir bei CRIF und Intrum für Sie an.",
    eigenMarke: "Grenzen und Preis",
    eigenTitel: "Was nicht dazugehört — und der Preis",
    eigenText: "Den Betreibungsregisterauszug stellt das Betreibungsamt Ihres Wohnorts aus; er ist ein amtliches Dokument und nicht Teil dieser Auskunft. ZEK und IKO fragen wir derzeit nicht an.",
    eigenPunkte: [
      "Der Preis gilt in Euro — einmalig, per Überweisung, wie in Deutschland und Österreich.",
      // Gegenlesen E-241: „in der Regel" — Art. 25 Abs. 6 DSG mit Art. 19 DSV erlaubt in Ausnahmen ein Entgelt.
      "Die Auskunft nach Art. 25 DSG ist in der Regel kostenlos; wir nehmen Ihnen Anforderung, Erklärung und Schreiben ab.",
    ],
    fragenTitel: "Fragen zur Auskunft in der Schweiz",
    weiter: [
      { href: "/ratgeber/bonitaet-in-der-schweiz-grundlagen", t: "Bonität in der Schweiz: die Grundlagen" },
      { href: "/ratgeber/crif-auszug-schweiz", t: "CRIF-Auszug in der Schweiz" },
      { href: "/schweiz", t: "FIAON in der Schweiz" },
      { href: "/auskunfteien", t: "Die Auskunfteien im Vergleich" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UNTERNEHMEN
// ═══════════════════════════════════════════════════════════════════════════
export const BX_FIRMA = {
  bild: "/kino/business.jpg", krume: "Unternehmen",
  pille: "Bonitätsauskunft · Unternehmen",
  h1a: "Bonitätsauskunft für Unternehmen —",
  h1b: "was Wirtschaftsauskunfteien über Ihre Firma speichern.",
  lead: "Wir fordern die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien an — u. a. Creditreform und CRIF — und dazu die persönliche Datenkopie der Inhaberin, des Inhabers oder der Geschäftsführung. Jeder Eintrag erklärt, Fristen und veraltete Firmendaten geprüft, dazu Handlungsplan und fertige Schreiben.",
  bekommenTitel: "Was Sie bekommen",
  bekommenText: "Die Firmenvariante: Wirtschaftsauskunfteien für das Unternehmen, dazu die persönliche Datenkopie im Land des Firmensitzes.",
  landAria: "Sitz des Unternehmens",
  werTitel: "Für wen",
  werText: "Bestellen darf, wer das Unternehmen vertreten kann — Inhaberin, Inhaber, Geschäftsführung oder eine berechtigte Person. Bei der Bestellung wählen Sie die Rechtsform:",
  rechtsformen: {
    DE: "Einzelunternehmen, e.K., GbR, UG (haftungsbeschränkt), GmbH, GmbH & Co. KG, KG, OHG, AG und freie Berufe",
    AT: "Einzelunternehmen, e.U., OG, KG, GmbH, FlexCo und AG",
    CH: "Einzelunternehmen, Kollektivgesellschaft, GmbH und AG",
  } as Record<AuskunftLand, string>,
  dauerTitel: "Wie lange es dauert",
  dauerText: auskunftLeistungszeit("firma"),
  widerrufTitel: "Kein Widerrufsrecht für Unternehmen",
  widerrufText: `${AUSKUNFT_KEIN_WIDERRUF} Bei der Bestellung bestätigen Sie, dass Sie für das Unternehmen zu gewerblichen Zwecken bestellen und es vertreten dürfen.`,
  bandSatz: "Bestellen dauert wenige Minuten — Firmendaten und Ihre persönliche Datenkopie in einem Auftrag.",
  fragenTitel: "Fragen zur Auskunft für Unternehmen",
  weiter: [
    { href: "/ratgeber/bonitaet-und-selbststaendigkeit", t: "Was Auskunfteien über Unternehmer speichern" },
    { href: "/ratgeber/rechtsform-und-bonitaet-ug-gmbh-einzelunternehmen", t: "Rechtsform und Bonität" },
    { href: "/ratgeber/unternehmensbonitaet-oesterreich-schweiz", t: "Unternehmensbonität in Österreich und der Schweiz" },
    { href: "/ratgeber/firmenkreditkarte-abgelehnt-was-banken-pruefen", t: "Firmenkreditkarte abgelehnt: was geprüft wurde" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// ABLAUF
// ═══════════════════════════════════════════════════════════════════════════
export const BX_ABLAUF = {
  bild: "/kino/cockpit.jpg", krume: "Ablauf",
  pille: "Bonitätsauskunft · Ablauf",
  h1a: "Was nach der Bestellung passiert —",
  h1b: "Schritt für Schritt.",
  lead: "Vom Klick auf „Zahlungspflichtig bestellen“ bis zu Handlungsplan und Schreiben in Ihrem Kundenbereich: was wann passiert, wovon es abhängt — und wo Sie gefragt sind.",
  schritte: [
    { titel: "Schritt 1 · Bestellen", text: "Wenige Minuten: Name, Anschrift, Geburtsdatum, E-Mail und Telefon. Mit Ihrem Auftrag dürfen wir Ihr Auskunftsverlangen an die Auskunfteien übermitteln, den Stand erfragen und die Antworten für Sie entgegennehmen. Eigene Erklärungen in Ihrem Namen geben wir nicht ab; die Vollmacht gilt zwölf Monate und ist jederzeit widerruflich." },
    { titel: "Schritt 2 · Bezahlen", text: "Direkt nach der Bestellung öffnet sich Ihre Zahlungsseite mit Bankverbindung, Verwendungszweck und Betrag. Sie zahlen per Überweisung, einmalig, kein Abo. Die Rechnung und die Bestätigung Ihres Vertrags mit Widerrufsbelehrung kommen per E-Mail." },
    { titel: "Schritt 3 · Wir fordern an", text: "Sobald Ihre Zahlung eingegangen ist, übermitteln wir Ihre Anfragen an die großen Auskunfteien Ihres Landes. Verlangt eine Auskunftei zusätzlich einen Identitätsnachweis, sagen wir Ihnen Bescheid." },
    { titel: "Schritt 4 · Auswertung, Handlungsplan, Schreiben", text: "Sobald die Antworten vorliegen, erklären wir jeden Eintrag, prüfen die Speicherfristen und legen Handlungsplan und fertige Schreiben in Ihren Kundenbereich. Sie geben jedes Schreiben frei, wir übermitteln es." },
  ],
  dauerTitel: "Wie lange es realistisch dauert",
  dauerText: `Es hängt an zwei Dingen, die niemand ganz in der Hand hat: wann Ihre Überweisung eingeht und wann die Auskunfteien antworten. ${auskunftLeistungszeit("privat")} Einen festen Tag sagen wir deshalb nicht zu — den Stand Ihrer Anfragen sehen Sie in Ihrem Kundenbereich.`,
  widerrufTitel: "Ihr Widerrufsrecht, verständlich",
  widerrufText: "Als Verbraucherin oder Verbraucher können Sie den Vertrag vierzehn Tage lang ohne Angabe von Gründen widerrufen.",
  widerrufPunkte: [
    "Damit wir nicht erst nach Ablauf dieser Frist anfragen, verlangen Sie auf unserer Bestellseite ausdrücklich, dass wir vorher beginnen.",
    "Widerrufen Sie danach, zahlen Sie nur den Anteil der bis dahin erbrachten Leistung.",
    "Ist die Leistung vollständig erbracht, erlischt das Widerrufsrecht.",
    "Die vollständige Belehrung sehen Sie auf der Bestellseite vor dem Klick, und Sie erhalten sie mit der Vertragsbestätigung per E-Mail.",
    "Für Unternehmen gilt kein gesetzliches Widerrufsrecht.",
  ],
  widerrufLink: "Widerrufsbelehrung lesen",
  fragenTitel: "Fragen zum Ablauf",
  weiter: [
    { href: "/ratgeber/schufa-auskunft-kostenlos-datenkopie", t: "Die Datenkopie nach Art. 15 DSGVO, Schritt für Schritt" },
    { href: "/ratgeber/schufa-datenkopie-wie-oft", t: "Wie oft darf ich die Datenkopie anfordern?" },
    { href: "/selbstauskunft-checkliste", t: "Selbstauskunft richtig lesen" },
    { href: "/widerrufsbelehrung", t: "Widerrufsbelehrung" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HANDLUNGSPLAN
// ═══════════════════════════════════════════════════════════════════════════
export const BX_PLAN = {
  bild: "/kino/akten.jpg", krume: "Handlungsplan",
  pille: "Bonitätsauskunft · Handlungsplan",
  h1a: "Der Handlungsplan —",
  h1b: "was drinsteht und was Sie damit tun.",
  lead: "Eine Datenkopie sagt, was gespeichert ist. Der Handlungsplan sagt, was Sie jetzt tun können — Eintrag für Eintrag, in einer klaren Reihenfolge, mit den fertigen Schreiben dazu.",
  inhaltTitel: "Was im Handlungsplan steht",
  inhaltText: "Fünf Teile, in derselben Ordnung für jede Auskunftei.",
  inhaltPunkte: [
    "Jeder Eintrag in klaren Worten: wer ihn gemeldet hat, seit wann, mit welchem Stand.",
    "Die Einordnung: Positivmerkmal, berechtigt gemeldet, Frist abgelaufen oder inhaltlich falsch.",
    "Die Speicherfrist jedes Eintrags — mit ihrer Grundlage.",
    "Die Reihenfolge: was zuerst, was danach, was von selbst endet.",
    "Die passenden Schreiben — fertig zur Freigabe.",
  ],
  schreibenTitel: "Die Schreiben",
  schreibenText: "Jedes Schreiben ist auf Ihren Eintrag zugeschnitten, gestützt auf die DSGVO (in der Schweiz auf das DSG). Sie geben frei, wir übermitteln — kein Schreiben geht ohne Ihre Freigabe hinaus.",
  schreiben: [
    { titel: "Löschung nach Fristablauf", grund: "Art. 17 DSGVO", wann: "Die Speicherfrist eines erledigten Eintrags ist abgelaufen — und er steht trotzdem noch in Ihrer Datenkopie." },
    { titel: "Berichtigung falscher Daten", grund: "Art. 16 DSGVO", wann: "Betrag, Datum, Anschrift oder die Person stimmen nicht — etwa eine alte Anschrift oder eine Verwechslung." },
    { titel: "Erledigung nachtragen", grund: "Art. 16 DSGVO", wann: "Sie haben bezahlt, der Eintrag steht aber noch als offen in der Datenkopie." },
  ],
  briefTitel: "So liest sich ein Schreiben",
  briefText: "Ein Auszug — mit erfundenen Daten, wie das Beispiel oben.",
  brief: {
    an: ["SCHUFA Holding AG", "Kormoranweg 5", "65201 Wiesbaden"],
    betreff: "Löschung nach Fristablauf",
    absaetze: [
      "Sehr geehrte Damen und Herren,",
      "in meiner Datenkopie ist die Forderung eines Versandhändlers über 380 € gespeichert. Sie ist laut Datenkopie am 12.03.2022 erledigt worden. Die Speicherfrist nach den Verhaltensregeln der Wirtschaftsauskunfteien ist abgelaufen.",
      "Ich verlange die Löschung dieses Eintrags nach Art. 17 DSGVO und bitte um eine schriftliche Bestätigung.",
      "Mit freundlichen Grüßen",
    ],
    unterschrift: "Beispielperson",
    marke: "Beispiel mit erfundenen Daten",
  },
  bandSatz: "Ihr Handlungsplan beginnt mit der Bestellung — wenige Minuten.",
  fragenTitel: "Fragen zum Handlungsplan",
  grenzeTitel: "Was der Plan nicht ist",
  grenzeText: "Keine Rechtsberatung im Einzelfall und keine Löschzusage: Berechtigt gemeldete Einträge bleiben bis zum Ende ihrer Speicherfrist. Ob gelöscht oder berichtigt wird, entscheidet die Auskunftei — über Konto, Karte und Rahmen die Bank. Was wir leisten: jeden Eintrag gegen die Voraussetzungen halten und für das, was angreifbar ist, die Schreiben fertig machen.",
  weiter: [
    { href: "/werkzeuge/loeschfrist", t: "Löschfrist-Rechner" },
    { href: "/werkzeuge/eintrag-pruefen", t: "Ist mein Eintrag angreifbar?" },
    { href: "/eintrag-verjaehrung", t: "Eintrag und Verjährung" },
    { href: "/ratgeber/schufa-loeschfristen-uebersicht", t: "SCHUFA-Löschfristen im Überblick" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// FRAGEN
// ═══════════════════════════════════════════════════════════════════════════
export const BX_FRAGEN_SEITE = {
  bild: "/kino/tuer.jpg", krume: "Fragen",
  pille: "Bonitätsauskunft · Fragen",
  h1a: "Fragen zur Bonitätsauskunft —",
  h1b: "ehrlich beantwortet.",
  lead: "Die Fragen, die uns am häufigsten gestellt werden — mit den Antworten, die wir auch am Telefon geben. Auch die unbequemen.",
  gruppen: [
    { titel: "Preis und Leistung", text: "Was es kostet, was drin ist und was Sie auch kostenlos bekommen." },
    { titel: "Dauer und Ablauf", text: "Wann was passiert und was Sie dafür tun." },
    { titel: "Score, Datenschutz und Widerruf", text: "Was die Anfrage bewirkt, was mit Ihren Daten geschieht, wie Sie widerrufen." },
  ],
  bandSatz: "Alles Wichtige beantwortet? Bestellen dauert wenige Minuten.",
  weiter: [
    { href: "/ratgeber/schufa-auskunft-kostenlos-datenkopie", t: "SCHUFA-Auskunft kostenlos: die Datenkopie" },
    { href: "/ratgeber/bonitaetsauskunft-fuer-vermieter", t: "Bonitätsauskunft für den Vermieter" },
    { href: "/schufa-score-verstehen", t: "Was der SCHUFA-Score bedeutet" },
    { href: "/sicherheit", t: "Datenschutz und Sicherheit bei FIAON" },
  ],
};

/** Weiterlesen auf der Übersicht. */
export const BX_HUB_WEITER: { href: string; t: string }[] = [
  { href: "/ratgeber/schufa-auskunft-kostenlos-datenkopie", t: "SCHUFA-Auskunft kostenlos: die Datenkopie" },
  { href: "/selbstauskunft-checkliste", t: "Selbstauskunft richtig lesen" },
  { href: "/auskunfteien", t: "SCHUFA, KSV und CRIF im Überblick" },
  { href: "/schufa-eintrag-loeschen", t: "SCHUFA-Eintrag löschen lassen" },
  { href: "/bonitaetsauskunft-beantragen", t: "Bonitätsauskunft beantragen: beide Wege" },
  { href: "/preise", t: "Alle FIAON-Pakete" },
];
