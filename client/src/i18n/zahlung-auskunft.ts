// ═══════════════════════════════════════════════════════════════════════════
// /zahlung/<Verwendungszweck> BEI EINER BONITÄTSAUSKUNFT — DIE EIGENEN SÄTZE
// (26.09.2026, E-243)
//
// Justin: „Warum die gleiche Zahlungsseite für Nicht-Kunden — da steht ‚Konto
// aktivieren', die bestellen ja nur die Auskunft!" Gemessen am 26.09.: Wer die
// Auskunft kaufte, las „Letzter Schritt: Konto aktivieren", „Jetzt überweisen —
// Konto sofort aktiv", „Konto aktivieren & Karte versenden" und nach der Zahlung
// „Ihr Konto ist aktiv und Ihre Karte ist unterwegs". Nichts davon stimmt: Die
// Auskunft ist ein Einmalkauf, es wird kein Konto aktiviert und keine Karte
// verschickt.
//
// Hier stehen die Sätze, die stattdessen gelten — nur deutsch (die Auskunft gibt
// es für DE/AT/CH; die englische Hälfte des Wörterbuchs zahlung.ts gilt nur dem
// Firmenauftrag von FIAON Global). Die Datei trägt deshalb kein `const en`.
//
// Regeln (Wortwand shared/fiaon-wortverbote.ts, E-240/E-241):
//   · keine Frist mit Zahl — wann eine Auskunftei liefert, bestimmt sie;
//   · keine Zusage über Karte, Rahmen oder Ergebnis — über die Karte entscheidet die Bank;
//   · kein „Limit" (die Seite lesen auch Leads und offene Anträge);
//   · AT und CH lesen nie „SCHUFA" — die Auskunfteien kommen vom Server (Land der Bestellung);
//   · keine „Empfehlung" — der schnelle Weg heißt beim Namen.
// Geprüft in .pruef/e243-zahlung-wortwand.ts.
// ═══════════════════════════════════════════════════════════════════════════
import {
  AUSKUNFT_NUTZEN_SATZ_KARTE, AUSKUNFT_PREISE_CENTS, euroText, type AuskunftArt,
} from "@shared/fiaon-auskunft";

/** Was die Seite über die Bestellung weiß (GET /api/fiaon/payment-order/:ref, produkt „auskunft"). */
export interface AuskunftSicht {
  art: AuskunftArt;
  /** „SCHUFA, CRIF und Creditreform Boniversum" — leer, solange unbekannt. */
  auskunfteien?: string | null;
  /** Erster Tag der Beschaffung, wenn der Kunde den Beginn erst nach der Widerrufsfrist gewählt hat. */
  beginnAb?: string | null;
}

/** Die Auskunfteien als Satzteil — ohne Land nie eine geratene SCHUFA. */
function bei(s: AuskunftSicht): string {
  return String(s.auskunfteien || "").trim() || "den großen Auskunfteien Ihres Landes";
}

const DATUM = /^\d{2}\.\d{2}\.\d{4}$/;

/** Der Satz zum späteren Beginn (nur Verbraucher, nur mit geprüftem Datum). */
function beginnSatz(s: AuskunftSicht): string | null {
  return s.art === "privat" && s.beginnAb && DATUM.test(s.beginnAb)
    ? `Wie bei der Bestellung gewählt, beginnen wir damit nach Ablauf der Widerrufsfrist, ab dem ${s.beginnAb}.`
    : null;
}

export interface AuskunftSchritt { titel: string; text: string }

