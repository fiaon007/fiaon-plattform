// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSKUNFT: WIDERRUFSBELEHRUNG UND VERTRAGSBESTÄTIGUNG — EINE QUELLE
// (25.09.2026, E-240)
//
// ── WARUM EINE EIGENE DATEI ───────────────────────────────────────────────
// Die Bestellseite /bonitaet-antrag zeigte die Belehrung aus dem Muster von
// FIAON Global (shared/fiaon-global-widerruf.ts); die Zahlungsdaten-Mail der
// Auskunft trug gar keine. Die Widerrufsfrist beginnt aber erst, wenn der
// Verbraucher nach Art. 246a § 1 Abs. 2 Satz 1 Nr. 1 EGBGB belehrt ist
// (§ 356 Abs. 3 BGB) — sonst läuft sie bis zu zwölf Monate und 14 Tage —, und
// die Bestätigung des Vertrags gehört auf einen dauerhaften Datenträger
// (§ 312f Abs. 2 BGB): Die Webseite ist keiner, die E-Mail schon. Seite und
// Zahlungsdaten-Mail (server/mail/vorlagen/auskunft-lead.ts,
// auskunftZahlungsdatenBaustein) lesen ab jetzt HIER — derselbe Wortlaut.
//
// ── WAS HIER STEHT ────────────────────────────────────────────────────────
// · Das gesetzliche Muster (Anlage 1 und 2 zu Art. 246a § 1 Abs. 2 EGBGB,
//   Gestaltungshinweis 6 für Dienstleistungen) — WÖRTLICH wie in
//   shared/fiaon-global-widerruf.ts. Nur die Anbieterangabe folgt dem
//   Impressum (client/src/pages/impressum.tsx: „Vereinigtes Königreich" statt
//   „United Kingdom"). Nicht „verbessern": Jede Abweichung kostet die
//   Musterwirkung. .pruef/e240-widerruf-mail.ts vergleicht die Absätze Satz
//   für Satz mit der Global-Fassung.
// · Im Muster-Formular steht die Anschrift mit E-Mail und OHNE Telefon — so
//   sieht es Anlage 2 vor („Name, Anschrift und gegebenenfalls E-Mail-Adresse");
//   in der Belehrung selbst gehört das Telefon seit 2022 dazu.
// · Der Hinweis zum vorzeitigen Erlöschen (§ 356 Abs. 4 BGB) und der Satz für
//   Unternehmen (kein gesetzliches Widerrufsrecht, § 14 BGB).
// · Die Sätze der Vertragsbestätigung, die Seite und Mail gleich sagen:
//   Anbieter, Kontakt, Laufzeit, Leistungszeit, Preisangabe, Vertragssprache.
// · Der Satz zur Wahl des Kunden (Beginn vor Fristablauf verlangt oder nicht)
//   — dieselbe Wahl, die die Lieferung liest (auskunftWiderrufStand in
//   server/lib/fiaon-auskunft-lieferung.ts).
//
// ── DIE INTERNE NOTIZ, DIE NIE WIEDER KUNDENTEXT WIRD ─────────────────────
// Die öffentliche Seite /widerrufsbelehrung (client/src/pages/
// widerrufsbelehrung.tsx), auf die Kaufkarte und Kauflink der Auskunft
// verweisen, zeigte bis heute eine Notiz der Anbieterin in der Belehrung —
// „… holen wir diese Zustimmung … über eine zwingend anzukreuzende Checkbox im
// Checkout-Prozess ein". Das ist eine Umsetzungsnotiz, keine Belehrung, und
// für die Auskunft auch falsch: Dort ist der Haken freiwillig („Ohne diesen
// Haken beginnen wir nach Ablauf der Widerrufsfrist"). Sie steht jetzt nur
// noch als Kommentar im Quelltext. Hier gilt dasselbe: Hinweise an das Team
// gehören in Kommentare, nie in einen der Texte unten.
//
// Wer einen Satz der Belehrung ändert, erhöht AUSKUNFT_WIDERRUF_FASSUNG UND
// BESTELL_FASSUNG (client/src/i18n/bonitaet-antrag.ts) — die Bestellseite
// schickt die Fassung mit jeder Bestellung, damit belegt bleibt, welche
// Belehrung der Kunde gesehen hat.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import type { AuskunftArt } from "./fiaon-auskunft";

