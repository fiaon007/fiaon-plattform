// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft — DIE FRAGEN DER SEITENFAMILIE
// (25.09.2026, E-241 · seit 14.10.2026 E-365: die FIAON-Bonitätsauswertung)
//
// Eine Liste für alle Seiten: /bonitaetsauskunft/fragen zeigt alle, die
// Übersicht einen Auszug, die Länder- und Unternehmensseiten ihre eigenen.
// Jede Seite gibt GENAU die Fragen an SeoDaten (FAQPage), die sie sichtbar
// zeigt — unsichtbares FAQ-Markup ist ein Abstrafungsgrund.
//
// Preise und Sätze aus shared/fiaon-auskunft.ts und
// shared/fiaon-auskunft-widerruf.ts — ein Preiswechsel zieht die Antworten mit.
// Die Antworten sind deshalb Vorlagen-Zeichenketten; scripts/seo-fragen-erzeugen.ts
// liest diese Datei nicht (sie steht nicht in seinen QUELLEN).
//
// E-365: Privat ist das Produkt die Bonitätsauswertung aus Ausweis und
// Kontoauszügen — keine Anfrage bei einer Auskunftei, keine Schreiben, keine
// Löschung. Die Firmen-Fragen (BX_FRAGEN_FIRMA) gelten der unveränderten
// Firmen-Auskunft.
//
// Wortwand wie überall: keine Zusage, keine Löschzusage, kein „Score verbessern",
// keine Frist mit Zahl als FIAON-Versprechen. Die kostenlose Datenkopie wird ehrlich
// beantwortet — nicht versteckt.
// ═══════════════════════════════════════════════════════════════════════════
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, AUSWERTUNG_KEINE_AUSKUNFT_SATZ, AUSWERTUNG_UNTERLAGEN_SATZ, auskunfteienText,
} from "@shared/fiaon-auskunft";
import { AUSKUNFT_KEIN_WIDERRUF, auskunftLeistungszeit } from "@shared/fiaon-auskunft-widerruf";
import { BX_INKLUSIVE_NEU, BX_PREIS } from "@/i18n/bonitaetsauskunft-familie";

export type BxFrage = { f: string; a: string };

const P = BX_PREIS;

// ── Preis und Leistung ──────────────────────────────────────────────────────
const KOSTENLOS: BxFrage = {
  f: "Kann ich die Datenkopie nicht kostenlos selbst anfordern?",
  a: AUSKUNFT_KOSTENLOS_ANTWORT,
};
const PREIS: BxFrage = {
  f: "Was kostet die Bonitätsauswertung?",
  a: `Einmalig ${P.privat}. Mit einem laufenden FIAON-Paket gilt der Kundenpreis von ${P.privatPaket}. ${BX_INKLUSIVE_NEU} ${P.steuer} Kein Abo. Für Unternehmen gibt es die Bonitätsauskunft mit Firmendaten: ${P.firma} einzeln, ${P.firmaPaket} mit Paket.`,
};
const INHALT: BxFrage = {
  f: "Was genau bekomme ich?",
  a: "Rund 25 Seiten: Ihre Haushaltsrechnung und die neun Merkmale, die eine Kreditprüfung ansieht; jede Einnahme und jede Ausgabe nach Empfänger, Monat für Monat; eine Ampel für sieben Bereiche, Ihren FIAON-Finanzwert, Ihr Potenzial und Ihren Plan für zwölf Monate. Ein Mensch prüft den Bericht und gibt ihn frei — Sie erhalten ihn als PDF per E-Mail und in Ihrem FIAON-Bereich.",
};
const PAKET: BxFrage = {
  f: "Brauche ich dafür ein FIAON-Paket?",
  // Integration 26.09.2026 (E-243): der Weg ohne Anmeldung — „Schon FIAON-Kunde? Kundenpreis-Link anfordern" (BX.kundenpreisLink).
  a: `Nein. Die Bonitätsauswertung können Sie einzeln bestellen, für ${P.privat}. Läuft bei Ihnen bereits ein bezahltes FIAON-Paket, zahlen Sie ${P.privatPaket} — über „Schon FIAON-Kunde? Kundenpreis-Link anfordern“ genügt dafür Ihre E-Mail-Adresse. ${BX_INKLUSIVE_NEU}`,
};
const KEIN_SCORE: BxFrage = {
  f: "Ist das eine Auskunft einer Auskunftei oder ein Score?",
  a: `Nein. ${AUSWERTUNG_KEINE_AUSKUNFT_SATZ} Die Auswertung zeigt, was eine Bank bei einer Kreditprüfung aus Ihren Kontoauszügen liest.`,
};
const PARTNER: BxFrage = {
  f: "Arbeitet FIAON mit Auskunfteien zusammen?",
  a: "Nein. FIAON ist unabhängig und kein Partner einer Auskunftei. Die Bonitätsauswertung fragt bei keiner Auskunftei an und ändert dort nichts — sie entsteht allein aus Ihren eigenen Unterlagen, Ausweis und Kontoauszügen.",
};

