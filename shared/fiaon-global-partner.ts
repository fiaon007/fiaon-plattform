// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — VERTRAGSPARTNER UND VERBUNDENE GESELLSCHAFTEN (19.09.2026, E-191; neu gefasst 13.11.2026, E-510)
//
// Öffentlich heißt die verbundene Gesellschaft seit dem 30.10.2026 (E-466, Justin) nur „Schwarzott Group“ — ohne
// Registernummer, Anschrift, Ort und Register-Links. Verträge und Angebote nennen ihre Vertragsparteien dort, wo sie
// Vertragspartei sind; das hier betrifft nur die Seite. Namen, Nummern und Anschriften der Gesellschaften stehen
// bewusst NICHT in dieser Datei (das Repo ist öffentlich).
//
// · FIAON LTD — Companies House (England and Wales) No. 17318250, London (shared/fiaon-firma.ts).
//
// ── DIE VERBINDUNG ────────────────────────────────────────────────────────
// Die Gesellschaften sind über Justin Schwarzott verbunden. Die Seite sagt es selbst (fester Satz S13 in
// shared/fiaon-global-saetze.ts) — nichts weglassen, was für die Entscheidung zählt.
//
// ── WAS DIE PARTNER TUN — UND WAS NICHT ───────────────────────────────────
// Vertragspartner des Kunden ist immer die FIAON LTD. Die Partner arbeiten
// für FIAON (Team vor Ort) oder begleiten die Kapital-Etappe. Keine der drei
// Gesellschaften ist eine Bank, vergibt Kredite oder vermittelt sie; über
// Konto, Karte, Rahmen und Darlehen entscheidet das jeweilige Institut.
//
// ── 13.11.2026 (E-510, Sprachleitfaden FIAON Global, Leitplanke 7) — WAS ÖFFENTLICH GILT ──────────────────────
// · Die verbundene Gesellschaft heißt öffentlich nur „Schwarzott Group“ — OHNE Ort (nie im selben Blick wie Zürich oder
//   Miami), ohne Rolle, ohne Nummer, ohne Anschrift. Öffentlich steht sie nur mit dem Satz GLOBAL_VERBUNDEN (S13).
// · Vor Ort heißt es „unsere Partner in den USA“. Über Partner steht nichts im Präsens, was nicht belegt ist.
// · Die Liste GLOBAL_STANDORTE (Stadt + Gesellschaft) steht deshalb auf KEINER öffentlichen Seite mehr: Die Partnerseite
//   (shared/fiaon-global-seiten/partner.ts) liest von ihr nur noch London. Sie bleibt für den Fuß der nicht öffentlichen
//   Seiten (Angebot, Mandat, Konto — components/site/global/GlobalOrte.tsx). Wer den Baustein „standorte“ oder diese Liste
//   wieder auf eine öffentliche Seite setzt, bricht die Leitplanke.
// · Die Zeilen oben (19.09. bis 30.10.2026) sind der Verlauf; sie beschreiben nicht mehr, was auf der Seite steht.
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
      "schließt den Vertrag mit Ihnen und stellt die Rechnung",
      "koordiniert Gründung, Steuernummern, Partner und Termine",
      // E-510 (13.11.2026): wortgleich mit dem Rollen-Satz (Leitfaden 5.11) — „für die Leistungen Ihres Vertrags“.
      "trägt die Honorare der Partner für die Leistungen Ihres Vertrags",
    ],
    en: {
      stadt: "London", land: "United Kingdom", rechtsform: "Private Limited Company",
      rolle: "Your contracting party — agreement, invoice and dedicated contact",
      aufgaben: [
        "concludes the agreement with you and issues the invoice",
        "coordinates formation, tax identification numbers, partners and appointments",
        "bears the partners’ fees for the services in your agreement",
      ],
    },
  },
  {
    schluessel: "zuerich",
    stadt: "Zürich",
    land: "Schweiz",
    zeitzone: "Europe/Zurich",
    gesellschaft: "Schwarzott Group",
    rechtsform: "Verbundene Gesellschaft",
    adresse: ["Zürich, Schweiz"],
    register: null,
    // E-510 (13.11.2026): keine Rolle, keine Tätigkeit — nur die Offenlegung (wie im Fuß: „Verbundene Gesellschaft“).
    rolle: "Verbundene Gesellschaft",
    aufgaben: [
      "keine Bank, keine Kreditvergabe",
    ],
    en: {
      stadt: "Zurich", land: "Switzerland", rechtsform: "Connected company",
      rolle: "Connected company",
      aufgaben: [
        "not a bank, no lending",
      ],
    },
  },
  {
    schluessel: "miami",
    stadt: "Miami",
    land: "Florida, USA",
    zeitzone: "America/New_York",
    gesellschaft: "Schwarzott Group",
    rechtsform: "Partner in den USA",
    adresse: ["Miami, Florida"],
    register: null,
    // E-510 (13.11.2026): Rolle und Aufgabe in den Worten des Leitfadens (4.1 „unsere Partner in den USA“, 5.11 Übergangssatz).
    // Was ein Partner im Einzelnen tut, steht hier nicht mehr — solche Sätze gehen erst live, wenn der Partner bestätigt ist.
    // (Vorher: „Partner in Miami — Termine vor Ort und persönliche Begleitung“ und drei Tätigkeiten im Präsens.)
    rolle: "Unsere Partner in den USA",
    aufgaben: [
      "wir reichen die Gründung über unsere Partner in den USA ein",
    ],
    en: {
      stadt: "Miami", land: "Florida, USA", rechtsform: "Partners in the United States",
      rolle: "Our partners in the United States",
      aufgaben: [
        "we file the formation through our partners in the United States",
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
