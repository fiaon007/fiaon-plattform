// ═══════════════════════════════════════════════════════════════════════════
// DAS GLOBAL-PORTAL — „Mein Auftrag" für Firmenkunden, neu (E-338, 12.10.2026)
//
// Justin: „Die Firmenkunden brauchen ein PERFEKTES Dashboard … für ihre
//          Verträge, Status zur LLC, Infomaterial, Vollmachten, Unterlagen,
//          Anfragen, einfach ALLES … der beste und hochwertigste Zugang der
//          gesamten Plattform … alles in Global CI, Global Stil, mit vielen und
//          HOCHWERTIGEN Animationen, alles perfekt clean — einfach WOW."
//
// Diese Seite zeigt business-auftrag.tsx, sobald der Server `portalNeu`
// meldet — für einen Kunden erst, wenn die Leitung es für IHN freischaltet,
// für die Leitung als Vorschau (`vorschau`). Alle Texte mit Gewicht kommen aus
// ihren Quellen und werden NICHT neu getextet:
//   · Garantie, Frist, Teile, Startgespräch → ANGEBOT_MEIN_AUFTRAG / Server
//   · Sofortstart vs. Widerrufsfrist (E-334) → GLOBAL_AUFTRAG_WOERTER
//   · Jahresbetreuung → GLOBAL_JAHRESBETREUUNG
//   · Fahrplan, Tresor, Kapital → shared/fiaon-global-mandat.ts
//
// Gestaltung (Justins Regeln): heller Papiergrund, die dunkle Navy-Bühne an
// GENAU einer Stelle, das Blau-Paar, Newsreader für die großen Zeilen, Inter
// sonst, dünn und luftig. Nichts klebt beim Scrollen. Bewegung nur, wo sie
// führt — und gar keine bei „Bewegung reduzieren".
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, Suspense, lazy, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
// E-452 (28.10.2026): Justin: „weg mit den ICONS, die sehen billig aus“ — es bleiben nur Bedien-Zeichen
// (Ausklapp-Winkel, Lade-Kreis ohne Text). Alles andere ist Text und Typografie.
import { ChevronDown, Loader2 } from "lucide-react";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import { GLOBAL_AGENT, GLOBAL_JAHRESBETREUUNG, globalAgentKontakt, globalPreisText } from "@shared/fiaon-global";
import { ANGEBOT_MEIN_AUFTRAG } from "@shared/fiaon-global-angebot";
import { GLOBAL_FAHRPLAN, GLOBAL_TRESOR, globalNaechsterSchritt, globalUsd, type GlobalTresorKategorie } from "@shared/fiaon-global-mandat";
import { GLOBAL_ETAPPE_FUSSNOTE, usBundesstaatName } from "@shared/fiaon-global-bereich";
// 22.10.2026: die Werte der Stationen (EIN, ITIN-Maske, D-U-N-S, Telefon, Adressen, Konto) — eine Quelle mit dem Editor.
import { stationStatusName, stationTelefonText, stationZeilen, type GlobalPlusKunde, type StationZeile } from "@shared/fiaon-global-stationen";
// 22.10.2026: die neue Navigation — Glasleiste mit Themen und Panel, am Telefon ein ganzseitiges Menü.
import PortalNav, { type NavGruppe } from "./global-portal-nav";
// 22.10.2026: von Hand unterschreiben (IRS-Formulare) — ausdrucken, unterschreiben, als PDF scannen, hochladen.
import HandschriftDialog from "./global-portal-handschrift";
// 22.10.2026: digital unterschreiben — Zustimmung, Name, Code per E-Mail (E-SIGN), statt Zeichenfeld.
import UnterschriftDigital from "./global-portal-unterschrift";
import { HANDSCHRIFT_WOERTER } from "@shared/fiaon-global-akte";
// E-341: die Fachbereiche (Strategie & Wachstum, Recht & Verträge, Steuern & Pflichten) — erst beim Öffnen geladen.
const GlobalFach = lazy(() => import("./global-portal-fach"));
// Scheibe 1 „Ihr US-Büro“ (22.10.2026): Zusatzdienste per Klick — Texte und Preise aus shared/fiaon-global-zusatz.ts.
const GlobalDienste = lazy(() => import("./global-portal-dienste"));
// E-456 (29.10.2026): „Neu für Sie" — das Fenster beim Öffnen, wenn FIAON seit dem letzten Besuch etwas bereitgestellt hat.
const PortalNeuigkeiten = lazy(() => import("./global-portal-neuigkeiten"));
import type { GlobalNeuigkeit, GlobalNeuigkeitZiel } from "@shared/fiaon-global-neuigkeiten";
import { ZUSATZ_WOERTER, globalZusatz, zusatzFreigegeben } from "@shared/fiaon-global-zusatz";
import "@/styles/global-rahmen.css";
import "@/styles/global-portal.css";
// 22.10.2026: Apple-Glas (Justin: „Apple Design mit Glas — Glas wie im Screenshot!“) — eine Schicht über dem Portal.
import "@/styles/global-portal-glas.css";

type T = Record<string, any>;

// ── Die Seiten des Portals (E-341): Adresse #<seite>, Zurück-Taste funktioniert. ──
// 22.10.2026: dazu „gesellschaft“ (die Stammdaten) und „adressen“ (Nummer & Adressen) — beide aus den Werten der Stationen.
export type PortalSeite = "uebersicht" | "fahrplan" | "gesellschaft" | "tresor" | "post" | "adressen" | "anfragen" | "kapital" | "vertrag" | "dienste" | "strategie" | "recht" | "steuern";
const SEITEN: PortalSeite[] = ["uebersicht", "fahrplan", "gesellschaft", "tresor", "post", "adressen", "anfragen", "kapital", "vertrag", "dienste", "strategie", "recht", "steuern"];
// Die Gruppen der Navigation (22.10.2026). Ein Thema mit `direkt` führt sofort auf seine Seite; die anderen öffnen ein Panel.
const GRUPPEN: { key: "uebersicht" | "weg" | "buero" | "kapital" | "vertrag" | "fach"; direkt?: PortalSeite; seiten: PortalSeite[] }[] = [
  { key: "uebersicht", direkt: "uebersicht", seiten: ["uebersicht"] },
  { key: "weg", seiten: ["fahrplan", "gesellschaft"] },
  { key: "buero", seiten: ["post", "tresor", "adressen", "anfragen", "dienste"] },
  { key: "kapital", direkt: "kapital", seiten: ["kapital"] },
  { key: "vertrag", direkt: "vertrag", seiten: ["vertrag"] },
  { key: "fach", seiten: ["strategie", "recht", "steuern"] },
];
const seiteAusHash = (): PortalSeite => {
  const h = (typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "") as PortalSeite;
  return SEITEN.includes(h) ? h : "uebersicht";
};