// ── Dauer und Ablauf ────────────────────────────────────────────────────────
const DAUER: BxFrage = {
  f: "Wie lange dauert es, bis ich meine Auswertung habe?",
  a: `Die Bestellung dauert wenige Minuten. ${auskunftLeistungszeit("privat")} Den Stand sehen Sie in Ihrem FIAON-Bereich.`,
};
const SELBST_TUN: BxFrage = {
  f: "Was muss ich selbst tun?",
  a: `${AUSWERTUNG_UNTERLAGEN_SATZ} An eine Auskunftei schicken Sie nichts.`,
};
const ZAHLUNG: BxFrage = {
  f: "Wie bezahle ich?",
  a: "Per Überweisung. Direkt nach der Bestellung öffnet sich Ihre Zahlungsseite mit Bankverbindung, Verwendungszweck und Betrag. Die Rechnung kommt per E-Mail. Einmalig, kein Abo, keine Verlängerung.",
};
const UNVOLLSTAENDIG: BxFrage = {
  f: "Was, wenn meine Unterlagen unvollständig sind?",
  a: "Dann sagen wir Ihnen, was fehlt — etwa ein Monat Kontoauszug oder die Rückseite des Ausweises. Wir beginnen, sobald alles vorliegt.",
};

// ── Score, Datenschutz und Widerruf ─────────────────────────────────────────
const SCORE: BxFrage = {
  f: "Verändert die Bonitätsauswertung meinen Score?",
  a: "Nein. Wir fragen bei keiner Auskunftei an — es entsteht keine Anfrage und kein Eintrag. Die Auswertung entsteht allein aus Ihren eigenen Unterlagen.",
};
const SCORE_ZAHL: BxFrage = {
  f: "Wird mein Score danach besser?",
  a: "Das kann niemand seriös vorhersagen. Den Score rechnet allein die Auskunftei, aus den Daten, die dort gespeichert sind. Ihre Bonitätsauswertung zeigt, was eine Bank aus Ihren Kontoauszügen liest — und welche Schritte in Ihrer Hand liegen. Eine bestimmte Zahl nennen wir nicht.",
};
const DATENSCHUTZ: BxFrage = {
  f: "Was passiert mit meinen Daten?",
  a: "Wir nutzen Ihren Ausweis und Ihre Kontoauszüge, um Ihre Bonitätsauswertung zu erstellen. Den Bericht legen wir in Ihren FIAON-Bereich. Wie wir Daten verarbeiten und wie lange wir sie speichern, steht in unserer Datenschutzerklärung.",
};
const WIDERRUF: BxFrage = {
  f: "Kann ich den Vertrag widerrufen?",
  a: "Ja, als Verbraucherin oder Verbraucher vierzehn Tage lang ohne Angabe von Gründen. Damit wir sofort beginnen können, verlangen Sie auf der Bestellseite ausdrücklich, dass wir vor Ablauf der Frist beginnen. Widerrufen Sie danach, zahlen Sie nur den Anteil der bis dahin erbrachten Leistung; ist die Leistung vollständig erbracht, erlischt das Widerrufsrecht.",
};

/** Alle Fragen, in drei Gruppen — die Seite /bonitaetsauskunft/fragen. */
export const BX_FRAGEN_GRUPPEN: BxFrage[][] = [
  [KOSTENLOS, PREIS, INHALT, PAKET, KEIN_SCORE, PARTNER],
  [DAUER, SELBST_TUN, ZAHLUNG, UNVOLLSTAENDIG],
  [SCORE, SCORE_ZAHL, DATENSCHUTZ, WIDERRUF],
];

/** Der Auszug auf der Übersicht. */
export const BX_FRAGEN_HUB: BxFrage[] = [KOSTENLOS, PREIS, DAUER, KEIN_SCORE];

/** Auf der Ablauf-Seite. */
export const BX_FRAGEN_ABLAUF: BxFrage[] = [SELBST_TUN, UNVOLLSTAENDIG, ZAHLUNG];