export const ZAHLUNG_AUSKUNFT = {
  titel: (art: AuskunftArt) =>
    art === "firma" ? "Ihre Firmen-Bonitätsauskunft — nur noch überweisen" : "Ihre Bonitätsauskunft — nur noch überweisen",

  /** Die Statuszeile: „Einmalig <b>149,00 €</b> — kein Abo, keine Verlängerung. Zahlbar bis zum <b>10.10.2026</b>." */
  statusVor: "Einmalig ",
  statusNach: " — kein Abo, keine Verlängerung.",
  statusFaellig: " Zahlbar bis zum ",

  kundenpreis: "Ihr Kundenpreis mit FIAON-Paket",

  /** Die Kurzfassung oben: was nach der Überweisung passiert. */
  kurzfassung: (s: AuskunftSicht): string => {
    const kern = s.art === "firma"
      ? `Nach Zahlungseingang beschaffen wir die Auskünfte Ihres Unternehmens bei den Wirtschaftsauskunfteien und die persönliche Auskunft der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei ${bei(s)} — und melden uns, sobald sie da sind: mit Erklärung jedes Eintrags, Handlungsplan und fertigen Schreiben.`
      : `Nach Zahlungseingang beschaffen wir Ihre Auskunft bei ${bei(s)} und melden uns, sobald sie da ist — mit Erklärung jedes Eintrags, Ihrem Handlungsplan und fertigen Schreiben.`;
    const b = beginnSatz(s);
    return b ? `${kern} ${b}` : kern;
  },

  kurzfassungTitel: "So geht es weiter",

  schritte: (s: AuskunftSicht): AuskunftSchritt[] => [
    {
      titel: "Überweisen",
      text: "Mit dem QR-Code unten ist die Überweisung schnell erledigt — Empfänger, Betrag und Verwendungszweck sind schon ausgefüllt.",
    },
    {
      titel: "Beschaffung",
      // Gegenlese 26.09.2026 (E-243): Die Auskunfteien stehen direkt darüber in der Kurzfassung —
      // hier nicht ein zweites Mal wörtlich derselbe Satz.
      text: s.art === "firma"
        ? "Wir beschaffen die Auskünfte Ihres Unternehmens und die persönliche Auskunft der Inhaberin, des Inhabers oder der Geschäftsführung — Sie müssen keinen Brief schreiben."
        : "Wir beschaffen Ihre Auskunft bei jeder dieser Auskunfteien — Sie müssen keinen Brief schreiben.",
    },
    {
      titel: "Auswertung und Handlungsplan",
      text: "Sobald die Auskunft da ist, bekommen Sie Bescheid. In Ihrem Bereich erklären wir jeden Eintrag, prüfen die Speicherfristen und legen Ihnen Handlungsplan und fertige Schreiben zur Freigabe vor.",
    },
  ],

  zuDenZahlungsdaten: "Zu den Zahlungsdaten",

  boxTitel: "Überweisen – ganz einfach",
  schnell: "Der schnelle Weg (fehlerfrei)",

  badges: ["SSL-verschlüsselt", "SEPA-Überweisung", "Einmalig, kein Abo"] as [string, string, string],

  /** Nach „Ich habe überwiesen" (Status gemeldet), oben auf der Zahlungsseite. */
  gemeldet: (art: AuskunftArt) => art === "firma"
    ? "Danke — Sie haben die Überweisung gemeldet. Wir prüfen den Eingang und beschaffen danach die Auskünfte Ihres Unternehmens. Sie bekommen eine E-Mail."
    : "Danke — Sie haben die Überweisung gemeldet. Wir prüfen den Eingang und beschaffen danach Ihre Auskunft. Sie bekommen eine E-Mail.",

  /**
   * Gegenlese 26.09.2026 (E-243): kein Ende ohne Weg — nach Fristablauf zeigt die Seite keine
   * alten Zahlungsdaten mehr, sondern führt direkt zur neuen Bestellung (die Bestellseite setzt
   * den Preis neu — mit Paket der Kundenpreis; auskunftStand zählt „expired" nicht als offen).
   */
  abgelaufen: "Die Zahlungsfrist dieser Bestellung ist abgelaufen — bitte überweisen Sie nicht mehr auf diesen Verwendungszweck. Bestellen Sie die Auskunft einfach neu; Fragen beantworten wir gern unter support@fiaon.com.",
  neuBestellen: (art: AuskunftArt) => ({ text: "Auskunft neu bestellen", ziel: art === "firma" ? "/bonitaet-antrag?art=firma" : "/bonitaet-antrag" }),

  /**
   * Gegenlese 26.09.2026 (E-243): Sperren greifen auch hier. Eine stornierte oder durch eine
   * neuere ersetzte Auskunft-Bestellung zeigt KEINE Zahlungsdaten mehr — sonst überweist jemand
   * auf eine stornierte Bestellung oder zu einem Preis, der nicht mehr gilt.
   */
  storniert: "Diese Bestellung ist storniert — bitte überweisen Sie dafür nichts. Fragen beantworten wir gern unter support@fiaon.com.",
  ersetzt: "Diese Bestellung wurde durch eine neuere ersetzt — bitte überweisen Sie nicht auf diesen Verwendungszweck. Die gültigen Zahlungsdaten stehen in unserer letzten E-Mail zur Bonitätsauskunft. Fragen beantworten wir gern unter support@fiaon.com.",
  nichtOffenTitel: "Diese Bestellung ist nicht mehr offen",

  /** Die Seite ist schon bezahlt. */
  bezahlt: (s: AuskunftSicht, vorname: string) => s.art === "firma"
    ? `Die Zahlung ist bei uns eingegangen — wir beschaffen die Auskünfte Ihres Unternehmens und melden uns per E-Mail, sobald sie da sind.`
    : `${vorname ? `${vorname}, Ihre` : "Ihre"} Zahlung ist bei uns eingegangen — wir beschaffen Ihre Auskunft bei ${bei(s)} und melden uns per E-Mail, sobald sie da ist.`,

  // ── DIE DANKESEITE ──────────────────────────────────────────────────────
  danke: {
    titel: "Danke!",
    lead: (art: AuskunftArt) => art === "firma"
      ? "Wir prüfen Ihren Zahlungseingang und beschaffen danach die Auskünfte Ihres Unternehmens. Sie müssen nichts weiter tun."
      : "Wir prüfen Ihren Zahlungseingang und beschaffen danach Ihre Auskunft. Sie müssen nichts weiter tun.",
    wasKommt: "Was als Nächstes kommt",
    schritte: (s: AuskunftSicht): AuskunftSchritt[] => {
      const b = beginnSatz(s);
      return [
        { titel: "Zahlungseingang", text: "Sobald Ihre Überweisung gebucht ist, bekommen Sie eine E-Mail." },
        {
          titel: "Beschaffung",
          text: (s.art === "firma"
            ? `Wir beschaffen die Auskünfte Ihres Unternehmens und die persönliche Auskunft der Inhaberin, des Inhabers oder der Geschäftsführung bei ${bei(s)}.`
            : `Wir beschaffen Ihre Auskunft bei ${bei(s)}.`)
            + " Brauchen wir dafür noch Ihre kurze Bestätigung, steht der Link in unserer E-Mail."
            + (b ? ` ${b}` : ""),
        },
        {
          titel: "Auswertung und Handlungsplan",
          text: "Sobald die Auskunft da ist, melden wir uns. In Ihrem Bereich finden Sie dann die Erklärung jedes Eintrags, Ihren Handlungsplan und fertige Schreiben zur Freigabe.",
        },
      ];
    },
    /**
     * Der ruhige Hinweis für Menschen OHNE laufendes Paket — kein Druck, keine Zusage.
     * Der Kundenpreis kommt aus der einen Quelle (shared/fiaon-auskunft.ts).
     *
     * Gegenlese 26.09.2026 (E-243): Ob und welcher Hinweis, sagt der Server (paketSchritt,
     * dieselbe Regel wie „Ihre Auskunft ist da"):
     *   „neu"    → der Antrag. Mit auskunft=0: Der Antrag klappt bei src=auskunft sonst den
     *              Zusatz „Bonitätsauskunft zum Kundenpreis" auf (buendelAnzeige) — wer gerade
     *              eine Auskunft bestellt hat, bekäme eine zweite angeboten.
     *   „antrag" → ein fertiger Paket-Antrag wartet auf die erste Zahlung: kein zweiter Antrag,
     *              kein Knopf — die Zahlungsdaten stehen in der E-Mail zum Antrag (die Seite ist
     *              öffentlich, deshalb nennt sie keine zweite Referenz).
     */
    weiter: (art: AuskunftArt, variante: "neu" | "antrag" = "neu") => {
      const preis = `Mit Paket gilt für jede weitere Auskunft auch der Kundenpreis von ${euroText(AUSKUNFT_PREISE_CENTS[art].mitAbo)}.`;
      return variante === "antrag"
        ? {
          titel: "Ihr nächster Schritt zur Karte",
          text: "Ihr Antrag für ein FIAON-Paket liegt schon bei uns — es fehlt nur Ihre erste Zahlung. Danach geht Ihre feste "
            + "Ansprechperson die Auswertung mit Ihnen durch und richtet Ihren Weg zur Karte danach aus. Über die Karte entscheidet "
            + `die Bank. Betrag, Bankdaten und Verwendungszweck stehen in unserer E-Mail zu Ihrem Antrag. ${preis}`,
          knopf: null as string | null,
          ziel: null as string | null,
        }
        : {
          titel: "Ihr nächster Schritt zur Karte",
          text: `${AUSKUNFT_NUTZEN_SATZ_KARTE} Diesen Weg gehen wir mit einem FIAON-Paket gemeinsam: eine feste Ansprechperson, `
            + `die Auswertung Ihrer Unterlagen und die Schreiben an die Auskunfteien. Über die Karte entscheidet die Bank. ${preis}`,
          knopf: "Pakete ansehen" as string | null,
          ziel: "/antrag?src=auskunft&auskunft=0" as string | null,
        };
    },
  },
};

/** Alle Sätze einer Sicht — für die Wortwand-Prüfung (.pruef/e243-zahlung-wortwand.ts). */
export function alleAuskunftSaetze(s: AuskunftSicht): string[] {
  const z = ZAHLUNG_AUSKUNFT;
  return [
    z.titel(s.art), `${z.statusVor}149,00 €${z.statusNach}${z.statusFaellig}10.10.2026.`, z.kundenpreis, z.kurzfassung(s), z.kurzfassungTitel,
    ...z.schritte(s).flatMap((x) => [x.titel, x.text]), z.zuDenZahlungsdaten, z.boxTitel, z.schnell, ...z.badges,
    z.gemeldet(s.art), z.abgelaufen, z.neuBestellen(s.art).text, z.storniert, z.ersetzt, z.nichtOffenTitel, z.bezahlt(s, "Maria"),
    z.danke.titel, z.danke.lead(s.art), z.danke.wasKommt, ...z.danke.schritte(s).flatMap((x) => [x.titel, x.text]),
    ...(["neu", "antrag"] as const).flatMap((v) => {
      const x = z.danke.weiter(s.art, v);
      return [x.titel, x.text, x.knopf ?? ""];
    }),
  ].filter(Boolean);
}
