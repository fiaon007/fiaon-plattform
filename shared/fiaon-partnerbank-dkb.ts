// ═══════════════════════════════════════════════════════════════════════════
// DIE PARTNERBANK IN ZAHLEN — eine Stelle für alle Konditionen der DKB (14.10.2026)
//
// Justin: „eine eigene Unterseite, wo alle Vorteile des Kontos und der
// Kreditkarte sind … hole dir gerne mehr Infos direkt von der DKB." Grundlage
// war der interne Leitfaden „Vorteile der Zusammenarbeit FIAON und DKB" — jede
// Zahl daraus wurde am 14.10.2026 auf dkb.de gegengeprüft. Abweichung gefunden:
// Der Leitfaden nennt 7,91 % Dispozins mit Aktivstatus, die DKB heute 9,06 %.
//
// Regeln:
//   · Nur Zahlen, die die DKB selbst veröffentlicht. Verbindlich ist ihr
//     Preis- und Leistungsverzeichnis — die Seite sagt das und nennt den Stand.
//   · Ändert die DKB etwas: HIER ändern und STAND neu setzen; die Seite
//     /partnerbank-dkb (beide Sprachen) liest nur von hier.
//   · Über Konto und Karte entscheidet die Bank. Kein Satz verspricht eine
//     Eröffnung oder einen Kartenrahmen.
//   · Wortwahl: „Partnerbank" / „Kooperationspartner" (E-067).
// Quellen: dkb.de/privatkunden/girokonto, …/karten/debitkarte,
// …/karten/visa-kreditkarte, Preis- und Leistungsverzeichnis (dok.dkb.de).
// ═══════════════════════════════════════════════════════════════════════════

/** Tag der letzten Gegenprüfung auf dkb.de (ISO). */
export const DKB_STAND = "2026-10-14";

export const DKB = {
  /** Kontoführung kostenlos ab diesem monatlichen Geldeingang (Euro) … */
  geldeingangEuro: 700,
  /** … oder bis zu diesem Geburtstag. */
  freiBisAlter: 28,
  /** Kontoführung ohne Aktivstatus, je Monat (Euro). */
  kontoGebuehrEuro: "4,50",
  /** Dispozins p. a., variabel. */
  dispoAktiv: "9,06",
  dispoOhne: "9,66",
  /** Notfallpaket bei Kartenverlust im Ausland — ohne Aktivstatus kostet es so viel (Euro). */
  notfallkarteEuro: 180,
  notfallbargeldEuro: 150,
  /** Währungsumrechnungsentgelt ohne Aktivstatus (Debitkarte, außerhalb des Euroraums). */
  fremdwaehrungOhne: "2,20",
  /** Neukunden: Aktivstatus automatisch für so viele Monate. */
  aktivStartMonate: 3,
  /** Kontoeröffnung online, ungefähr (Minuten). */
  eroeffnungMinuten: 5,
  /** Echtzeitüberweisung: Geld auf dem anderen SEPA-Konto in (Sekunden). */
  echtzeitSekunden: 10,
  /** Kontowechselservice informiert Zahlungspartner in unter (Minuten). */
  wechselMinuten: 10,
  /** Gesetzliche Einlagensicherung je Kunde (Euro). */
  einlagensicherungEuro: "100.000",
  /** Visa Kreditkarte — optional zum Girokonto, je Monat (Euro). */
  kreditkarteMonatEuro: "2,49",
  /** Abrechnung der Kreditkarte am … des Monats, Sollsaldo in einer Summe vom Girokonto. */
  abrechnungTag: 22,
  /** Bargeld am Automaten je Tag (Euro, Spanne). */
  bargeldTagEuro: "50 – 1.000",
} as const;

/**
 * Aktion der DKB zur Kreditkarte: 30 € Bonus für die erste Visa Kreditkarte,
 * beantragt 17.08.–31.12.2026, drei Zahlungen ab 5 € in sechs Wochen.
 * Die Seite zeigt den Hinweis nur bis zum letzten Tag (aktionLaeuft).
 */
export const DKB_AKTION = { bonusEuro: 30, bis: "2026-12-31", zahlungen: 3, abEuro: 5, wochen: 6 } as const;

export function aktionLaeuft(heute: Date = new Date()): boolean {
  const iso = heute.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  return iso <= DKB_AKTION.bis;
}

/** „14.10.2026" bzw. „14 October 2026". */
export function dkbStandText(sprache: "de" | "en"): string {
  const [j, m, t] = DKB_STAND.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t, 12));
  return sprache === "en"
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : `${String(t).padStart(2, "0")}.${String(m).padStart(2, "0")}.${j}`;
}

export const DKB_QUELLE = "https://www.dkb.de/privatkunden/girokonto";
