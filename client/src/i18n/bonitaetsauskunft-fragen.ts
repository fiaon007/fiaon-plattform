// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft — DIE FRAGEN DER SEITENFAMILIE (25.09.2026, E-241)
//
// Eine Liste für alle Seiten: /bonitaetsauskunft/fragen zeigt alle, die
// Übersicht einen Auszug, die Länder- und Unternehmensseiten ihre eigenen.
// Jede Seite gibt GENAU die Fragen an SeoDaten (FAQPage), die sie sichtbar
// zeigt — unsichtbares FAQ-Markup ist ein Abstrafungsgrund.
//
// Preise und Sätze aus shared/fiaon-auskunft.ts und
// shared/fiaon-auskunft-widerruf.ts — ein Preiswechsel zieht die Antworten mit.
// Die Antworten sind deshalb Vorlagen-Zeichenketten; scripts/seo-fragen-erzeugen.ts
// liest diese Datei nicht (sie steht nicht in seinen QUELLEN). Soll das
// Vorab-HTML die Fragen tragen, gehört sie dort eingetragen (siehe Bericht E-241).
//
// Wortwand wie überall: keine Zusage, keine Löschzusage, kein „Score verbessern",
// keine Frist mit Zahl als FIAON-Versprechen. Die kostenlose Datenkopie wird ehrlich
// beantwortet — nicht versteckt, nicht als Hauptweg.
// ═══════════════════════════════════════════════════════════════════════════
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, auskunfteienText,
} from "@shared/fiaon-auskunft";
import { AUSKUNFT_KEIN_WIDERRUF, auskunftLeistungszeit } from "@shared/fiaon-auskunft-widerruf";
import { BX_PREIS } from "@/i18n/bonitaetsauskunft-familie";

export type BxFrage = { f: string; a: string };

const P = BX_PREIS;

// ── Preis und Leistung ──────────────────────────────────────────────────────
const KOSTENLOS: BxFrage = {
  f: "Kann ich die Datenkopie nicht kostenlos selbst anfordern?",
  a: AUSKUNFT_KOSTENLOS_ANTWORT,
};
const PREIS: BxFrage = {
  f: "Was kostet die Bonitätsauskunft bei FIAON?",
  a: `Einmalig ${P.privat}. Mit einem laufenden FIAON-Paket gilt der Kundenpreis von ${P.privatPaket}. Für Unternehmen: ${P.firma} einzeln, ${P.firmaPaket} mit Paket. ${P.steuer} Kein Abo, keine Erfolgsbeteiligung — wir rechnen nicht pro „gelöschtem Eintrag“ ab.`,
};
const INHALT: BxFrage = {
  f: "Was genau bekomme ich?",
  a: "Ihre Datenkopien von den großen Auskunfteien Ihres Landes, jeden Eintrag in klaren Worten erklärt, die Speicherfristen geprüft, Ihren Handlungsplan in einer klaren Reihenfolge und fertige Schreiben — etwa zur Löschung nach Fristablauf oder zur Berichtigung falscher Daten. Sie geben jedes Schreiben frei, wir übermitteln es.",
};
const PAKET: BxFrage = {
  f: "Brauche ich dafür ein FIAON-Paket?",
  a: `Nein. Die Bonitätsauskunft können Sie einzeln bestellen, für ${P.privat}. Läuft bei Ihnen bereits ein bezahltes FIAON-Paket, zahlen Sie ${P.privatPaket} — melden Sie sich dafür an und bestellen Sie über Ihren Kundenbereich.`,
};
const ZERTIFIKAT: BxFrage = {
  f: "Ist das dasselbe wie ein Bonitätszertifikat?",
  a: "Nein. Das Bonitätszertifikat, das Auskunfteien verkaufen, ist für Dritte gedacht — etwa für den Vermieter — und bewusst gekürzt. Wir fordern die vollständige Datenkopie für Sie an: mit jedem Eintrag, jedem Meldedatum und der meldenden Stelle.",
};
const LOESCHUNG: BxFrage = {
  f: "Kann FIAON zusagen, dass Einträge gelöscht werden?",
  a: "Nein — und niemand kann das seriös. Berechtigt gemeldete Einträge bleiben bis zum Ende ihrer Speicherfrist. Wir halten jeden Eintrag gegen die gesetzlichen Voraussetzungen und machen für das, was angreifbar ist, die Schreiben fertig. Ob gelöscht wird, entscheidet die Auskunftei.",
};
const PARTNER: BxFrage = {
  f: "Ist FIAON ein Partner der SCHUFA oder anderer Auskunfteien?",
  a: "Nein. FIAON ist unabhängig. Wir verlangen Ihre Datenkopie in Ihrem Auftrag — genau so, wie Sie es selbst könnten — und arbeiten ausschließlich für Sie.",
};