/** Fassung der Belehrung und der Bestätigungssätze in dieser Datei. */
export const AUSKUNFT_WIDERRUF_FASSUNG = "2026-09-25";

/** Die Anschrift der FIAON LTD, wie sie im Impressum steht. */
export const AUSKUNFT_ANBIETER_ANSCHRIFT =
  `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, Vereinigtes Königreich`;

/** In der Belehrung: Name, Anschrift, Telefon und E-Mail (Gestaltungshinweis 2 des Musters). */
export const AUSKUNFT_WIDERRUF_ANBIETER =
  `${AUSKUNFT_ANBIETER_ANSCHRIFT}, Telefon: ${FIAON_FIRMA.telefon}, E-Mail: ${FIAON_FIRMA.email}`;

/** Der Vertragspartner für die vorvertraglichen Informationen und die Vertragsbestätigung. */
export const AUSKUNFT_ANBIETER_ZEILE =
  `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, Vereinigtes Königreich · Company No. ${FIAON_FIRMA.companyNo}, ${FIAON_FIRMA.register} · vertreten durch den Director ${FIAON_FIRMA.director}`;

export const AUSKUNFT_KONTAKT_ZEILE = `${FIAON_FIRMA.email} · Telefon ${FIAON_FIRMA.telefon}`;

// ═══════════════════════════════════════════════════════════════════════════
// DIE BELEHRUNG — das Muster, wörtlich
// ═══════════════════════════════════════════════════════════════════════════
export interface AuskunftWiderrufsbelehrung {
  titel: string;
  gilt: string;
  abschnitte: { h: string; absaetze: string[] }[];
  erloeschen: { h: string; text: string };
  formular: { titel: string; hinweis: string; an: string; zeilen: string[]; fuss: string };
}

