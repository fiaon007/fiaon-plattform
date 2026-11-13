// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE FESTEN WÖRTER DER UNTERSEITEN-VORLAGE (24.09.2026, E-234)
//
// Bis heute standen sie deutsch im JSX von client/src/pages/site/global-seite.tsx
// („Auf einen Blick", „Weiterlesen" …). Seit es die Unterseiten auch englisch
// gibt, stehen sie hier — in beiden Sprachen, gleich
// gebaut. Die Datei folgt der Hausform der i18n-Wörterbücher („const de", dann
// „const en: typeof de"), damit scripts/seo-wortverbote-en.ts die englische Hälfte
// prüft und scripts/pruef-wortwand-de.ts die deutsche.
// „Kurz beantwortet" und „Häufige Fragen" stehen NICHT hier, sondern in
// GLOBAL_SEITE_WORTE (shared/fiaon-global-seiten/index.ts) — der Server braucht
// dieselben Wörter für den Korpus.
//
// 13.11.2026 (E-510, Sprachleitfaden FIAON Global): Honorar statt Preis, „Angebot anfordern“ aus der einen Quelle
// (shared/fiaon-global-saetze.ts), der Vermerk in der festen Fassung (Leitfaden 5.11), englisch „As at“. Der Block
// `finder` (Fragen des früheren Paket-Finders, vier Stufen) ist gelöscht: Die Seite gibt es seit E-509 nicht mehr, und
// kein Baustein hat die Wörter mehr gelesen — der Baustein „finder“ zeigt den Honorarrechner mit eigenen Texten.
// ═══════════════════════════════════════════════════════════════════════════
import { handlung } from "@shared/fiaon-global-saetze";

const de = {
  krumen: "Brotkrumen",
  blick: "Auf einen Blick",
  stand: (datum: string) => `Stand ${datum}`,
  inhaltLabel: "Inhalt dieser Seite",
  inhalt: "Inhalt",
  jetzt: handlung("angebot", "de"),
  vermerkStand: "Stand:",
  vermerkRedaktion: "Redaktion:",
  vermerkKennung: "Kennung:",
  quellen: "Quellen",
  // Leitfaden 5.11: der Vermerk in genau dieser Fassung. Wer für Recht und Steuern zuständig ist, sagt der Rollen-Satz im Fuß jeder Seite (S8).
  vermerkHinweis: "Diese Seite erklärt Grundlagen und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls.",
  weiterlesen: "Weiterlesen",
  uebersichtTitel: "Die Übersicht",
  uebersichtText: "Leistung, Honorar, Vertragspartner",
  rollen: { fiaon: "FIAON übernimmt", partner: "Partner übernehmen", sie: "Sie übernehmen" },
  vermerk: "Vermerk",
  alleImVergleich: "Alle Leistungen auf einen Blick",
  kapitalrahmen: "Kapitalrahmen",
  festpreisEinmalig: "Honorar · einmalig",
  ortszeit: (stadt: string) => `Ortszeit ${stadt}`,
  zitat: (text: string) => `„${text}“`,
  // 06.10.2026 (E-293, Scheibe D): die Vorlage wird kompakter — Merkblatt klappbar, Kalender erst auf Wunsch,
  // Quellen als Klappzeile. Wortlaut aus dem Bauplan Kapitel 5 (gegen Wand und E-188 geprüft).
  alleAngaben: "Alle Angaben",
  blickPunkte: (n: number) => `Auf einen Blick · ${n} Punkte`,
  gespraechKarte: "Erstgespräch: dreißig Minuten, kostenfrei",
  zeitWaehlen: "Zeit wählen",
  quellenZahl: (n: number) => `Quellen (${n})`,
};

const en: typeof de = {
  krumen: "Breadcrumbs",
  blick: "At a glance",
  stand: (datum: string) => `As at ${datum}`,
  inhaltLabel: "On this page",
  inhalt: "Contents",
  jetzt: handlung("angebot", "en"),
  vermerkStand: "As at:",
  vermerkRedaktion: "Editorial team:",
  vermerkKennung: "Reference:",
  quellen: "Sources",
  vermerkHinweis: "This page explains the basics and does not replace a tax or legal review of your case.",
  weiterlesen: "Read on",
  uebersichtTitel: "The overview",
  uebersichtText: "Services, fees, contracting party",
  rollen: { fiaon: "What FIAON does", partner: "What partners do", sie: "What you do" },
  vermerk: "Note",
  alleImVergleich: "All services at a glance",
  kapitalrahmen: "Funding target",
  festpreisEinmalig: "Fee · one-off",
  ortszeit: (stadt: string) => `Local time in ${stadt}`,
  zitat: (text: string) => `“${text}”`,
  alleAngaben: "All details",
  blickPunkte: (n: number) => `At a glance · ${n} points`,
  gespraechKarte: "Initial call: thirty minutes, free of charge",
  zeitWaehlen: "Choose a time",
  quellenZahl: (n: number) => `Sources (${n})`,
};

export const GLOBAL_SEITE_WOERTER = { de, en };
