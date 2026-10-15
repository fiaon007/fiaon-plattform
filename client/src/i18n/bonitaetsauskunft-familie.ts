// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft — DIE SEITENFAMILIE: TEXTE
// (25.09.2026, E-241 · seit 14.10.2026 E-365: die FIAON-Bonitätsauswertung)
//
// Justin: „Die Boni-Seite komplett überarbeiten und mehrere Seiten anlegen,
// dass, wenn man auf Bonitätsauskunft geht, alles perfekt ist — wirklich HIGH
// END, der ganze Ablauf, und wir direkt verkaufen können."
//
// ── E-365 (14.10.2026): DAS PRODUKT IST DIE BONITÄTSAUSWERTUNG ─────────────
// Privat verkauft FIAON für 149 € (74 € mit laufendem Paket) die
// FIAON-Bonitätsauswertung: Ihre Bonität aus Sicht einer Bank — aus Ausweis und
// Kontoauszügen der letzten drei Monate, rund 25 Seiten, ein Mensch gibt frei.
// FIAON fordert NICHTS mehr bei Auskunfteien an, erklärt keine Datenkopie, legt
// keinen Handlungsplan mit Schreiben vor. Die Pfade bleiben (Suchwort
// „Bonitätsauskunft"), die Worte sagen ehrlich, was verkauft wird. Die
// Firmen-Auskunft (349/199 €) ist unverändert — ihre Texte bleiben.
//
// ── WAS HIER STEHT ────────────────────────────────────────────────────────
// Die Wörter aller acht Seiten (Übersicht, Deutschland, Österreich, Schweiz,
// Unternehmen, Ablauf, Ihr Plan, Fragen) und der gemeinsamen Bausteine
// (Unternavigation, Bestellkarte, Kaufleiste, Abschluss). Die Fragen stehen in
// bonitaetsauskunft-fragen.ts.
//
// ── WAS NICHT HIER STEHT ──────────────────────────────────────────────────
// Preise, Leistungsliste und die Sätze der Bonitätsauswertung kommen aus
// shared/fiaon-auskunft.ts, Leistungszeit, Steuersatz und der Unternehmer-Satz
// aus shared/fiaon-auskunft-widerruf.ts — dieselben Sätze wie Bestellseite, Mail
// und Mara. Ein Preiswechsel dort zieht jede Seite hier mit.
//
// ── SEO-TABELLE ───────────────────────────────────────────────────────────
// H1, Einleitung und die H2 der Abschnitte stehen ein zweites Mal in
// shared/fiaon-seo-seiten.ts (Vorab-HTML für Suchmaschinen). Wer hier eine
// Überschrift ändert, zieht die Tabelle nach.
//
// ── WORTWAND (shared/fiaon-wortverbote.ts) ────────────────────────────────
// Keine Zusage, kein „Score verbessern", keine Frist mit Zahl als
// FIAON-Versprechen, keine Karten- oder Limitzusage, kein „Limit" (Leads lesen
// mit). FIAON ist kein Partner der Auskunfteien — nie so wirken lassen, keine
// Logos. Österreich und Schweiz lesen nie „SCHUFA". Das Beispiel eines Plans ist
// als erfunden gekennzeichnet — kein echter Kunde. Die kostenlose Datenkopie
// wird ehrlich genannt; „keine Auskunft einer Auskunftei und kein Score" steht
// überall, wo die Auswertung beschrieben wird.
// ═══════════════════════════════════════════════════════════════════════════
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, AUSKUNFT_PREISE_CENTS, AUSWERTUNG_KEINE_AUSKUNFT_SATZ, AUSWERTUNG_SCHRITTE,
  AUSWERTUNG_UNTERLAGEN_SATZ, AUSWERTUNG_UNTERZEILE, euroText,
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
  { seite: "schufa", kurz: "Deutschland", satz: "Was Banken in Deutschland prüfen" },
  { seite: "oesterreich", kurz: "Österreich", satz: "Was Banken in Österreich prüfen" },
  { seite: "schweiz", kurz: "Schweiz", satz: "Was Banken in der Schweiz prüfen" },
  { seite: "unternehmen", kurz: "Unternehmen", satz: "Firmendaten und Inhaber" },
  { seite: "ablauf", kurz: "Ablauf", satz: "Was nach der Bestellung passiert" },
  { seite: "handlungsplan", kurz: "Ihr Plan", satz: "Potenzial und zwölf Monate" },
  { seite: "fragen", kurz: "Fragen", satz: "Preis, Dauer, Score, Widerruf" },
];

