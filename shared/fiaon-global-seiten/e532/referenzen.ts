// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — MANDATE UND REFERENZEN: FÜR WEN WIR ARBEITEN (25.11.2026, E-532) · FG · 56
//
// Justin (25.11.2026): namhafte Unternehmen, die FIAON vertritt, sollen sichtbar werden — mit Freigabe der Kunden
// („Kunden um Freigabe bitten“). Bis eine schriftliche Zustimmung vorliegt, nennt die Seite KEINEN Namen: Sie zeigt,
// für wen das Mandat gedacht ist, das Profil der Mandate mit Stand (nur unterschriebene, nicht stornierte, ohne
// Testfälle — gezählt am 25.11.2026 in fiaon_global_auftraege: Wohnsitz DE/CH, Bundesstaaten Delaware/Florida)
// und wie man uns ohne Referenz prüft.
// Namen von Klienten stehen NIE in diesem öffentlichen Quelltext. Kommen Freigaben, liest die Seite sie zur
// Laufzeit aus der Datenbank (eigener Baustein, Folgeschritt) — mit Widerruf jederzeit.
// Stand ändern: Profil neu zählen (nur lesen), Tabelle + Blick + Kurz + Frage gemeinsam nachziehen.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "../typen";
import { beleg, satz, weitererSatz } from "../../fiaon-global-saetze";
import { FIAON_FIRMA as F } from "../../fiaon-firma";

const STAND = "2026-11-25";
const STAND_TEXT = "25. November 2026";

