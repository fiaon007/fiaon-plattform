// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — PRESSE UND MEDIEN (25.11.2026, E-532) · FG · 55
//
// Für Redaktionen (und für alle, die „FIAON Presse“ suchen): das Unternehmen in wenigen Sätzen, die prüfbaren Fakten
// und der Weg zu uns. Die Presse-Zeile („Zitiert in Die Presse …“) steht NICHT im Text — die Vorlage setzt sie genau
// einmal je Seite im Vertrauens-Band (global-seite.tsx → GlobalVertrauen, Leitfaden 6.1 und 6.3).
// Der Definitionssatz (Leitfaden 9.4) ist das Kurzprofil — derselbe Wortlaut wie in Datenblock und /llms.txt.
// Der Registereintrag (3. Juli 2026) steht wie auf /business/was-ist-fiaon-global, selbst nachgeprüft am 25.11.2026:
// FIAON LTD, 17318250, Private limited Company, Active, 128 City Road, London EC1V 2NX.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "../typen";
import { beleg, satz, weitererSatz } from "../../fiaon-global-saetze";
import { FIAON_FIRMA as F } from "../../fiaon-firma";

const STAND = "2026-11-25";
const DEFINITION = weitererSatz("DEFINITION");
/** „Was FIAON ist — und was nicht: keine Bank, …“ → nur die Aufzählung nach dem Doppelpunkt. */
const ROLLE = beleg("rolle").split(": ")[1].replace(/\.$/, "");

