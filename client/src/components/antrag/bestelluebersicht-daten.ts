// ═══════════════════════════════════════════════════════════════════════════
// DIE BESTELLÜBERSICHT ÜBER DEM KNOPF „ZAHLUNGSPFLICHTIG ANNEHMEN" (26.09.2026, E-244)
//
// Justin: „ja, ändere den Knopf auf Zahlungspflichtig annehmen".
//
// ── WARUM ES DIESE DATEI GIBT ─────────────────────────────────────────────
// § 312j Abs. 2 BGB verlangt, dass Paket, Gesamtpreis, Laufzeit und
// Kündigungsregel UNMITTELBAR vor dem Klick stehen, der zahlungspflichtig
// macht — klar, verständlich, hervorgehoben. Der Knopf allein (Abs. 3) reicht
// nicht. Bis heute zeigte Schritt 6 nur E-Mail, drei Haken und den Zusatz;
// die Laufzeit stand nirgends, der Gesamtbetrag auch nicht — obwohl AGB § 5
// Abs. 2 verspricht, beides stehe „in der Bestellübersicht".
//
// ── DIE QUELLEN (nichts steht hier, was sie nicht hergeben) ───────────────
//   Preise:     shared/fiaon-pakete.ts (Katalog, Cent) — NIE die Kartenliste
//               in antrag.tsx.
//   Auskunft:   shared/fiaon-auskunft.ts (Kundenpreis mit Paket; im Bündel
//               entsteht die Bestellung erst nach der ersten Paketzahlung,
//               shared/fiaon-auskunft-buendel.ts).
//   Laufzeit:   AGB § 6 Abs. 1–3 (client/src/pages/agb.tsx).
//   Zahlung:    AGB § 5 Abs. 2–4 — Gesamtvergütung, zwölf Raten, zinsfrei,
//               erste Rate mit Vertragsschluss; Zahlungsweg Überweisung
//               (Lastschrift gibt es seit E-194 nicht mehr).
//   Leistung:   je Paket PAKET_KERN (Preisseite privatkunden.ts, AGB § 4
//               Abs. 1) + AGB § 2/§ 4 Abs. 2 (Bank entscheidet). Kein Limit,
//               keine Karte, kein Score-Versprechen.
//
// Wer AGB § 5 oder § 6 ändert, ändert DIESE Sätze mit — und umgekehrt.
// Prüfstand: .pruef/e244-knopf-uebersicht.mts
// ═══════════════════════════════════════════════════════════════════════════
import { paket } from "@shared/fiaon-pakete";
import { PAKET_ANZEIGE } from "@shared/fiaon-paketname";
import { istUebersichtPaket } from "@shared/fiaon-vertrag-paket";
import { AUSKUNFT_PREISE_CENTS, type AuskunftArt } from "@shared/fiaon-auskunft";

/** Der Knopf, der den Vertrag schließt — überall derselbe Wortlaut (§ 312j Abs. 3 BGB). */
export const KNOPF_ZAHLUNGSPFLICHTIG = "Zahlungspflichtig annehmen";

/** Laufzeit der Erstlaufzeit in Monaten (AGB § 6 Abs. 1) = Zahl der Raten (§ 5 Abs. 2). */
export const LAUFZEIT_MONATE = 12;

