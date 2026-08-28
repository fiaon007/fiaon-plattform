// ═══════════════════════════════════════════════════════════════════════════
// KONTOAUSZUG-ANLEITUNGEN JE BANK (P13, Team-Feedback 28.08.2026)
//
// „In der früheren Kundenansicht gab es bei den jeweiligen Banken einen
// Erklärbär, der erklärt hat, wie man die Kontoauszüge herunterlädt."
//
// Die Wege hier sind bewusst GENERISCH je Bank beschrieben (Postfach/
// Dokumente im Online-Banking), nicht als Klickpfad mit Menünamen — Banken
// bauen ihre Apps ständig um, und eine falsche Menüangabe ist schlimmer als
// eine allgemeine. Benötigt wird immer: die letzten 3 Monate, als PDF.
//
// Geteilt (shared/), weil zwei Seiten dieselben Texte sprechen:
//   · das Kundenportal bei „Unterlagen" (der Kunde liest selbst)
//   · die Agenten-Akte im Dokumente-Reiter (der Agent liest am Telefon vor)
// ═══════════════════════════════════════════════════════════════════════════

export interface BankAnleitung {
  /** Erkennungswörter — gegen Bankname/IBAN-Bankname des Kunden geprüft. */
  woerter: string[];
  name: string;
  schritte: string[];
}

/** Der Rahmen, der für JEDE Bank gilt. */
export const AUSZUG_GRUNDSATZ =
  "Gebraucht werden die Kontoauszüge der letzten drei Monate als PDF — "
  + "keine Screenshots, keine Fotos vom Bildschirm.";

export const BANK_ANLEITUNGEN: BankAnleitung[] = [
  {
    woerter: ["sparkasse", "haspa", "kreissparkasse", "stadtsparkasse"],
    name: "Sparkasse",
    schritte: [
      "Im Online-Banking anmelden (App oder Browser).",
      "Zum elektronischen Postfach gehen — dort liegen die Auszüge als PDF, je Monat einer.",
      "Die letzten drei Monate herunterladen. Fehlen dort Auszüge: unter „Umsätze“ den Zeitraum wählen und „Exportieren/Drucken als PDF“ nutzen.",
    ],
  },
  {
    woerter: ["volksbank", "raiffeisen", "vr bank", "vr-bank", "sparda"],
    name: "Volksbank / Raiffeisenbank / Sparda",
    schritte: [
      "Im Online-Banking anmelden.",
      "Postfach bzw. „Dokumente“ öffnen — die Kontoauszüge liegen dort monatlich als PDF.",
      "Alternativ unter „Umsätze“ den Zeitraum (3 Monate) wählen und als PDF exportieren.",
    ],
  },
  {
    woerter: ["ing", "ing-diba", "diba"],
    name: "ING",
    schritte: [
      "Im Banking anmelden und „Post“ (Postbox) öffnen.",
      "Dort liegen die Kontoauszüge monatlich als PDF — die letzten drei herunterladen.",
      "In der App: Menü → Post → Dokument antippen → Teilen/Sichern als PDF.",
    ],
  },
  {
    woerter: ["dkb", "deutsche kreditbank"],
    name: "DKB",
    schritte: [
      "Im Banking anmelden, oben „Postfach“ öffnen.",
      "Kategorie „Kontoauszüge“ wählen — je Monat ein PDF, die letzten drei herunterladen.",
    ],
  },
  {
    woerter: ["commerzbank"],
    name: "Commerzbank",
    schritte: [
      "Im Online-Banking anmelden und das Postfach öffnen.",
      "Unter „Kontoauszüge“ die letzten drei Monats-PDFs herunterladen.",
    ],
  },
  {
    woerter: ["deutsche bank"],
    name: "Deutsche Bank",
    schritte: [
      "Im Online-Banking anmelden.",
      "„Postbox“ öffnen — dort liegen die Auszüge als PDF, die letzten drei Monate laden.",
    ],
  },
  {
    woerter: ["postbank"],
    name: "Postbank",
    schritte: [
      "Im Banking anmelden und das elektronische Postfach öffnen.",
      "Unter „Dokumente/Kontoauszüge“ die letzten drei Monats-PDFs herunterladen.",
    ],
  },
  {
    woerter: ["n26"],
    name: "N26",
    schritte: [
      "App öffnen → Profil/Zahnrad → „Kontoauszüge“ (Statements).",
      "Die Monats-PDFs der letzten drei Monate herunterladen bzw. per Teilen sichern.",
    ],
  },
  {
    woerter: ["comdirect"],
    name: "comdirect",
    schritte: [
      "Im Banking anmelden, „PostBox“ öffnen.",
      "Nach „Kontoauszug“ filtern und die letzten drei Monats-PDFs herunterladen.",
    ],
  },
  {
    woerter: ["revolut"],
    name: "Revolut",
    schritte: [
      "App öffnen → Konto antippen → „…“ / Dokumente → „Kontoauszug“.",
      "Zeitraum (3 Monate) wählen, PDF erzeugen und herunterladen.",
    ],
  },
  {
    woerter: ["targobank"],
    name: "Targobank",
    schritte: [
      "Im Online-Banking anmelden und das Postfach öffnen.",
      "Die Kontoauszüge der letzten drei Monate als PDF herunterladen.",
    ],
  },
];

/** Die passende Anleitung zu einem Banknamen — oder der allgemeine Weg. */
export function bankAnleitungFuer(bankname: string | null | undefined): BankAnleitung {
  const n = String(bankname || "").toLowerCase();
  if (n) {
    for (const b of BANK_ANLEITUNGEN) {
      if (b.woerter.some((w) => n.includes(w))) return b;
    }
  }
  return {
    woerter: [],
    name: "Ihre Bank",
    schritte: [
      "Im Online-Banking (App oder Browser) anmelden.",
      "Das elektronische Postfach bzw. „Dokumente“ öffnen — dort liegen die Kontoauszüge als PDF, je Monat einer.",
      "Die letzten drei Monate herunterladen. Gibt es kein Postfach: unter „Umsätze“ den Zeitraum wählen und als PDF exportieren.",
      "Kein Online-Banking? Die Auszüge gibt es am Kontoauszugsdrucker in der Filiale oder auf Anfrage per Post — das dauert einige Tage, also früh anfordern.",
    ],
  };
}