export const AUSKUNFT_WIDERRUF: AuskunftWiderrufsbelehrung = {
  titel: "Widerrufsbelehrung",
  gilt: "Gilt, wenn Sie als Verbraucherin oder Verbraucher bestellen.",
  abschnitte: [
    { h: "Widerrufsrecht", absaetze: [
      "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.",
      "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
      `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${AUSKUNFT_WIDERRUF_ANBIETER}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
      "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.",
    ] },
    { h: "Folgen des Widerrufs", absaetze: [
      "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
      "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.",
    ] },
  ],
  erloeschen: {
    h: "Vorzeitiges Erlöschen des Widerrufsrechts",
    text: "Ihr Widerrufsrecht erlischt, wenn wir die Dienstleistung vollständig erbracht haben und mit der Ausführung erst begonnen haben, nachdem Sie dazu Ihre ausdrückliche Zustimmung gegeben und gleichzeitig Ihre Kenntnis davon bestätigt haben, dass Sie Ihr Widerrufsrecht bei vollständiger Vertragserfüllung durch uns verlieren (§ 356 Abs. 4 BGB).",
  },
  formular: {
    titel: "Muster-Widerrufsformular",
    hinweis: "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
    an: `An ${AUSKUNFT_ANBIETER_ANSCHRIFT}, E-Mail: ${FIAON_FIRMA.email}:`,
    zeilen: [
      "Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)",
      "Bestellt am (*)/erhalten am (*)",
      "Name des/der Verbraucher(s)",
      "Anschrift des/der Verbraucher(s)",
      "Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)",
      "Datum",
    ],
    fuss: "(*) Unzutreffendes streichen.",
  },
};

/** Für Unternehmen — dieselben Worte auf der Seite und in der Mail. */
export const AUSKUNFT_KEIN_WIDERRUF =
  "Sie bestellen als Unternehmen (§ 14 BGB). Das gesetzliche Widerrufsrecht gilt nur für Verbraucherinnen und Verbraucher — für diese Bestellung besteht es daher nicht.";

// ═══════════════════════════════════════════════════════════════════════════
// DIE WAHL DES KUNDEN ZUM BEGINN (§ 356 Abs. 4, § 357a Abs. 2 BGB)
//
// „verlangt" / „nicht_verlangt" stehen im Verlauf der Bestellung (Bestellseite:
// auskunftBestellungBelegen; Kaufkarte und Kauflink: eigener Vermerk) und
// werden an der Tür (auskunftMailAnreichern) als `widerruf_wahl` in die
// Nutzlast gelegt. „offen" heißt: keine dokumentierte Wahl (Bestellung durch
// Betreuer, Altbestand) — dann behauptet die Mail nichts über die Wahl.
// ═══════════════════════════════════════════════════════════════════════════
export type AuskunftBeginnWahl = "verlangt" | "nicht_verlangt" | "offen";

export function auskunftBeginnWahl(roh: unknown): AuskunftBeginnWahl {
  const w = String(roh ?? "").trim();
  return w === "verlangt" || w === "nicht_verlangt" ? w : "offen";
}

/** Der Satz zur Wahl in der Vertragsbestätigung — null, wenn keine Wahl dokumentiert ist. */
export function auskunftBeginnSatz(wahl: AuskunftBeginnWahl, abText?: string | null): string | null {
  if (wahl === "verlangt") {
    return "Sie haben bei Ihrer Bestellung ausdrücklich verlangt, dass wir vor Ablauf der Widerrufsfrist mit der Leistung beginnen, "
      + "und bestätigt, dass Ihr Widerrufsrecht erlischt, sobald wir den Vertrag vollständig erfüllt haben. "
      + "Widerrufen Sie vorher, zahlen Sie den Anteil der bis dahin erbrachten Leistung.";
  }
  if (wahl === "nicht_verlangt") {
    return "Sie haben bei Ihrer Bestellung nicht verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen. "
      + `Deshalb übermitteln wir Ihre Anfragen an die Auskunfteien erst nach Ablauf der Widerrufsfrist${abText ? `, ab dem ${abText}` : ""}.`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SÄTZE DER VERTRAGSBESTÄTIGUNG (§ 312f Abs. 2 BGB, Art. 246a § 1 EGBGB)
// — wortgleich mit der Zusammenfassung auf der Bestellseite
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wie FIAON die Umsatzsteuer ausweist — wortgleich aus den AGB § 5 Abs. 1. Die
 * Rechnung der Auskunft trägt keinen gesonderten Steuerausweis
 * (server/fiaon-invoice.ts, Modus „none") — der Betrag ist der Rechnungsbetrag.
 */
export const AUSKUNFT_PREIS_STEUER = "Endpreis einschließlich einer etwaig anfallenden Umsatzsteuer";

export const AUSKUNFT_LAUFZEIT = "Einmalige Leistung — kein Abo, keine Verlängerung.";

export const AUSKUNFT_VERTRAGSSPRACHE = "Deutsch";

/**
 * Wann geleistet wird. Gegenlesen 24.09.2026 (Bestellseite): „Die Auskunfteien
 * antworten innerhalb der Frist" war ein Versprechen über Dritte — sie MÜSSEN es.
 * Für Firmendaten (juristische Personen) gilt Art. 15 DSGVO nicht; wann
 * Creditreform & Co. liefern, liegt bei ihnen — keine Frist erfinden.
 */
export function auskunftLeistungszeit(art: AuskunftArt, nachFrist?: { ab: string | null } | null): string {
  if (art === "firma") {
    return "Wir übermitteln die Anfragen, sobald Ihre Zahlung eingegangen ist. Für die persönliche Datenkopie gilt die gesetzliche Frist, in der Regel ein Monat; wann die Wirtschaftsauskunfteien die Firmendaten liefern, liegt bei ihnen. Sobald die Antworten vorliegen, erhalten Sie Auswertung, Handlungsplan und Schreiben.";
  }
  // Wer den Beginn vor Fristablauf NICHT verlangt hat (Kaufkarte, Kauflink), dem sagt die
  // Bestätigung das Datum — dieselbe Regel wie die Lieferung (anforderungAb). Ohne
  // `nachFrist` ist der Satz wortgleich mit der Bestellseite.
  const wann = nachFrist
    ? `Wir übermitteln Ihre Anfragen, sobald Ihre Zahlung eingegangen und die Widerrufsfrist abgelaufen ist${nachFrist.ab ? ` — frühestens am ${nachFrist.ab}` : ""}.`
    : "Wir übermitteln Ihre Anfragen, sobald Ihre Zahlung eingegangen ist.";
  return `${wann} Die Auskunfteien müssen innerhalb der gesetzlichen Frist antworten, in der Regel innerhalb eines Monats. Sobald die Antworten vorliegen, erhalten Sie Auswertung, Handlungsplan und Schreiben.`;
}