/** Der eine Bestellweg (E-240): /bonitaet-antrag liest ?art= und ?land= vor. */
export function bestellPfad(art: AuskunftArt = "privat", land?: AuskunftLand): string {
  const q: string[] = [];
  if (art === "firma") q.push("art=firma");
  if (land) q.push(`land=${land}`);
  return `/bonitaet-antrag${q.length ? `?${q.join("&")}` : ""}`;
}

/**
 * Der Weg für Kunden mit laufendem Paket (26.09.2026, E-243): dieselbe Bestellseite mit
 * geöffnetem Kunden-Zweig (?kunde=1) — dort fordern sie ihren Kundenpreis-Link an, ohne
 * Anmeldung und ohne etwas einzutippen. Den Preis entscheidet der Server an der Person.
 */
export function kundenpreisPfad(art: AuskunftArt = "privat", land?: AuskunftLand): string {
  const q = ["kunde=1"];
  if (art === "firma") q.push("art=firma");
  if (land) q.push(`land=${land}`);
  return `/bonitaet-antrag?${q.join("&")}`;
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

/**
 * E-365: Für NEUE Paketkunden ist die Bonitätsauswertung im Paket enthalten (der Schritt vor dem
 * Kartenlink der Partnerbank, E-363) — öffentlich gesagt, ohne Zusage über die Karte.
 * Kunden mit laufendem Paket liest AUSWERTUNG_INKLUSIVE_SATZ (shared/fiaon-auskunft.ts).
 */
export const BX_INKLUSIVE_NEU =
  "Für neue Paketkunden ist die Bonitätsauswertung im Paket enthalten — sie ist der Schritt vor dem Link unserer Partnerbank für Ihren Kartenantrag.";

/** Die ehrliche Abgrenzung und der Satz zu den Unterlagen — wörtlich aus der einen Quelle. */
export const BX_KEINE_AUSKUNFT = AUSWERTUNG_KEINE_AUSKUNFT_SATZ;
export const BX_UNTERLAGEN = AUSWERTUNG_UNTERLAGEN_SATZ;

// ═══════════════════════════════════════════════════════════════════════════
// GEMEINSAME BAUSTEINE
// ═══════════════════════════════════════════════════════════════════════════
export const BX = {
  familieAria: "Bonitätsauswertung: alle Seiten",
  familieBestellen: "Bestellen",
  weiterTitel: "Weiter in der Bonitätsauswertung",
  zurueck: "Zurück",
  weiter: "Weiter",

  knopfBestellen: "Bonitätsauswertung bestellen",
  knopfBestellenFirma: "Für Ihr Unternehmen bestellen",
  knopfAblauf: "So läuft es ab",
  knopfFragen: "Alle Fragen",
  knopfPlan: "Zu Ihrem Plan",

  // ── Die Bestellkarte (die eine Navy-Glas-Fläche der Unterseiten) ──
  karteTag: "Ihre Bonitätsauswertung",
  karteTagFirma: "Bonitätsauskunft für Unternehmen",
  karteEinmal: "einmalig · kein Abo",
  kartePaket: (paket: string) => `${paket} für FIAON-Kunden mit laufendem Paket`,
  // Privat (E-365): keine Auskunftei — die Karte nennt, woraus die Auswertung entsteht.
  karteAus: "Aus Ihren Unterlagen",
  karteUnterlagen: ["Ausweis", "Kontoauszüge · drei Monate"],
  karteFirmaBei: "Firmendaten u. a. bei",
  kartePersoenlich: "Persönliche Datenkopie bei",
  karteAlleFirma: "Dazu die persönliche Datenkopie im Land des Firmensitzes.",
  kartePunkte: [
    "Haushaltsrechnung und die neun Merkmale einer Kreditprüfung",
    "Jede Ausgabe nach Empfänger, Ampel und FIAON-Finanzwert",
    "Ihr Potenzial und Ihr Plan für zwölf Monate",
  ],
  // Die Firmen-Auskunft ist unverändert (E-365 betrifft nur privat).
  kartePunkteFirma: [
    "Jeder Eintrag in klaren Worten erklärt",
    "Speicherfristen geprüft",
    "Handlungsplan und fertige Schreiben — Sie geben frei",
  ],
  karteAblauf: "So läuft es ab",
  karteSeitenTitel: "Mehr zur Bonitätsauswertung",

  // ── Die Kaufleiste am Handy ──
  leisteWas: "Bonitätsauswertung",
  leisteWasFirma: "Für Unternehmen",
  leistePaket: (paket: string) => `mit Paket ${paket}`,
  leisteKnopf: "Bestellen",

  // ── Der Abschluss jeder Seite ──
  schlussPille: "Einmalig · kein Abo",
  schlussTitel: "Wissen, was die Bank sieht.",
  schlussSatz: "Ihre Bonität aus Sicht einer Bank: Haushaltsrechnung, jede Ausgabe nach Empfänger, Ampel, FIAON-Finanzwert und Ihr Plan für zwölf Monate — aus Ihren eigenen Kontoauszügen.",
  schlussSatzFirma: "Mit der Auskunft sehen Sie, was Lieferanten, Banken und Kartenanbieter über Ihr Unternehmen lesen — und was Sie daran berichtigen lassen können.",
  schlussPreis: (einzeln: string, paket: string) => `${einzeln} einzeln · ${paket} für FIAON-Kunden mit Paket`,
  schlussFuss: `${AUSWERTUNG_KEINE_AUSKUNFT_SATZ} FIAON ist unabhängig — kein Partner einer Auskunftei. Über Konto, Karte und Rahmen entscheidet immer die Bank.`,
  schlussFussFirma: "FIAON ist keine Rechtsberatung, verspricht keine Löschung berechtigter Einträge und ist unabhängig — kein Partner der genannten Auskunfteien. Über Konto, Karte und Rahmen entscheidet immer die Bank.",

  // ── Die Bestellseite /bonitaet-antrag: Kopf der Familie (nur Optik) ──
  antragZurueck: "Bonitätsauswertung: Leistung, Ablauf, Fragen",
  antragWegAria: "Ihr Weg zur Bonitätsauswertung",
  antragMehr: [
    { href: "/bonitaetsauskunft/fragen", t: "Alle Fragen zur Bonitätsauswertung" },
    { href: "/bonitaetsauskunft/ablauf", t: "Der Ablauf im Detail" },
    { href: "/bonitaetsauskunft/handlungsplan", t: "Was in Ihrem Plan steht" },
  ],

  // ── Kleine Zeilen ──
  preisEinmal: "einmalig",
  preisMitPaket: (paket: string) => `${paket} für FIAON-Kunden mit laufendem Paket`,
  // 26.09.2026 (E-243): am Preis — führt auf die Bestellseite mit geöffnetem Kunden-Zweig (kundenpreisPfad).
  kundenpreisLink: "Schon FIAON-Kunde? Kundenpreis-Link anfordern",
  weiterlesen: "Weiterlesen",
  stand: "Stand Oktober 2026 — keine Rechtsberatung im Einzelfall.",
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE ÜBERSICHT /bonitaetsauskunft
// ═══════════════════════════════════════════════════════════════════════════
export const BX_HUB = {
  pille: "Bonitätsauswertung · DE · AT · CH",
  h1a: "Ihre Bonität aus Sicht einer Bank —",
  h1b: "die FIAON-Bonitätsauswertung.",
  lead: "Aus Ihrem Ausweis und Ihren Kontoauszügen der letzten drei Monate entwickeln wir Ihre Bonitätsauswertung: Haushaltsrechnung, die neun Merkmale einer Kreditprüfung, jede Ausgabe nach Empfänger, Ampel, FIAON-Finanzwert und Ihr Plan für zwölf Monate. Ein Mensch prüft und gibt frei.",
  fakten: ["Aus Ihren eigenen Kontoauszügen", "Keine Anfrage bei einer Auskunftei", "Einmalig, kein Abo"],

  // Die Mappe im Kopf: zeigt den AUFBAU des Berichts, keine Daten.
  mappeAria: "Darstellung: So ist Ihre Bonitätsauswertung aufgebaut — Haushaltsrechnung, Ausgaben je Empfänger, Ampel und Plan",
  mappeBlaetter: [
    // Gegenlesen E-241: Von den hinteren Blättern sind nur rund 110 px sichtbar — kurze Titel,
    // sonst schneidet das vordere Blatt mitten im Wort ab.
    { tag: "Haushalt", titel: "neun Merkmale" },
    { tag: "Ausgaben", titel: "je Empfänger" },
    { tag: "Ampel und Plan", titel: "Ihr Potenzial, zwölf Monate" },
  ],
  mappePlan: [
    { ton: "gruen", t: "Einnahmen · stabil" },
    { ton: "gelb", t: "Verträge · Potenzial" },
    { ton: "blau", t: "FIAON-Finanzwert" },
    { ton: "grau", t: "Plan · zwölf Monate" },
  ],
  mappeUnter: "Darstellung des Aufbaus",
  tafelTag: "Ihre Bonitätsauswertung",
  tafelLandAria: "Land wählen",

  // 01 — Was Sie bekommen
  bekommenMarke: "Was Sie bekommen",
  bekommenTitel: "Was Sie bekommen",
  bekommenText: `${AUSWERTUNG_UNTERZEILE} Für Unternehmen gibt es eine eigene Bonitätsauskunft mit den Firmendaten.`,
  artAria: "Für wen",
  arten: { privat: "Für mich privat", firma: "Für mein Unternehmen" } as Record<AuskunftArt, string>,

  // 02 — Für wen
  werTitel: "Für wen",
  werText: "Für Privatpersonen in Deutschland, Österreich und der Schweiz — und für Unternehmen, mit einer eigenen Bonitätsauskunft für die Firmendaten.",
  werZeilen: [
    { seite: "schufa" as BxSeite, name: "Deutschland", bei: "Was Banken in Deutschland prüfen", art: "privat" as AuskunftArt },
    { seite: "oesterreich" as BxSeite, name: "Österreich", bei: "Was Banken in Österreich prüfen", art: "privat" as AuskunftArt },
    { seite: "schweiz" as BxSeite, name: "Schweiz", bei: "Was Banken in der Schweiz prüfen", art: "privat" as AuskunftArt },
    { seite: "unternehmen" as BxSeite, name: "Unternehmen", bei: "Firmendaten u. a. bei Creditreform und CRIF, dazu die persönliche Datenkopie der Inhaber", art: "firma" as AuskunftArt },
  ],

  // 03 — Ablauf
  ablaufTitel: "Der Ablauf in vier Schritten",
  ablaufText: "Bestellen, hochladen — dann arbeiten wir. Ihren Bericht bekommen Sie als PDF per E-Mail und in Ihrem FIAON-Bereich.",
  ablaufMehr: "Der Ablauf im Detail",

  // 04 — Beispiel
  beispielTitel: "So sieht Ihr Plan aus",
  beispielText: "Ein Beispiel mit erfundenen Daten: jeder Bereich mit Ampel, das Potenzial benannt, der nächste Schritt in Reihenfolge.",
  beispielMehr: "Was in Ihrem Plan steht",

  // 05 — Kostenlos oder von uns
  kostenlosTitel: "Kostenlose Datenkopie — oder Bonitätsauswertung?",
  kostenlosZitat: AUSKUNFT_KOSTENLOS_ANTWORT,
  selbstTitel: "Datenkopie selbst anfordern",
  selbstPreis: "0 €",
  selbstZeilen: [
    "Sie schreiben jede Auskunftei selbst an — Ihr gesetzliches Recht.",
    "Sie sehen, was dort über Sie gespeichert ist.",
    "Laden Sie die Kopie hoch, beziehen wir sie in Ihre Auswertung ein.",
  ],
  selbstLink: "Das kostenlose Anschreiben dafür",
  fiaonTitel: "FIAON-Bonitätsauswertung",
  fiaonZeilen: [
    "Ihre Bonität aus Sicht einer Bank — aus Ihren eigenen Kontoauszügen.",
    "Jede Einnahme und Ausgabe nach Empfänger, Ampel und FIAON-Finanzwert.",
    "Ihr Potenzial und Ihr Plan für zwölf Monate.",
  ],

  // 06 — Fragen
  fragenTitel: "Häufige Fragen",
  fragenMehr: "Alle Fragen zur Bonitätsauswertung",

  // Zwischenruf
  bandSatz: "Bestellen dauert wenige Minuten. Danach laden Sie Ausweis und Kontoauszüge hoch.",
};

/**
 * Die vier Schritte — Übersicht, Ablauf-Seite und Bestellseite sprechen gleich.
 * Titel und Texte aus AUSWERTUNG_SCHRITTE (shared/fiaon-auskunft.ts); hier nur „wann" und der
 * Satz zur Zahlung im ersten Schritt.
 */
export const BX_SCHRITTE: { kurz: string; titel: string; wann: string; text: string }[] = [
  { wann: "wenige Minuten", zusatz: " Ihre Zahlungsseite öffnet sich gleich nach der Bestellung." },
  { wann: "nach der Bestellung", zusatz: "" },
  { wann: "sobald alles vorliegt", zusatz: "" },
  { wann: "nach der Freigabe", zusatz: "" },
].map((s, i) => ({
  kurz: AUSWERTUNG_SCHRITTE[i].titel,
  titel: AUSWERTUNG_SCHRITTE[i].titel,
  wann: s.wann,
  text: `${AUSWERTUNG_SCHRITTE[i].text}${s.zusatz}`,
}));

// ═══════════════════════════════════════════════════════════════════════════
// DAS BEISPIEL EINES PLANS — ERFUNDEN, SO GEKENNZEICHNET
// Keine Person, keine Zahl hier ist echt. Die Bereiche folgen dem Bericht
// (Haushaltsrechnung, Ampel, Potenzial, Plan — fiaon-finanzauswertung-pdf.ts).
// ═══════════════════════════════════════════════════════════════════════════
export const BX_BEISPIEL = {
  kopf: "FIAON · Bonitätsauswertung",
  fuer: "Beispielperson · Deutschland",
  stempel: "Beispiel mit erfundenen Daten",
  spalten: ["Bereich", "Ampel", "Nächster Schritt"],
  zeilen: [
    { stelle: "Einnahmen", eintrag: "Gehalt, regelmäßig zum Monatsanfang", einordnung: "stabil", ton: "gruen", schritt: "Nichts zu tun." },
    { stelle: "Verträge", eintrag: "Drei Streaming-Abos, zusammen 41 € im Monat", einordnung: "Potenzial", ton: "gelb", schritt: "Zwei davon kündigen — 29 € im Monat frei." },
    { stelle: "Konto", eintrag: "Dispo an 9 von 90 Tagen genutzt", einordnung: "beobachten", ton: "blau", schritt: "Einen kleinen Puffer aufbauen, bevor Sie eine Karte beantragen." },
    { stelle: "Zahlungen", eintrag: "Eine Rücklastschrift beim Mobilfunk", einordnung: "Merkmal einer Kreditprüfung", ton: "grau", schritt: "Den Abbuchungstag auf den Gehaltseingang legen." },
  ],
  planTitel: "Ihr Plan für zwölf Monate",
  plan: [
    "Abos bereinigen — rund 350 € im Jahr frei.",
    "Lastschriften nach dem Gehaltseingang ausrichten.",
    "Drei Monate ohne Dispo — ein ruhiges Konto ist ein Merkmal, das Banken ansehen.",
    "Mit Ihrer Ansprechperson den Weg zur Karte danach ausrichten.",
  ],
  fuss: "Beispielperson und alle Zahlen sind erfunden. Die Bonitätsauswertung ist keine Auskunft einer Auskunftei und kein Score — über Konto, Karte und Rahmen entscheidet die Bank.",
  aria: "Beispiel eines Plans mit erfundenen Daten: vier Bereiche mit Ampel und nächstem Schritt",
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE LÄNDERSEITEN
// Die Bonitätsauswertung ist in allen drei Ländern dieselbe (Ausweis und
// Kontoauszüge). Je Land steht dazu ehrlich, wo Sie Ihre KOSTENLOSE Datenkopie
// selbst anfordern — als Information, nicht als FIAON-Leistung.
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
    pille: "Bonitätsauswertung · Deutschland",
    h1a: "Bonitätsauswertung für Deutschland —",
    h1b: "Ihre SCHUFA-Datenkopie bleibt kostenlos.",
    lead: "Bei einer Kreditprüfung zählt beides: was Auskunfteien wie SCHUFA, CRIF und Creditreform Boniversum gespeichert haben — und was Ihre Kontoauszüge über Einnahmen und Ausgaben zeigen. Ihre Bonitätsauswertung zeigt den zweiten Teil. Die Datenkopie fordern Sie kostenlos selbst an.",
    beiTitel: "Ihre Datenkopien — kostenlos, von Ihnen angefordert",
    beiText: "Jede Datenkopie steht Ihnen nach Art. 15 DSGVO kostenlos zu. Fordern Sie sie selbst an — unser Generator schreibt den Brief. Laden Sie sie hoch, beziehen wir sie in Ihre Auswertung ein.",
    bekommenTitel: "Was Sie bekommen",
    bekommenText: "Ein Auftrag, ein Preis — Ihre Bonitätsauswertung aus Ihren eigenen Kontoauszügen.",
    bandSatz: "Bestellen dauert wenige Minuten — danach laden Sie Ausweis und Kontoauszüge hoch.",
    eigenMarke: "Einordnung",
    eigenTitel: "Warum nicht nur die SCHUFA?",
    eigenText: "Die SCHUFA-Datenkopie zeigt, was gemeldet wurde. Bei einer Kreditprüfung sieht die Bank zusätzlich auf Ihren Haushalt: Einnahmen, feste Ausgaben, Verträge und wie Ihr Konto läuft. Genau das zeigt die Bonitätsauswertung — aus Ihren eigenen Kontoauszügen.",
    eigenPunkte: [
      AUSWERTUNG_KEINE_AUSKUNFT_SATZ,
      "Sie ist keine Kreditanfrage: Wir fragen bei keiner Auskunftei an, es entsteht kein Eintrag.",
      "Über Konto, Karte und Rahmen entscheidet die Bank.",
    ],
    fragenTitel: "Fragen zur Bonitätsauswertung in Deutschland",
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
    pille: "Bonitätsauswertung · Österreich",
    h1a: "Bonitätsauswertung für Österreich —",
    h1b: "Ihre KSV-Datenkopie bleibt kostenlos.",
    lead: "Bei einer Kreditprüfung zählt beides: was KSV1870 und CRIF gespeichert haben — und was Ihre Kontoauszüge über Einnahmen und Ausgaben zeigen. Ihre Bonitätsauswertung zeigt den zweiten Teil, zum selben Preis wie überall. Die Datenkopie fordern Sie kostenlos selbst an.",
    beiTitel: "Ihre Datenkopien — kostenlos, von Ihnen angefordert",
    beiText: "KSV1870 und CRIF, beide in Wien. Die Datenkopie steht Ihnen nach Art. 15 DSGVO kostenlos zu — die DSGVO gilt in Österreich unmittelbar. Laden Sie sie hoch, beziehen wir sie in Ihre Auswertung ein.",
    bekommenTitel: "Was Sie bekommen",
    bekommenText: "Ein Auftrag, ein Preis — Ihre Bonitätsauswertung aus Ihren eigenen Kontoauszügen.",
    bandSatz: "Bestellen dauert wenige Minuten — danach laden Sie Ausweis und Kontoauszüge hoch.",
    eigenMarke: "Preis",
    eigenTitel: "Derselbe Preis, derselbe Weg",
    eigenText: "Die Bonitätsauswertung kostet in Österreich dasselbe wie in Deutschland und der Schweiz: einmalig, kein Abo, per Überweisung. Ihre Unterlagen laden Sie über einen Link hoch — ohne Anmeldung.",
    fragenTitel: "Fragen zur Bonitätsauswertung in Österreich",
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
    pille: "Bonitätsauswertung · Schweiz",
    h1a: "Bonitätsauswertung für die Schweiz —",
    h1b: "Ihre Auskunft nach Art. 25 DSG bleibt kostenlos.",
    lead: "Bei einer Kreditprüfung zählt beides: was Auskunfteien wie CRIF und Intrum gespeichert haben — und was Ihre Kontoauszüge über Einnahmen und Ausgaben zeigen. Ihre Bonitätsauswertung zeigt den zweiten Teil. Die Auskunft nach Art. 25 DSG fordern Sie selbst an.",
    beiTitel: "Ihre Auskünfte — von Ihnen angefordert",
    beiText: "CRIF in Zürich und Intrum in Schwerzenbach, jeweils nach Art. 25 DSG. Die Auskunft ist in der Regel kostenlos. Laden Sie sie hoch, beziehen wir sie in Ihre Auswertung ein.",
    bekommenTitel: "Was Sie bekommen",
    bekommenText: "Ein Auftrag, ein Preis — Ihre Bonitätsauswertung aus Ihren eigenen Kontoauszügen.",
    bandSatz: "Bestellen dauert wenige Minuten — danach laden Sie Ausweis und Kontoauszüge hoch.",
    eigenMarke: "Grenzen und Preis",
    eigenTitel: "Was nicht dazugehört — und der Preis",
    eigenText: "Den Betreibungsregisterauszug stellt das Betreibungsamt Ihres Wohnorts aus; er ist ein amtliches Dokument und nicht Teil der Bonitätsauswertung. Wir fragen bei keiner Auskunftei an — auch nicht bei ZEK oder IKO.",
    eigenPunkte: [
      "Der Preis gilt in Euro — einmalig, per Überweisung, wie in Deutschland und Österreich.",
      // Gegenlesen E-241: „in der Regel" — Art. 25 Abs. 6 DSG mit Art. 19 DSV erlaubt in Ausnahmen ein Entgelt.
      "Die Auskunft nach Art. 25 DSG ist in der Regel kostenlos; Sie fordern sie selbst an. Laden Sie sie hoch, beziehen wir sie ein.",
    ],
    fragenTitel: "Fragen zur Bonitätsauswertung in der Schweiz",
    weiter: [
      { href: "/ratgeber/bonitaet-in-der-schweiz-grundlagen", t: "Bonität in der Schweiz: die Grundlagen" },
      { href: "/ratgeber/crif-auszug-schweiz", t: "CRIF-Auszug in der Schweiz" },
      { href: "/schweiz", t: "FIAON in der Schweiz" },
      { href: "/auskunfteien", t: "Die Auskunfteien im Vergleich" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UNTERNEHMEN — die Firmen-Auskunft ist unverändert (E-365 betrifft nur privat)
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
// ABLAUF — vier Schritte, dieselben wie BX_SCHRITTE (der Zeitstrahl liest „wann" dort)
// ═══════════════════════════════════════════════════════════════════════════
export const BX_ABLAUF = {
  bild: "/kino/cockpit.jpg", krume: "Ablauf",
  pille: "Bonitätsauswertung · Ablauf",
  h1a: "Was nach der Bestellung passiert —",
  h1b: "Schritt für Schritt.",
  lead: "Vom Klick auf „Zahlungspflichtig bestellen“ bis zu Ihrem Bericht als PDF: was wann passiert, wovon es abhängt — und wo Sie gefragt sind.",
  schritte: [
    { titel: "Schritt 1 · Bestellen und bezahlen", text: "Wenige Minuten: Name, Anschrift, Geburtsdatum, E-Mail und Telefon. Direkt danach öffnet sich Ihre Zahlungsseite mit Bankverbindung, Verwendungszweck und Betrag — per Überweisung, einmalig, kein Abo. Die Rechnung und die Bestätigung Ihres Vertrags mit Widerrufsbelehrung kommen per E-Mail." },
    { titel: "Schritt 2 · Hochladen", text: "Per E-Mail bekommen Sie einen Link: Dort laden Sie Ihren Ausweis und Ihre Kontoauszüge der letzten drei Monate hoch — ohne Anmeldung. Haben Sie die kostenlose Datenkopie einer Auskunftei, laden Sie sie gern dazu." },
    { titel: "Schritt 3 · Wir entwickeln", text: "Ihr FIAON-Team wertet jede Buchung aus: Haushaltsrechnung, die neun Merkmale einer Kreditprüfung, Ampel, FIAON-Finanzwert, Potenzial und Plan. Ein Mensch prüft den Bericht und gibt ihn frei. Bei keiner Auskunftei wird etwas angefragt." },
    { titel: "Schritt 4 · Sie erhalten Ihren Bericht", text: "Rund 25 Seiten als PDF per E-Mail und jederzeit in Ihrem FIAON-Bereich. Ihre Ansprechperson geht ihn mit Ihnen durch." },
  ],
  dauerTitel: "Wie lange es dauert",
  dauerText: `Es hängt an zwei Dingen: wann Ihre Überweisung eingeht und wann Ihre Unterlagen vollständig vorliegen. ${auskunftLeistungszeit("privat")} Den Stand sehen Sie in Ihrem FIAON-Bereich.`,
  widerrufTitel: "Ihr Widerrufsrecht, verständlich",
  widerrufText: "Als Verbraucherin oder Verbraucher können Sie den Vertrag vierzehn Tage lang ohne Angabe von Gründen widerrufen.",
  widerrufPunkte: [
    "Damit wir nicht erst nach Ablauf dieser Frist beginnen, verlangen Sie auf unserer Bestellseite ausdrücklich, dass wir vorher beginnen.",
    "Widerrufen Sie danach, zahlen Sie nur den Anteil der bis dahin erbrachten Leistung.",
    "Ist die Leistung vollständig erbracht, erlischt das Widerrufsrecht.",
    "Die vollständige Belehrung sehen Sie auf der Bestellseite vor dem Klick, und Sie erhalten sie mit der Vertragsbestätigung per E-Mail.",
    "Für Unternehmen gilt kein gesetzliches Widerrufsrecht.",
  ],
  widerrufLink: "Widerrufsbelehrung lesen",
  fragenTitel: "Fragen zum Ablauf",
  weiter: [
    { href: "/ratgeber/schufa-auskunft-kostenlos-datenkopie", t: "Die kostenlose Datenkopie nach Art. 15 DSGVO" },
    { href: "/werkzeuge/spielraum", t: "Ihr monatlicher Spielraum" },
    { href: "/selbstauskunft-checkliste", t: "Selbstauskunft richtig lesen" },
    { href: "/widerrufsbelehrung", t: "Widerrufsbelehrung" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// IHR PLAN (Pfad /bonitaetsauskunft/handlungsplan bleibt — Suchwort und Verweise)
// Was der Plan der Bonitätsauswertung enthält: Haushalt, Ampel, Potenzial,
// Reihenfolge, zwölf Monate. Keine Schreiben, keine Löschung — der Plan zeigt,
// was in der Hand des Menschen liegt.
// ═══════════════════════════════════════════════════════════════════════════
export const BX_PLAN = {
  bild: "/kino/akten.jpg", krume: "Ihr Plan",
  pille: "Bonitätsauswertung · Ihr Plan",
  h1a: "Ihr Plan in der Bonitätsauswertung —",
  h1b: "Potenzial und zwölf Monate.",
  lead: "Die Auswertung sagt, wo Sie stehen. Ihr Plan sagt, was Sie daraus machen können: was im Monat und im Jahr frei werden kann, in welcher Reihenfolge — hochgerechnet auf zwölf Monate.",
  inhaltTitel: "Was in Ihrem Plan steht",
  inhaltText: "Fünf Teile, in derselben Ordnung für jeden Bericht.",
  inhaltPunkte: [
    "Ihre Haushaltsrechnung: was hereinkommt, was fest abgeht, was bleibt.",
    "Die Ampel für sieben Bereiche — wo es ruhig läuft und wo eine Bank genauer hinsieht.",
    "Ihr Potenzial: welche Ausgaben sich senken oder bündeln lassen, im Monat und im Jahr.",
    "Die Reihenfolge: was zuerst, was danach, was Zeit braucht.",
    "Die Hochrechnung auf zwölf Monate — mit Ihrem FIAON-Finanzwert als Ausgangspunkt.",
  ],
  schreibenTitel: "Woraus Ihr Plan entsteht",
  schreibenText: "Aus Ihren eigenen Kontoauszügen der letzten drei Monate — jede Buchung zugeordnet, nach Empfänger und Monat. Bei keiner Auskunftei wird etwas angefragt.",
  schreiben: [
    { titel: "Einnahmen", grund: "Monat für Monat", wann: "Gehalt, Rente oder Leistungen — wie regelmäßig sie kommen und wie hoch sie sind." },
    { titel: "Feste Ausgaben", grund: "nach Empfänger", wann: "Miete, Energie, Versicherungen, Verträge und Abos — jeder Empfänger einzeln." },
    { titel: "Kontoführung", grund: "Merkmale einer Kreditprüfung", wann: "Dispo, Rücklastschriften und Puffer — was eine Bank an einem Konto abliest." },
  ],
  bandSatz: "Ihr Plan beginnt mit der Bestellung — wenige Minuten.",
  fragenTitel: "Fragen zu Ihrem Plan",
  grenzeTitel: "Was der Plan nicht ist",
  grenzeText: "Keine Rechtsberatung im Einzelfall, kein Score und keine Zusage: Über Konto, Karte und Rahmen entscheidet die Bank. Ihr Plan zeigt, was in Ihrer Hand liegt — welche Ausgaben Sie senken, was Sie ordnen und in welcher Reihenfolge.",
  weiter: [
    { href: "/werkzeuge/spielraum", t: "Ihr monatlicher Spielraum" },
    { href: "/werkzeuge/schuldenplan", t: "Schuldenfrei-Plan" },
    { href: "/ratenzahlung-und-bonitaet", t: "Ratenzahlung und Bonität" },
    { href: "/schufa-score-verstehen", t: "Was der SCHUFA-Score bedeutet" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// FRAGEN
// ═══════════════════════════════════════════════════════════════════════════
export const BX_FRAGEN_SEITE = {
  bild: "/kino/tuer.jpg", krume: "Fragen",
  pille: "Bonitätsauswertung · Fragen",
  h1a: "Fragen zur Bonitätsauswertung —",
  h1b: "ehrlich beantwortet.",
  lead: "Die Fragen, die uns am häufigsten gestellt werden — mit den Antworten, die wir auch am Telefon geben. Auch die unbequemen.",
  gruppen: [
    { titel: "Preis und Leistung", text: "Was es kostet, was drin ist und was Sie auch kostenlos bekommen." },
    { titel: "Dauer und Ablauf", text: "Wann was passiert und was Sie dafür tun." },
    { titel: "Score, Datenschutz und Widerruf", text: "Was die Auswertung bewirkt, was mit Ihren Daten geschieht, wie Sie widerrufen." },
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
  { href: "/partnerbank-dkb", t: "Konto und Karte mit unserer Partnerbank" },
  { href: "/bonitaetsauskunft-beantragen", t: "Bonitätsauskunft oder Bonitätsauswertung?" },
  { href: "/preise", t: "Alle FIAON-Pakete" },
];