// ── Dauer und Ablauf ────────────────────────────────────────────────────────
const DAUER: BxFrage = {
  f: "Wie lange dauert es, bis ich meine Auswertung habe?",
  a: `Die Bestellung dauert wenige Minuten. ${auskunftLeistungszeit("privat")} Einen festen Tag sagen wir nicht zu; den Stand sehen Sie in Ihrem Kundenbereich.`,
};
const SELBST_TUN: BxFrage = {
  f: "Muss ich selbst etwas an die Auskunfteien schicken?",
  a: "Nein. In Ihrem Auftrag schicken wir Ihr Auskunftsverlangen, erfragen den Stand und nehmen die Antworten entgegen. Verlangt eine Auskunftei zusätzlich einen Identitätsnachweis, sagen wir Ihnen Bescheid.",
};
const ZAHLUNG: BxFrage = {
  f: "Wie bezahle ich?",
  a: "Per Überweisung. Direkt nach der Bestellung öffnet sich Ihre Zahlungsseite mit Bankverbindung, Verwendungszweck und Betrag. Die Rechnung kommt per E-Mail. Einmalig, kein Abo, keine Verlängerung.",
};
const KEINE_ANTWORT: BxFrage = {
  f: "Was passiert, wenn eine Auskunftei nicht antwortet?",
  a: "Dann fassen wir nach. Die Auskunfteien sind zur Antwort verpflichtet; den Stand jeder Anfrage sehen Sie in Ihrem Kundenbereich.",
};

// ── Score, Datenschutz und Widerruf ─────────────────────────────────────────
const SCORE: BxFrage = {
  f: "Verändert die Anfrage meinen Score?",
  a: "Die Anfrage nach Ihrer eigenen Datenkopie ist keine Kreditanfrage. Nach Angaben der Auskunfteien fließt sie nicht in Ihre Bewertung ein — auch dann nicht, wenn FIAON sie in Ihrem Auftrag für Sie stellt.",
};
const SCORE_ZAHL: BxFrage = {
  f: "Wird mein Score danach besser?",
  a: "Das kann niemand seriös vorhersagen. Den Score rechnet allein die Auskunftei, aus den gespeicherten Daten. Werden falsche oder abgelaufene Einträge berichtigt oder gelöscht, ändern sich diese Daten — eine bestimmte Zahl nennen wir nicht.",
};
const DATENSCHUTZ: BxFrage = {
  f: "Was passiert mit meinen Daten?",
  a: "Wir nutzen Ihre Angaben, um Ihre Anfragen zu stellen und Ihre Auswertung zu erstellen. Die Antworten der Auskunfteien legen wir in Ihren Kundenbereich. Wie wir Daten verarbeiten und wie lange wir sie speichern, steht in unserer Datenschutzerklärung.",
};
const WIDERRUF: BxFrage = {
  f: "Kann ich den Vertrag widerrufen?",
  a: "Ja, als Verbraucherin oder Verbraucher vierzehn Tage lang ohne Angabe von Gründen. Damit wir sofort anfragen können, verlangen Sie auf der Bestellseite ausdrücklich, dass wir vor Ablauf der Frist beginnen. Widerrufen Sie danach, zahlen Sie nur den Anteil der bis dahin erbrachten Leistung; ist die Leistung vollständig erbracht, erlischt das Widerrufsrecht.",
};