// ── Wörter des neuen Portals (DE/EN). Alles mit Gewicht kommt aus `t` (GLOBAL_AUFTRAG_WOERTER). ──
const W = {
  de: {
    morgen: "Guten Morgen", tag: "Guten Tag", abend: "Guten Abend",
    navTitel: "Bereiche Ihres Portals", buero: "Ihr US-Büro", menue: "Menü",
    gruppen: { uebersicht: "Übersicht", weg: "Ihre Firma", buero: "Ihr Büro", kapital: "Kapital", vertrag: "Vertrag & Zahlung", fach: "Fachbereiche" } as Record<string, string>,
    seiten: { uebersicht: "Übersicht", fahrplan: "Ihr Weg", gesellschaft: "Firmendaten", tresor: "Tresor", post: "Post", adressen: "Nummer & Adressen", anfragen: "Anfragen", kapital: "Banken & Kapital", vertrag: "Vertrag & Zahlung", dienste: ZUSATZ_WOERTER.de.nav, strategie: "Strategie & Wachstum", recht: "Recht & Verträge", steuern: "Steuern & Pflichten" } as Record<string, string>,
    // E-452 (28.10.2026): Justin: „auch nicht sowas wie ‚Phase I von IV‘ — viel zu kompliziert, denk dich in den Kunden rein“.
    // Keine Phasen, Ziffern oder Zähler: EIN Satz, was gerade passiert, EIN Schritt für den Kunden, die Meilensteine in Alltagssprache.
    vorStart: "Vor dem Start", allesErledigt: "Alles erledigt",
    jetztAuge: "Gerade", fuerSie: "Für Sie", nichtsTun: "Sie müssen gerade nichts tun.",
    wegAnsehen: "Ganzen Weg ansehen", laeuft: "läuft", wegStartet: "Ihr Weg beginnt mit Ihrer Zahlung.",
    // Die Stationen in den Worten des Kunden — das Fachwort steht eine Seite tiefer im Erklärsatz.
    alltag: {
      name: "Firmenname gesichert", articles: "Gründung eingereicht", eingetragen: "Gesellschaft eingetragen",
      agent: "Anschrift für Behördenpost", adresse: "US-Adresse und Telefon", ein: "Steuernummer der Firma",
      operating_agreement: "Gesellschaftsvertrag", vorgesellschaft: "Alte Gesellschaft gelöscht", itin: "Ihre persönliche Steuernummer",
      konto: "US-Bankkonto", duns: "Eintrag im Firmenverzeichnis", karte_1: "Erste Firmenkarte", kartenleiter: "Weitere Firmenkarten",
      kreditrahmen: "Kreditrahmen",
    } as Record<string, string>,
    chip: { seit: (f: string, d: string) => `${f} seit ${d}`, name: "Name geprüft", ein: "EIN erteilt", itin: "ITIN erteilt", duns: "D-U-N-S vorhanden", konto: "Geschäftskonto eröffnet" },
    wegAuge: "Ihr Weg", kopieren: "Kopieren", dokOeffnen: "Öffnen",
    rolle: "Ihr Ansprechpartner", nachricht: "Nachricht",
    karteWeg: { auge: "Ihr Weg", text: "Jeder Schritt mit Datum, sobald er erledigt ist.", knopf: "Ihren Weg ansehen" },
    karteBuero: { auge: "Ihr Briefkasten", neu: (n: number) => n === 1 ? "Ein neuer Brief" : `${n} neue Briefe`, leer: "Alles gelesen", text: "Jeder Brief für Ihre Gesellschaft wird für Sie eingescannt.", knopf: "Zur Post" },
    karteFach: { auge: "Fachbereiche", titel: "Antworten für Ihre Gesellschaft", text: "Sparring, Vorlagen und Fristen — jederzeit, auf Ihre Gesellschaft bezogen." },
    zuletzt: "Zuletzt passiert", bueroTitel: "Ihr Büro", bueroLead: "Nummer, Adressen, Post, Konto und Fristen — ein Klick öffnet jedes Detail.",
    kachel: { nummer: "Ihre US-Nummer", konto: "Konto & Karten", adressen: "Adressen & Post", fristen: "Fristen", dokumente: "Dokumente", dienste: "Ihre Dienste" },
    kontoEroeffnet: (d: string) => `Geschäftskonto eröffnet am ${d}`, kontoFolgt: "Das Geschäftskonto folgt auf Ihrem Weg.", kartenLeer: "Karten erscheinen hier mit ihrem Stand.",
    karte: { firma: "Firmenkarte", privat: "Private Karte" } as Record<string, string>, limit: (b: string) => `Rahmen ${b}`,
    geschaeft: "Geschäftsadresse", privat: "Private Adresse", agentPost: "Anschrift für Behördenpost", adresseFolgt: "folgt", postZahl: (n: number, neu: number) => neu ? `${neu} neu von ${n}` : n === 1 ? "1 Brief" : `${n} Briefe`,
    fristenLeer: "Keine Frist in Sicht.", dokumenteLeer: "Noch keine Dokumente.", diensteLeer: "Was Sie dazunehmen, erscheint hier.", oeffnenPfeil: "Öffnen",
    anzeigen: "Anzeigen", verbergen: "Verbergen", itinFehler: "Die ITIN ließ sich gerade nicht anzeigen — bitte gleich noch einmal.",
    adressenLeer: "Ihre US-Nummer und Ihre Adressen erscheinen hier, sobald sie eingerichtet sind.", anrufen: "Anrufen",
    rechnungenTitel: "Alle Rechnungen", rechnungenLead: "Jede Rechnung zu Ihrem Auftrag — mit Stand, PDF und Zahlung.", rechnungenLeer: "Noch keine Rechnung.",
    vertraegeTitel: "Verträge und Vereinbarungen", vertraegeLeer: "Der Vertrag erscheint hier mit dem Auftrag.",
    pflichtTitel: "Ihre Unterschriften", pflichtLead: "Was wir für Ihre Gesellschaft von Ihnen unterschrieben brauchen.", pflichtVoll: "Alles unterschrieben — danke.",
    pflichtTun: (x: string) => `Bitte unterschreiben: ${x}`,
    allesLaden: "Alle Unterlagen herunterladen", allesLadenText: "Verträge, Rechnungen, unterschriebene Dokumente und Ihr Tresor — als eine ZIP-Datei mit Inhaltsverzeichnis.",
    zurZahlung: "Zur Zahlung", weitereLeistungen: "Weitere Leistungen", weitereLead: "Was Sie zu Ihrem Auftrag dazugenommen haben.",
    stammTitel: "Die Daten Ihrer Gesellschaft", stammLead: "Nummern, Adressen und Daten — zum Nachschlagen und Kopieren.", zumFahrplan: "Ihren Weg ansehen",
    // Leer = die Seite trägt ihren einen Satz im Abschnitt darunter (keine Doppelung).
    seitenSatz: {
      fahrplan: "",
      tresor: "",
      post: "",
      anfragen: "",
      kapital: "",
      vertrag: "Auftrag, Zahlungsplan und Rechnungen.",
      dienste: ZUSATZ_WOERTER.de.lead,
      strategie: "Sparring, Rechner und Wissen für Wachstum und Kapital.",
      recht: "Vorlagen, Wissen und Antworten rund um Ihre Gesellschaft.",
      steuern: "Fristen, Formulare und Antworten auf Steuerfragen.",
    } as Record<string, string>,
    alleBereiche: "Alles für Ihre Gesellschaft",
    meinAuftrag: "Mein Auftrag", ihreGesellschaft: "Ihre Gesellschaft", inGruendung: "in Gründung", gesellschaftOhneName: "Ihre US-Gesellschaft",
    naechsterLeer: "Wir melden uns mit dem nächsten Schritt.",
    tunTitel: "Für Sie zu tun", tunWeiter: "Weitere Schritte", tunLeer: "Alles erledigt — wir sind am Zug.",
    unterschriftTitel: (x: string) => `Bitte unterschreiben: ${x}`, unterschriftText: "Direkt hier, ohne Ausdrucken.", unterschreiben: "Jetzt unterschreiben",
    antwortTitel: (n: string) => `Neue Antwort von ${n}`, antwortText: "Zu Ihrer Anfrage.", lesen: "Antwort lesen",
    postTitel: (n: number) => n === 1 ? "Ein neuer Brief" : `${n} neue Briefe`, postText: "Für Sie eingescannt.", oeffnen: "Öffnen",
    unterlagenTitel: (n: number) => n === 1 ? "Eine Unterlage fehlt noch" : `${n} Unterlagen fehlen noch`, unterlagenText: "Bitte im Tresor hochladen.", zumTresor: "Zum Tresor",
    // E-443 (28.10.2026): eine Unterlage, die wir neu brauchen — mit dem Grund aus dem Team.
    neuTitel: (x: string) => `Bitte neu einreichen: ${x}`, bitteNeu: "Bitte neu einreichen", neuGrund: (x: string) => `Bitte neu: ${x}`,
    termin: "Ihr Startgespräch",
    fahrplanTitel: "Schritt für Schritt", fahrplanLead: "Was erledigt ist, steht mit Datum da. Was noch kommt, folgt darunter.",
    // E-452: EIN Wort für „läuft“ — Karte, Kapitel und Station sagen dasselbe.
    stand: { offen: "offen", in_arbeit: "läuft", beantragt: "läuft", erledigt: "erledigt" } as Record<string, string>,
    etappeStand: { fertig: "erledigt", jetzt: "läuft", arbeit: "läuft", offen: "kommt danach" } as Record<string, string>,
    tresorTitel: "Ihr Tresor", tresorLead: "Alle Dokumente vertraulich an einem Ort — unterschreiben direkt hier.", alle: "Alle",
    nachweise: "Nachweise und Sicherheiten", vertragRechnungen: "Vertrag und Rechnungen", neu: "Neu", leerMappe: "Noch leer.",
    hochladenTitel: "Unterlage hochladen", hochladenFeld: "Datei hierher ziehen oder auswählen", hochladenKlein: "PDF, JPG, PNG oder HEIC · bis 15 MB", art: "Was laden Sie hoch?", hochladen: "Hochladen", laedt: "Wird hochgeladen …",
    unterschrieben: (d: string) => `unterschrieben am ${d}`, wartet: "wartet auf Ihre Unterschrift",
    postFachTitel: "Ihr Briefkasten", postLead: GLOBAL_AGENT.de.post as string, postLeer: "Noch keine Post — neue Briefe erscheinen hier.", absender: "Absender", eingang: "Eingang",
    anfragenTitel: "Ihre Anfragen", anfragenLead: (n: string) => `Schreiben Sie ${n} — die Antwort lesen Sie hier.`, anfragenLeer: "Noch keine Anfrage.", sie: "Sie", platzhalter: "Ihre Nachricht …", senden: "Senden", sendet: "Wird gesendet …",
    kapitalTitel: "Banken & Kapital", kapitalLead: "Konto, Firmenkarten und Kreditrahmen — mit dem Stand jedes Antrags.", kapitalLeer: "Noch kein Antrag — jeder Schritt erscheint hier.", zugesagt: "Zugesagt und aktiv", beantragt: (d: string) => `beantragt ${d}`,
    fristenNachZahlung: "Der Kalender startet mit Ihrem Zahlungseingang.",
    fristenTitel: "Pflichten & Fristen", fristenLead: "Was wann fällig ist — wir erinnern Sie dreißig und sieben Tage vorher.", inTagen: (n: number) => n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`, ueber: (n: number) => `seit ${n} ${n === 1 ? "Tag" : "Tagen"} fällig`,
    verlaufTitel: "Was bisher geschah", alleZeigen: "Alle anzeigen", weniger: "Weniger zeigen",
    gesellschaftLeer: "Die Angaben folgen mit der Eintragung.",
    kontaktTitel: "Ihr Ansprechpartner", schreiben: "Nachricht schreiben", gesellschaftTitel: "Ihre US-Gesellschaft", auftragTitel: "Ihr Auftrag", kopiert: "Kopiert",
    felder: { name: "Name", form: "Rechtsform", bundesstaat: "Bundesstaat", gegruendet: "Eingetragen am", aktenzeichen: "Registernummer", ein: "EIN", registeredAgent: "Registered Agent", usAdresse: "US-Adresse", usTelefon: "US-Telefon", itin: "ITIN" },
    itin: { offen: "noch offen", beantragt: "beantragt", vorhanden: "erteilt" } as Record<string, string>,
    sicher: "Ihr persönlicher Zugang · verschlüsselt", vorschau: (n: string) => `Vorschau — so sieht ${n} das Portal. Nichts gilt als gelesen; handeln kann nur der Kunde.`,
    modalTitel: "Dokument unterschreiben", modalLesen: "In neuem Fenster öffnen", modalName: "Ihr vollständiger Name", modalZeichnen: "Unterschrift — mit Finger, Stift oder Maus", modalLoeschen: "Neu zeichnen",
    modalZustimmung: "Ich habe das Dokument gelesen und unterschreibe es elektronisch.", modalKnopf: "Verbindlich unterschreiben", modalLaeuft: "Wird unterschrieben …", modalFertig: "Unterschrieben",
    modalFertigText: "Liegt in Ihrem Tresor — Ihr Ansprechpartner ist informiert.", schliessen: "Schließen",
    fusszeile: "FIAON Global · Vertraulich · Ihr persönlicher Bereich.",
  },
  en: {
    morgen: "Good morning", tag: "Good afternoon", abend: "Good evening",
    navTitel: "Areas of your portal", buero: "Your US office", menue: "Menu",
    gruppen: { uebersicht: "Overview", weg: "Your company", buero: "Your office", kapital: "Capital", vertrag: "Contract & payment", fach: "Expert areas" } as Record<string, string>,
    seiten: { uebersicht: "Overview", fahrplan: "Your path", gesellschaft: "Company details", tresor: "Vault", post: "Mail", adressen: "Number & addresses", anfragen: "Requests", kapital: "Banking & capital", vertrag: "Contract & payment", dienste: ZUSATZ_WOERTER.en.nav, strategie: "Strategy & growth", recht: "Law & contracts", steuern: "Tax & compliance" } as Record<string, string>,
    vorStart: "Before the start", allesErledigt: "All done",
    jetztAuge: "Right now", fuerSie: "For you", nichtsTun: "There is nothing you need to do right now.",
    wegAnsehen: "See the whole path", laeuft: "under way", wegStartet: "Your path begins once your payment arrives.",
    alltag: {
      name: "Company name secured", articles: "Formation filed", eingetragen: "Company registered",
      agent: "Address for official mail", adresse: "US address and phone", ein: "Company tax number",
      operating_agreement: "Company agreement", vorgesellschaft: "Previous company closed", itin: "Your personal tax number",
      konto: "US bank account", duns: "Business directory listing", karte_1: "First business card", kartenleiter: "More business cards",
      kreditrahmen: "Credit line",
    } as Record<string, string>,
    chip: { seit: (f: string, d: string) => `${f} since ${d}`, name: "Name checked", ein: "EIN issued", itin: "ITIN issued", duns: "D-U-N-S on file", konto: "Business account open" },
    wegAuge: "Your path", kopieren: "Copy", dokOeffnen: "Open",
    rolle: "Your contact", nachricht: "Message",
    karteWeg: { auge: "Your path", text: "Every step with its date once it is done.", knopf: "See your path" },
    karteBuero: { auge: "Your mailbox", neu: (n: number) => n === 1 ? "One new letter" : `${n} new letters`, leer: "All read", text: "Every letter for your company is scanned for you.", knopf: "To your mail" },
    karteFach: { auge: "Expert areas", titel: "Answers for your company", text: "Sparring, templates and deadlines — any time, tailored to your company." },
    zuletzt: "Recently", bueroTitel: "Your office", bueroLead: "Number, addresses, mail, account and deadlines — one click opens every detail.",
    kachel: { nummer: "Your US number", konto: "Account & cards", adressen: "Addresses & mail", fristen: "Deadlines", dokumente: "Documents", dienste: "Your services" },
    kontoEroeffnet: (d: string) => `Business account opened on ${d}`, kontoFolgt: "The business account follows on your path.", kartenLeer: "Cards appear here with their status.",
    karte: { firma: "Business card", privat: "Personal card" } as Record<string, string>, limit: (b: string) => `Limit ${b}`,
    geschaeft: "Business address", privat: "Private address", agentPost: "Address for official mail", adresseFolgt: "to follow", postZahl: (n: number, neu: number) => neu ? `${neu} new of ${n}` : n === 1 ? "1 letter" : `${n} letters`,
    fristenLeer: "No deadline in sight.", dokumenteLeer: "No documents yet.", diensteLeer: "What you add appears here.", oeffnenPfeil: "Open",
    anzeigen: "Show", verbergen: "Hide", itinFehler: "The ITIN could not be shown just now — please try again shortly.",
    adressenLeer: "Your US number and your addresses appear here once they are set up.", anrufen: "Call",
    rechnungenTitel: "All invoices", rechnungenLead: "Every invoice for your order — with status, PDF and payment.", rechnungenLeer: "No invoice yet.",
    vertraegeTitel: "Contracts and agreements", vertraegeLeer: "The contract appears here with the order.",
    pflichtTitel: "Your signatures", pflichtLead: "What we need signed by you for your company.", pflichtVoll: "Everything signed — thank you.",
    pflichtTun: (x: string) => `Please sign: ${x}`,
    allesLaden: "Download all documents", allesLadenText: "Contracts, invoices, signed documents and your vault — as one ZIP file with an index.",
    zurZahlung: "Go to payment", weitereLeistungen: "Further services", weitereLead: "What you have added to your order.",
    stammTitel: "Your company's details", stammLead: "Numbers, addresses and dates — to look up and copy.", zumFahrplan: "See your path",
    seitenSatz: {
      fahrplan: "",
      tresor: "",
      post: "",
      anfragen: "",
      kapital: "",
      vertrag: "Order, payment plan and invoices.",
      dienste: ZUSATZ_WOERTER.en.lead,
      strategie: "Sparring, calculators and know-how for growth and capital.",
      recht: "Templates, know-how and answers about your company.",
      steuern: "Deadlines, forms and answers to tax questions.",
    } as Record<string, string>,
    alleBereiche: "Everything for your company",
    meinAuftrag: "My order", ihreGesellschaft: "Your company", inGruendung: "being formed", gesellschaftOhneName: "Your US company",
    naechsterLeer: "We will be in touch with the next step.",
    tunTitel: "For you to do", tunWeiter: "Further steps", tunLeer: "All done — the next move is ours.",
    unterschriftTitel: (x: string) => `Please sign: ${x}`, unterschriftText: "Right here, no printing needed.", unterschreiben: "Sign now",
    antwortTitel: (n: string) => `New reply from ${n}`, antwortText: "On your request.", lesen: "Read the reply",
    postTitel: (n: number) => n === 1 ? "One new letter" : `${n} new letters`, postText: "Scanned for you.", oeffnen: "Open",
    unterlagenTitel: (n: number) => n === 1 ? "One document is still missing" : `${n} documents are still missing`, unterlagenText: "Please upload to your vault.", zumTresor: "Go to the vault",
    neuTitel: (x: string) => `Please submit again: ${x}`, bitteNeu: "Please submit again", neuGrund: (x: string) => `Needed again: ${x}`,
    termin: "Your kick-off call",
    fahrplanTitel: "Step by step", fahrplanLead: "What is done carries its date. What is still to come follows below.",
    stand: { offen: "open", in_arbeit: "under way", beantragt: "under way", erledigt: "done" } as Record<string, string>,
    etappeStand: { fertig: "done", jetzt: "under way", arbeit: "under way", offen: "still to come" } as Record<string, string>,
    tresorTitel: "Your vault", tresorLead: "Every document, confidential and in one place — sign right here.", alle: "All",
    nachweise: "Evidence and collateral", vertragRechnungen: "Contract and invoices", neu: "New", leerMappe: "Empty for now.",
    hochladenTitel: "Upload a document", hochladenFeld: "Drop a file here or choose one", hochladenKlein: "PDF, JPG, PNG or HEIC · max. 15 MB", art: "What are you uploading?", hochladen: "Upload", laedt: "Uploading …",
    unterschrieben: (d: string) => `signed on ${d}`, wartet: "awaiting your signature",
    postFachTitel: "Your mailbox", postLead: GLOBAL_AGENT.en.post as string, postLeer: "No mail yet — new letters appear here.", absender: "Sender", eingang: "Received",
    anfragenTitel: "Your requests", anfragenLead: (n: string) => `Write to ${n} — you read the reply here.`, anfragenLeer: "No requests yet.", sie: "You", platzhalter: "Your message …", senden: "Send", sendet: "Sending …",
    kapitalTitel: "Banking & capital", kapitalLead: "Account, business cards and credit lines — with the status of every application.", kapitalLeer: "No application yet — every step appears here.", zugesagt: "Approved and active", beantragt: (d: string) => `applied for ${d}`,
    fristenNachZahlung: "The calendar starts once your payment has arrived.",
    fristenTitel: "Compliance & deadlines", fristenLead: "What is due when — we remind you thirty and seven days ahead.", inTagen: (n: number) => n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`, ueber: (n: number) => `due ${n} ${n === 1 ? "day" : "days"} ago`,
    verlaufTitel: "What has happened so far", alleZeigen: "Show all", weniger: "Show less",
    gesellschaftLeer: "The details follow with registration.",
    kontaktTitel: "Your contact", schreiben: "Write a message", gesellschaftTitel: "Your US company", auftragTitel: "Your order", kopiert: "Copied",
    felder: { name: "Name", form: "Legal form", bundesstaat: "State", gegruendet: "Registered on", aktenzeichen: "Register number", ein: "EIN", registeredAgent: "Registered agent", usAdresse: "US address", usTelefon: "US phone", itin: "ITIN" },
    itin: { offen: "still open", beantragt: "applied for", vorhanden: "issued" } as Record<string, string>,
    sicher: "Your personal access · encrypted", vorschau: (n: string) => `Preview — this is how ${n} sees the portal. Nothing is marked as read; only the client can act.`,
    modalTitel: "Sign the document", modalLesen: "Open in a new window", modalName: "Your full name", modalZeichnen: "Signature — finger, pen or mouse", modalLoeschen: "Draw again",
    modalZustimmung: "I have read the document and sign it electronically.", modalKnopf: "Sign with binding effect", modalLaeuft: "Signing …", modalFertig: "Signed",
    modalFertigText: "Now in your vault — your contact has been informed.", schliessen: "Close",
    fusszeile: "FIAON Global · Confidential · Your personal area.",
  },
};