/** Auf der Seite zu Ihrem Plan. */
export const BX_FRAGEN_PLAN: BxFrage[] = [
  {
    f: "Was bedeutet „Potenzial“?",
    a: "Was im Monat und im Jahr frei werden kann — etwa durch Verträge, die doppelt laufen, Abos, die Sie nicht mehr nutzen, oder Gebühren, die sich vermeiden lassen. Jede Zahl stammt aus Ihren eigenen Buchungen.",
  },
  {
    f: "Was, wenn mein Konto schon gut aussieht?",
    a: "Dann sagt Ihnen der Plan genau das — und was als Nächstes zählt, damit es so bleibt.",
  },
  SCORE_ZAHL,
];

/** Je Land eigene Fragen. */
export const BX_FRAGEN_LAND: Record<"DE" | "AT" | "CH", BxFrage[]> = {
  DE: [
    {
      f: "Warum fragt FIAON nicht bei der SCHUFA an?",
      a: "Weil die Bonitätsauswertung etwas anderes zeigt: was eine Bank bei einer Kreditprüfung aus Ihren Kontoauszügen liest. Ihre SCHUFA-Datenkopie steht Ihnen kostenlos zu — fordern Sie sie selbst an. Laden Sie sie hoch, beziehen wir sie ein.",
    },
    {
      f: "Wo bekomme ich meine kostenlose Datenkopie?",
      a: `In Deutschland zum Beispiel bei ${auskunfteienText("DE")} — kostenlos nach Art. 15 DSGVO. Unser Generator schreibt Ihnen den Brief.`,
    },
    SCORE,
  ],
  AT: [
    {
      f: "Gibt es die Bonitätsauswertung auch in Österreich?",
      a: "Ja. Sie entsteht aus Ihrem Ausweis und Ihren Kontoauszügen — in Österreich genauso wie in Deutschland und der Schweiz.",
    },
    {
      f: "Gilt die DSGVO auch in Österreich?",
      a: `Ja, unmittelbar. Das Recht auf die kostenlose Datenkopie nach Art. 15 DSGVO gilt bei ${auskunfteienText("AT")} genauso. Fordern Sie sie selbst an — laden Sie sie hoch, beziehen wir sie ein.`,
    },
    {
      f: "Kostet die Bonitätsauswertung in Österreich mehr?",
      a: `Nein. ${P.privat} einzeln, ${P.privatPaket} für FIAON-Kunden mit laufendem Paket — einmalig, per Überweisung.`,
    },
  ],
  CH: [
    {
      f: "Gibt es die Bonitätsauswertung auch in der Schweiz?",
      a: `Ja. Sie entsteht aus Ihrem Ausweis und Ihren Kontoauszügen. Die Auskunft nach Art. 25 DSG bei ${auskunfteienText("CH")} fordern Sie selbst an — laden Sie sie hoch, beziehen wir sie ein.`,
    },
    {
      f: "Ist der Betreibungsregisterauszug dabei?",
      a: "Nein. Den stellt das Betreibungsamt Ihres Wohnorts aus; er ist ein amtliches Dokument und nicht Teil der Bonitätsauswertung.",
    },
    {
      f: "In welcher Währung zahle ich?",
      a: `In Euro: ${P.privat} einzeln, ${P.privatPaket} für FIAON-Kunden mit laufendem Paket — einmalig, per Überweisung.`,
    },
  ],
};

/** Auf der Unternehmensseite — die Firmen-Auskunft ist unverändert. */
export const BX_FRAGEN_FIRMA: BxFrage[] = [
  {
    f: "Gilt die kostenlose Datenkopie auch für Firmen?",
    a: "Das Auskunftsrecht nach Art. 15 DSGVO schützt Menschen, nicht Unternehmen. Für die Daten Ihres Unternehmens fragen wir bei den Wirtschaftsauskunfteien an — wann sie liefern, liegt bei ihnen. Ihre persönliche Datenkopie als Inhaber oder Geschäftsführung bleibt Ihr Recht.",
  },
  {
    f: "Wer darf für das Unternehmen bestellen?",
    a: "Inhaberin, Inhaber, Geschäftsführung oder eine andere vertretungsberechtigte Person. Bei der Bestellung bestätigen Sie, dass Sie für das Unternehmen zu gewerblichen Zwecken bestellen und es vertreten dürfen.",
  },
  {
    f: "Brauche ich eine Registernummer?",
    a: "Sie ist freiwillig. Sie hilft den Auskunfteien, das Unternehmen sicher zuzuordnen — tragen Sie sie ein, wenn Sie sie zur Hand haben.",
  },
  {
    f: "Kann ich als Unternehmen widerrufen?",
    a: AUSKUNFT_KEIN_WIDERRUF,
  },
];
