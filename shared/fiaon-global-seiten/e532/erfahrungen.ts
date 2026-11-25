// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ERFAHRUNGEN: DAS MANDAT AUS SICHT DES KLIENTEN (25.11.2026, E-532) · FG · 54
//
// Justin (25.11.2026): Wer „FIAON seriös“ oder ähnlich sucht, soll auf Fakten treffen, die Vertrauen schaffen.
// „FIAON Erfahrungen“ führte bis heute auf die Seite der Privatkunden (/fiaon-erfahrungen). Diese Seite beantwortet
// die Frage für FIAON Global: wie ein Mandat von innen aussieht — Erstgespräch, Angebot, Unterschrift, Rechnung,
// Portal „Mein Auftrag“, fester Ansprechpartner. Nichts, was nicht im Produkt steht (Portal-Bezeichnungen wie in
// client/src/pages/global-portal.tsx).
//
// Sprachleitfaden FIAON Global (E-510): feste Sätze, Belege und Übergangssätze aus shared/fiaon-global-saetze.ts,
// keine Dauer als Zusage, kein Partner bei der Arbeit im Präsens (nur Rollenwörter), keine Presse-Zeile im Text
// (sie steht im Vertrauens-Band der Vorlage), kein Kundenname (Klienten nur mit schriftlicher Zustimmung, dann aus
// der Datenbank — nie im öffentlichen Quelltext).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "../typen";
import { GELD_ZURUECK, beleg, satz, weitererSatz } from "../../fiaon-global-saetze";
import { FIAON_FIRMA as F } from "../../fiaon-firma";

const STAND = "2026-11-25";
/** Satz S8, in seinen drei Sätzen — hier nur der zweite: keine Kredite. */
const KEINE_KREDITE = satz("S8").split(/(?<=\.)\s+/)[1];