export const SEITE: GlobalSeite = {
  pfad: "/business/referenzen",
  art: "partner",
  seo: {
    titel: "Mandate und Referenzen: für wen wir arbeiten — FIAON Global",
    beschreibung: "Für wen FIAON Global arbeitet: Unternehmen, Gründer und Privatpersonen mit US-Gesellschaft. Referenzen nennen wir nur mit schriftlicher Zustimmung.",
  },
  stand: STAND,
  erschienen: STAND,
  kennung: "FG · 56",
  auge: "FIAON Global · Mandate und Referenzen",
  h1: "Für wen wir arbeiten.",
  h1b: "Namen nur mit Zustimmung.",
  lead: "FIAON Global arbeitet für Unternehmen, Gründer und Privatpersonen, die eine US-Gesellschaft aufbauen. Diese Seite zeigt, für wen das Mandat gedacht ist, wie unsere Mandate heute aussehen — und warum wir Klienten nur mit ihrer Zustimmung nennen.",
  ziffern: [
    { wert: "Delaware · Florida", label: `Bundesstaaten der Gesellschaften, Stand ${STAND_TEXT}` },
    { wert: "DE · CH", label: `Wohnsitz unserer Klienten, Stand ${STAND_TEXT}` },
    { wert: "1 Vertrag", label: "je Mandat, mit festem Ansprechpartner" },
  ],
  blick: [
    ["Für wen", "Unternehmen, Gründer und Privatpersonen mit Vorhaben in den USA"],
    ["Mandat", "Ein Vertrag, ein fester Ansprechpartner"],
    ["Bundesstaaten", `Delaware und Florida (Stand ${STAND_TEXT})`],
    ["Wohnsitz der Klienten", `Deutschland und die Schweiz (Stand ${STAND_TEXT})`],
    ["Referenzen", "Nur mit schriftlicher Zustimmung des Klienten"],
    ["Nicht geeignet", "Vorhaben ohne tatsächliche Geschäftstätigkeit"],
  ],
  kurz: `FIAON Global arbeitet für Unternehmen, Gründer und Privatpersonen, die eine US-Gesellschaft aufbauen. Mit Stand ${STAND_TEXT} leben unsere Klienten in Deutschland und in der Schweiz; ihre Gesellschaften gründen wir in Delaware und Florida. Klienten nennen wir nur mit ihrer schriftlichen Zustimmung.`,
  bloecke: [
    {
      typ: "karten", id: "fuerwen", h2: "Für wen das Mandat gedacht ist", spalten: 3,
      karten: [
        { tag: "Mittelstand", titel: "Tochtergesellschaft in den USA", text: "Für Unternehmen, die mit einer eigenen Gesellschaft in den US-Markt gehen.", pfad: "/business/tochtergesellschaft-usa" },
        { tag: "Onlinehandel", titel: "Onlinehandel und Marken", text: "Für Händler und Marken, die an Kunden in den USA verkaufen.", pfad: "/business/onlinehandel" },
        { tag: "Dienstleister", titel: "Agenturen und Software", text: "Für Agenturen und Softwarehäuser mit Kunden in den USA.", pfad: "/business/agenturen-software" },
        { tag: "Projekte", titel: "Bau und Immobilien", text: "Für Projekte und Objekte in den USA.", pfad: "/business/bau-immobilien" },
        { tag: "Privat", titel: "Privatpersonen und Gründer", text: "Für alle, die ohne eigene Firma beauftragen.", pfad: "/business/privatpersonen" },
        { tag: "Miami", titel: "Persönlich in Miami", text: weitererSatz("MIAMI"), pfad: "/business/miami" },
      ],
    },
    {
      typ: "tabelle", id: "profil", h2: "Unsere Mandate auf einen Blick",
      lead: "Das Profil unserer laufenden Mandate — ohne Namen, mit Stand.",
      kopf: ["Merkmal", `Stand ${STAND_TEXT}`],
      zeilen: [
        ["Wohnsitz der Klienten", "Deutschland, Schweiz"],
        ["Bundesstaaten der Gesellschaften", "Delaware, Florida"],
        ["Vertrag", "Online unterzeichnet, auf Deutsch, nach deutschem Recht"],
        ["Zahlung", `Per Rechnung an die ${F.name}`],
      ],
      fuss: ["Gezählt sind unterschriebene, nicht stornierte Mandate. Namen nennen wir nur mit schriftlicher Zustimmung."],
    },
    {
      typ: "text", id: "diskretion", h2: "Warum wir Namen nur mit Zustimmung nennen",
      absaetze: [
        "Wer eine US-Gesellschaft aufbaut, plant oft einen Markteintritt oder eine neue Struktur und entscheidet selbst, wann das öffentlich wird. Deshalb nennen wir Klienten nur mit ihrer schriftlichen Zustimmung — mit Namen, Branche und, wenn sie es wünschen, einem Satz zu ihrer Erfahrung.",
        "Klienten, die zustimmen, erscheinen auf dieser Seite. Ihre Zustimmung können sie jederzeit widerrufen; dann entfernen wir den Eintrag.",
      ],
    },
    {
      typ: "karten", id: "pruefen", h2: "So prüfen Sie uns ohne Referenz", spalten: 2,
      karten: [
        { tag: "Register", titel: "Registereintrag prüfen", text: `Companies House · Nr. ${F.companyNo} — öffentlich einsehbar, ohne Anmeldung; der Link steht unten bei den Quellen.` },
        { tag: "Vertrag", titel: "Vertrag vor der Unterschrift", text: "Ihren vollständigen Vertrag lesen Sie in Ihrem persönlichen Angebot, bevor Sie unterzeichnen.", pfad: "/business/mustervertrag" },
        { tag: "Zahlung", titel: "Nur per Rechnung", text: `${beleg("zahlung")} Die Bankverbindung steht auf der Seite „Ist FIAON seriös?“.` },
        { tag: "Prüfliste", titel: "Seriöse Anbieter erkennen", text: "Die Fragen, die Sie jedem Anbieter vor dem Auftrag stellen sollten — auch uns.", pfad: "/business/wissen/anbieter-pruefen" },
      ],
    },
    { typ: "hinweis", id: "nicht", h2: "Für wen das Mandat nicht geeignet ist", punkte: [beleg("fuerWenNicht"), satz("S10"), satz("S2")] },
  ],
  fragen: [
    { f: "Für wen arbeitet FIAON Global?", a: `Für Unternehmen, Gründer und Privatpersonen, die eine US-Gesellschaft aufbauen. Mit Stand ${STAND_TEXT} leben unsere Klienten in Deutschland und in der Schweiz; ihre Gesellschaften gründen wir in Delaware und Florida. Namen nennen wir nur mit schriftlicher Zustimmung.` },
    { f: "Warum nennt FIAON keine Referenzen mit Namen?", a: "Weil wir Klienten nur mit ihrer schriftlichen Zustimmung nennen. Wer eine US-Gesellschaft aufbaut, entscheidet selbst, wann sein Vorhaben öffentlich wird. Klienten, die zustimmen, erscheinen auf dieser Seite." },
    { f: "Wie prüfe ich FIAON ohne Referenz?", a: `Am Registereintrag der ${F.name} im Companies House (Nr. ${F.companyNo}), am vollständigen Vertrag, den Sie vor der Unterschrift lesen, und an der Zahlung: ${beleg("zahlung")}` },
    { f: "Ist das Mandat für jedes Vorhaben geeignet?", a: `Nein. ${beleg("fuerWenNicht")}` },
  ],
  weiter: ["/business/erfahrungen", "/business/wissen/anbieter-pruefen", "/business/tochtergesellschaft-usa", "/business/presse"],
  quellen: [
    { titel: `Companies House (England und Wales): ${F.name}, Nr. ${F.companyNo}`, url: `https://find-and-update.company-information.service.gov.uk/company/${F.companyNo}` },
  ],
  schluss: { a: "Prüfen Sie uns. ", b: "Dann sprechen wir.", text: "Dreißig Minuten, kostenfrei und ohne Verpflichtung — mit Ihrem festen Ansprechpartner." },
  prio: 0.6,
};
