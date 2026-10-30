// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DREI STANDORTE: LONDON · ZÜRICH · MIAMI (19.09.2026, E-191)
//
// Justin (18.09.2026, spät): „Wir arbeiten hier mit der Schwarzott Global LLC
// aus Miami zusammen und mit der Schwarzott Capital Partners AG aus Zürich."
//
// ── 30.10.2026 (E-466, Justin): „entferne Schwarzott Capital Partners AG bzw. Schwarzott Global LLC,
// sondern eher Schwarzott Group“ — öffentlich heißen Zürich und Miami seither „Schwarzott Group“, ohne
// Registernummer, Anschrift und Register-Links. Verträge, Angebote (Bürgschaft) und Buchhaltung nennen die
// Gesellschaften weiter mit ihrem echten Namen (dort sind sie Vertragspartei) — das hier betrifft nur die Seite.
//
// ── WAS HIER STEHT, IST GEPRÜFT (Stand 19.09.2026, vor der Umbenennung) ────
// · FIAON LTD — Companies House (England and Wales) No. 17318250, 128 City
//   Road, London (shared/fiaon-firma.ts).
// · Schwarzott Capital Partners AG — Handelsregister des Kantons Zürich,
//   UID CHE-102.119.428, Schifflände 26, 8001 Zürich (Zefix, abgefragt am
//   19.09.2026). Zweck laut Register: Investition und Beteiligung an
//   Unternehmen, Unternehmensberatung und Marketing, Immobilieninvestitionen
//   im Ausland.
// · Schwarzott Global LLC — Miami, Florida; 3119 Coral Way, Suite 200,
//   Miami, FL 33145 (Angabe der Gesellschaft). Das Florida-Register
//   (Sunbiz) liegt hinter einer Bot-Sperre und wurde NICHT abgefragt (19.09.2026
//   erneut: Sunbiz 403, OpenCorporates Captcha, eigene Imprint-Seite 403) —
//   deshalb steht hier keine Registernummer; die Seiten nennen stattdessen die
//   Rechtsform (standortNachweis). Nummer in `register` eintragen, sobald Justin
//   sie nennt — sie ersetzt die Rechtsform dann überall von selbst.
//
// ── OFFEN GESAGT: DIE VERBINDUNG ──────────────────────────────────────────
// Alle drei Gesellschaften sind über Justin Schwarzott verbunden (Director der
// FIAON LTD, Verwaltungsrat der AG, Vertreter der LLC). Wer als Firmenkunde
// prüft, sieht das in zwei Minuten im Register. Die Seite sagt es deshalb
// selbst — eine Kanzlei nennt ihre verbundenen Gesellschaften, sie versteckt
// sie nicht (§ 5a UWG: nichts weglassen, was für die Entscheidung zählt).
//
// ── WAS DIE PARTNER TUN — UND WAS NICHT ───────────────────────────────────
// Vertragspartner des Kunden ist immer die FIAON LTD. Die Partner arbeiten
// für FIAON (Team vor Ort) oder begleiten die Kapital-Etappe. Keine der drei
// Gesellschaften ist eine Bank, vergibt Kredite oder vermittelt sie; über
// Konto, Karte, Rahmen und Darlehen entscheidet das jeweilige Institut.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";

export interface GlobalStandort {
  schluessel: "london" | "zuerich" | "miami";
  stadt: string;
  land: string;
  /** Zeitzone für die Ortszeit auf der Seite. */
  zeitzone: string;
  gesellschaft: string;
  rechtsform: string;
  adresse: string[];
  register: string | null;
  /** Die Rolle in einem Satz — für Merkblätter und die Standort-Tafel. */
  rolle: string;
  /** Was die Gesellschaft für FIAON-Global-Kunden tut. */
  aufgaben: string[];
  /** Dieselben Angaben auf Englisch (24.09.2026, E-234) — Anschrift und Register bleiben, wie sie sind. */
  en: { stadt: string; land: string; rechtsform: string; rolle: string; aufgaben: string[] };
}