export const SEITE: GlobalSeite = {
  pfad: "/business/erfahrungen",
  art: "partner",
  seo: {
    titel: "FIAON Erfahrungen: Ihr Mandat von innen — FIAON Global",
    beschreibung: "FIAON Erfahrungen: Was Klienten von FIAON Global erleben — Erstgespräch, Vertrag vor der Unterschrift, Rechnung, Portal und fester Ansprechpartner.",
  },
  stand: STAND,
  erschienen: STAND,
  kennung: "FG · 54",
  auge: "FIAON Global · Erfahrungen",
  h1: "So erleben Klienten",
  h1b: "ihr Mandat bei FIAON Global.",
  lead: "Wer „FIAON Erfahrungen“ sucht, will wissen, wie die Zusammenarbeit wirklich aussieht. Diese Seite zeigt es der Reihe nach: vom Erstgespräch über den Vertrag bis zum Portal „Mein Auftrag“, in dem Sie sehen, welcher Schritt Ihrer Gesellschaft gerade läuft.",
  ziffern: [
    { wert: "1 Ansprechpartner", label: "fest benannt, mit dem Start Ihres Mandats" },
    { wert: "Portal", label: "„Mein Auftrag“ — Stand, Dokumente, Verlauf" },
    { wert: "Vertrag", label: "vollständig lesbar, bevor Sie unterzeichnen" },
  ],
  blick: [
    ["Erstgespräch", "Dreißig Minuten, kostenfrei und ohne Verpflichtung"],
    ["Angebot", "Persönlich, mit Ihrem Honorar als Betrag"],
    ["Unterschrift", "Online, in Ihrem persönlichen Angebot"],
    ["Zahlung", `Per Rechnung und Überweisung an die ${F.name} — kein Abo, keine Abbuchung`],
    ["Portal", "„Mein Auftrag“: Ihre Gesellschaft, Ihr Tresor, Für Sie zu tun, Verlauf"],
    ["Neuigkeiten", "Im Portal beim Öffnen und per E-Mail"],
    ["Wer entscheidet", "Der Bundesstaat, die US-Steuerbehörde und das jeweilige Institut"],
  ],
  kurz: `Klienten von FIAON Global erleben ein Mandat mit festem Ansprechpartner. Sie lesen Ihren vollständigen Vertrag, bevor Sie unterzeichnen, zahlen per Rechnung an die ${F.name} und sehen im Portal „Mein Auftrag“, welcher Schritt gerade läuft. ${weitererSatz("LEITSATZ")}`,
  bloecke: [
    {
      typ: "etappen", id: "weg", h2: "Der Weg eines Mandats — aus Sicht des Klienten",
      lead: "Sechs Schritte, jeder mit seiner Bedingung. Was Sie selbst tun, steht dabei.",
      etappen: [
        { titel: "Erstgespräch", text: `Dreißig Minuten am Telefon, kostenfrei und ohne Verpflichtung. Sie schildern Ihr Vorhaben. ${beleg("fuerWenNicht")}` },
        { titel: "Persönliches Angebot", text: `${beleg("honorarVorab")} Im Angebot lesen Sie Ihren vollständigen Vertrag — auf Deutsch, nach deutschem Recht.` },
        { titel: "Unterschrift und Rechnung", text: `Sie unterzeichnen online in Ihrem Angebot. ${beleg("zahlung")}` },
        { titel: "Abgleich vor Beginn", text: beleg("pruefungVorBeginn") },
        { titel: "Gründung und Steuernummern", text: `${weitererSatz("UEBERGANG-EINREICHUNG")} Im Portal sehen Sie, welcher Schritt gerade läuft. ${satz("S3")}` },
        { titel: "Betreuung im ersten Jahr", text: `Die aktive Betreuung im ersten Jahr ist Teil Ihres Mandats. ${weitererSatz("UEBERGANG-ASSISTENZ")}` },
      ],
    },
    {
      typ: "karten", id: "portal", h2: "Ihr Portal „Mein Auftrag“", spalten: 2,
      lead: "Mit dem Start erhalten Sie Ihren Zugang. Dort steht alles, was Ihre Gesellschaft betrifft — für Sie jederzeit einsehbar.",
      karten: [
        { tag: "Gesellschaft", titel: "Ihre Gesellschaft", text: "Name, Bundesstaat, Registernummer, EIN und Registered Agent — sobald sie feststehen." },
        { tag: "Tresor", titel: "Ihr Tresor", text: "Gründungsunterlagen und die Schreiben der Behörden liegen dort als Dokumente für Sie bereit." },
        { tag: "Aufgaben", titel: "Für Sie zu tun", text: "Was wir von Ihnen brauchen — etwa Ihren Reisepass oder eine Unterschrift —, steht dort mit einer kurzen Erklärung." },
        { tag: "Verlauf", titel: "Verlauf und Nachrichten", text: "Jede Station erscheint im Verlauf. Neuigkeiten zeigt das Portal beim Öffnen und meldet sie Ihnen per E-Mail; Ihre Fragen stellen Sie Ihrem Ansprechpartner direkt im Portal." },
      ],
    },
    {
      typ: "text", id: "ansprechpartner", h2: "Ein fester Ansprechpartner",
      absaetze: [
        "Mit dem Start benennen wir Ihren Ansprechpartner. Er kennt Ihr Mandat, koordiniert die Schritte und beantwortet Ihre Fragen — telefonisch, per E-Mail und im Portal.",
        `${weitererSatz("UEBERGANG-ASSISTENZ")} ${weitererSatz("ROLLEN")}`,
      ],
    },
    {
      typ: "karten", id: "sicherheit", h2: "Was Klienten absichert", spalten: 2,
      karten: [
        { tag: "Vertrag", titel: "Vertrag vor der Unterschrift", text: "Ihren vollständigen Vertrag lesen Sie in Ihrem persönlichen Angebot, bevor Sie unterzeichnen.", pfad: "/business/mustervertrag" },
        { tag: "Zahlung", titel: "Nur per Rechnung", text: `${beleg("zahlung")} Kein Abo, keine Abbuchung.` },
        { tag: "Eigentum", titel: "Ihre Gesellschaft gehört Ihnen", text: beleg("eigentum") },
        { tag: "Erstattung", titel: GELD_ZURUECK.de.auge, text: satz("S7") },
      ],
    },
    {
      typ: "text", id: "diskretion", h2: "Referenzen und Diskretion",
      absaetze: [
        "Wir nennen Klienten nur mit ihrer schriftlichen Zustimmung. Diskretion gehört zum Mandat — auch gegenüber Interessenten.",
        "Für wen wir arbeiten und wie Sie uns ohne Referenz prüfen, steht auf der Seite „Mandate und Referenzen“.",
      ],
    },
    { typ: "hinweis", id: "grenzen", h2: "Was Sie wissen müssen", punkte: [satz("S3"), satz("S2"), satz("S10"), KEINE_KREDITE] },
  ],
  fragen: [
    { f: "Welche Erfahrungen machen Klienten mit FIAON Global?", a: `Ein Mandat mit festem Ansprechpartner und klaren Schritten. Sie lesen Ihren vollständigen Vertrag, bevor Sie unterzeichnen, zahlen per Rechnung an die ${F.name} und sehen im Portal „Mein Auftrag“, welcher Schritt gerade läuft. Klienten nennen wir nur mit ihrer schriftlichen Zustimmung.` },
    { f: "Wie sehe ich, was in meinem Mandat gerade passiert?", a: "Im Portal „Mein Auftrag“: Dort stehen Ihre Gesellschaft, Ihr Tresor mit den Dokumenten, was für Sie zu tun ist, und der Verlauf. Neuigkeiten zeigt das Portal beim Öffnen und meldet sie Ihnen per E-Mail." },
    { f: "Wer ist mein Ansprechpartner?", a: `Mit dem Start benennen wir Ihren festen Ansprechpartner. Er koordiniert Ihr Mandat und beantwortet Ihre Fragen telefonisch, per E-Mail und im Portal. ${weitererSatz("ROLLEN")}` },
    { f: "Warum nennt FIAON keine Namen von Klienten?", a: "Weil wir Klienten nur mit ihrer schriftlichen Zustimmung nennen. Wer eine US-Gesellschaft aufbaut, entscheidet selbst, wann sein Vorhaben öffentlich wird. Wie Sie uns ohne Referenz prüfen, steht auf der Seite „Mandate und Referenzen“." },
    { f: "Was gilt, wenn die Finanzierung ausbleibt?", a: satz("S7") },
  ],
  weiter: ["/business/referenzen", "/business/ablauf", "/business/mustervertrag", "/business/presse"],
  quellen: [
    { titel: `Companies House (England und Wales): ${F.name}, Nr. ${F.companyNo}`, url: `https://find-and-update.company-information.service.gov.uk/company/${F.companyNo}` },
  ],
  schluss: { a: "Erleben Sie es selbst. ", b: "Im Erstgespräch.", text: "Dreißig Minuten, kostenfrei und ohne Verpflichtung — mit Ihrem festen Ansprechpartner." },
  prio: 0.7,
};
