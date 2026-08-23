// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 10 — Reale Situationen (23.08.2026, Plan §11)
// Zehn Fallstudien aus anonymisierten echten Fällen (Betriebslage 08/2026,
// Chat-Auswertung, Telefonie-Bug E-012, Dubletten, Fehlbeträge). Entscheidung,
// dann Auflösung. Preise aus dem Katalog.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, type Fall, frage } from "./typen";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";

const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const preis = (key: string) => eur(PAKETE.find((x) => x.key === key)?.preisCents ?? 0);
const schufa = SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",") + " €";
const fall = (f: Fall) => ({ uebung: { art: "fall" as const, fall: f } });

export const KAPITEL_10: KapitelInhalt = {
  inhalte: {
    "fall-1": fall({
      situation: `Herr M. hat im Startgespräch gesagt, er wolle „nur die Auskunft“. Zwei Tage später meldet der Kontoabgleich einen Eingang von ${preis("ultra")} mit seiner Referenz – der Preis von FIAON Ultra, nicht die ${schufa} der Bonitätsauskunft. In der Akte steht sein Paket als Start.`,
      akte: ["Paket laut Antrag: FIAON Start", `Eingang: ${preis("ultra")}, Verwendungszweck korrekt`, "Notiz Startgespräch: „wollte nur die Auskunft“"],
      frage: "Was tust du?",
      optionen: [
        { text: "Nichts – mehr Geld ist gut, das Paket stillschweigend auf Ultra setzen.", folge: "Der Kunde merkt es bei der nächsten Rate und fühlt sich betrogen. Kündigung, Erstattung, Vertrauensverlust – und ein Gespräch mit der Geschäftsführung." },
        { text: "Anrufen, klären, was er wollte; Differenz über das Back-Office erstatten oder auf sein Paket anrechnen; Entscheidung in die Akte.", richtig: true, folge: "Der Kunde erlebt, dass FIAON auf ihn achtet. Er entscheidet – oft bleibt er bei einem größeren Paket, weil ihm jemand ehrlich erklärt hat, was er dafür bekommt." },
        { text: "Den Betrag als Provision verbuchen lassen und abwarten.", folge: "Provision entsteht nur auf korrekt zugeordnete Raten. Ein Fehlbetrag ist kein Verdienst, sondern ein Ticket für das Back-Office." },
      ],
      aufloesung: "Fehlbeträge kommen regelmäßig vor – die Zahlen liegen nah beieinander und Kunden überweisen aus dem Gedächtnis. Die Regel: nie stillschweigend umbuchen. Anruf, Klärung, Ticket an das Back-Office (Erstattung oder Anrechnung), Notiz mit wörtlicher Entscheidung des Kunden.",
      lehre: "Geld, das nicht zum Paket passt, ist ein Gespräch, kein Gewinn.",
    }),
    "fall-2": fall({
      situation: `Frau S. (FIAON Ultra, ${preis("ultra")}, Monat 4) ruft an: „Ich will kündigen. Bei Ihnen passiert nichts.“ In der Akte: Löschantrag an die Auskunftei vor sechs Wochen (Antwort: abgelehnt, Gläubiger hat Mahnungen vorgelegt), Widerspruch an das Inkasso mit Frist bis Monatsende, zwei ungelesene Nachrichten im Bereich.`,
      akte: ["Schreiben 1: Löschantrag – abgelehnt, Mahnungen vorgelegt", "Schreiben 2: Widerspruch Inkasso – Frist läuft", "Nachrichten im Bereich: 2 ungelesen"],
      frage: "Wie reagierst du?",
      optionen: [
        { text: "„Sie haben zwölf Raten unterschrieben, kündigen geht nicht.“", folge: "Falsch (kündbar formlos) und feindselig. Sie kündigt sicher – und schreibt eine Bewertung." },
        { text: "Zuhören, dann die Akte konkret erklären: was in vier Monaten passiert ist, warum der Löschantrag abgelehnt wurde (Mahnungen lagen vor → Einigung statt Löschung), was bis Monatsende kommt. Kündigungsweg ehrlich nennen; wenn sie bleibt, nächsten sichtbaren Schritt vereinbaren.", richtig: true, folge: "Viele Kunden kündigen nicht die Arbeit, sondern die Unsichtbarkeit. Wer sieht, was passiert ist, bleibt oft – und wer trotzdem geht, geht ohne Groll." },
        { text: "Zwei Monate gratis anbieten.", folge: "Kein Versprechen, das du geben darfst – und es beantwortet ihre Enttäuschung nicht. Rabatte kaufen keine Geduld." },
      ],
      aufloesung: "Die Ablehnung des Löschantrags ist kein Scheitern, sondern ein Ergebnis: Der Gläubiger konnte Mahnungen vorlegen, also ist der Eintrag berechtigt – jetzt geht es um Erledigung (100-Tage-Regel prüfen, Ratenvereinbarung, Erledigungsvermerk). Das muss die Kundin hören, nicht lesen. Danach entscheidet sie.",
      lehre: "Kündigungswünsche sind fast immer Informationslücken. Erklären, nicht halten.",
    }),
    "fall-3": fall({
      situation: "In der Pipeline tauchen zwei Anträge auf: „Thomas K.“ mit Gmail-Adresse (Stufe B, Rechnung offen) und „T. Kaiser“ mit Firmenadresse (Stufe C, Lead), gleiche Telefonnummer, gleiches Geburtsdatum. Ein Kollege hat den zweiten gestern angerufen.",
      akte: ["Antrag 1: Stufe B, Pro, Rechnung offen, dein Kunde", "Antrag 2: Stufe C, Lead, Kollege hat gestern angerufen", "Gleiche Nummer, gleiches Geburtsdatum"],
      frage: "Was ist richtig?",
      optionen: [
        { text: "Beide Anträge getrennt weiterverkaufen – zwei Abschlüsse.", folge: "Zwei Rechnungen an einen Menschen, zwei Anrufe von zwei Kollegen: Der Kunde fühlt sich verfolgt, und die Datenbank hat eine Dublette mehr." },
        { text: "Dublette melden (Admin/Dubletten), einen Antrag als führend festlegen, mit dem Kollegen absprechen, wer den Kunden behält, den Kunden einmal anrufen.", richtig: true, folge: "Ein Kunde, ein Betreuer, eine Rechnung. Die Dublette wird zusammengeführt (merged_into), der Verlauf bleibt erhalten." },
        { text: "Den älteren Antrag löschen.", folge: "Nichts wird gelöscht – Datensätze werden zusammengeführt. Löschen vernichtet Verlauf und Zahlungen." },
      ],
      aufloesung: "Dubletten entstehen, wenn jemand den Antrag zweimal beginnt (andere E-Mail, Tippfehler). Die Datenbankbereinigung vom 23.08. hat viele zusammengeführt; neue melden wir sofort. Besitzanspruch: Wer zuerst ein dokumentiertes Ergebnis hatte, behält den Kunden – im Zweifel entscheidet die Teamleitung.",
      lehre: "Ein Mensch ist ein Datensatz. Alles andere ist ein Ticket.",
    }),
    "fall-4": fall({
      situation: `Herr B. schreibt per WhatsApp: „Habe gestern ${preis("pro")} überwiesen, Screenshot anbei.“ Auf dem Screenshot: Betrag, Empfänger FIAON, Datum gestern, aber kein Verwendungszweck. Der Kontoabgleich zeigt heute keinen Eingang.`,
      akte: ["Status: Kunde meldet Zahlung – noch nicht bankbestätigt", "Screenshot ohne Verwendungszweck", "Kontoabgleich heute: kein Eingang"],
      frage: "Was tust du?",
      optionen: [
        { text: "Status auf „Bezahlt“ setzen und das Startgespräch buchen.", folge: "„Bezahlt“ tragen nur bankbestätigte Zahlungen. Kommt das Geld nicht oder landet es unzuordenbar, sitzt ein Kunde im Startgespräch, der nicht bezahlt hat – und deine Provision ist Luft." },
        { text: "Bedanken, erklären, dass der Eingang ein bis zwei Bankarbeitstage dauert; bitten, beim nächsten Mal die Referenz als Verwendungszweck zu nutzen; Back-Office über die fehlende Referenz informieren (Ticket mit Screenshot); Termin als Startgespräch anbieten, der bei Eingang greift.", richtig: true, folge: "Das Back-Office findet den Eingang über Betrag und Datum, ordnet zu, bestätigt. Der Kunde hat einen Termin und fühlt sich ernst genommen." },
        { text: "Den Kunden bitten, nochmal zu überweisen – diesmal mit Referenz.", folge: "Doppelzahlung, Erstattung, Ärger. Ein Screenshot ist ein Hinweis, keine Aufforderung zum Doppelten." },
      ],
      aufloesung: "Stufe A ist das leichteste Gespräch: Du fragst nach dem Beleg und gibst ihn weiter. Die Wahrheit liegt im Kontoabgleich – nicht in WhatsApp. Ein fehlender Verwendungszweck ist der häufigste Grund für „Geld ist da, aber niemand weiß von wem“.",
      lehre: "Zahlungen werden bestätigt, nicht geglaubt.",
    }),
    "fall-5": fall({
      situation: `Collections zeigt: Herr R. (FIAON Pro, ${preis("pro")}), Rate 3 seit 14 Tagen offen, Lastschrift zurückgegeben, Erinnerungen Tag 0/3/7 ohne Antwort. Letzte Notiz vor drei Wochen: „sehr zufrieden, Löschantrag läuft“.`,
      akte: ["Rate 3: 14 Tage offen, Rücklastschrift", "Erinnerungen: 3, keine Antwort", "Letzte Notiz: zufrieden"],
      frage: "Wie eröffnest du den Anruf?",
      optionen: [
        { text: "„Herr R., Sie haben nicht bezahlt. Wenn bis Freitag nichts kommt, melden wir Sie bei der SCHUFA.“", folge: "Drohung mit Eintrag – weder gewollt noch ohne Weiteres zulässig (§ 31 BDSG). Ein zufriedener Kunde wird in einem Satz zum Gegner." },
        { text: "„Guten Tag Herr R., [Name] von FIAON – ich rufe wegen Ihrer Rate vom [Datum] an, die ist noch offen, die Lastschrift ist zurückgegangen. Ist etwas dazwischengekommen?“ Dann Grund erfahren, Datum vereinbaren, Ergebnis klicken.", richtig: true, folge: "Meist ein leeres Konto oder ein Kontowechsel. Mit Datum und Weg ist die Rate in der Regel in der Woche da – und der Kunde bleibt zufrieden." },
        { text: "Nicht anrufen – das Back-Office übernimmt ab Tag 30 sowieso.", folge: "Tag 14 ist dein Anruf. Wer ihn auslässt, schickt einen zufriedenen Kunden in den Mahnlauf – und verliert die Haltequote, an der der Quartalsbonus hängt." },
      ],
      aufloesung: "Der Zahlungsmotor hat Tag 0–14 erledigt; du bist die bekannte Stimme. Grund erfahren, Lage sachlich einordnen (Sperre ab Tag 30 ist eine Information, keine Drohung), Vereinbarung mit Datum, Ergebnis klicken (zahlt am …). Bei Rücklastschrift: Lastschrift erneut anstoßen oder Überweisung vereinbaren.",
      lehre: "Ein Hilfsangebot mit Datum – keine Mahnung mit Stimme.",
    }),
    "fall-6": fall({
      situation: "Ein Interessent am Telefon: „Ich unterschreibe nur, wenn Sie mir schriftlich garantieren, dass der Eintrag in drei Monaten weg ist. Andere Anbieter machen das.“",
      frage: "Deine Antwort?",
      optionen: [
        { text: "„Gut, ich schreibe Ihnen das in die Nachricht – drei Monate, garantiert.“", folge: "Ein schriftliches Beweisstück für ein verbotenes Versprechen. Wenn der Eintrag berechtigt ist, bleibt er – und FIAON haftet für die Zusage." },
        { text: "„Nein – und wer Ihnen das schriftlich gibt, lügt oder will Vorkasse. Was ich Ihnen schriftlich gebe: jeden Schritt in Ihrem Bereich, mit Datum. Wir prüfen, ob die Meldung zulässig war; fehlen Voraussetzungen, verlangen wir die Löschung. Ist sie berechtigt, erledigen wir sie so, dass die kurze Frist greift.“", richtig: true, folge: "Manche gehen zum „Garantie“-Anbieter – und kommen zurück. Die anderen unterschreiben, weil ihnen zum ersten Mal jemand die Wahrheit gesagt hat." },
        { text: "„Eine Garantie darf ich nicht geben, aber unsere Erfolgsquote liegt bei 90 Prozent.“", folge: "Eine erfundene Zahl ist so schlimm wie eine Garantie. Erfolgsaussichten gibt es je Eintrag in der Akte – nicht als Prozentzahl am Telefon." },
      ],
      aufloesung: "„Garantie“ ist das Wort, das FIAON nie benutzt – nicht aus Vorsicht, sondern weil es die Wahrheit verfehlt: Ob ein Eintrag fällt, entscheidet die Rechtslage, nicht der Anbieter. Der Markt ist voll von Vorkasse-Versprechen; unsere Ehrlichkeit ist der Unterschied.",
      lehre: "Ehrlichkeit ist kein Verzicht auf Verkauf. Sie ist das Verkaufsargument.",
    }),
    "fall-7": fall({
      situation: "Herr K. (Interessent) liest dir einen Inkassobrief vor: Hauptforderung 89 € (Versandhaus, Bestellung angeblich zurückgeschickt), Inkassogebühr 70,20 €, Auslagen 20 €, „Kontoführung“ 18 €, Zinsen 12,80 € – Summe 210 €, Frist sieben Tage, Drohung mit SCHUFA-Eintrag. Er will „das einfach zahlen, damit Ruhe ist“.",
      akte: ["Hauptforderung 89 €, erstes Schreiben", "Kosten 108,20 € zuzüglich Zinsen", "Kunde hat Rücksendung – Beleg unklar"],
      frage: "Was erklärst du?",
      optionen: [
        { text: "„Zahlen Sie, dann ist Ruhe – Inkasso ist nie verkehrt.“", folge: "Er zahlt rund 85 € zu viel, ohne zu wissen, ob die Forderung überhaupt besteht – und eine Zahlung kann ein Anerkenntnis sein." },
        { text: "Strukturieren: 1) Besteht die Forderung (Rücksendebeleg suchen)? 2) Verjährt? 3) Mahnungen zugegangen? 4) Kosten: zulässig sind rund 24,50 € Gebühr (0,5) plus 4,90 € Auslagen; „Kontoführung“ ohne Nachweis 0 €. Dann: FIAON bereitet das Schreiben vor (Zurückweisung der überhöhten Kosten, bei Rücksendebeleg Widerspruch); Eintrag ist erst nach zwei Mahnungen mit vier Wochen Abstand zulässig. Entscheidung bei ihm.", richtig: true, folge: "Aus Panik wird ein Plan mit vier Punkten. Ob er Kunde wird, entscheidet sich daran, ob er erlebt hat, dass jemand sortiert statt drängt." },
        { text: "„Zahlen Sie auf keinen Fall, das ist Abzocke.“", folge: "Rechtsberatung im Einzelfall – und möglicherweise falsch: Wenn die Bestellung nie zurückkam, ist die Hauptforderung berechtigt, und Nichtzahlung setzt den Verzug fort." },
      ],
      aufloesung: "Der Inkassokosten-Prüfer (Kapitel 5) rechnet es vor: zulässig rund 29,40 € Kosten statt 108,20 €. Die Hauptforderung hängt am Rücksendebeleg. Die Eintragsdrohung ist nur dann real, wenn die Voraussetzungen des § 31 BDSG vorliegen – und das erste Inkassoschreiben ist meist noch nicht die zweite Mahnung.",
      lehre: "Vier Prüfungen vor jedem Euro – und die Entscheidung bleibt beim Kunden.",
    }),
    "fall-8": fall({
      situation: `Frau L. (FIAON Start, ${preis("start")}) schreibt nach der zweiten Abbuchung an Hilfe: „Ich dachte, das war einmalig! Ich will mein Geld zurück.“ In der Notiz des Startgespräches steht zu Abo-Klarheit nur: „ok“.`,
      akte: ["Paket Start, Rate 2 abgebucht", "Notiz Abo-Klarheit: „ok“", "Anliegen über Hilfe, Ton verärgert"],
      frage: "Was tust du?",
      optionen: [
        { text: "„Das steht in den AGB, die Sie akzeptiert haben.“", folge: "Formal richtig, menschlich falsch – und die dünne Notiz „ok“ beweist nicht, dass es erklärt wurde. Kündigung plus Erstattungsforderung." },
        { text: "Anrufen, sich entschuldigen, dass es nicht klar angekommen ist; erklären, was das Abo leistet und was bisher passiert ist; Kündigungsweg nennen; über das Back-Office eine Kulanzprüfung für Rate 2 anstoßen, falls sie geht. Und: künftig die Abo-Klarheit wörtlich notieren.", richtig: true, folge: "Oft bleibt die Kundin, wenn sie versteht, was läuft. Wenn nicht, geht sie ohne Streit – und die nächste Notiz steht wörtlich drin." },
        { text: "Das Anliegen an die Geschäftsführung weiterleiten und abwarten.", folge: "Es ist dein Kunde und dein Startgespräch. Weiterleiten ohne eigenes Gespräch verliert einen Tag und die Beziehung." },
      ],
      aufloesung: "Abo-Klarheit ist Schritt 6 der Agenda mit Pflichtnotiz – und „ok“ ist keine Notiz. Die Regel: Betrag nennen, Datum der nächsten Abbuchung nennen, Kündigungsweg nennen, Antwort wörtlich festhalten („Ja, 7,99 jeden Monat ist in Ordnung“). Der Streitfall entsteht nicht bei der Abbuchung, sondern im Startgespräch.",
      lehre: "Eine Notiz, die nicht wörtlich ist, hat nicht stattgefunden.",
    }),
    "fall-9": fall({
      situation: "Herr P. hat vor 20 Monaten seine Restschuldbefreiung erhalten. In seiner Datenkopie steht der Vermerk noch. Die Bank hat ihm deshalb das Girokonto verweigert – „wegen Insolvenz“.",
      akte: ["Restschuldbefreiung vor 20 Monaten", "Vermerk in der Datenkopie vorhanden", "Kontoeröffnung abgelehnt"],
      frage: "Was ist der Weg?",
      optionen: [
        { text: "„Das ist normal, drei Jahre – warten Sie.“", folge: "Falsch seit März 2023: Sechs Monate. 14 Monate rechtswidrige Speicherung – und ein verweigertes Konto, das ihm zusteht." },
        { text: "Zwei Schreiben vorbereiten: Löschung nach Art. 17 DSGVO bei der Auskunftei mit Verweis auf EuGH C-26/22 und die SCHUFA-Praxis seit März 2023 (Frist ein Monat, bei Weigerung Datenschutzbehörde). Und: Der Kunde hat unabhängig davon Anspruch auf ein Basiskonto nach dem ZKG – Ablehnung schriftlich begründen lassen, Beschwerde bei der BaFin möglich.", richtig: true, folge: "Die Löschung kommt in der Regel schnell – das Urteil kennt jede Sachbearbeiterin. Das Basiskonto eröffnet die Partnerbank ohnehin." },
        { text: "Eine Kreditanfrage bei drei Banken stellen, um zu sehen, wer zusagt.", folge: "Drei Kreditanfragen drücken den Wert – und lösen das Problem nicht. Erst löschen, dann anfragen." },
      ],
      aufloesung: "Die Restschuldbefreiung darf nur sechs Monate gespeichert werden (EuGH 7.12.2023). Ein älterer Vermerk ist ein klarer Löschanspruch. Und ein Konto ist keine Gnade: Basiskonto nach dem Zahlungskontengesetz, unabhängig von der Bonität.",
      lehre: "Eine überschrittene Frist ist der klarste Löschgrund, den es gibt.",
    }),
    "fall-10": fall({
      situation: "Frau St. aus Wien: Beim Handyvertrag abgelehnt, „wegen KSV“. Sie hat vor zwei Jahren eine Versandhausrechnung verspätet bezahlt. Sie fragt, ob die 100-Tage-Regel für sie gilt und ob sie eine SCHUFA-Auskunft bestellen soll.",
      frage: "Was erklärst du?",
      optionen: [
        { text: "„Ja, die 100-Tage-Regel gilt auch in Österreich – bestellen Sie die SCHUFA-Auskunft.“", folge: "Zwei Fehler in einem Satz: Die SCHUFA ist in Österreich nicht zuständig, die 100-Tage-Regel ist eine deutsche Verhaltensregel." },
        { text: "„In Österreich sind das KSV1870 und CRIF – und die Warnliste der Banken. Beim Handyvertrag ist oft CRIF entscheidend. Die 100-Tage-Regel ist eine deutsche Regel; in Österreich zählen die Fristen der jeweiligen Auskunftei – bei erledigten Forderungen in der Regel drei Jahre. Ihr Auskunftsrecht steht in Art. 15 DSGVO. FIAON beschafft alle drei Auskünfte mit Vollmacht; ist der Eintrag falsch oder die Frist vorbei, schreiben wir nach österreichischem Recht.“", richtig: true, folge: "Die Kundin versteht zum ersten Mal, wer über sie entscheidet – und warum die Antwort in Deutschland anders wäre." },
        { text: "„Das muss ich prüfen und melde mich.“", folge: "Ehrlich, aber die Grundlagen (Kapitel 7) gehören zum Handwerk. Prüfen darfst du Details – nicht, welches Land welche Auskunftei hat." },
      ],
      aufloesung: "Drei Auskünfte, eine Rechtsgrundlage (DSGVO), eine Behörde (Datenschutzbehörde Wien), keine deutsche Regel. Der verspätet bezahlte Versandhauseintrag ist nach zwei Jahren wahrscheinlich noch gespeichert – zu prüfen ist, ob die Meldung zulässig war (fällig, unbestritten, informiert) und ob das Erledigungsdatum stimmt.",
      lehre: "Land zuerst, dann Regel. Nie umgekehrt.",
    }),
  },
  test: [
    frage("Kunde überweist den Ultra-Preis, wollte aber die Auskunft. Richtig ist:", ["Stillschweigend umbuchen", "Anrufen, klären, Differenz über das Back-Office erstatten oder anrechnen, Entscheidung notieren", "Als Provision verbuchen", "Abwarten"], 1, "Nie stillschweigend umbuchen."),
    frage("Kündigungswunsch in Monat 4 – erster Schritt?", ["Kündigung bestätigen", "Akte erklären: was passiert ist, was kommt; Kündigungsweg ehrlich nennen; Entscheidung beim Kunden", "Rabatt", "„Geht nicht, zwölf Raten“"], 1, "Kündigungswünsche sind meist Informationslücken."),
    frage("Zwei Anträge, ein Mensch. Was tun?", ["Beide verkaufen", "Dublette melden, führenden Antrag festlegen, mit dem Kollegen absprechen, einmal anrufen", "Den älteren löschen", "Ignorieren"], 1, "Ein Mensch ist ein Datensatz."),
    frage("Screenshot ohne Verwendungszweck, kein Eingang im Abgleich.", ["„Bezahlt“ setzen", "Bedanken, Bankarbeitstage erklären, Referenz erbitten, Back-Office informieren, Termin anbieten", "Nochmal überweisen lassen", "Archivieren"], 1, "Zahlungen werden bestätigt, nicht geglaubt."),
    frage("Tag-14-Anruf – welcher Satz ist tabu?", ["„Ist etwas dazwischengekommen?“", "„Sonst melden wir Sie bei der SCHUFA.“", "„Passt der 28.?“", "„Die Lastschrift ist zurückgegangen.“"], 1, "Keine Drohung mit Eintrag."),
    frage("Interessent will eine schriftliche Löschgarantie in drei Monaten.", ["Schriftlich geben", "Klar nein; erklären, was FIAON schriftlich gibt: jeden Schritt mit Datum; Prüfmechanismus erklären", "„90 Prozent Erfolgsquote“", "Thema wechseln"], 1, "Ehrlichkeit ist das Verkaufsargument."),
    frage("Restschuldbefreiung vor 20 Monaten, Vermerk noch da, Konto verweigert.", ["Warten", "Löschung nach Art. 17 DSGVO (EuGH C-26/22) und Basiskonto nach ZKG – Ablehnung begründen lassen, BaFin", "Drei Kreditanfragen", "Neu Insolvenz anmelden"], 1, "Sechs Monate – und ein Konto ist ein Rechtsanspruch."),
    frage("Kundin aus Wien fragt nach der 100-Tage-Regel und der SCHUFA.", ["Beides gilt", "KSV1870/CRIF/Warnliste; deutsche Regel gilt nicht; Art. 15 DSGVO; Datenschutzbehörde Wien", "SCHUFA bestellen", "Prüfen und melden"], 1, "Land zuerst, dann Regel."),
  ],
};
