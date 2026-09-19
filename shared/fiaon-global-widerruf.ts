// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE WIDERRUFSBELEHRUNG FÜR PRIVATPERSONEN (19.09.2026, E-191)
//
// EINE Quelle für die Anlage zum Auftrag (server/lib/fiaon-global-vertrag.ts,
// im PDF und im Hash) und für die Seite /business/widerrufsbelehrung. Der
// Wortlaut ist das gesetzliche Muster (Anlage 1 und 2 zu Art. 246a § 1 EGBGB,
// Gestaltungshinweis 6 für Dienstleistungen) — WÖRTLICH, damit die gesetzliche
// Musterwirkung greift; englisch nach Anhang I A und B der Richtlinie
// 2011/83/EU. Nicht „verbessern": Jede Abweichung kostet die Musterwirkung.
// Seit 2022 gehört eine Telefonnummer in die Belehrung — die Support-Nummer aus
// shared/fiaon-firma.ts (seit 19.09.2026 dort, vorher nur in fiaon-wissen.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";

export interface GlobalWiderrufsbelehrung {
  titel: string;
  gilt: string;
  abschnitte: { h: string; absaetze: string[] }[];
  formular: { titel: string; hinweis: string; an: string; zeilen: string[]; fuss: string };
}

/** Name, Anschrift, Telefon und E-Mail der FIAON LTD — so, wie sie in die Belehrung eingesetzt werden. */
export function globalWiderrufAnbieter(sprache: "de" | "en"): string {
  return `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}, ${sprache === "en" ? "phone" : "Telefon"}: ${FIAON_FIRMA.telefon}, ${sprache === "en" ? "e-mail" : "E-Mail"}: ${FIAON_FIRMA.email}`;
}

export function globalWiderrufsbelehrung(sprache: "de" | "en"): GlobalWiderrufsbelehrung {
  const wir = globalWiderrufAnbieter(sprache);
  return sprache === "en" ? {
    titel: "Annex — Withdrawal instructions",
    gilt: "Applies if the Client is acting as a consumer.",
    abschnitte: [
      { h: "Right of withdrawal", absaetze: [
        "You have the right to withdraw from this contract within 14 days without giving any reason.",
        "The withdrawal period will expire after 14 days from the day of the conclusion of the contract.",
        `To exercise the right of withdrawal, you must inform us (${wir}) of your decision to withdraw from this contract by an unequivocal statement (e.g. a letter sent by post or e-mail). You may use the attached model withdrawal form, but it is not obligatory.`,
        "To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired.",
      ] },
      { h: "Effects of withdrawal", absaetze: [
        "If you withdraw from this contract, we shall reimburse to you all payments received from you, including the costs of delivery (with the exception of the supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by us), without undue delay and in any event not later than 14 days from the day on which we are informed about your decision to withdraw from this contract. We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.",
        "If you requested to begin the performance of services during the withdrawal period, you shall pay us an amount which is in proportion to what has been provided until you have communicated us your withdrawal from this contract, in comparison with the full coverage of the contract.",
      ] },
    ],
    formular: {
      titel: "Model withdrawal form",
      hinweis: "(Complete and return this form only if you wish to withdraw from the contract.)",
      an: `To ${wir}:`,
      zeilen: [
        "I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*)/for the provision of the following service (*),",
        "Ordered on (*)/received on (*),",
        "Name of consumer(s),",
        "Address of consumer(s),",
        "Signature of consumer(s) (only if this form is notified on paper),",
        "Date",
      ],
      fuss: "(*) Delete as appropriate.",
    },
  } : {
    titel: "Anlage — Widerrufsbelehrung",
    gilt: "Gilt, wenn der Auftraggeber als Verbraucher handelt.",
    abschnitte: [
      { h: "Widerrufsrecht", absaetze: [
        "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.",
        "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
        `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${wir}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
        "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.",
      ] },
      { h: "Folgen des Widerrufs", absaetze: [
        "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
        "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.",
      ] },
    ],
    formular: {
      titel: "Muster-Widerrufsformular",
      hinweis: "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
      an: `An ${wir}:`,
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
}
