// ═══════════════════════════════════════════════════════════════════════════
// DAS BÜNDEL: PAKET UND BONITÄTSAUSKUNFT IN EINEM ANTRAG (26.09.2026, E-243)
//
// Justin: „Ziel ist, die Bonitätsauskunft zu verkaufen UND ein Abo zu verkaufen
// — wenn nicht, auch gut, dann nur die Bonität."
//
// ── DER WEG ────────────────────────────────────────────────────────────────
//   1. Im letzten Entscheidungsschritt des Antrags („Vertrag annehmen",
//      client/src/pages/antrag.tsx) steht der Zusatz „Bonitätsauskunft zum
//      Kundenpreis dazubestellen". NIE vorangekreuzt. Mit ?auskunft=1 oder
//      src=auskunft (Wege von /bonitaetsauskunft) aufgeklappt, sonst dezent
//      eingeklappt; mit src=auskunft_da (Mail „Ihre Auskunft ist da") gar nicht —
//      der Mensch hat sie schon.
//   2. Der Haken reist beim Abschicken (ab Schritt 7) zum Server und steht als
//      Vermerk BUENDEL_WUNSCH_VERMERK an der Paket-Bestellung (fiaon_contact_log)
//      — mit Wortlaut, Fassung, Zeit, Wahl zum Beginn. Keine Spalte, keine
//      Migration (buendelWunschVermerken, server/lib/fiaon-auskunft.ts).
//   3. Erste Paketzahlung gebucht (onCustomerPaid) → die Auskunft-Bestellung
//      entsteht: Preis jetzt automatisch 74 € bzw. 199 € (laufendes Paket,
//      auskunftPreis), Beschaffungsauftrag aus dem Antrag an der neuen
//      Bestellung, Zahlungsdaten-Mail wie üblich (auskunftBuendelNachZahlung).
//   4. Nach der Lieferung an Menschen OHNE laufendes Paket: in „Ihre Auskunft
//      ist da" der Abschnitt „Ihr nächster Schritt zur Karte" und beim Betreuer
//      die Aufgabe „Auskunft geliefert — Auswertung besprechen und Paket
//      anbieten" (server/lib/fiaon-auskunft-lieferung.ts).
//
// ── WORTWAND ───────────────────────────────────────────────────────────────
// Kein Streichpreis (PAngV § 11: beide Preise nebeneinander, nie „statt"), kein
// „Limit" (der Antrag ist noch kein zahlender Kunde), keine Zusage über das
// Ergebnis, „fällig erst nach Ihrer ersten Paketzahlung" statt „kostenlos".
//
// Wer einen Satz ändert, der im Haken steht, erhöht BUENDEL_FASSUNG — die
// Fassung steht mit jedem Vermerk im Verlauf, und der Server nimmt nur den
// Wortlaut dieser Quelle als Beschaffungsauftrag (wie auskunftBestellungBelegen).
// ═══════════════════════════════════════════════════════════════════════════
import {
  AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT, AUSKUNFT_PREISE_CENTS, euroText, type AuskunftArt,
} from "./fiaon-auskunft";

/** Fassung des Zusatz-Hakens (Haken- und Sofort-Text dieser Datei). */
export const BUENDEL_FASSUNG = "2026-09-26";

/**
 * Anfang des Vermerks an der Paket-Bestellung, wenn der Zusatz angehakt war.
 * Liest: auskunftBuendelNachZahlung (Anlage nach der Zahlung) und
 * auskunftAngebotKaufstand (kein Einzelpreis-Angebot, solange das Bündel wartet).
 */
export const BUENDEL_WUNSCH_VERMERK = "Auskunft zum Kundenpreis dazubestellt";

/**
 * Anfang des Vermerks, mit dem die Anlage nach der Zahlung sich einmal je Person
 * „reserviert" (und danach das Ergebnis). Ein zweiter Buchungslauf sieht ihn und
 * legt nichts doppelt an.
 */
export const BUENDEL_ANLAGE_VERMERK = "Bündel Auskunft+Paket";

/** Wie der Zusatz auf der Seite erscheint: aufgeklappt, eingeklappt oder gar nicht. */
export type BuendelAnzeige = "offen" | "dezent" | "aus";

/**
 * Die Anzeige aus der Adresszeile — ?auskunft=1 oder src=auskunft klappen auf,
 * src=auskunft_da (Link aus „Ihre Auskunft ist da") blendet aus.
 */
export function buendelAnzeige(suche: string): BuendelAnzeige {
  try {
    const q = new URLSearchParams(suche);
    const src = String(q.get("src") ?? "").trim().toLowerCase();
    if (src === "auskunft_da" || q.get("auskunft") === "0") return "aus";
    if (q.get("auskunft") === "1" || src === "auskunft") return "offen";
  } catch { /* egal — dezent */ }
  return "dezent";
}