/** Ein Betrag in Cent als „59,99 €" / „719,88 €" / „74 €" — immer mit Komma, Tausenderpunkt. */
export function euro(cents: number): string {
  const e = cents / 100;
  const ganz = Number.isInteger(e);
  return `${e.toLocaleString("de-DE", { minimumFractionDigits: ganz ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

// E-244: istUebersichtPaket und paketKeyAusName wohnen in shared/fiaon-vertrag-paket.ts —
// der Server prüft dieselbe Frage, bevor er über /zustimmung eine Vertragsannahme festhält.
export { istUebersichtPaket, paketKeyAusName } from "@shared/fiaon-vertrag-paket";

export interface BestellZeile {
  /** Kurzer Titel links („Monatliche Rate"). */
  titel: string;
  /** Der Inhalt rechts. */
  wert: string;
  /** Hervorgehoben (Gesamtbetrag). */
  stark?: boolean;
  /** Maschinenlesbarer Name für Prüfstände. */
  id: string;
}

export interface BestellUebersicht {
  packKey: string;
  paketName: string;
  rateCents: number;
  gesamtCents: number;
  zusatzCents: number | null;
  zeilen: BestellZeile[];
  /** Der Satz unter der Tabelle (Endpreis, Widerruf). */
  fuss: string;
}

// ── KERNLEISTUNGEN JE PAKET (Nachbesserung E-244, 26.09.2026) ─────────────
// Vorher stand für alle vier Pakete derselbe Satz („Zugang … im Umfang des
// Pakets") — Pro und Ultra waren in der Übersicht nicht zu unterscheiden, die
// wesentlichen Eigenschaften (Art. 246a § 1 Nr. 1 EGBGB) fehlten. AGB § 4 Abs. 1
// verweist für den Umfang auf die Leistungsbeschreibung des Pakets: Das ist die
// Preisseite (client/src/i18n/privatkunden.ts, `pakete.*.feats`). Die Punkte
// hier folgen ihr — OHNE Limit-, Karten-, Konto- und Fristversprechen
// (Wortwand): kein „Kreditkarte bis …", kein „Girokonto für jeden Kunden",
// kein „SCHUFA" (AT/CH), kein „in 24 Stunden". Die Punkte stehen auch in der
// Paketwahl des Antrags (antrag.tsx, PACKS.feats) — eine Quelle für beide.
//
// DIE AUSKUNFT SELBST IST NICHT IM PAKET (Nachbesserung 26.09.2026): Hier stand „Ihre Bonitätsauskunft –
// beschafft und erklärt" — und darunter verkaufte dieselbe Übersicht die Auskunft als Zusatz für 74 €.
// Die Auskunft ist ein Zusatzprodukt (shared/fiaon-wissen.ts, Welcome-Mail konto.ts). Im Paket steckt die
// AUSWERTUNG: Der Kunde lädt seine selbst angeforderte Datenkopie hoch oder beauftragt die Auskunft als Zusatz.
export const PAKET_START_AUSKUNFT_PUNKT = "Auswertung Ihrer Bonitätsauskunft – jeder Eintrag erklärt (Ihre selbst angeforderte Datenkopie oder die Auskunft als Zusatz)";
export const PAKET_KERN: Record<string, { zeile: string; punkte: string[] }> = {
  start: {
    zeile: `${PAKET_START_AUSKUNFT_PUNKT}; Kontoauszug-Analyse mit Ihrem finanziellen Spielraum; Ihr Kundenbereich mit Fahrplan; Unterstützung per E-Mail.`,
    punkte: [PAKET_START_AUSKUNFT_PUNKT, "Kontoauszug-Analyse mit Ihrem Spielraum", "Ihr Kundenbereich mit Fahrplan", "Unterstützung per E-Mail"],
  },
  // E-283 (05.10.2026): Das Limit-Gespräch gilt für ALLE bezahlten Pro-, Ultra- und High-End-Kunden, alter und
  // neuer Antrag gleich (Entscheidung Justin) — es steht deshalb auch hier. Ultra und High-End erben es über
  // „Alles aus Pro“. Gebucht wird im Kundenbereich (Regel: shared/fiaon-limit-gespraech.ts).
  pro: {
    zeile: "Alles aus Start, dazu Löschanträge und Widersprüche – vorbereitet, versendet, verfolgt; Ratenvereinbarungen mit Antwort-Verfolgung; Startgespräch und feste Ansprechpartnerin; Limit-Gespräch alle drei Monate, im Kundenbereich buchbar.",
    punkte: ["Alles aus Start", "Löschanträge und Widersprüche – vorbereitet, versendet, verfolgt", "Ratenvereinbarungen mit Antwort-Verfolgung", "Startgespräch und feste Ansprechpartnerin", "Limit-Gespräch alle drei Monate – im Kundenbereich buchbar"],
  },
  ultra: {
    zeile: "Alles aus Pro, dazu Begleitung auf dem Weg zu einer Kreditkarte (Readiness, Meilensteine, Antragsvorbereitung); bevorzugte Bearbeitung Ihrer Schreiben; telefonische Betreuung.",
    punkte: ["Alles aus Pro", "Begleitung auf dem Weg zu einer Kreditkarte – Readiness, Meilensteine, Antragsvorbereitung", "Bevorzugte Bearbeitung Ihrer Schreiben", "Telefonische Betreuung"],
  },
  highend: {
    zeile: "Alles aus Ultra, dazu ein persönlicher Betreuer für Ihre Akte; Vorbereitung auf Finanzierungen; erreichbar auch außerhalb der Bürozeiten.",
    punkte: ["Alles aus Ultra", "Persönlicher Betreuer für Ihre Akte", "Vorbereitung auf Finanzierungen", "Erreichbar auch außerhalb der Bürozeiten"],
  },
};

/** Der Satz nach jeder Kernleistung — AGB § 2 (keine Finanzvermittlung) und § 4 Abs. 2 (Bank entscheidet). */
export const BANK_SATZ = "FIAON vermittelt keine Kredite; über Konto, Karte und Rahmen entscheidet allein die Bank.";

/** Leistung in einer Zeile — je Paket (PAKET_KERN) plus BANK_SATZ. */
export function leistungZeile(packKey: string): string {
  const k = PAKET_KERN[packKey];
  return `${k ? k.zeile : "Zugang zur FIAON-Plattform im Umfang des Pakets."} ${BANK_SATZ}`;
}

/**
 * Was der Zusatz über das Paket hinaus bringt: die Beschaffung (shared/fiaon-auskunft.ts auskunftLeistung,
 * ohne Land — die Übersicht kennt es nicht; daher „die großen Auskunfteien Ihres Landes", nie „SCHUFA").
 */
export const ZUSATZ_LEISTUNG: Record<AuskunftArt, string> = {
  privat: "Wir fordern Ihre Datenkopien bei den großen Auskunfteien Ihres Landes an – in Ihrem Auftrag.",
  firma: "Wir fordern die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien und Ihre persönliche Datenkopie bei den großen Auskunfteien Ihres Landes an – in Ihrem Auftrag.",
};

/** Der Vertrags-Haken (Antrag ag3, /zustimmung consent_contract): Er bestätigt das PRÜFEN — angenommen wird mit dem Knopf (AGB § 3 Abs. 3). */
export const HAKEN_VERTRAG_TITEL = "Bestellung geprüft";
export const HAKEN_VERTRAG_TEXT = "Ich habe Paket, Monatsrate, Laufzeit, Gesamtbetrag und Kündigungsregel in der Bestellübersicht geprüft.";

/**
 * Zahlungsweise — AGB § 5 Abs. 2–4. E-283 (05.10.2026): Stichtag der weiteren Raten ist der Kalendertag,
 * an dem die erste Rate EINGEGANGEN ist (server/lib/fiaon-abo-zyklus.ts: Anker = bankbestätigte Buchung),
 * nicht der Tag des Vertragsschlusses — so steht es seit der Fassung vom 05.10.2026 in AGB § 5 Abs. 3
 * und im neuen Vertrag § 5 Abs. 2.
 */
export const ZAHLUNG_ZEILE =
  "Überweisung. Die erste Rate ist mit Vertragsschluss fällig, die weiteren jeweils monatlich im Voraus am Kalendertag, an dem die erste Rate bei FIAON eingegangen ist.";

/** Kündigung — AGB § 6 Abs. 2 und 3. */
export const KUENDIGUNG_ZEILE =
  "Mit einer Frist von einem Monat zum Ende der zwölf Monate, in Textform (fiaon.com/abo-kuendigen, Kundenbereich oder E-Mail). "
  + "Ohne Kündigung läuft der Vertrag danach unbefristet weiter und ist dann jederzeit mit einer Frist von einem Monat kündbar.";

export const FUSS_SATZ =
  "Alle Preise sind Endpreise einschließlich einer etwaig anfallenden Umsatzsteuer. Als Verbraucher können Sie den Vertrag binnen vierzehn Tagen widerrufen; Einzelheiten stehen in der Widerrufsbelehrung.";

/**
 * Die Übersicht für ein Paket (und optional den Auskunft-Zusatz). null, wenn
 * das Paket kein Privatpaket mit Rate ist — dann gibt es nichts Wahres zu zeigen.
 */
export function bestellUebersicht(packKey: unknown, zusatz: AuskunftArt | null = null): BestellUebersicht | null {
  if (!istUebersichtPaket(packKey)) return null;
  const p = paket(packKey)!;
  const name = PAKET_ANZEIGE[p.key]?.name ?? p.label;
  const rate = p.preisCents;
  const gesamt = rate * LAUFZEIT_MONATE;
  const zusatzCents = zusatz ? AUSKUNFT_PREISE_CENTS[zusatz].mitAbo : null;
  const zeilen: BestellZeile[] = [
    { id: "paket", titel: "Paket", wert: name },
    { id: "leistung", titel: "Leistung", wert: leistungZeile(p.key) },
    { id: "rate", titel: "Monatliche Rate", wert: `${euro(rate)} (zinsfrei)` },
    { id: "laufzeit", titel: "Laufzeit", wert: `${LAUFZEIT_MONATE} Monate fest (Jahresvertrag), ab Vertragsschluss` },
    { id: "gesamt", titel: "Gesamtbetrag", wert: `${euro(gesamt)} (${LAUFZEIT_MONATE} × ${euro(rate)})`, stark: true },
    { id: "zahlung", titel: "Zahlungsweise", wert: ZAHLUNG_ZEILE },
    { id: "kuendigung", titel: "Kündigung", wert: KUENDIGUNG_ZEILE },
  ];
  if (zusatz && zusatzCents != null) {
    zeilen.push({ id: "zusatz", titel: "Zusatz", wert: `${zusatz === "firma" ? "Firmen-Bonitätsauskunft" : "Bonitätsauskunft"} ${euro(zusatzCents)} einmalig, fällig erst nach Ihrer ersten Paketzahlung. ${ZUSATZ_LEISTUNG[zusatz]}` });
    zeilen.push({ id: "zusammen", titel: "Zusammen", wert: `${euro(gesamt + zusatzCents)} (Paket ${euro(gesamt)} + Auskunft ${euro(zusatzCents)})`, stark: true });
  }
  return { packKey: p.key, paketName: name, rateCents: rate, gesamtCents: gesamt, zusatzCents, zeilen, fuss: FUSS_SATZ };
}