/** Alle Fragen, in drei Gruppen — die Seite /bonitaetsauskunft/fragen. */
export const BX_FRAGEN_GRUPPEN: BxFrage[][] = [
  [KOSTENLOS, PREIS, INHALT, PAKET, ZERTIFIKAT, LOESCHUNG, PARTNER],
  [DAUER, SELBST_TUN, ZAHLUNG, KEINE_ANTWORT],
  [SCORE, SCORE_ZAHL, DATENSCHUTZ, WIDERRUF],
];

/** Der Auszug auf der Übersicht. */
export const BX_FRAGEN_HUB: BxFrage[] = [KOSTENLOS, PREIS, DAUER, LOESCHUNG];

/** Auf der Ablauf-Seite. */
export const BX_FRAGEN_ABLAUF: BxFrage[] = [SELBST_TUN, KEINE_ANTWORT, ZAHLUNG];

/** Auf der Seite zum Handlungsplan. */
export const BX_FRAGEN_PLAN: BxFrage[] = [
  {
    f: "Muss ich jedes Schreiben freigeben?",
    a: "Ja. Kein Schreiben geht ohne Ihre Freigabe hinaus. Sie lesen es in Ihrem Kundenbereich, geben es frei — dann übermitteln wir es.",
  },
  {
    f: "Was, wenn kein Eintrag angreifbar ist?",
    a: "Dann sagt Ihnen der Plan genau das — und was als Nächstes zählt: welche Einträge wann von selbst enden und was Sie bis dahin tun können.",
  },
  LOESCHUNG,
];

/** Je Land eigene Fragen. */
export const BX_FRAGEN_LAND: Record<"DE" | "AT" | "CH", BxFrage[]> = {
  DE: [
    {
      f: "Warum fragen Sie auch bei CRIF und Creditreform Boniversum an?",
      a: "Weil Händler, Vermieter, Mobilfunkanbieter und Banken mit unterschiedlichen Auskunfteien arbeiten. Ein Eintrag kann bei einer Auskunftei stehen und bei der anderen fehlen — oder anders gemeldet sein.",
    },
    {
      f: "Fragen Sie auch bei weiteren Auskunfteien an?",
      a: `In Deutschland fragen wir bei ${auskunfteienText("DE")} an — den Auskunfteien, deren Anschriften und Wege wir geprüft haben. Weitere nehmen wir erst auf, wenn Anschrift und Weg geprüft sind.`,
    },
    SCORE,
  ],
  AT: [
    {
      f: "Warum KSV1870 und CRIF?",
      a: `In Österreich fragen wir bei ${auskunfteienText("AT")} an — den Auskunfteien, deren Anschriften und Wege wir für Österreich geprüft haben. Bei jeder der beiden verlangen wir Ihre Datenkopie nach Art. 15 DSGVO; weitere nehmen wir erst auf, wenn Anschrift und Weg geprüft sind.`,
    },
    {
      f: "Gilt die DSGVO auch in Österreich?",
      a: "Ja, unmittelbar. Das Recht auf die kostenlose Datenkopie nach Art. 15 DSGVO gilt in Österreich genauso wie in Deutschland. Wir nehmen Ihnen Anforderung, Erklärung und Schreiben ab.",
    },
    {
      f: "Kostet die Auskunft in Österreich mehr?",
      a: `Nein. ${P.privat} einzeln, ${P.privatPaket} für FIAON-Kunden mit laufendem Paket — einmalig, per Überweisung.`,
    },
  ],
  CH: [
    {
      f: "Warum Art. 25 DSG und nicht die DSGVO?",
      a: "Die Schweiz ist nicht in der EU. Ihr revidiertes Datenschutzgesetz gibt Ihnen ein eigenes Auskunftsrecht (Art. 25 DSG) — auf diesem Weg fragen wir bei CRIF und Intrum für Sie an.",
    },
    {
      f: "Ist der Betreibungsregisterauszug dabei?",
      a: "Nein. Den stellt das Betreibungsamt Ihres Wohnorts aus; er ist ein amtliches Dokument und nicht Teil unserer Auskunft.",
    },
    {
      f: "In welcher Währung zahle ich?",
      a: `In Euro: ${P.privat} einzeln, ${P.privatPaket} für FIAON-Kunden mit laufendem Paket — einmalig, per Überweisung.`,
    },
  ],
};

/** Auf der Unternehmensseite. */
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