/** Die Art aus dem Paket: ein FIAON-Business-Paket heißt Firmen-Auskunft (wie auskunftArtFuer). */
export function buendelArt(packKey: unknown): AuskunftArt {
  return String(packKey ?? "").trim().toLowerCase().startsWith("business_") ? "firma" : "privat";
}

/** „74 €" bzw. „199 €" — der Kundenpreis MIT Paket. */
export function buendelPreisText(art: AuskunftArt): string {
  return euroText(AUSKUNFT_PREISE_CENTS[art].mitAbo);
}

/** Die Überschrift des Zusatzes: „Bonitätsauskunft zum Kundenpreis dazubestellen — 74 €". */
export function buendelTitel(art: AuskunftArt): string {
  return `${art === "firma" ? "Firmen-Bonitätsauskunft" : "Bonitätsauskunft"} zum Kundenpreis dazubestellen — ${buendelPreisText(art)}`;
}

/**
 * Die Preiszeile unter der Überschrift — beide Preise nebeneinander, nie als
 * Streichpreis. Im Privatantrag steht der Firmenpreis dabei (Justin: „privat 74 €,
 * B2B 199 €"), damit niemand den Preis für die falsche Art liest.
 */
export function buendelPreisZeile(art: AuskunftArt): string {
  const p = AUSKUNFT_PREISE_CENTS;
  return art === "firma"
    ? `${euroText(p.firma.mitAbo)} als FIAON-Kunde mit Paket · einzeln ${euroText(p.firma.einzeln)} · einmalig, kein Abo`
    : `${euroText(p.privat.mitAbo)} als FIAON-Kunde mit Paket (Unternehmen ${euroText(p.firma.mitAbo)}) · einzeln ${euroText(p.privat.einzeln)} · einmalig, kein Abo`;
}

/**
 * Der Wortlaut des Hakens — Bestellung UND Beschaffungsauftrag in einem Satz.
 * Der Auftrag ist wortgleich AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT (Pflicht an jeder
 * Kauftür, E-241); „die oben genannten Auskunfteien" nennt der Zusatz darüber,
 * je Land (AT und CH lesen nie „SCHUFA").
 */
export function buendelHakenText(art: AuskunftArt): string {
  const was = art === "firma" ? "die Firmen-Bonitätsauskunft" : "die Bonitätsauskunft";
  return `Ja, ich bestelle ${was} inklusive Handlungsplan zum Kundenpreis von ${buendelPreisText(art)} dazu — `
    + "fällig erst nach meiner ersten Paketzahlung, einmalig, kein Abo. "
    + AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT(art);
}

/**
 * Die Wahl zum Beginn vor Ablauf der Widerrufsfrist — wortgleich mit Kauflink
 * (SOFORT_BEGINN_SATZ, server/routes/fiaon-auskunft-kauf.ts) und Kaufkarte im
 * Bereich. Freiwillig, nie vorangekreuzt, nur für Verbraucher.
 */
export const BUENDEL_SOFORT_TEXT =
  "Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit der Arbeit beginnt. Mir ist bekannt, "
  + "dass ich bei einem Widerruf die bis dahin erbrachten Leistungen anteilig bezahle und dass mein Widerrufsrecht "
  + "erlischt, wenn FIAON den Vertrag vollständig erfüllt hat.";

export const BUENDEL_SOFORT_OHNE = "Ohne diesen Haken beginnen wir nach Ablauf der Widerrufsfrist.";

/** Der Satz, der sagt, wann bezahlt wird — auf der Seite und im Verlauf gleich. */
// Gegenlesen 26.09.2026 (E-243): + „Kommt keine Paketzahlung …" — der Zusatz hängt am Paket; ohne dessen
// erste Zahlung legt der Server keine Auskunft-Bestellung an (auskunftBuendelNachZahlung). Das zu sagen
// nimmt die Sorge vor einer Rechnung ohne Paket — und ist wahr.
export const BUENDEL_FAELLIG_SATZ =
  "Fällig erst nach Ihrer ersten Paketzahlung: Dann bekommen Sie Rechnung und Zahlungsdaten der Auskunft per E-Mail, "
  + "zusammen mit der Vertragsbestätigung und der Widerrufsbelehrung. Kommt keine Paketzahlung, gibt es auch keine Rechnung "
  + "für die Auskunft. Einmalig, kein Abo.";

/** Was der Browser beim Abschicken mitschickt (antrag.tsx → POST /application). */
export interface BuendelZusatz {
  gewaehlt: boolean;
  art: AuskunftArt;
  fassung: string;
  /** Der Wortlaut des Hakens, wie angezeigt (buendelHakenText). */
  haken: string;
  /** Der Beschaffungsauftrag daraus (AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT). */
  auftrag: string;
  /** ISO-Zeitpunkt des Hakens. */
  am: string | null;
  sofort: boolean;
  sofortText: string;
  sofortAm: string | null;
  anzeige: BuendelAnzeige;
  land: string | null;
}