export const GLOBAL_STANDORTE: GlobalStandort[] = [
  {
    schluessel: "london",
    stadt: "London",
    land: "Vereinigtes Königreich",
    zeitzone: "Europe/London",
    gesellschaft: FIAON_FIRMA.name,
    rechtsform: "Private Limited Company",
    adresse: [FIAON_FIRMA.strasse, FIAON_FIRMA.ortZeile],
    register: `Companies House No. ${FIAON_FIRMA.companyNo}`,
    rolle: "Ihr Vertragspartner — Vertrag, Rechnung und Ansprechpartner",
    aufgaben: [
      "schließt den Auftrag mit Ihnen und stellt die Rechnung",
      "koordiniert Gründung, Steuernummern, Partner und Termine",
      "trägt die Honorare der Partner für die Leistungen Ihres Pakets",
    ],
    en: {
      stadt: "London", land: "United Kingdom", rechtsform: "Private Limited Company",
      rolle: "Your contracting party — contract, invoice and dedicated contact",
      aufgaben: [
        "concludes the engagement with you and issues the invoice",
        "coordinates formation, tax numbers, partners and appointments",
        "pays the partners’ fees for the services in your package",
      ],
    },
  },
  {
    schluessel: "zuerich",
    stadt: "Zürich",
    land: "Schweiz",
    zeitzone: "Europe/Zurich",
    gesellschaft: "Schwarzott Group",
    rechtsform: "Partner von FIAON Global",
    adresse: ["Zürich, Schweiz"],
    register: null,
    rolle: "Partner für die Kapital-Etappe und für Kunden aus der Schweiz",
    aufgaben: [
      "begleitet die Kapital-Etappe: Kennzahlen und Unterlagen für Finanzierungsgespräche",
      "Ansprechpartner vor Ort für Unternehmen aus der Schweiz",
      "Beteiligungs- und Investmentgruppe — keine Bank, keine Kreditvergabe",
    ],
    en: {
      stadt: "Zurich", land: "Switzerland", rechtsform: "Partner of FIAON Global",
      rolle: "Partner for the capital stage and for clients from Switzerland",
      aufgaben: [
        "supports the capital stage: key figures and documents for financing discussions",
        "local contact for companies from Switzerland",
        "an investment and holding group — not a bank, no lending",
      ],
    },
  },
  {
    schluessel: "miami",
    stadt: "Miami",
    land: "Florida, USA",
    zeitzone: "America/New_York",
    gesellschaft: "Schwarzott Group",
    rechtsform: "Partner von FIAON Global",
    adresse: ["Miami, Florida"],
    register: null,
    rolle: "Unser Team vor Ort — Termine, Einreichungen, Auftakt in Miami",
    aufgaben: [
      "nimmt Termine bei Behörden und Banken vor Ort wahr",
      "reicht Unterlagen ein und holt Dokumente ab",
      "richtet den Auftakt des Pakets Global VIP in Miami aus",
    ],
    en: {
      stadt: "Miami", land: "Florida, USA", rechtsform: "Partner of FIAON Global",
      rolle: "Our team on the ground — appointments, filings and the kick-off in Miami",
      aufgaben: [
        "attends appointments with authorities and banks on the ground",
        "files documents and collects paperwork",
        "hosts the kick-off of the Global VIP package in Miami",
      ],
    },
  },
];

/**
 * Was eine Gesellschaft auf der Seite ausweist: die Registernummer — und wo sie (noch) nicht
 * geprüft vorliegt, die Rechtsform nach dem Recht des Sitzstaats. So steht an jedem Standort
 * eine vollständige Angabe, nie eine Lücke (19.09.2026, E-192).
 */
export function standortNachweis(o: GlobalStandort): string {
  // Seit 30.10.2026 (E-466) tragen nur noch Gesellschaften mit eigener Registernummer einen Nachweis (FIAON LTD);
  // die Schwarzott Group steht ohne Register und ohne Rechtsform auf der Seite.
  return o.register ?? "";
}

/** Der Satz zur Verbindung — steht überall, wo die Partner genannt werden. */
export const GLOBAL_VERBUNDEN =
  "Die Schwarzott Group ist mit FIAON über unseren Gründer Justin Schwarzott verbunden. Ihr Vertragspartner ist in jedem Fall die FIAON LTD.";

/** Derselbe Satz auf Englisch (24.09.2026, E-234) — eine Quelle für Seite, Fuß und Register. */
export const GLOBAL_VERBUNDEN_EN =
  "Schwarzott Group is connected to FIAON through our founder Justin Schwarzott. Your contracting party is always FIAON LTD.";