const ruhig = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Elemente mit `gp-auftauchen` erscheinen, wenn sie in den Blick kommen — einmal, dann Ruhe. */
function useAuftauchen(abh: unknown) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".gp-auftauchen:not(.gp-da)"));
    if (ruhig() || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("gp-da")); return; }
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) if (e.isIntersecting) { (e.target as HTMLElement).classList.add("gp-da"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [abh]);
}

/**
 * E-452: Beim ersten Aufruf steht die Startbühne (index.html, #fi-start) über der Seite. Die Bühne der Übersicht wartet,
 * bis sie WEG ist — sonst liefe die Namens-Animation dahinter ab. „zu“ ist nur der Anfang ihres Ausgangs (App.tsx:
 * die Streifen laufen danach noch ~950 ms über die Seite); erst wenn die Hülle aus dem DOM ist, steht die Bühne frei.
 * Nach Seitenwechseln gibt es keine Startbühne. Die Hülle liegt direkt in <body> (index.html).
 */
function useStartbuehneOffen(): boolean {
  const offen = () => typeof document === "undefined" || !document.getElementById("fi-start");
  const [o, setO] = useState(offen);
  useEffect(() => {
    if (o) return;
    if (offen()) { setO(true); return; }
    const mo = new MutationObserver(() => { if (offen()) { setO(true); mo.disconnect(); } });
    mo.observe(document.body, { childList: true });
    const notfall = window.setTimeout(() => setO(true), 6000);
    return () => { mo.disconnect(); window.clearTimeout(notfall); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o]);
  return o;
}

// ── Unterschreiben ───────────────────────────────────────────────────────────
// 22.10.2026: Das Zeichenfeld ist abgelöst — digital unterschreibt der Kunde mit Zustimmung, getipptem Namen und Code
// per E-Mail (global-portal-unterschrift.tsx); von Hand (IRS-Formulare) mit Scan (global-portal-handschrift.tsx).

// ── Das Portal ───────────────────────────────────────────────────────────────
export default function GlobalPortal({ a, gref, token, s, t, laden }: {
  a: T; gref: string; token: string; s: "de" | "en"; t: T; laden: () => Promise<void> | void;
}) {
  const w = W[s];
  const loc = s === "en" ? "en-GB" : "de-DE";
  const vorschau = !!a.vorschau;
  const basis = `/api/fiaon/global/mein-auftrag/${encodeURIComponent(gref)}`;
  const mitToken = (pfad: string) => `${basis}${pfad}?t=${encodeURIComponent(token)}${vorschau ? "&vorschau=1" : ""}`;
  const tag = (iso?: string | null) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" }) : "";
  const tagKurz = (iso?: string | null) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const zeit = (iso?: string | null) => iso ? new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const euroText = (c?: number | null) => c == null ? "" : `${(Number(c) / 100).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const kb = (n?: number) => !n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString(loc, { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
  // ── Seiten (E-341) ──
  const [seite, setSeite] = useState<PortalSeite>(seiteAusHash);
  // 22.10.2026: Die Seite gleitet in die Richtung, in der sie im Menü steht (vor = weiter rechts/unten, zurück = davor).
  const [richtung, setRichtung] = useState<"vor" | "zurueck">("vor");
  const wechsel = (z: PortalSeite) => setSeite((alt) => { setRichtung(SEITEN.indexOf(z) >= SEITEN.indexOf(alt) ? "vor" : "zurueck"); return z; });
  useEffect(() => {
    const neu = () => wechsel(seiteAusHash());
    window.addEventListener("hashchange", neu);
    return () => window.removeEventListener("hashchange", neu);
  }, []);
  const geh = (ziel: PortalSeite | string) => {
    const z = (SEITEN.includes(ziel as PortalSeite) ? ziel : "uebersicht") as PortalSeite;
    if (window.location.hash !== `#${z}`) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${z}`);
    wechsel(z);
    window.scrollTo({ top: 0, behavior: ruhig() ? "auto" : "smooth" });
  };
  useAuftauchen(`${a.ref}:${seite}`);
  const buehneOffen = useStartbuehneOffen();
  // Titel, „nicht indexieren" und Dokument-Scrollen (iOS blendet seine Leisten nur beim Scrollen des Dokuments aus).
  useEffect(() => {
    const vorher = document.title;
    document.title = `${w.meinAuftrag} · ${a.gesellschaft?.name || a.firma?.name || "FIAON Global"}`;
    const meta = document.createElement("meta"); meta.name = "robots"; meta.content = "noindex, nofollow"; document.head.appendChild(meta);
    document.documentElement.classList.add("fg-dokument");
    return () => { document.title = vorher; meta.remove(); document.documentElement.classList.remove("fg-dokument"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── abgeleitet ──
  const dz: Record<string, T> = a.dokumentZusatz ?? {};
  const doks: T[] = (a.dokumente ?? []).map((d: T) => ({ ...d, ...(dz[String(d.id)] ?? {}) }));
  const post = doks.filter((d) => d.art === "post");
  const tresorDoks = doks.filter((d) => d.art !== "post");
  const zuUnterschreiben = doks.filter((d) => d.unterschrift?.gefordert && !d.unterschrift?.unterschrieben);
  const schritte: T[] = a.schritte ?? [];
  const sichtbareSchritte = schritte.filter((x) => x.status !== "entfaellt");
  const erledigt = sichtbareSchritte.filter((x) => x.status === "erledigt").length;
  const nachrichten: T[] = a.nachrichten ?? [];
  const ungeleseneAntworten = nachrichten.filter((n) => n.von === "fiaon" && !n.gelesen);
  const postNeu = post.filter((d) => !d.gelesen);
  // 30.10.2026: der Server sagt, ob der Dokumentenraum offen ist (bei angenommenem Angebot schon vor der Zahlung — Vertrag Ziffer 7).
  const darfHochladen = typeof a.uploadOffen === "boolean" ? a.uploadOffen : ["bezahlt", "gestartet", "abgeschlossen"].includes(a.status);
  const fehlend = darfHochladen ? (a.unterlagen ?? []).filter((u: T) => !u.vorhanden) : [];
  // E-443 (28.10.2026): Was das Team als „bitte neu“ markiert hat und nicht schon oben als fehlende Unterlage steht.
  const nachreichen: T[] = darfHochladen ? (a.nachreichen ?? []) : [];
  const ap = a.ansprechpartner as T | undefined;
  const apVorname = ap?.vorname || ap?.name?.split(" ")[0] || (s === "en" ? "your contact" : "Ihrem Ansprechpartner");
  const g = a.gesellschaft ?? {};
  const gp: GlobalPlusKunde = a.gesellschaftPlus ?? {};
  // Die ITIN im Klartext — nur nach „Anzeigen“, für 20 Sekunden (der Server liefert sonst nur die Maske).
  const [itinKlar, setItinKlar] = useState<string | null>(null);
  const [itinFehler, setItinFehler] = useState("");
  useEffect(() => { if (!itinKlar) return; const u = window.setTimeout(() => setItinKlar(null), 20_000); return () => window.clearTimeout(u); }, [itinKlar]);
  const itinAnzeigen = async () => {
    setItinFehler("");
    try {
      const r = await fetch(mitToken("/itin"), { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setItinKlar(String(j.itin)); else setItinFehler(j.error || w.itinFehler);
    } catch { setItinFehler(w.itinFehler); }
  };
  const kapital: T[] = a.kapital ?? [];
  const zugesagtCents = kapital.filter((k) => (k.status === "zugesagt" || k.status === "aktiv") && ["karte", "kreditrahmen", "darlehen"].includes(k.art)).reduce((x, k) => x + Number(k.betragCents || 0), 0);
  const J = GLOBAL_JAHRESBETREUUNG[s];
  const stunde = new Date().getHours();
  const hallo = stunde < 11 ? w.morgen : stunde < 18 ? w.tag : w.abend;
  // „Herr Mustermann" — mit Anrede und Nachname; fehlt die Anrede, der hinterlegte Name, sonst nur der Gruß.
  // E-452: auf Englisch „Mr“/„Ms“ statt „Herr“/„Frau“ (die Anrede kommt deutsch aus dem Auftrag).
  const anredeText = (x: string) => s !== "en" ? x : ({ herr: "Mr", frau: "Ms" } as Record<string, string>)[x.trim().toLowerCase()] ?? x;
  const name = a.gruss?.anrede && a.gruss?.nachname ? `${anredeText(String(a.gruss.anrede))} ${a.gruss.nachname}` : (a.gruss?.name ?? "");
  const vollerName = [a.gruss?.vorname, a.gruss?.nachname].filter(Boolean).join(" ") || a.gruss?.name || "";

  // ── Tresor-Mappen ──
  const [mappe, setMappe] = useState<string>("alle");
  const mappen = useMemo(() => {
    const m: { key: string; titel: string; zahl: number }[] = [];
    const vertragZahl = (a.vertragUrl ? 1 : 0) + (a.rechnungUrl ? 1 : 0) + ((a.angebot?.teile ?? []).filter((x: T) => x.rechnungUrl).length);
    if (vertragZahl) m.push({ key: "vertrag", titel: w.vertragRechnungen, zahl: vertragZahl });
    if ((a.angebotUnterlagen ?? []).length) m.push({ key: "nachweise", titel: w.nachweise, zahl: a.angebotUnterlagen.length });
    for (const k of GLOBAL_TRESOR) {
      if (k.kategorie === "vertrag" || k.kategorie === "post") continue;
      const n = tresorDoks.filter((d) => (d.kategorie ?? "sonstiges") === k.kategorie).length;
      if (n) m.push({ key: k.kategorie, titel: s === "en" ? k.titel.en : k.titel.de, zahl: n });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, s]);

  // ── Hochladen ──
  const [art, setArtRoh] = useState("sonstiges");
  // E-443 (28.10.2026): Ist eine Unterlage angefordert oder „bitte neu“, steht ihre Art im Upload schon vorbelegt — bis der
  // Kunde selbst wählt. Vorher stand dort immer „Sonstiges“, und ein Pass landete als „Sonstiges Dokument“.
  const [artGewaehlt, setArtGewaehlt] = useState(false);
  const setArt = (x: string) => { setArtGewaehlt(true); setArtRoh(x); };
  const erlaubt = (x?: string) => !!x && ((a.dokumentArten ?? []) as T[]).some((d) => d.art === x);
  const artVorschlag = [fehlend.find((u: T) => u.abgelehnt)?.art, nachreichen[0]?.art, fehlend[0]?.art].find((x) => erlaubt(x)) ?? "sonstiges";
  useEffect(() => { if (!artGewaehlt) setArtRoh(artVorschlag); }, [artVorschlag, artGewaehlt]);
  const grundFuerArt = fehlend.find((u: T) => u.art === art)?.abgelehnt?.grund ?? nachreichen.find((x) => x.art === art)?.grund ?? null;
  const [datei, setDatei] = useState<File | null>(null);
  const [zieht, setZieht] = useState(false);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [uploadMeldung, setUploadMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const hochladen = async () => {
    if (!datei) return;
    if (datei.size > 15 * 1024 * 1024) { setUploadMeldung({ gut: false, text: t.uploadZuGross }); return; }
    setLaedtHoch(true); setUploadMeldung(null);
    try {
      const fd = new FormData(); fd.append("art", art); fd.append("datei", datei);
      const r = await fetch(mitToken("/dokument"), { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) setUploadMeldung({ gut: false, text: j.error || t.uploadFehler });
      // E-443: nach dem Upload schlägt die Auswahl wieder die nächste fehlende Unterlage vor.
      else { setDatei(null); setArtGewaehlt(false); setUploadMeldung({ gut: true, text: s === "en" ? "Uploaded — now in your vault." : "Hochgeladen — liegt im Tresor." }); await laden(); }
    } catch { setUploadMeldung({ gut: false, text: t.uploadFehler }); }
    finally { setLaedtHoch(false); }
  };

  // ── Anfragen ──
  const [text, setText] = useState("");
  const [sendet, setSendet] = useState(false);
  const [nMeldung, setNMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const fadenRef = useRef<HTMLDivElement>(null);
  const senden = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSendet(true); setNMeldung(null);
    try {
      const r = await fetch(mitToken("/nachricht"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setText(""); setNMeldung({ gut: true, text: j.meldung || t.nachrichtOk }); await laden(); } else setNMeldung({ gut: false, text: j.error || t.nachrichtFehler });
    } catch { setNMeldung({ gut: false, text: t.nachrichtFehler }); }
    finally { setSendet(false); }
  };
  // Gelesen: sobald der Faden mit ungelesenen Antworten wirklich im Blick ist (nie in der Vorschau).
  useEffect(() => {
    if (vorschau || ungeleseneAntworten.length === 0 || !fadenRef.current || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) { void fetch(mitToken("/gelesen"), { method: "POST" }); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(fadenRef.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ungeleseneAntworten.length, vorschau]);
  useEffect(() => { const f = fadenRef.current; if (f) f.scrollTop = f.scrollHeight; }, [nachrichten.length]);

  // ── E-456: „Neu für Sie" ──
  // Einmal je Öffnen des Portals: Der Server liefert, was seit dem letzten „Gesehen" neu ist. Das Fenster öffnet beim
  // ersten Laden (nicht beim Auffrischen jede Minute). In der Vorschau der Leitung nur mit ?neuigkeiten=zeigen —
  // und dort wird nie etwas vermerkt (Server und Seite).
  const neuDaten = a.neuigkeiten as { liste: GlobalNeuigkeit[]; weitere: number; stand: string } | undefined;
  const [neuOffen, setNeuOffen] = useState(false);
  const neuEntschieden = useRef(false);
  useEffect(() => {
    if (neuEntschieden.current || !neuDaten) return;
    neuEntschieden.current = true;
    const wunsch = new URLSearchParams(window.location.search).get("neuigkeiten") === "zeigen";
    if (neuDaten.liste?.length && (!vorschau || wunsch)) setNeuOffen(true);
  }, [neuDaten, vorschau]);
  const neuGesehen = () => {
    if (vorschau || !neuDaten) return;
    void fetch(mitToken("/neuigkeiten/gesehen"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bis: neuDaten.stand }) }).catch(() => { /* beim nächsten Mal wieder */ });
  };

  // ── Unterschrift ──
  const [dialog, setDialog] = useState<T | null>(null);
  const [kopiert, setKopiert] = useState("");
  const kopieren = async (wert: string, key: string) => { try { await navigator.clipboard.writeText(wert); setKopiert(key); setTimeout(() => setKopiert(""), 1600); } catch { /* egal */ } };
  const [verlaufAlle, setVerlaufAlle] = useState(false);
  const zu = (id: string) => geh(id.replace(/^gp-/, ""));

  // ── Die vollständige Akte (22.10.2026): Rechnungen der Person, Verträge, Pflichtunterlagen, ZIP ──
  const akte: T = a.akte ?? {};
  const rechnungen: T[] = akte.rechnungen ?? [];
  const pflicht: T | null = akte.pflicht ?? null;
  const einzelLeistungen = rechnungen.filter((r) => r.art === "einzel");

  // ── „Für Sie zu tun" ──
  const tun: { key: string; ton: string; titel: string; text: string; knopf?: string; aktion?: () => void; href?: string }[] = [];
  // E-469: Nach einer Teilzahlung nennt die Karte, was kam und was noch offen ist.
  const teilText = a.zahlung?.teilBezahltCents
    ? (s === "en"
      ? `Thank you for your part payment of ${euroText(a.zahlung.teilBezahltCents)}. Outstanding: ${euroText(a.zahlung.offenCents)}${a.zahlung.faelligAm ? `, payable by ${tagKurz(a.zahlung.faelligAm)}` : ""}.`
      : `Danke für Ihre Teilzahlung über ${euroText(a.zahlung.teilBezahltCents)}. Offen sind noch ${euroText(a.zahlung.offenCents)}${a.zahlung.faelligAm ? `, zahlbar bis zum ${tagKurz(a.zahlung.faelligAm)}` : ""}.`)
    : null;
  if (a.status === "offen" && a.zahlung?.zahlungsseite) tun.push({ key: "zahlung", ton: "navy", titel: t.zahlungOffenTitel, text: teilText ?? t.zahlungOffenText, knopf: t.zurZahlung, href: a.zahlung.zahlungsseite });
  // 22.10.2026: zuerst die Ergänzung zum Vertrag, dann Statement, Operating Agreement, IRS-Formulare, dann der Rest.
  const REIHE = ["fiaon_befugnisse", "us_organizer", "us_operating_agreement", "irs_ss4", "irs_8821"];
  const rang = (d: T) => { const i = REIHE.indexOf(String(d.pflichtKey ?? "")); return i < 0 ? REIHE.length : i; };
  for (const d of [...zuUnterschreiben].sort((a, b) => rang(a) - rang(b))) {
    const p = ((pflicht?.eintraege ?? []) as T[]).find((e) => e.dokumentId === d.id);
    tun.push({ key: `u${d.id}`, ton: "blau", titel: p ? w.pflichtTun(p.titel) : w.unterschriftTitel(d.titel || d.artText), text: p?.text || w.unterschriftText, knopf: d.unterschrift?.modus === "handschriftlich" ? HANDSCHRIFT_WOERTER[s].knopf : w.unterschreiben, aktion: () => setDialog(d) });
  }
  if (ungeleseneAntworten.length) tun.push({ key: "antwort", ton: "blau", titel: w.antwortTitel(ungeleseneAntworten[ungeleseneAntworten.length - 1].autor || apVorname), text: w.antwortText, knopf: w.lesen, aktion: () => zu("gp-anfragen") });
  if (postNeu.length) tun.push({ key: "post", ton: "", titel: w.postTitel(postNeu.length), text: w.postText, knopf: w.oeffnen, aktion: () => zu("gp-post") });
  // E-443 (28.10.2026): Fehlt eine Unterlage, weil wir sie neu brauchen, steht der Grund dabei; der Knopf wählt ihre Art vor.
  if (fehlend.length) tun.push({ key: "unterlagen", ton: "", titel: w.unterlagenTitel(fehlend.length), text: fehlend.map((u: T) => u.abgelehnt?.grund ? `${u.titel} — ${u.abgelehnt.grund}` : u.titel).join(" · "), knopf: w.zumTresor, aktion: () => {
    // E-443 (Gutachten): zuerst die Unterlage, die wir neu brauchen — wie die Vorbelegung ohne Klick.
    const ziel = (fehlend.find((u: T) => u.abgelehnt && erlaubt(u.art)) ?? fehlend.find((u: T) => erlaubt(u.art)))?.art;
    if (ziel) setArt(ziel);
    zu("gp-tresor");
  } });
  for (const x of nachreichen) tun.push({ key: `n${x.art}`, ton: "", titel: w.neuTitel(x.titel), text: x.grund, knopf: w.zumTresor, aktion: () => { if (erlaubt(x.art)) setArt(x.art); zu("gp-tresor"); } });
  // Scheibe 1: offene Rechnung eines hinzugefügten Dienstes — mit dem Weg zur Zahlungsseite.
  for (const d of (a.dienste?.gebucht ?? []) as T[]) {
    const z = globalZusatz(d.key);
    if (z && d.zahlungOffen && d.zahlungsseite) tun.push({ key: `z${d.id}`, ton: "", titel: ZUSATZ_WOERTER[s].tunTitel(z[s].titel), text: ZUSATZ_WOERTER[s].tunText, knopf: ZUSATZ_WOERTER[s].zurZahlung, href: d.zahlungsseite });
  }
  // Offene Rechnungen der Person (Einzelrechnungen wie Fast-Track, Angebotsteile) — die Paketrechnung steht schon oben.
  for (const r of rechnungen) {
    if (r.zahlungsseite && r.art !== "paket" && r.art !== "zusatz" && !tun.some((x) => x.href === r.zahlungsseite)) tun.push({ key: `r${r.bestellRef}`, ton: "", titel: `${s === "en" ? "Invoice open" : "Rechnung offen"}: ${r.titel}`, text: [r.nummer, r.offenCents != null ? `${s === "en" ? "outstanding" : "offen"} ${euroText(r.offenCents)}` : euroText(r.betragCents)].filter(Boolean).join(" · "), knopf: w.zurZahlung, href: r.zahlungsseite });
  }
  // Pflichtunterlagen, die schon zur Unterschrift bereitliegen, stehen über zuUnterschreiben oben; hier der Titel der Pflicht.
  // Pflichtfristen der nächsten dreißig Tage gehören zu „Für Sie zu tun".
  const heuteIso = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  for (const f of (a.fristen ?? []) as T[]) {
    if (!f.erledigt && f.faelligAm >= heuteIso && f.faelligAm <= in30) {
      tun.push({ key: `f${f.id}`, ton: "", titel: f.titel, text: s === "en" ? `Due on ${tag(f.faelligAm)}.` : `Fällig am ${tag(f.faelligAm)}.`, knopf: s === "en" ? "Compliance" : "Zu den Pflichten", aktion: () => geh("steuern") });
    }
  }
  const sg = a.angebot?.startgespraech;
  // E-452 (Gutachten): tun[0] steht in der Bühne unter „Für Sie“ — darunter nur der Rest, nie derselbe Auftrag zweimal.
  const tunWeiter = tun.slice(1);
  // Die Etappe kommt vom Server (sie steuert Mails). Für die Anzeige gilt zusätzlich der Fahrplan: Läuft in einer
  // „folgenden" Etappe schon etwas, steht sie auf „in Arbeit" — die Seite widerspricht sich nicht.
  const standAnzeige = (e: T): string => {
    if (e.stand !== "offen") return e.stand;
    const liste = sichtbareSchritte.filter((x) => x.etappe === e.nr);
    if (liste.length && liste.every((x) => x.status === "erledigt")) return "fertig";
    return liste.some((x) => x.status !== "offen") ? "arbeit" : "offen";
  };
  const hatAuftragsblock = !!(a.angebot || a.stichtag || a.widerruf);
  // E-407: Kapital-Angebot — die Summe der entstandenen Teile (Server), nicht die der künftigen.
  const preisText = a.angebot ? `${((a.angebot.summeCents ?? (a.angebot.teile as T[]).reduce((x, y) => x + y.betragCents, 0)) / 100).toLocaleString("de-DE")} €` : globalPreisText(a.paket, s);

  const kachelSatz = (k: PortalSeite): string => {
    const de = s !== "en";
    switch (k) {
      case "uebersicht": return de ? "Ihr Stand auf einen Blick" : "Your status at a glance";
      case "fahrplan": return wegKurz;
      // E-452: ohne den Namen — er steht auf jeder Karte schon groß darüber.
      case "gesellschaft": return [gp.ein ? `EIN ${gp.ein}` : "", gp.duns ? "D-U-N-S" : ""].filter(Boolean).join(" · ") || (de ? "Nummern und Daten" : "Numbers and dates");
      case "adressen": return [gp.usTelefon ? stationTelefonText(gp.usTelefon) : "", gp.usAdresse ? (de ? "Geschäftsadresse" : "Business address") : "", gp.privatAdresse ? (de ? "private Adresse" : "private address") : ""].filter(Boolean).join(" · ") || (de ? "Folgt mit der Einrichtung" : "Follows with the set-up");
      case "tresor": return de ? `${tresorDoks.length + (a.angebotUnterlagen ?? []).length} Dokumente${zuUnterschreiben.length ? ` · ${zuUnterschreiben.length} zur Unterschrift` : ""}` : `${tresorDoks.length + (a.angebotUnterlagen ?? []).length} documents${zuUnterschreiben.length ? ` · ${zuUnterschreiben.length} to sign` : ""}`;
      case "post": return postNeu.length ? (de ? `${postNeu.length} ungelesen` : `${postNeu.length} unread`) : (de ? `${post.length} Briefe` : `${post.length} letters`);
      case "anfragen": return ungeleseneAntworten.length ? (de ? "Neue Antwort" : "New reply") : (de ? `${nachrichten.length} Nachrichten` : `${nachrichten.length} messages`);
      case "kapital": return zugesagtCents > 0 ? `${globalUsd(zugesagtCents, s)} ${de ? "zugesagt" : "approved"}` : (de ? `${kapital.length} Einträge` : `${kapital.length} entries`);
      case "vertrag": return a.status === "offen" ? (t.status?.[a.status] ?? a.status) : a.paketName;
      case "dienste": {
        const aktiv = ((a.dienste?.gebucht ?? []) as T[]).filter((x) => x.status === "aktiv").length;
        return aktiv > 0 ? (de ? `${aktiv} ${aktiv === 1 ? "Dienst" : "Dienste"} aktiv` : `${aktiv} ${aktiv === 1 ? "service" : "services"} active`) : ZUSATZ_WOERTER[s].titel;
      }
      case "strategie": return de ? "KI-Sparring · Rechner · Bank-Exposé" : "AI sparring · calculators · bank profile";
      case "recht": return de ? "Vorlagen · Verzeichnis · Rechtsfragen" : "Templates · directory · legal questions";
      case "steuern": return de ? "Fristen · Formulare · Steuerfragen" : "Deadlines · forms · tax questions";
      default: return "";
    }
  };

  // ── E-452 (28.10.2026): Ihr Weg in den Worten des Kunden — keine Phasen, keine Ziffern, keine Zähler ──
  // Dieselben Stationen wie im Fahrplan, nur anders gesagt: was zuletzt erledigt ist (mit Datum), was gerade läuft, was danach kommt.
  const reihe = (k: unknown) => { const i = GLOBAL_FAHRPLAN.findIndex((v) => v.schluessel === k); return i < 0 ? GLOBAL_FAHRPLAN.length : i; };
  const wegSchritte = [...sichtbareSchritte].sort((x, y) => (Number(x.etappe ?? 9) - Number(y.etappe ?? 9)) || (reihe(x.schluessel) - reihe(y.schluessel)));
  const alltag = (x: T) => w.alltag[String(x.schluessel ?? "")] ?? String(x.titel ?? "");
  const imPaket = (x: T) => ((a.etappen ?? []) as T[]).find((e) => e.nr === x.etappe)?.imPaket !== false;
  const wegOffen = wegSchritte.filter((x) => x.status !== "erledigt" && imPaket(x));
  const wegJetzt: T | null = wegOffen.find((x) => x.status === "in_arbeit" || x.status === "beantragt") ?? wegOffen[0] ?? null;
  const wegZuletzt = wegSchritte.filter((x) => x.status === "erledigt").slice(-1);
  const meilensteine: { x: T; stand: "fertig" | "jetzt" | "offen" }[] = [
    ...wegZuletzt.map((x) => ({ x, stand: "fertig" as const })),
    ...(wegJetzt ? [{ x: wegJetzt, stand: "jetzt" as const }] : []),
    ...wegOffen.filter((x) => x !== wegJetzt).slice(0, 2).map((x) => ({ x, stand: "offen" as const })),
  ];
  const wegKurz = wegJetzt ? alltag(wegJetzt) : erledigt > 0 ? w.allesErledigt : w.vorStart;
  const tagMonat = (iso?: string | null) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString(loc, { day: "numeric", month: "short" }) : "";
  // Die Bühne (22.10.2026): Datum wie auf dem Sperrbildschirm; „Als Nächstes“ = der Schritt des Teams, sonst die nächste offene Station.
  const heuteText = new Date().toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
  const naechsterText = a.naechsterSchritt?.text || globalNaechsterSchritt(schritte, s) || w.naechsterLeer;
  const nameGeprueft = schritte.some((x) => x.schluessel === "name" && x.status === "erledigt");
  const chips: string[] = [
    g.gegruendetAm ? w.chip.seit(g.form || "LLC", tagKurz(g.gegruendetAm)) : nameGeprueft ? w.chip.name : "",
    gp.ein ? w.chip.ein : "", gp.itinVorhanden ? w.chip.itin : "", gp.duns ? w.chip.duns : "", gp.kontoEroeffnetAm ? w.chip.konto : "",
  ].filter(Boolean);
  const freigabe: string[] = a.dienste?.freigegeben ?? [];
  const dienstFrei = (k: string) => vorschau || zusatzFreigegeben(k, freigabe);
  const gebuchteDienste = ((a.dienste?.gebucht ?? []) as T[]).filter((x) => globalZusatz(x.key));
  const hatAdressen = !!(gp.usTelefon || gp.usAdresse || gp.privatAdresse || gp.agentAdresse);
  const karten = kapital.filter((k) => k.art === "karte");
  const naechsteFristen = ((a.fristen ?? []) as T[]).filter((f) => !f.erledigt && f.faelligAm >= heuteIso).slice(0, 2);
  const tageBis = (iso: string) => Math.round((new Date(iso + "T12:00:00").getTime() - new Date(new Date().toDateString()).getTime() - 12 * 3600_000) / 86_400_000);
  const zahlFuer = (k: PortalSeite) => k === "anfragen" ? ungeleseneAntworten.length : k === "post" ? postNeu.length : k === "tresor" ? zuUnterschreiben.length : 0;
  const navGruppen: NavGruppe<PortalSeite>[] = GRUPPEN.map((gr) => ({
    key: gr.key, titel: w.gruppen[gr.key], direkt: gr.direkt,
    // „Nummer & Adressen“ erscheint, sobald es etwas zu zeigen gibt; die Adresse #adressen geht trotzdem immer.
    eintraege: gr.seiten.filter((k) => k !== "adressen" || hatAdressen || seite === "adressen").map((k) => ({ key: k, titel: w.seiten[k], satz: kachelSatz(k), zahl: zahlFuer(k) })),
    karte: gr.key === "weg" ? { auge: w.karteWeg.auge, titel: wegKurz, text: w.karteWeg.text, ziel: "fahrplan" as PortalSeite, knopf: w.karteWeg.knopf }
      : gr.key === "buero" ? { auge: w.karteBuero.auge, titel: postNeu.length ? w.karteBuero.neu(postNeu.length) : w.karteBuero.leer, text: w.karteBuero.text, ziel: "post" as PortalSeite, knopf: w.karteBuero.knopf }
      : gr.key === "fach" ? { auge: w.karteFach.auge, titel: w.karteFach.titel, text: w.karteFach.text } : undefined,
  }));
  const gruppeVon = (k: PortalSeite) => GRUPPEN.find((gr) => gr.seiten.includes(k))?.key ?? "uebersicht";
  // Die Zeilen unter einer Station: Werte aus den Stationen; Karten und Rahmen aus Banken & Kapital.
  const kapitalZeile = (k: T) => [k.art === "karte" ? w.karte[k.inhaber === "privat" ? "privat" : "firma"] : k.artText, k.statusText, k.betragCents != null ? w.limit(globalUsd(k.betragCents, s)) : "", k.entschiedenAm ? tagKurz(k.entschiedenAm) : k.beantragtAm ? w.beantragt(tagKurz(k.beantragtAm)) : ""].filter(Boolean).join(" · ");
  const stationWerte = (schluessel: string): { zeilen: StationZeile[]; kapital: T[] } => ({
    zeilen: stationZeilen(schluessel, g, gp, s, tag, (c) => usBundesstaatName(c)),
    kapital: schluessel === "karte_1" ? karten.slice(0, 1) : schluessel === "kartenleiter" ? karten.slice(1) : schluessel === "kreditrahmen" ? kapital.filter((k) => k.art === "kreditrahmen" || k.art === "darlehen") : [],
  });
  const WertZeile = ({ z }: { z: StationZeile }) => (
    <div className="gp-wert">
      <dt>{z.titel}</dt>
      <dd>
        <span className={z.geheim ? "gp-geheim" : undefined}>{z.geheim === "itin" && itinKlar ? itinKlar : z.wert}</span>
        {z.geheim === "itin" && (itinKlar
          ? <button type="button" className="gp-kopie" onClick={() => setItinKlar(null)}>{w.verbergen}</button>
          : <button type="button" className="gp-kopie" onClick={() => void itinAnzeigen()} data-fiaon="itin-anzeigen">{w.anzeigen}</button>)}
        {z.kopie && <button type="button" className="gp-kopie" onClick={() => kopieren(z.kopie!, z.key)} aria-label={`${z.titel}: ${kopiert === z.key ? w.kopiert : w.kopieren}`}>{kopiert === z.key ? w.kopiert : w.kopieren}</button>}
      </dd>
    </div>
  );

  // ── Mappen-Inhalt ──
  const zeilenVertrag = () => (
    <>
      {a.vertragUrl && <DokZeile titel={t.vertragPdf} unter={t.vonFiaon} href={a.vertragUrl} los={w.dokOeffnen} />}
      {a.rechnungUrl && <DokZeile titel={t.rechnungPdf} unter={t.vonFiaon} href={a.rechnungUrl} los={w.dokOeffnen} />}
      {(a.angebot?.teile ?? []).filter((x: T) => x.rechnungUrl).map((x: T) => <DokZeile key={`r${x.nr}`} titel={`${ANGEBOT_MEIN_AUFTRAG.rechnung} · ${x.titel}`} unter={x.rechnungsnummer ?? ""} href={x.rechnungUrl} los={w.dokOeffnen} />)}
    </>
  );
  const zeilenNachweise = () => (a.angebotUnterlagen ?? []).map((u: T) => (
    <DokZeile key={`n${u.id}`} titel={u.titel} unter={[t.vonFiaon, u.mime === "application/pdf" ? "PDF" : (s === "en" ? "Image" : "Bild"), kb(u.groesse)].filter(Boolean).join(" · ")} href={u.url} los={w.dokOeffnen} />
  ));
  const zeilenDok = (liste: T[]) => liste.map((d) => (
    <DokZeile key={d.id} titel={d.titel || d.artText || d.name} los={w.dokOeffnen}
      unter={[d.abgelehnt?.grund ? w.neuGrund(d.abgelehnt.grund) : "", d.titel ? d.name : (d.artText ? d.name : ""), d.von === "kunde" ? t.vonIhnen : t.vonFiaon, tagKurz(d.am), kb(d.groesse)].filter(Boolean).join(" · ")}
      href={mitToken(`/dokument/${encodeURIComponent(String(d.id))}`)}
      marke={d.abgelehnt ? { text: w.bitteNeu, ton: "st-abgelehnt" } : d.unterschrift?.gefordert ? (d.unterschrift.unterschrieben ? { text: w.unterschrieben(tagKurz(d.unterschrift.am)), ton: "gruen" } : { text: w.wartet, ton: "blau" }) : (d.von !== "kunde" && !d.gelesen ? { text: w.neu, ton: "blau" } : undefined)}
      aktion={d.unterschrift?.gefordert && !d.unterschrift.unterschrieben ? { text: d.unterschrift.modus === "handschriftlich" ? HANDSCHRIFT_WOERTER[s].knopf : w.unterschreiben, los: () => setDialog(d) } : undefined} />
  ));

  return (
    <div className={`gp gp-glas${seite === "uebersicht" ? " gp-start" : ""}`}>
      {vorschau && <div className="gp-vorschau" role="note">{w.vorschau(vollerName || name || "der Kunde")}</div>}

      {/* ── Navigation (22.10.2026): schwebende Glasleiste mit Themen und Panel; am Telefon ein ganzseitiges Menü ── */}
      <PortalNav gruppen={navGruppen} seite={seite} geh={geh} titel={w.buero} aktuellTitel={w.seiten[seite]}
        marke={<a className="gp-logo" href="#uebersicht" onClick={(e) => { e.preventDefault(); geh("uebersicht"); }} aria-label={`FIAON Global · ${w.seiten.uebersicht}`}><FiaonWortmarke variante="global" hoehe="22px" /></a>}
        person={ap ? { name: String(ap.name ?? apVorname), rolle: w.rolle, bild: ap.bild ?? null, onKlick: () => geh("anfragen") } : null}
        texte={{ navTitel: w.navTitel, menue: w.menue, schliessen: w.schliessen, sicher: w.sicher, schreiben: w.schreiben }} />

      <div className="gp-app">
        <div className="gp-seiteninhalt" key={seite} data-richtung={richtung} data-fiaon={`portal-seite-${seite}`}>
          {seite === "uebersicht" ? (
            <>
              {/* ── 22.10.2026: Die Bühne wie ein Sperrbildschirm (Justin: „Apple Design mit Glas — Glas wie im Screenshot!“):
                    Datum, EINE große dünne Zahl, wenige Glaspillen — darunter drei Glas-Widgets. Die einzige blaue Stelle. ── */}
              <section className={`gp-sperr${buehneOffen ? "" : " gp-wartet"}`} aria-label={w.ihreGesellschaft} data-fiaon="portal-buehne">
                <div className="gp-sperr-kopf">
                  <p className="gp-sperr-datum">{heuteText}</p>
                  <p className="gp-sperr-gruss">{hallo}{name ? `, ${name}` : ""}.</p>
                  {/* E-452: Justin: „Prozentanzeige weg — lieber eine perfekte Animation mit den Firmennamen“. Der Name trägt die Bühne:
                        Buchstaben steigen aus einer Maske, danach streicht einmal ein Lichtschimmer darüber. */}
                  <FirmenName name={g.name || a.firma?.name || w.gesellschaftOhneName} />
                  <p className="gp-sperr-unter">{[g.bundesstaat, a.paketName].filter(Boolean).join(" · ")}</p>
                  <div className="gp-sperr-pillen">
                    <span className={`gp-glaspille st-${a.status}`}>{t.status?.[a.status] ?? a.status}</span>
                    {chips.slice(0, 2).map((c) => <span key={c} className="gp-glaspille">{c}</span>)}
                  </div>
                </div>
                <div className="gp-widgets">
                  {/* E-452: wie der Bestellstatus bei Apple — EIN Satz, was gerade passiert, und EIN Schritt für den Kunden (oder Ruhe). */}
                  <div className="gp-widget gp-w-jetzt" data-fiaon="portal-als-naechstes">
                    <span className="gp-widget-auge">{w.jetztAuge}</span>
                    <p className="gp-w-satz">{naechsterText}</p>
                    {a.naechsterSchritt?.bis && <small>{t.schrittBis(tag(a.naechsterSchritt.bis))}</small>}
                    <div className="gp-w-fuer">
                      <span className="gp-widget-auge">{w.fuerSie}</span>
                      {tun[0] ? (
                        <div className="gp-w-fuer-zeile">
                          <p>{tun[0].titel}</p>
                          {tun[0].href ? <a className="gp-w-knopf" href={tun[0].href}>{tun[0].knopf}</a>
                            : tun[0].aktion ? <button type="button" className="gp-w-knopf" onClick={tun[0].aktion}>{tun[0].knopf}</button> : null}
                        </div>
                      ) : <p className="gp-w-ruhe">{w.nichtsTun}</p>}
                    </div>
                  </div>
                  <div className="gp-widget gp-w-weg" data-fiaon="portal-meilensteine">
                    <span className="gp-widget-auge">{w.wegAuge}</span>
                    {meilensteine.length ? (
                      <ol className="gp-meilen" aria-label={t.wegTitel}>
                        {meilensteine.map(({ x, stand }, i) => (
                          <li key={String(x.schluessel ?? i)} className={`gp-meilen-zeile ${stand}`} style={{ ["--i" as any]: i }} aria-current={stand === "jetzt" ? "step" : undefined}>
                            <span className="gp-meilen-zeichen" aria-hidden="true">{stand === "fertig" ? <i className="gp-hk" /> : null}</span>
                            <span className="gp-meilen-text">{alltag(x)}<span className="gp-sr"> · {w.etappeStand[stand === "jetzt" ? "jetzt" : stand]}</span></span>
                            <span className="gp-meilen-wann" aria-hidden={stand === "fertig" ? undefined : true}>{stand === "fertig" ? tagMonat(x.datum) : stand === "jetzt" ? w.laeuft : ""}</span>
                          </li>
                        ))}
                      </ol>
                    ) : <p className="gp-w-ruhe">{a.status === "offen" ? w.wegStartet : w.naechsterLeer}</p>}
                    <button type="button" className="gp-w-link" onClick={() => geh("fahrplan")}>{w.wegAnsehen}</button>
                  </div>
                  {ap && (
                    <div className="gp-widget gp-w-kontakt">
                      {ap.bild ? <img src={ap.bild} alt="" /> : <span className="gp-w-mono" aria-hidden="true">{(ap.vorname || ap.name || "F").slice(0, 1)}</span>}
                      <div><b>{ap.name}</b><small>{w.rolle}</small></div>
                      <button type="button" className="gp-w-knopf" onClick={() => geh("anfragen")}>{w.nachricht}</button>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Weitere Schritte (E-452): der erste Schritt steht schon oben unter „Für Sie“ — hier nur, was danach kommt.
                    Ist nichts weiter zu tun und kein Termin da, entfällt der Abschnitt (oben steht schon „Sie müssen gerade nichts tun.“). ── */}
              {(tunWeiter.length > 0 || !!(sg && (sg.zeile || sg.satz))) && (
              <section id="gp-tun" className="gp-abschnitt gp-auftauchen">
                <h2 className="gp-h2">{tunWeiter.length ? w.tunWeiter : w.termin}</h2>
                {tunWeiter.length > 0 && (
                  <div className="gp-tun">
                    {tunWeiter.map((x, i) => (
                      <div key={x.key} className={`gp-tun-karte ${x.ton}`} style={{ ["--i" as any]: i }}>
                        <div><b>{x.titel}</b><p>{x.text}</p></div>
                        {x.href ? <a className="gp-knopf" href={x.href}>{x.knopf}</a>
                          : x.aktion ? <button type="button" className="gp-knopf" onClick={x.aktion}>{x.knopf}</button> : null}
                      </div>
                    ))}
                  </div>
                )}
                {sg && sg.zeile && (
                  <div className="gp-termin">
                    <div><b>{sg.titel}: {sg.zeile}</b>{sg.wie && <small>{sg.wie}</small>}</div>
                    <div className="gp-termin-wege">
                      {sg.kalenderUrl && <a className="gp-knopf leise" href={sg.kalenderUrl}>{sg.texte.kalender}</a>}
                      {sg.googleUrl && <a className="gp-knopf leise" href={sg.googleUrl} target="_blank" rel="noopener">{sg.texte.google}</a>}
                      {sg.verschiebenUrl && <a className="gp-knopf leise" href={sg.verschiebenUrl}>{sg.texte.verschieben}</a>}
                    </div>
                  </div>
                )}
                {sg && !sg.zeile && sg.satz && <p className="gp-leise">{sg.satz}</p>}
              </section>
              )}

              {/* ── Ihr Büro: Nummer, Konto & Karten, Adressen & Post, Fristen, Dokumente, Dienste — jede Kachel klickbar ── */}
              <section className="gp-abschnitt gp-auftauchen gp-buero" aria-label={w.bueroTitel}>
                <h2 className="gp-h2">{w.bueroTitel}</h2>
                <p className="gp-lead">{w.bueroLead}</p>
                <div className="gp-buero-raster">
                  <button type="button" className="gp-buero-kachel nummer" onClick={() => geh("adressen")} data-fiaon="buero-nummer">
                    <span className="gp-auge">{w.kachel.nummer}</span>
                    {gp.usTelefon ? <b className="gp-nummer">{stationTelefonText(gp.usTelefon)}</b> : <span className="gp-leise">{w.adresseFolgt}</span>}
                    <span className="gp-buero-fuss">{w.seiten.adressen}</span>
                  </button>
                  <button type="button" className="gp-buero-kachel" onClick={() => geh("kapital")} data-fiaon="buero-konto">
                    <span className="gp-auge">{w.kachel.konto}</span>
                    <span className="gp-buero-zeile">{gp.kontoEroeffnetAm ? w.kontoEroeffnet(tagKurz(gp.kontoEroeffnetAm)) : w.kontoFolgt}</span>
                    {karten.length ? <ul className="gp-buero-liste">{karten.slice(0, 3).map((k) => <li key={k.id}>{kapitalZeile(k)}</li>)}</ul> : <span className="gp-leise">{w.kartenLeer}</span>}
                    <span className="gp-buero-fuss">{w.seiten.kapital}</span>
                  </button>
                  <button type="button" className="gp-buero-kachel" onClick={() => geh(hatAdressen ? "adressen" : "post")} data-fiaon="buero-adressen">
                    <span className="gp-auge">{w.kachel.adressen}</span>
                    <span className="gp-buero-zeile"><small>{w.geschaeft}</small>{gp.usAdresse ? String(gp.usAdresse).split("\n")[0] : w.adresseFolgt}</span>
                    {gp.privatAdresse && <span className="gp-buero-zeile"><small>{w.privat}</small>{String(gp.privatAdresse).split("\n")[0]}</span>}
                    <span className="gp-buero-zeile"><small>{w.seiten.post}</small>{w.postZahl(post.length, postNeu.length)}</span>
                    <span className="gp-buero-fuss">{w.oeffnenPfeil}</span>
                  </button>
                  <button type="button" className="gp-buero-kachel" onClick={() => geh("steuern")} data-fiaon="buero-fristen">
                    <span className="gp-auge">{w.kachel.fristen}</span>
                    {naechsteFristen.length ? <ul className="gp-buero-liste">{naechsteFristen.map((f) => <li key={f.id}><span>{f.titel}</span><em>{w.inTagen(tageBis(f.faelligAm))}</em></li>)}</ul> : <span className="gp-leise">{a.status === "offen" ? w.fristenNachZahlung : w.fristenLeer}</span>}
                    <span className="gp-buero-fuss">{w.seiten.steuern}</span>
                  </button>
                  <button type="button" className="gp-buero-kachel" onClick={() => geh("tresor")} data-fiaon="buero-dokumente">
                    <span className="gp-auge">{w.kachel.dokumente}</span>
                    {tresorDoks.length ? <ul className="gp-buero-liste">{tresorDoks.slice(0, 3).map((d) => <li key={d.id}><span>{d.titel || d.artText || d.name}</span><em>{tagKurz(d.am)}</em></li>)}</ul> : <span className="gp-leise">{w.dokumenteLeer}</span>}
                    <span className="gp-buero-fuss">{w.seiten.tresor}</span>
                  </button>
                  <button type="button" className="gp-buero-kachel" onClick={() => geh("dienste")} data-fiaon="buero-dienste">
                    <span className="gp-auge">{w.kachel.dienste}</span>
                    {gebuchteDienste.length ? <ul className="gp-buero-liste">{gebuchteDienste.slice(0, 3).map((d) => <li key={d.id}><span>{globalZusatz(d.key)![s].titel}</span><em>{ZUSATZ_WOERTER[s].statusKurz[d.status as keyof typeof ZUSATZ_WOERTER.de.statusKurz]}</em></li>)}</ul> : <span className="gp-leise">{w.diensteLeer}</span>}
                    <span className="gp-buero-fuss">{ZUSATZ_WOERTER[s].titel}</span>
                  </button>
                </div>
              </section>

              {/* ── Zuletzt passiert (drei Zeilen, auf Wunsch alle) ── */}
              <section className="gp-abschnitt gp-auftauchen gp-zuletzt" aria-label={w.zuletzt}>
                <h2 className="gp-h2">{w.zuletzt}</h2>
                {(a.verlauf ?? []).length === 0 ? <p className="gp-leise">{t.verlaufLeer}</p> : (
                  <>
                    <ol className="gp-verlauf kurz">
                      {(a.verlauf as T[]).slice(0, verlaufAlle ? 200 : 3).map((v, i) => <li key={i}><time dateTime={v.am}>{tagKurz(v.am)}</time><span>{v.text}</span></li>)}
                    </ol>
                    {(a.verlauf as T[]).length > 3 && <button type="button" className="gp-link" onClick={() => setVerlaufAlle((x) => !x)}>{verlaufAlle ? w.weniger : w.alleZeigen} <ChevronDown size={14} style={{ transform: verlaufAlle ? "rotate(180deg)" : "none" }} /></button>}
                  </>
                )}
              </section>
            </>
          ) : (
            <>
              <header className="gp-seitenkopf">
                <span className="gp-auge">{w.gruppen[gruppeVon(seite)]} · {g.name || a.firma?.name || w.meinAuftrag}</span>
                <h1>{seite === "dienste" ? ZUSATZ_WOERTER[s].titel : w.seiten[seite]}</h1>
                {w.seitenSatz[seite] && <p>{w.seitenSatz[seite]}</p>}
              </header>
              {seite === "fahrplan" && (
                <div className="gp-spalten">
                  <main className="gp-haupt">
          {/* ── Fahrplan ── */}
          <section id="gp-fahrplan" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.fahrplanTitel}</h2>
            <p className="gp-lead">{w.fahrplanLead}</p>
            <div className="gp-fahrplan">
              {[1, 2, 3, 4].map((nr) => {
                const e = (a.etappen ?? []).find((x: T) => x.nr === nr);
                const liste = sichtbareSchritte.filter((x) => x.etappe === nr);
                if (!e || (!liste.length && !e.imPaket)) return null;
                const st = standAnzeige(e);
                return (
                  <div key={nr} className={`gp-kapitel ${st}${e.imPaket === false ? " ausserhalb" : ""}`}>
                    <div className="gp-kapitel-kopf">
                      <div><b>{e.titel}</b><small>{w.etappeStand[st]}{e.stand === "jetzt" && e.seit ? ` · ${t.seit(tagKurz(e.seit))}` : ""}</small></div>
                    </div>
                    {e.text && <p className="gp-kapitel-text">{e.text}</p>}
                    <ul className="gp-schritte">
                      {liste.map((x, i) => (
                        <li key={x.schluessel} className={`gp-schritt ${x.status}`} style={{ ["--i" as any]: i }}>
                          <span className="gp-schritt-zeichen" aria-hidden="true">
                            {/* E-452: Stand ohne Icon — gezeichneter Haken = erledigt, Puls = läuft, feiner Ring = kommt noch. */}
                            {x.status === "erledigt" ? <span className="gp-stand-haken"><i className="gp-hk" /></span> : x.status === "in_arbeit" || x.status === "beantragt" ? <span className="gp-puls" /> : <span className="gp-stand-punkt" />}
                          </span>
                          <div>
                            <b>{alltag(x)}</b>
                            {/* E-452: „offen“ sagt schon der leere Ring — die Zeile steht nur bei „läuft“ und „erledigt“ (mit Datum). */}
                            {x.status !== "offen" && <small>{(x.status === "in_arbeit" || x.status === "beantragt" ? w.stand[x.status] : stationStatusName(x.schluessel, x.status, s) ?? w.stand[x.status] ?? x.status)}{x.datum ? ` · ${tagKurz(x.datum)}` : x.beantragtAm && x.status === "beantragt" ? ` · ${tagKurz(x.beantragtAm)}` : ""}</small>}
                            {x.hinweis ? <p className="gp-schritt-hinweis">{x.hinweis}</p> : <p className="gp-schritt-text">{x.text}</p>}
                            {(() => {
                              // 22.10.2026: die echten Werte der Station — EIN, ITIN (maskiert, „Anzeigen“), D-U-N-S, Nummer, Adressen, Konto, Karten.
                              const sw = stationWerte(x.schluessel);
                              if (!sw.zeilen.length && !sw.kapital.length) return null;
                              return (
                                <dl className="gp-werte" data-fiaon={`station-werte-${x.schluessel}`}>
                                  {sw.zeilen.map((z) => <WertZeile key={z.key} z={z} />)}
                                  {sw.kapital.map((k) => <div key={k.id} className="gp-wert"><dt>{k.art === "karte" ? w.karte[k.inhaber === "privat" ? "privat" : "firma"] : k.artText}</dt><dd><span>{kapitalZeile(k)}</span></dd></div>)}
                                  {x.schluessel === "itin" && itinFehler && <p className="gp-meldung schlecht" role="alert">{itinFehler}</p>}
                                </dl>
                              );
                            })()}
                            {/* E-424: die Kontaktperson ist der Kunde selbst (bzw. ein Gesellschafter) — der Satz kommt aus GLOBAL_AGENT, mit dem Bundesstaat der Gesellschaft. */}
                            {x.schluessel === "agent" && <p className="gp-schritt-text">{globalAgentKontakt(s, g.bundesstaat)}</p>}
                            {x.schluessel === "kreditrahmen" && !a.angebot && stationWerte("kreditrahmen").kapital.length > 0 && <p className="gp-schritt-text">{GLOBAL_ETAPPE_FUSSNOTE[s]}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

                  </main>
                  <aside className="gp-seite">
          <button type="button" className="gp-karte gp-auftauchen gp-karte-klick" onClick={() => geh("gesellschaft")}>
            <span className="gp-auge">{w.gesellschaftTitel}</span>
            <b className="gp-karte-gross">{g.name || w.gesellschaftOhneName}</b>
            <span className="gp-leise">{kachelSatz("gesellschaft")}</span>
            <span className="gp-buero-fuss">{w.seiten.gesellschaft}</span>
          </button>
          {hatAdressen && (
            <button type="button" className="gp-karte gp-auftauchen gp-karte-klick" onClick={() => geh("adressen")}>
              <span className="gp-auge">{w.seiten.adressen}</span>
              <span className="gp-leise">{kachelSatz("adressen")}</span>
              <span className="gp-buero-fuss">{w.oeffnenPfeil}</span>
            </button>
          )}

                  </aside>
                </div>
              )}
              {seite === "gesellschaft" && (
                <div className="gp-spalten">
                  <main className="gp-haupt">
                    <section className="gp-abschnitt gp-auftauchen" data-fiaon="portal-gesellschaft">
                      <h2 className="gp-h2">{w.stammTitel}</h2>
                      <p className="gp-lead">{w.stammLead}</p>
                      <dl className="gp-werte gross">
                        {(["eingetragen", "ein", "itin", "duns", "agent"] as const).flatMap((k) => stationWerte(k).zeilen).map((z) => <WertZeile key={z.key} z={z} />)}
                        {g.form && <WertZeile z={{ key: "form", titel: w.felder.form, wert: g.form }} />}
                        {!gp.itinVorhanden && g.itinStand && <WertZeile z={{ key: "itinstand", titel: w.felder.itin, wert: w.itin[g.itinStand] ?? g.itinStand }} />}
                      </dl>
                      {itinFehler && <p className="gp-meldung schlecht" role="alert">{itinFehler}</p>}
                      {!g.name && !gp.ein && <p className="gp-leise">{w.gesellschaftLeer}</p>}
                      {gp.hinweis && <p className="gp-satz klein">{gp.hinweis}</p>}
                    </section>
                  </main>
                  <aside className="gp-seite">
                    <button type="button" className="gp-karte gp-auftauchen gp-karte-klick" onClick={() => geh("fahrplan")}>
                      <span className="gp-auge">{w.wegAuge}</span>
                      <b className="gp-karte-gross">{wegKurz}</b>
                      <span className="gp-leise">{w.karteWeg.text}</span>
                      <span className="gp-buero-fuss">{w.zumFahrplan}</span>
                    </button>
                  </aside>
                </div>
              )}
              {seite === "adressen" && (
                <div className="gp-haupt">
                  <section className="gp-abschnitt gp-auftauchen" data-fiaon="portal-adressen">
                    {!hatAdressen ? (
                      <div className="gp-leer-karte"><p>{w.adressenLeer}</p></div>
                    ) : (
                      <div className="gp-adressen">
                        {gp.usTelefon && (
                          <div className="gp-adresse nummer">
                            <span className="gp-auge">{w.kachel.nummer}</span>
                            <b className="gp-nummer">{stationTelefonText(gp.usTelefon)}</b>
                            <div className="gp-adresse-wege">
                              <a className="gp-knopf leise" href={`tel:${gp.usTelefon}`}>{w.anrufen}</a>
                              <button type="button" className="gp-kopie" onClick={() => kopieren(gp.usTelefon!, "tel")} aria-label={`${w.kachel.nummer}: ${kopiert === "tel" ? w.kopiert : w.kopieren}`}>{kopiert === "tel" ? w.kopiert : w.kopieren}</button>
                            </div>
                          </div>
                        )}
                        {([["usAdresse", w.geschaeft], ["privatAdresse", w.privat], ["agentAdresse", w.agentPost]] as const).map(([k, titel]) => gp[k] ? (
                          <div key={k} className="gp-adresse">
                            <span className="gp-auge">{titel}</span>
                            <address>{gp[k]}</address>
                            <button type="button" className="gp-kopie" onClick={() => kopieren(String(gp[k]), k)} aria-label={`${titel}: ${kopiert === k ? w.kopiert : w.kopieren}`}>{kopiert === k ? w.kopiert : w.kopieren}</button>
                          </div>
                        ) : null)}
                        {!gp.privatAdresse && dienstFrei("wohnadresse") && (
                          <button type="button" className="gp-adresse leer" onClick={() => geh("dienste")}>
                            <span className="gp-auge">{w.privat}</span>
                            <span className="gp-leise">{globalZusatz("wohnadresse")![s].kurz}</span>
                            <span className="gp-buero-fuss">{ZUSATZ_WOERTER[s].titel}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                </div>
              )}
              {seite === "tresor" && <div className="gp-haupt">
          {/* ── Tresor ── */}
          <section id="gp-tresor" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.tresorTitel}</h2>
            <p className="gp-lead">{w.tresorLead}</p>
            <div className="gp-mappen" role="tablist">
              <button type="button" role="tab" aria-selected={mappe === "alle"} className={mappe === "alle" ? "an" : ""} onClick={() => setMappe("alle")}>{w.alle}</button>
              {mappen.map((m) => (
                <button key={m.key} type="button" role="tab" aria-selected={mappe === m.key} className={mappe === m.key ? "an" : ""} onClick={() => setMappe(m.key)}>
                  {m.titel}<i>{m.zahl}</i>
                </button>
              ))}
            </div>
            <div className="gp-dokliste" key={mappe}>
              {(mappe === "alle" || mappe === "vertrag") && zeilenVertrag()}
              {(mappe === "alle" || mappe === "nachweise") && zeilenNachweise()}
              {zeilenDok(mappe === "alle" ? tresorDoks : tresorDoks.filter((d) => (d.kategorie ?? "sonstiges") === (mappe as GlobalTresorKategorie)))}
              {mappe !== "alle" && mappe !== "vertrag" && mappe !== "nachweise" && tresorDoks.filter((d) => (d.kategorie ?? "sonstiges") === mappe).length === 0 && <p className="gp-leise">{w.leerMappe}</p>}
            </div>

            {darfHochladen ? (
              <div className={`gp-ablage${zieht ? " zieht" : ""}`}
                   onDragOver={(e) => { e.preventDefault(); setZieht(true); }} onDragLeave={() => setZieht(false)}
                   onDrop={(e) => { e.preventDefault(); setZieht(false); const f = e.dataTransfer.files?.[0]; if (f) setDatei(f); }}>
                <b className="gp-ablage-titel">{w.hochladenTitel}</b>
                {(fehlend.length > 0 || nachreichen.length > 0) && (
                  <ul className="gp-fehlt">
                    {fehlend.map((u: T) => (
                      <li key={u.art}><button type="button" className={art === u.art ? "an" : ""} onClick={() => setArt(u.art)}>{u.titel}</button></li>
                    ))}
                    {nachreichen.filter((x) => erlaubt(x.art) && !fehlend.some((u: T) => u.art === x.art)).map((x) => (
                      <li key={`n${x.art}`}><button type="button" className={art === x.art ? "an" : ""} onClick={() => setArt(x.art)}>{x.titel}</button></li>
                    ))}
                  </ul>
                )}
                {grundFuerArt && <p className="gp-leise" role="note">{w.neuGrund(grundFuerArt)}</p>}
                <label className="gp-ablage-feld">
                  <span>{datei ? <b>{datei.name}</b> : w.hochladenFeld}</span>
                  <small>{w.hochladenKlein}</small>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} />
                </label>
                <div className="gp-ablage-zeile">
                  <label className="gp-feldname">{w.art}
                    <select className="gp-eingabe" value={art} onChange={(e) => setArt(e.target.value)}>
                      {(a.dokumentArten ?? []).map((x: T) => <option key={x.art} value={x.art}>{x.titel}</option>)}
                    </select>
                  </label>
                  <button type="button" className="gp-knopf" disabled={!datei || laedtHoch || vorschau} onClick={hochladen}>
                    {laedtHoch ? w.laedt : w.hochladen}
                  </button>
                </div>
                {uploadMeldung && <p className={`gp-meldung ${uploadMeldung.gut ? "gut" : "schlecht"}`} role="status">{uploadMeldung.text}</p>}
              </div>
            ) : (
              <p className="gp-leise gp-hinweis-zeile">{t.uploadGesperrt}</p>
            )}
          </section>

              </div>}
              {seite === "post" && <div className="gp-haupt">
          {/* ── Post ── */}
          <section id="gp-post" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.postFachTitel}</h2>
            <p className="gp-lead">{w.postLead}</p>
            {post.length === 0 ? <div className="gp-leer-karte"><p>{w.postLeer}</p></div> : (
              <div className="gp-briefe">
                {post.map((d) => (
                  <a key={d.id} className={`gp-brief${d.gelesen ? "" : " neu"}`} href={mitToken(`/dokument/${encodeURIComponent(String(d.id))}`)} target="_blank" rel="noopener" onClick={() => setTimeout(() => void laden(), 1200)}>
                    <div><b>{d.post?.absender || d.titel || d.artText}</b><small>{w.eingang} {tag(d.post?.eingangAm || d.am)}</small></div>
                    {!d.gelesen && <span className="gp-marke blau">{w.neu}</span>}
                    <span className="gp-brief-los" aria-hidden="true">{w.dokOeffnen}</span>
                  </a>
                ))}
              </div>
            )}
          </section>

              </div>}
              {seite === "anfragen" && (
                <div className="gp-spalten">
                  <main className="gp-haupt">
          {/* ── Anfragen ── */}
          <section id="gp-anfragen" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.anfragenTitel}</h2>
            <p className="gp-lead">{w.anfragenLead(ap?.name || apVorname)}</p>
            <div className="gp-faden" ref={fadenRef}>
              {nachrichten.length === 0 && <p className="gp-leise">{w.anfragenLeer}</p>}
              {nachrichten.map((n) => (
                <div key={n.id} className={`gp-blase ${n.von}`}>
                  <p>{n.text}</p>
                  <small>{n.von === "kunde" ? w.sie : n.autor} · {zeit(n.am)}</small>
                </div>
              ))}
            </div>
            <form className="gp-schreiben" onSubmit={senden}>
              <textarea className="gp-eingabe" value={text} maxLength={2000} rows={3} placeholder={w.platzhalter} onChange={(e) => setText(e.target.value)} aria-label={w.anfragenTitel} />
              <button type="submit" className="gp-knopf" disabled={sendet || !text.trim() || vorschau}>
                {sendet ? w.sendet : w.senden}
              </button>
            </form>
            {nMeldung && <p className={`gp-meldung ${nMeldung.gut ? "gut" : "schlecht"}`} role="status">{nMeldung.text}</p>}
          </section>

                  </main>
                  <aside className="gp-seite">
          <div className="gp-karte gp-auftauchen">
            <span className="gp-auge">{w.kontaktTitel}</span>
            {ap ? (
              <div className="gp-person">
                {ap.bild ? <img src={ap.bild} alt="" /> : <span className="gp-person-mono" aria-hidden="true">{(ap.vorname || ap.name || "F").slice(0, 1)}</span>}
                <div>
                  <b>{ap.name}</b>
                  {ap.email && <a href={`mailto:${ap.email}`}>{ap.email}</a>}
                  {ap.telefon && <a href={`tel:${String(ap.telefon).replace(/\s/g, "")}`}>{ap.telefon}</a>}
                </div>
              </div>
            ) : <p className="gp-leise">{t.seiteAnsprechLeer}</p>}
            <button type="button" className="gp-knopf leise breit" onClick={() => zu("gp-anfragen")}>{w.schreiben}</button>
          </div>

                  </aside>
                </div>
              )}
              {seite === "kapital" && <div className="gp-haupt">
          {/* ── Banken & Kapital ── */}
          <section id="gp-kapital" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.kapitalTitel}</h2>
            <p className="gp-lead">{w.kapitalLead}</p>
            {zugesagtCents > 0 && <div className="gp-summe"><small>{w.zugesagt}</small><b>{globalUsd(zugesagtCents, s)}</b></div>}
            {kapital.length === 0 ? <div className="gp-leer-karte"><p>{w.kapitalLeer}</p></div> : (
              <div className="gp-kapital">
                {kapital.map((k, i) => (
                  <div key={k.id} className={`gp-kapital-karte st-${k.status}`} style={{ ["--i" as any]: i }}>
                    <small>{k.artText}</small>
                    <b>{k.institut || k.artText}</b>
                    {k.produkt && <em>{k.produkt}</em>}
                    <div className="gp-kapital-fuss">
                      {k.betragCents != null && <strong>{globalUsd(k.betragCents, s)}</strong>}
                      <span className={`gp-marke st-${k.status}`}>{k.statusText}</span>
                    </div>
                    {(k.beantragtAm || k.hinweis) && <p>{[k.beantragtAm ? w.beantragt(tagKurz(k.beantragtAm)) : "", k.hinweis].filter(Boolean).join(" · ")}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

              </div>}
              {seite === "vertrag" && (
                <div className="gp-spalten">
                  <main className="gp-haupt">
          {/* ── Vertrag, Zahlungsplan, Garantie ── */}
          <section id="gp-vertrag" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{a.angebot ? (a.angebot.titel ?? ANGEBOT_MEIN_AUFTRAG.titel) : w.auftragTitel}</h2>
            {a.angebot?.ref && <p className="gp-ref-zeile">{a.angebot.ref}</p>}
            {a.angebot && (
              <>
                <ul className="gp-teile">
                  {(a.angebot.teile as T[]).map((x) => (
                    <li key={x.nr}>
                      <div><b>{x.titel}</b><small>{(x.betragCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €{x.hinweis ? ` — ${x.hinweis}` : x.nr === 2 && x.stand === "noch nicht fällig" ? ` — ${ANGEBOT_MEIN_AUFTRAG.teil2Hinweis}` : ""}</small></div>
                      <span className={`gp-marke ${x.stand === "bezahlt" ? "gruen" : "blau"}`}>{ANGEBOT_MEIN_AUFTRAG.stand[x.stand] ?? x.stand}</span>
                    </li>
                  ))}
                </ul>
                <p className="gp-satz">{a.angebot.garantieSatz ? a.angebot.garantieSatz : a.angebot.garantieErfuelltAm ? ANGEBOT_MEIN_AUFTRAG.garantieErfuellt(a.angebot.garantieErfuelltAm) : a.angebot.erstattungAusgeloest ? ANGEBOT_MEIN_AUFTRAG.erstattung : a.angebot.fristBeginn && a.angebot.fristEnde ? ANGEBOT_MEIN_AUFTRAG.frist(a.angebot.fristBeginn, a.angebot.fristEnde) : ANGEBOT_MEIN_AUFTRAG.fristNochNicht}</p>
              </>
            )}
            {a.stichtag && <p className="gp-satz">{t.stichtag}: <b>{tag(a.stichtag)}</b></p>}
            {/* E-334: Sofortstart zeigt die Wahl des Kunden — nie die Widerrufsfrist als Behauptung. */}
            {a.widerruf && (a.widerruf.sofortBeginn ? (
              <p className="gp-satz" data-fiaon="mein-auftrag-start-sofort"><b>{t.startSofort}</b> {a.status === "offen" ? t.startSofortOffen : t.startSofortLaeuft}</p>
            ) : (
              <p className="gp-satz">{t.widerrufBis}: <b>{tag(a.widerruf.fristEnde)}</b>{(a.status === "offen" || a.status === "bezahlt") && <> · {t.startNachFrist(tag(a.widerruf.startAb))}</>}</p>
            ))}
            {!hatAuftragsblock && <p className="gp-satz">{a.paketName} · {a.ref}</p>}
          </section>

          {/* ── 22.10.2026: die vollständige Akte — alle Rechnungen, alle Verträge, Unterschriften, alles als ZIP ── */}
          <section className="gp-abschnitt gp-auftauchen" data-fiaon="portal-rechnungen">
            <h2 className="gp-h2">{w.rechnungenTitel}</h2>
            <p className="gp-lead">{w.rechnungenLead}</p>
            {rechnungen.length === 0 ? <p className="gp-leise">{w.rechnungenLeer}</p> : (
              <ul className="gp-rechnungen">
                {rechnungen.map((r) => (
                  <li key={r.bestellRef} className={`st-${r.status}`}>
                    <div><b>{r.titel}</b><small>{[r.nummer, r.datum ? tagKurz(r.datum) : "",
                      // E-469: Teilzahlung — bezahlt, offen, bis wann.
                      r.teilBezahltCents ? (s === "en" ? `paid ${euroText(r.teilBezahltCents)}, outstanding ${euroText(r.offenCents)}${r.faelligAm ? ` by ${tagKurz(r.faelligAm)}` : ""}` : `bezahlt ${euroText(r.teilBezahltCents)}, offen ${euroText(r.offenCents)}${r.faelligAm ? ` bis ${tagKurz(r.faelligAm)}` : ""}`) : ""].filter(Boolean).join(" · ")}</small></div>
                    <span className="gp-betrag">{euroText(r.betragCents)}</span>
                    <span className={`gp-marke ${r.status === "bezahlt" ? "gruen" : r.status === "offen" ? "blau" : ""}`}>{r.statusText}</span>
                    <span className="gp-rechnung-wege">
                      {r.pdfUrl && <a className="gp-link" href={r.pdfUrl} target="_blank" rel="noopener">PDF</a>}
                      {r.zahlungsseite && <a className="gp-knopf klein" href={r.zahlungsseite}>{w.zurZahlung}</a>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="gp-abschnitt gp-auftauchen" data-fiaon="portal-vertraege">
            <h2 className="gp-h2">{w.vertraegeTitel}</h2>
            {((akte.vertraege ?? []) as T[]).length === 0 && (a.angebotUnterlagen ?? []).length === 0 ? <p className="gp-leise">{w.vertraegeLeer}</p> : (
              <div className="gp-dokliste">
                {((akte.vertraege ?? []) as T[]).map((v) => <DokZeile key={v.key} titel={v.titel} unter={v.unter} href={v.url} los={w.dokOeffnen} />)}
                {zeilenNachweise()}
              </div>
            )}
          </section>
          {pflicht && (pflicht.eintraege ?? []).length > 0 && (
            <section className="gp-abschnitt gp-auftauchen" data-fiaon="portal-pflicht">
              <h2 className="gp-h2">{w.pflichtTitel}</h2>
              <p className="gp-lead">{pflicht.vollstaendig ? w.pflichtVoll : w.pflichtLead}</p>
              <ul className="gp-pflicht">
                {(pflicht.eintraege as T[]).map((e) => {
                  const d = doks.find((x) => x.id === e.dokumentId);
                  return (
                    <li key={e.key} className={`st-${e.stand}`}>
                      <span className="gp-pflicht-punkt" aria-hidden="true" />
                      <div><b>{e.titel}</b>{e.text && <small>{e.text}</small>}</div>
                      {e.stand === "wartet" && d ? <button type="button" className="gp-knopf klein" onClick={() => setDialog(d)}>{e.modus === "handschriftlich" ? HANDSCHRIFT_WOERTER[s].knopf : w.unterschreiben}</button>
                        : <span className={`gp-marke ${e.stand === "unterschrieben" ? "gruen" : ""}`}>{e.stand === "unterschrieben" ? (s === "en" ? "Signed" : "Unterschrieben") : (s === "en" ? "Being prepared" : "Wird vorbereitet")}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

                  </main>
                  <aside className="gp-seite">
          <div className="gp-karte gp-auftauchen">
            <span className="gp-auge">{w.auftragTitel}</span>
            <p className="gp-paket">{a.paketName}</p>
            {preisText && !/^0\s?€$|^€\s?0$/.test(preisText.trim()) && <p className="gp-preis">{preisText}</p>}
            <dl className="gp-daten"><Zeile k={t.seiteReferenz} v={a.ref} /></dl>
            {/* E-407: Kapital-Angebot — Jahresbetreuung aus Ziffer 6 (verlängert sich, kündbar zum Jahresende), nicht der Paket-Satz. */}
            {a.angebot?.jahresZeile ? (
              <div className="gp-jahr"><b>{J.titel}</b><small>{a.angebot.jahresZeile}</small></div>
            ) : a.jahresbetreuung ? (
              <div className="gp-jahr"><b>{J.titel}</b><p>{J.gebucht}</p><small>{J.bedingungen}</small></div>
            ) : a.status !== "storniert" && <p className="gp-leise">{t.jahrSpaeter(J.titel, J.preisZeile)}</p>}
            <p className="gp-leise klein">{a.angebot ? (a.angebot.seiteHinweis ?? ANGEBOT_MEIN_AUFTRAG.seiteHinweis) : t.seiteHinweis}</p>
          </div>
          {akte.zipUrl && (
            <a className="gp-karte gp-auftauchen gp-karte-klick gp-zip" href={akte.zipUrl} data-fiaon="portal-zip">
              <span className="gp-auge">{w.allesLaden}</span>
              <span className="gp-leise">{w.allesLadenText}</span>
              <span className="gp-buero-fuss">ZIP</span>
            </a>
          )}
                  </aside>
                </div>
              )}
              {seite === "dienste" && (
                <div className="gp-haupt">
                  <Suspense fallback={<div className="gp-abschnitt"><Loader2 size={18} className="gp-dreht" /></div>}>
                    <GlobalDienste a={a} s={s} mitToken={mitToken} vorschau={vorschau} laden={laden} />
                  </Suspense>
                  {/* 22.10.2026: einmalige Leistungen außerhalb des Katalogs (Fast-Track, LLC-Gründung …) gehören auch zu „Ihre Dienste“. */}
                  {einzelLeistungen.length > 0 && (
                    <section className="gp-abschnitt gpd-abschnitt" data-fiaon="portal-einzelleistungen">
                      <h2 className="gpd-h2">{w.weitereLeistungen}</h2>
                      <p className="gp-lead">{w.weitereLead}</p>
                      <ul className="gp-rechnungen">
                        {einzelLeistungen.map((r) => (
                          <li key={r.bestellRef} className={`st-${r.status}`}>
                            <div><b>{r.titel}</b><small>{[r.nummer, r.datum ? tagKurz(r.datum) : ""].filter(Boolean).join(" · ")}</small></div>
                            <span className="gp-betrag">{euroText(r.betragCents)}</span>
                            <span className={`gp-marke ${r.status === "bezahlt" ? "gruen" : r.status === "offen" ? "blau" : ""}`}>{r.statusText}</span>
                            <span className="gp-rechnung-wege">{r.pdfUrl && <a className="gp-link" href={r.pdfUrl} target="_blank" rel="noopener">PDF</a>}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}
              {(seite === "strategie" || seite === "recht" || seite === "steuern") && (
                <div className="gp-haupt">
                  {seite === "steuern" && (
          <section id="gp-fristen" className="gp-abschnitt gp-auftauchen">
            <h2 className="gp-h2">{w.fristenTitel}</h2>
            <p className="gp-lead">{w.fristenLead}</p>
            {(a.fristen ?? []).length === 0 ? <p className="gp-leise">{a.status === "offen" ? w.fristenNachZahlung : t.fristenLeer}</p> : (
              <ul className="gp-fristen">
                {(a.fristen as T[]).map((f) => {
                  const tage = Math.round((new Date(f.faelligAm + "T12:00:00").getTime() - new Date(new Date().toDateString()).getTime() - 12 * 3600_000) / 86_400_000);
                  return (
                    <li key={f.id} className={f.erledigt ? "erledigt" : tage < 0 ? "faellig" : tage <= 30 ? "bald" : ""}>
                      <span className="gp-frist-datum"><b>{new Date(f.faelligAm + "T12:00:00").toLocaleDateString(loc, { day: "2-digit" })}</b><small>{new Date(f.faelligAm + "T12:00:00").toLocaleDateString(loc, { month: "short", year: "numeric" })}</small></span>
                      <div><b>{f.titel}</b>{f.hinweis && <small>{f.hinweis}</small>}</div>
                      <span className="gp-marke">{f.erledigt ? t.erledigt : tage < 0 ? w.ueber(-tage) : w.inTagen(tage)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

                  )}
                  <Suspense fallback={<div className="gp-abschnitt"><Loader2 size={18} className="gp-dreht" /></div>}>
                    <GlobalFach bereich={seite} a={a} s={s} mitToken={mitToken} vorschau={vorschau} laden={laden} geh={geh} />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="gp-fuss">{w.fusszeile}</footer>

      {neuOffen && neuDaten && (
        <Suspense fallback={null}>
          <PortalNeuigkeiten liste={neuDaten.liste} weitere={neuDaten.weitere ?? 0} s={s} vorschau={vorschau}
            onZu={() => { neuGesehen(); setNeuOffen(false); }}
            onZiel={(z: GlobalNeuigkeitZiel) => { neuGesehen(); setNeuOffen(false); geh(z); }} />
        </Suspense>
      )}

      {/* 22.10.2026: Von Hand zu unterschreibende Formulare (IRS SS-4/8821) bekommen NIE ein Zeichenfeld — vier Schritte bis zum PDF-Scan. */}
      {dialog && dialog.unterschrift?.modus === "handschriftlich" && (
        <HandschriftDialog dok={dialog} s={s} vorschau={vorschau}
          titel={((pflicht?.eintraege ?? []) as T[]).find((e) => e.dokumentId === dialog.id)?.titel ?? (dialog.titel || dialog.artText)}
          oeffnenUrl={mitToken(`/dokument/${encodeURIComponent(String(dialog.id))}`)}
          sendenUrl={mitToken(`/unterschrift/${encodeURIComponent(String(dialog.id))}/scan`)}
          onFertig={() => void laden()} onZu={() => setDialog(null)} />
      )}
      {dialog && dialog.unterschrift?.modus !== "handschriftlich" && (
        <UnterschriftDigital dok={dialog} s={s} vorschau={vorschau}
          titel={((pflicht?.eintraege ?? []) as T[]).find((e) => e.dokumentId === dialog.id)?.titel ?? (dialog.titel || dialog.artText)}
          namen={(a.unterschriften?.[String(dialog.id)]?.namen as string[] | undefined) ?? (vollerName ? [vollerName] : [])}
          ansichtUrl={mitToken(`/unterschrift/${encodeURIComponent(String(dialog.id))}/ansicht`)}
          startUrl={mitToken(`/unterschrift/${encodeURIComponent(String(dialog.id))}/start`)}
          codeNeuUrl={mitToken(`/unterschrift/${encodeURIComponent(String(dialog.id))}/code-neu`)}
          sendenUrl={mitToken(`/unterschrift/${encodeURIComponent(String(dialog.id))}`)}
          onFertig={() => void laden()} onZu={() => setDialog(null)} />
      )}
    </div>
  );
}

// ── Der Firmenname als Bühne (E-452) ─────────────────────────────────────────
// Die WÖRTER steigen gestaffelt aus ihrer Maske (je Wort ~100 ms versetzt, 0,9 s, weich abgebremst) — wie Apple ganze
// Wörter zeigt, nicht Buchstabe für Buchstabe. Steht der Name, streicht EINMAL ein gleichmäßiger Lichtstrich über den
// ganzen Namen (eine deckungsgleiche zweite Lage mit EINEM Verlauf, kein Glanz je Buchstabe). Der Screenreader liest
// den Namen einmal (gp-sr). „Bewegung reduzieren“: alles sofort da, kein Schimmer (CSS).
// Lange Wörter: Die Schrift wird so klein, dass das längste Wort in eine Zeile passt (--lang), nie abgeschnitten.
// Die Choreografie läuft EINMAL je Besuch — wer von einer Unterseite zurückkommt, sieht den Namen still stehen.
let firmenNameGezeigt = false;
function FirmenName({ name }: { name: string }) {
  const woerter = name.trim().split(/\s+/).filter(Boolean);
  const lang = Math.max(1, ...woerter.map((x) => Array.from(x).length));
  const [still] = useState(() => firmenNameGezeigt);
  useEffect(() => { firmenNameGezeigt = true; }, []);
  const takt = 100; // ms je Wort
  const glanzAb = 120 + Math.max(0, woerter.length - 1) * takt + 780; // wenn das letzte Wort fast steht
  // Das Leerzeichen steht ZWISCHEN den Wörtern (in einem inline-block fiele es am Ende weg) — so bricht der Name nur dort um.
  const lage = (glanz: boolean) => woerter.map((wort, wi) => (
    <Fragment key={wi}>
      {wi > 0 ? " " : null}
      <span className="gp-name-wort">
        {glanz ? wort : <span className="gp-name-b" style={{ animationDelay: `${120 + wi * takt}ms` }}>{wort}</span>}
      </span>
    </Fragment>
  ));
  return (
    <h1 className={`gp-name${still ? " gp-name-still" : ""}`} data-fiaon="portal-firmenname" style={{ ["--lang" as any]: lang }}>
      <span className="gp-sr">{name}</span>
      <span className="gp-name-lage" aria-hidden="true">{lage(false)}</span>
      <span className="gp-name-lage gp-name-glanz" aria-hidden="true" style={{ animationDelay: `${glanzAb}ms` }}>{lage(true)}</span>
    </h1>
  );
}

function DokZeile({ titel, unter, href, los, marke, aktion }: {
  titel: string; unter?: string; href: string; los: string; marke?: { text: string; ton: string }; aktion?: { text: string; los: () => void };
}) {
  return (
    <div className="gp-dok">
      <a className="gp-dok-text" href={href} target="_blank" rel="noopener"><b>{titel}</b>{unter && <small>{unter}</small>}</a>
      {marke && <span className={`gp-marke ${marke.ton}`}>{marke.text}</span>}
      {aktion ? <button type="button" className="gp-knopf klein" onClick={aktion.los}>{aktion.text}</button>
        : <a className="gp-dok-pfeil" href={href} target="_blank" rel="noopener" aria-label={`${titel} · ${los}`}>{los}</a>}
    </div>
  );
}

function Zeile({ k, v, kopie, kopiert, w }: { k: string; v?: string | null; kopie?: () => void; kopiert?: boolean; w?: typeof W.de }) {
  if (!v) return null;
  return (
    <div className="gp-zeile">
      <dt>{k}</dt>
      <dd>
        <span>{v}</span>
        {kopie && <button type="button" className="gp-kopie" onClick={kopie} aria-label={`${k}: ${kopiert ? (w?.kopiert ?? "Kopiert") : (w?.kopieren ?? "Kopieren")}`}>{kopiert ? (w?.kopiert ?? "Kopiert") : (w?.kopieren ?? "Kopieren")}</button>}
      </dd>
    </div>
  );
}
