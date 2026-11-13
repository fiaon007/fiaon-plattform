// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — VERTRAGSPARTNER UND PARTNER (19.09.2026, E-191; neu gefasst 13.11.2026, E-510)
//
// Bis 12.11.2026 hieß die Seite „London, Zürich, Miami — drei Standorte“ und zeigte je Stadt eine Gesellschaft mit
// Rolle und Tätigkeiten. Seit dem Sprachleitfaden FIAON Global (Leitplanke 7, Abschnitte 4.1 und 5.11) gilt:
//   · Die verbundene Gesellschaft heißt öffentlich nur „Schwarzott Group“ — ohne Ort, ohne Rolle, ohne Nummer,
//     ohne Anschrift. Sie steht nur mit dem Satz S13 (GLOBAL_VERBUNDEN).
//   · Vor Ort heißt es „unsere Partner in den USA“. Über Partner steht nichts im Präsens, was nicht belegt ist —
//     deshalb nur die Zuständigkeit (Rollen-Satz, S8) und der eine Übergangssatz zur Einreichung der Gründung.
//   · FIAON ist keine Kanzlei. Recht und Steuern liegen bei Partner-Anwälten und US-Steuerberatern (CPA) aus unserem
//     Partnernetz; sie arbeiten in eigener Verantwortung.
// Darum steht der Baustein „standorte“ (Karte mit drei Städten) hier nicht mehr, und die Karten kommen nicht mehr aus
// der Standort-Liste: Aus shared/fiaon-global-partner.ts liest die Seite nur noch London (Vertragspartner).
// Feste Sätze kommen aus shared/fiaon-global-saetze.ts, Firmendaten aus shared/fiaon-firma.ts — nichts davon getippt.
// Pfad, Kennung und die Anker (aufgaben, netz, offen) bleiben.
// ═══════════════════════════════════════════════════════════════════════════
import { EIN_PRODUKT } from "./ein-produkt";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN } from "../fiaon-global-partner";
import { FIAON_FIRMA } from "../fiaon-firma";
import { satz, weitererSatz } from "../fiaon-global-saetze";
import type { GlobalSeite } from "./typen";

const FIRMA = FIAON_FIRMA.name;
const NR = FIAON_FIRMA.companyNo;
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** London — der Vertragspartner. Rolle und Aufgaben aus der einen Quelle. */
const LONDON = GLOBAL_STANDORTE.find((o) => o.schluessel === "london")!;
/** Rollen-Satz (Leitfaden 5.11): wer für Recht und Steuern zuständig ist und wer die Honorare trägt. */
const ROLLEN = EIN_PRODUKT.de.partner;
/** Der zweite Satz daraus: „Deren Honorare für die Leistungen Ihres Vertrags trägt FIAON.“ */
const HONORARE = ROLLEN.split(/(?<=\.)\s+/)[1] ?? "";
/** Übergangssatz (Leitfaden 5.11): sagt nur, was FIAON selbst tut. */
const EINREICHUNG = weitererSatz("UEBERGANG-EINREICHUNG", "de");

export const PARTNER_SEITE: GlobalSeite = {
  pfad: "/business/partner",
  art: "partner",
  seo: {
    titel: "Vertragspartner und Partnernetz — FIAON Global",
    beschreibung: `Ihr Vertragspartner: ${FIRMA}, London, Companies House Nr. ${NR}. Recht und Steuern liegen bei Partnern, die in eigener Verantwortung arbeiten.`,
  },
  stand: "2026-11-13",
  kennung: "FG · 18",
  auge: "Wissen · Vertragspartner und Partner",
  h1: "Ein Vertragspartner.",
  h1b: "Klar benannte Zuständigkeiten.",
  lead: `Ihr Vertrag kommt mit der ${FIRMA} in London zustande. ${ROLLEN}`,
  ziffern: [
    { wert: "London", label: `${FIRMA} — Vertrag, Rechnung, Ansprechpartner` },
    { wert: `Nr. ${NR}`, label: "Companies House (England und Wales)" },
    { wert: "USA", label: "Einreichung der Gründung über unsere Partner" },
  ],
  blick: [
    ["Vertragspartner", `${FIRMA}, ${FIAON_FIRMA.strasse}, London · Companies House Nr. ${NR}`],
    ["In den USA", EINREICHUNG],
    ["Recht und Steuern", "Partner-Anwälte und US-Steuerberater (CPA) aus unserem Partnernetz — in eigener Verantwortung"],
    ["Honorare der Partner", "FIAON trägt sie für die Leistungen Ihres Vertrags"],
    ["Verbundene Gesellschaft", "Schwarzott Group — über unseren Gründer Justin Schwarzott"],
    ["Keine Bank, keine Kanzlei", "FIAON vergibt und vermittelt keine Kredite"],
    ["Wer entscheidet", "Über die Eintragung der Bundesstaat, über Konto, Karte und Finanzierung das jeweilige Institut"],
  ],
  kurz: `Sie schließen Ihren Vertrag mit der ${FIRMA} in London (Companies House Nr. ${NR}); auch die Rechnung kommt von ihr. ${ROLLEN} ${GLOBAL_VERBUNDEN}`,
  bloecke: [
    {
      typ: "karten", id: "aufgaben", h2: "Wer wofür zuständig ist", spalten: 3,
      karten: [
        { tag: "London", titel: FIRMA, text: `${LONDON.rolle}. ${LONDON.aufgaben.map(gross).join(". ")}.` },
        { tag: "USA", titel: "Unsere Partner in den USA", text: `${EINREICHUNG} ${satz("S3", "de")}` },
        { tag: "Recht und Steuern", titel: "Partnernetz", text: "Partner-Anwälte und US-Steuerberater (CPA) aus unserem Partnernetz — in eigener Verantwortung." },
      ],
    },
    {
      typ: "text", id: "netz", h2: "Das Partnernetz",
      absaetze: [
        ROLLEN,
        "Rechts- und Steuerfragen darf nur beantworten, wer dafür zugelassen ist. Diese Fragen liegen deshalb bei den Partnern. FIAON koordiniert und bereitet vor.",
      ],
    },
    {
      typ: "hinweis", id: "offen", h2: "Zur Einordnung",
      punkte: [
        GLOBAL_VERBUNDEN,
        `Weder die ${FIRMA} noch die Schwarzott Group ist eine Bank; keine von beiden vergibt oder vermittelt Kredite.`,
        satz("S2", "de"),
      ],
    },
  ],
  fragen: [
    { f: "Wer ist mein Vertragspartner bei FIAON Global?", a: `Die ${FIRMA}, ${FIAON_FIRMA.strasse}, London, eingetragen im Companies House (England und Wales) unter der Nummer ${NR}. Vertrag und Rechnung kommen von ihr.` },
    { f: "Wer ist für Recht und Steuern zuständig?", a: `${satz("S8", "de")} ${HONORARE}` },
    { f: "Wer reicht die Gründung in den USA ein?", a: `${EINREICHUNG} ${satz("S3", "de")}` },
    { f: "Ist die Schwarzott Group unabhängig von FIAON?", a: `Nein. ${GLOBAL_VERBUNDEN}` },
  ],
  weiter: ["/business/miami", "/business/wissen/anbieter-pruefen", "/business/firmenkarten-kapital", "/business/us-firmengruendung"],
  quellen: [
    { titel: `Companies House — ${FIRMA}`, url: `https://find-and-update.company-information.service.gov.uk/company/${NR}` },
  ],
};