export const SEITE: GlobalSeite = {
  pfad: "/business/presse",
  art: "partner",
  seo: {
    titel: "FIAON Presse: Pressekontakt und Fakten — FIAON Global",
    beschreibung: "Presse und Medien bei FIAON Global: das Unternehmen in wenigen Sätzen, die prüfbaren Fakten der FIAON LTD, London, und der direkte Weg für Anfragen.",
  },
  stand: STAND,
  erschienen: STAND,
  kennung: "FG · 55",
  auge: "FIAON Global · Presse",
  h1: "Presse und Medien.",
  h1b: "Fakten für Ihre Berichterstattung.",
  lead: "Für Redaktionen, die über FIAON Global berichten: das Unternehmen in wenigen Sätzen, die prüfbaren Fakten und der direkte Weg zu uns. Anfragen beantworten wir schriftlich.",
  ziffern: [
    { wert: F.companyNo, label: "Companies House (England und Wales)" },
    { wert: "DE · EN", label: "Anfragen auf Deutsch und Englisch" },
    { wert: "London", label: `Sitz der ${F.name}` },
  ],
  blick: [
    ["Unternehmen", `${F.name}, London — FIAON Global ist ihre Unternehmensberatung für US-Gesellschaften`],
    ["Register", `Companies House (England und Wales), Nr. ${F.companyNo}, Eintrag vom 3. Juli 2026`],
    ["Gründer", `${F.director}, Director der ${F.name}`],
    ["Sitz", `${F.strasse}, ${F.ortZeile}, ${F.land}`],
    ["Pressekontakt", `${F.email}, Betreff „Presse“`],
    ["Telefon", `${F.telefon}, werktags`],
    ["Sprachen", "Deutsch und Englisch"],
  ],
  kurz: DEFINITION,
  bloecke: [
    {
      typ: "text", id: "kurzprofil", h2: "FIAON Global in wenigen Sätzen",
      absaetze: [
        DEFINITION,
        `Die ${F.name} ist eine Private Limited Company nach dem Recht von England und Wales mit Sitz in London. Geschäftsführer (Director) ist der Gründer ${F.director}.`,
        "Wir arbeiten auf Deutsch und auf Englisch, für Unternehmen, Gründer und Privatpersonen, die eine US-Gesellschaft aufbauen.",
      ],
    },
    {
      typ: "tabelle", id: "fakten", h2: "Fakten für Redaktionen",
      lead: "Die Angaben zum Unternehmen — prüfbar im Register und in den Unterlagen, die jeder Klient vor der Unterschrift erhält.",
      kopf: ["Merkmal", "Angabe"],
      zeilen: [
        ["Name", `FIAON Global — die Unternehmensberatung der ${F.name} für US-Gesellschaften`],
        ["Rechtsform", "Private Limited Company, England und Wales"],
        ["Register", `Companies House, Nr. ${F.companyNo}, Eintrag vom 3. Juli 2026`],
        ["Sitz", `${F.strasse}, ${F.ortZeile}, ${F.land}`],
        ["Leitung", `${F.director} (Director), Gründer`],
        ["Tätigkeit", "Gründung von US-Gesellschaften, laufende Betreuung und Begleitung bis zur Entscheidung über die Finanzierung"],
        ["Was FIAON nicht ist", ROLLE],
        ["Zahlung", weitererSatz("ZAHLUNG")],
      ],
    },
    {
      typ: "text", id: "anfragen", h2: "So erreichen Sie uns",
      absaetze: [
        `Presseanfragen richten Sie an ${F.email} mit dem Betreff „Presse“ — gern mit Ihrem Thema und Ihrem Termin. Wir antworten schriftlich und nennen Ihnen, wer für ein Gespräch zur Verfügung steht.`,
        `Telefon: ${F.telefon} (werktags, Deutsch und Englisch). Post: ${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}.`,
      ],
    },
    {
      typ: "hinweis", id: "hinweise", h2: "Hinweise für die Berichterstattung",
      punkte: [
        `FIAON schreibt sich F-I-A-O-N. Die Internetadresse ist fiaon.com, Vertragspartner ist die ${F.name} in London.`,
        satz("S8"),
        "Klienten nennen wir nur mit ihrer schriftlichen Zustimmung.",
      ],
    },
    {
      typ: "karten", id: "mehr", h2: "Mehr über FIAON Global", spalten: 3,
      karten: [
        { tag: "Profil", titel: "Was ist FIAON Global?", text: "Die Unternehmensberatung, ihre Zuständigkeiten und die Fakten mit Quellen.", pfad: "/business/was-ist-fiaon-global" },
        { tag: "Erfahrungen", titel: "Das Mandat von innen", text: "Erstgespräch, Vertrag, Rechnung, Portal und fester Ansprechpartner.", pfad: "/business/erfahrungen" },
        { tag: "Vertragspartner", titel: "Vertragspartner und Partner", text: `Die ${F.name} in London und wer wofür zuständig ist.`, pfad: "/business/partner" },
      ],
    },
  ],
  fragen: [
    { f: "Was ist FIAON Global?", a: DEFINITION },
    { f: "Wer steht hinter FIAON?", a: `Die ${F.name} mit Sitz in ${F.strasse}, ${F.ortZeile}, eingetragen im Companies House (England und Wales) unter Nr. ${F.companyNo}. Geschäftsführer (Director) ist der Gründer ${F.director}.` },
    { f: "Wie erreiche ich FIAON für eine Presseanfrage?", a: `Per E-Mail an ${F.email} mit dem Betreff „Presse“ oder telefonisch werktags unter ${F.telefon}. Wir antworten schriftlich, auf Deutsch oder Englisch.` },
    { f: "Ist FIAON eine Bank?", a: `Nein. ${satz("S8")}` },
  ],
  weiter: ["/business/was-ist-fiaon-global", "/business/erfahrungen", "/business/referenzen", "/business/partner"],
  quellen: [
    { titel: `Companies House (England und Wales): ${F.name}, Nr. ${F.companyNo}`, url: `https://find-and-update.company-information.service.gov.uk/company/${F.companyNo}` },
  ],
  schluss: { a: "Ihre Anfrage. ", b: "Unsere Antwort, schriftlich.", text: `Schreiben Sie an ${F.email} — Betreff „Presse“.` },
  prio: 0.5,
};
