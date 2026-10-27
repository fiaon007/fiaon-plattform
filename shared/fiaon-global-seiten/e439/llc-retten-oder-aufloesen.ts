// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: BESTEHENDE US-LLC RETTEN, ÜBERGEBEN ODER AUFLÖSEN
// (27.10.2026, E-439) · FG · 50
//
// Für Inhaber einer LLC, die bei einem anderen Dienst gegründet wurde und still
// geworden ist: versäumte Jahresberichte, Auflösung von Amts wegen, Registered
// Agent weg, Form 5472 nie abgegeben. Recherche: .arbeit/recherche/kw_de.md (T6),
// kw_en.md (5.3). Deutschsprachig gibt es dazu kaum Seiten mit Primärquellen.
//
// Selbst nachgeprüft am 27.10.2026 an den amtlichen Texten:
// · Florida Statutes 2026: § 605.0714 (Auflösung von Amts wegen: Bericht fehlt am
//   dritten Freitag im September → Auflösung am vierten Freitag; Agent/Gebühren/
//   Änderungsmeldung → 60 Tage nach Mitteilung; danach nur Abwicklung; Agent bleibt
//   zustellungsbefugt), § 605.0715 (Wiederherstellung jederzeit, Antrag vom Agent
//   mitunterschrieben, alle Gebühren zu den Sätzen am Antragstag, wirkt zurück;
//   Name ein Jahr gesperrt), § 605.0707 (Articles of Dissolution), § 605.0114
//   (Statement of Change mit schriftlicher Annahme des neuen Agent), § 605.0115
//   (Rücktritt des Agent: Amt endet am 31. Tag nach Eintragung, Kopie an die
//   Postanschrift der LLC), § 605.0212 (ohne Bericht weder klagen noch verteidigen),
//   § 605.0213 (Wiederherstellung 100 $, Agent-Wechsel 25 $, sonstige Dokumente
//   25 $), § 607.193 (Zuschlag 400 $ entfällt bei Wiederherstellung nach Auflösung
//   wegen fehlenden Berichts).
// · Wyoming Secretary of State: FAQ (Auflösung 60 Tage nach Fälligkeit, keine
//   Wiederherstellung nach zwei Jahren) und Gebührenordnung ab 01.07.2026
//   (Wiederherstellung 100 $ bzw. 350 $ ohne Agent, Auflösung 60 $, neuer Agent 5 $).
// · Delaware Code Title 6: § 18-1107/§ 18-1108 (Löschung nach drei Jahren ohne
//   Jahressteuer), § 18-1109 (Revival auch nach Löschung wegen fehlenden Agent),
//   § 18-104(d) (Rücktritt ohne Nachfolger → Löschung nach dreißig Tagen), § 18-203
//   (Certificate of Cancellation nach Abwicklung); Gebührenordnung 01.08.2026
//   (Cancellation 220 $ plus Jahressteuer, Revival 220 $, Agent-Wechsel 50 $);
//   Title 8 § 510 („void“ nur bei Corporations).
// · IRS: Instructions for Form 5472 (25.000 $, Fortsetzung nach 90 Tagen je
//   30 Tage, nicht elektronisch, „Foreign-owned U.S. DE“, nur Name, Anschrift,
//   Felder B und E der 1120), Instructions for Form 1120 (Feld E: Final Return),
//   Closing a Business (Brief nach Cincinnati, OH 45999; Konto erst nach allen
//   Erklärungen und Steuern; Form 1065 mit final K-1; Form 966 bei Corporations),
//   Delinquent International Information Return Submission Procedures (Stand
//   19.04.2026: Strafen können trotzdem festgesetzt werden), About Form 8822-B.
// · 26 U.S.C. § 6038A(d), § 6501(c)(8); 26 CFR § 1.6038A-4(b) (Reasonable Cause,
//   kleine Gesellschaften ≤ 20 Mio. $ Einnahmen: „liberally“).
// · § 138 Abs. 2 Satz 1 Nr. 2 und 3, Abs. 5 AO; § 10 AO; § 1 KStG; § 16 Abs. 3,
//   § 17 Abs. 1 und 4 EStG.
// Bewusst weggelassen: Aussagen, die EIN werde „gelöscht“ (die IRS nennt sie
// dauerhaft), Erfahrungswerte zur Erfolgsquote von Begründungen, Partner- und
// Anbieternamen, ein Preis für die Übernahme (steht erst nach der Prüfung fest).
//
// Wortwand: kein „bis zu“, kein Bankname, keine Frist mit Ziffer als Zusage, kein
// Zinssatz, kein Steuerversprechen, keine Strafbefreiung als Zusage. „Unterneh-
// mensberatung“ als Selbstbezeichnung erlaubt seit E-439 (Justin, 27.10.2026).
//
// Fachprüfung 27.10.2026 (zweiter Durchgang, alle Quellen erneut geöffnet):
// Delaware-Löschung verlangt die Jahressteuer bis einschließlich des laufenden
// Jahres (§ 18-1107); Florida-Zuschlag entfällt nur bei Auflösung wegen des
// fehlenden Berichts (§ 607.193); Wyoming-Wiederherstellung zuzüglich offener
// License Tax; Rückwirkung nur für Florida und Delaware belegt; Rücktritt des
// Agent in Delaware mit 30 Tagen Vorankündigung (§ 18-104(d)); § 6501(c)(8)(B);
// Typenvergleich mit BMF-Schreiben vom 19.03.2004 belegt; Folgen je Weg klären
// die Partner im Mandat (RDG/StBerG), FIAON nennt Wege, Staatsgebühren, Festpreis.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../typen";
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN } from "../../fiaon-global";
import { QUELLEN_WISSEN as Q, QUELLEN_STAATEN, STAAT, IRS } from "../fakten";

const S = "2026-10-27";
const FL = STAAT.florida;
const WY = STAAT.wyoming;
const DE = STAAT.delaware;

/** Eigene Quellen dieses Beitrags (geprüft am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  fl0707: { titel: "Florida Statutes 2026, § 605.0707 — Articles of Dissolution", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0707" },
  fl0715: { titel: "Florida Statutes 2026, § 605.0715 — Wiederherstellung nach Auflösung von Amts wegen", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0715" },
  fl0114: { titel: "Florida Statutes 2026, § 605.0114 — Wechsel des Registered Agent", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0114" },
  fl0115: { titel: "Florida Statutes 2026, § 605.0115 — Rücktritt des Registered Agent", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0115" },
  deAufloesung: { titel: "Delaware Code, Title 6, Chapter 18, Subchapter II — Certificate of Cancellation (§ 18-203)", url: "https://delcode.delaware.gov/title6/c018/sc02/index.html" },
  de510: { titel: "Delaware Code, Title 8, Chapter 5 — § 510, Nichtigkeit der Charter bei Corporations", url: "https://delcode.delaware.gov/title8/c005/index.html" },
  irsSchliessen: { titel: "IRS — Closing a business", url: "https://www.irs.gov/businesses/small-businesses-self-employed/closing-a-business" },
  irsNachholen: { titel: "IRS — Delinquent international information return submission procedures", url: "https://www.irs.gov/individuals/international-taxpayers/delinquent-international-information-return-submission-procedures" },
  usc6038A: { titel: "26 U.S. Code § 6038A — Information with respect to certain foreign-owned corporations", url: "https://www.law.cornell.edu/uscode/text/26/6038A" },
  cfr6038A4: { titel: "26 CFR § 1.6038A-4 — Monetary penalty, Reasonable Cause", url: "https://www.law.cornell.edu/cfr/text/26/1.6038A-4" },
  usc6501: { titel: "26 U.S. Code § 6501 — Limitations on assessment and collection", url: "https://www.law.cornell.edu/uscode/text/26/6501" },
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  kstg1: { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
  estg16: { titel: "§ 16 EStG — Veräußerung und Aufgabe des Betriebs", url: "https://www.gesetze-im-internet.de/estg/__16.html" },
  estg17: { titel: "§ 17 EStG — Veräußerung und Auflösung von Kapitalgesellschaften", url: "https://www.gesetze-im-internet.de/estg/__17.html" },
  bmf2004: { titel: "BMF-Schreiben vom 19.03.2004 zur US-LLC (KStH 2022, Anlage 10)", url: "https://usth.bundesfinanzministerium.de/ksth/2022/B-Anlagen/Anlage-10/inhalt.html" },
};

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/llc-retten-oder-aufloesen",
  art: "wissen",
  seo: {
    titel: "US-LLC auflösen, retten oder übergeben — FIAON Global",
    beschreibung: "Annual Report versäumt, Form 5472 fehlt, Agent gekündigt: wie Sie eine US-LLC reaktivieren, übergeben oder sauber auflösen — mit Primärquellen.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 50",
  auge: "Wissen · Bestehende LLC",
  h1: "US-LLC auflösen oder retten.",
  h1b: "Erst prüfen, dann entscheiden.",
  lead: "Viele Unternehmer aus Deutschland, Österreich und der Schweiz haben eine US-LLC über einen Online-Dienst gegründet — und dann wurde es still: kein Jahresbericht, keine Form 5472, der Registered Agent gekündigt, die Post der IRS an einer alten Anschrift. Hier steht, was in Florida, Wyoming und Delaware dann gilt, wie Sie eine solche US-LLC auflösen, wiederherstellen oder übergeben und was die IRS dabei erwartet.",
  ziffern: [
    { wert: "25.000 $", label: "mögliche Strafe je fehlender Form 5472 und Jahr" },
    { wert: "2 Jahre", label: "für die Wiederherstellung in Wyoming" },
    { wert: "4. Freitag im September", label: "Auflösung in Florida ohne Jahresbericht" },
  ],
  blick: [
    ["Erster Schritt", "Status im Register und Stand bei der IRS feststellen"],
    ["Retten", "Reinstatement mit allen offenen Berichten und Gebühren"],
    ["Übergeben", "Neuer Registered Agent, neue Anschrift bei der IRS"],
    ["Auflösen", "Auflösung beim Staat, Schlusserklärung, Konto der EIN schließen"],
    ["Altlasten", "Fehlende Form 5472 bleiben offen — auch nach der Löschung"],
    ["Zu Hause", "Meldung nach § 138 AO und steuerliche Folgen der Auflösung"],
    ["Mit FIAON Global", "Prüfung, Nachholen, Übergabe oder Auflösung — ein Ansprechpartner statt acht"],
  ],
  kurz: `Eine US-LLC auflösen heißt: beim Bundesstaat die Auflösung einreichen — in Florida und Wyoming mit Articles of Dissolution, in Delaware mit einem Certificate of Cancellation —, bei der IRS die letzte Erklärung als Schlusserklärung abgeben und das Konto der EIN per Brief schließen lassen. Ist die LLC schon von Amts wegen aufgelöst, lässt sie sich wiederherstellen: in Florida jederzeit, in Wyoming nur in den ersten zwei Jahren. Versäumte Form 5472 erledigen sich durch keine Löschung; die IRS kann ${IRS.strafe5472} festsetzen, und über eine nachgereichte Begründung entscheidet allein die IRS.`,
  bloecke: [
    {
      typ: "text", id: "lage", h2: "Wenn es still geworden ist: drei Wege für eine bestehende LLC",
      absaetze: [
        "Die Lage ist oft dieselbe. Die Gesellschaft wurde günstig über einen Online-Dienst gegründet, im ersten Jahr lief der Registered Agent mit, danach kam keine Post mehr an. Der Jahresbericht beim Bundesstaat fehlt, die jährliche Meldung an die IRS wurde nie abgegeben, und die Anschrift, die die IRS kennt, gehört einem Dienst, mit dem Sie nichts mehr zu tun haben.",
        "Für eine solche Gesellschaft gibt es drei Wege. Sie retten sie, wenn sie noch gebraucht wird — etwa weil ein Konto, ein Händlerkonto oder Verträge an ihr hängen. Sie übergeben sie in neue Hände, wenn sie weiterlaufen soll, aber ohne den alten Dienst. Oder Sie lösen sie sauber auf, wenn sie keinen Zweck mehr hat. Welcher Weg passt, hängt an zwei Fragen: Was steht im Register des Bundesstaats, und was fehlt bei der IRS?",
        "Nichts zu tun ist meist die teuerste Wahl. Eine Gesellschaft, die der Staat von Amts wegen auflöst, ist damit nicht aus der Welt: In Florida etwa besteht sie weiter, um abgewickelt zu werden, und ihre offenen Meldungen bei der IRS bleiben in jedem Bundesstaat offen.",
      ],
    },
    {
      typ: "tabelle", id: "staaten", h2: "LLC Administrative Dissolution: Florida, Wyoming und Delaware",
      lead: "Jeder Bundesstaat regelt Jahresbericht, Auflösung von Amts wegen und Wiederherstellung selbst. Die Regeln der drei Staaten im Überblick, Stand Oktober 2026.",
      kopf: ["", "Florida", "Wyoming", "Delaware"],
      zeilen: [
        ["Jährliche Pflicht", `${FL.jahrName}: ${FL.jahr}; Frist: ${FL.jahrFrist}`, `${WY.jahrName}: ${WY.jahr}; Frist: ${WY.jahrFrist}`, `${DE.jahrName}: ${DE.jahr}; Frist: ${DE.jahrFrist}`],
        ["Bei Verzug", FL.jahrVerzug, "säumig ab dem zweiten Tag des Folgemonats", `${DE.jahrVerzug}; die LLC verliert den Status „good standing“`],
        ["Auflösung von Amts wegen", "am vierten Freitag im September, wenn der Jahresbericht fehlt; fehlen Agent oder Gebühren, 60 Tage nach der Mitteilung des Staats", "60 Tage nach Fälligkeit des Jahresberichts", "Löschung, wenn die Jahressteuer drei Jahre unbezahlt bleibt; tritt der Agent zurück, ohne dass binnen dreißig Tagen ein neuer benannt ist, schon dann"],
        ["Wiederherstellung", "jederzeit; 100 $ und alle offenen Gebühren — war der fehlende Jahresbericht der Grund, entfällt der Zuschlag von 400 $; wirkt auf den Tag der Auflösung zurück", "nur in den ersten zwei Jahren nach der Auflösung; 100 $ zuzüglich der offenen License Tax, fehlte der Registered Agent 350 $", "Certificate of Revival, 220 $ und die offene Jahressteuer samt Strafen und Zinsen; wirkt, als wäre nie gelöscht worden"],
        ["Freiwillige Auflösung", "Articles of Dissolution, 25 $", "Articles of Dissolution, 60 $", "Certificate of Cancellation nach der Abwicklung, 220 $ und die Jahressteuer bis einschließlich des laufenden Jahres"],
        ["Neuer Registered Agent", "Statement of Change mit schriftlicher Annahme des neuen Agent, 25 $", "Benennung von Agent und Anschrift, 5 $", "Änderung des Agent, 50 $"],
      ],
      fuss: [
        `Staatsgebühren laut Gesetz und Gebührenordnungen der Staaten, Stand Oktober 2026. Delaware: ${DE.jahrAlt}`,
        "Bei Corporations in Delaware heißt der entsprechende Zustand „void“: Ihre Charter wird nichtig, wenn sie ein Jahr lang Franchise Tax oder Jahresbericht schuldig bleibt (8 Del. C. § 510).",
      ],
    },
    {
      typ: "text", id: "aufgeloest", h2: "Was eine aufgelöste LLC noch darf",
      absaetze: [
        "In Florida existiert eine LLC, die der Staat von Amts wegen aufgelöst hat, weiter — aber nur noch, um abgewickelt zu werden. Sie darf ihre Geschäfte beenden, ihr Vermögen verwerten und verteilen und Gläubiger benachrichtigen, mehr nicht (§ 605.0714). Ihr Registered Agent bleibt dabei befugt, Zustellungen anzunehmen.",
        "Für den Alltag hat das handfeste Folgen. Banken, Zahlungsplattformen und Vertragspartner können den Status im Register jederzeit einsehen; eine Gesellschaft, die dort als aufgelöst oder säumig geführt wird, kann keinen einwandfreien Status nachweisen. In Delaware erhält eine LLC ohne gezahlte Jahressteuer keine Bescheinigung über ihren Status und kann vor den Gerichten des Staats keine Klage führen. In Florida kann eine Gesellschaft ohne Jahresbericht vor Gericht weder klagen noch sich verteidigen, bis Bericht und Gebühren nachgeholt sind (§ 605.0212).",
        "Der Name ist in Florida nach der Auflösung ein Jahr lang für andere gesperrt. Hat ihn danach eine andere Gesellschaft übernommen, gelingt die Wiederherstellung nur unter neuem Namen (§ 605.0715). Wer seine Gesellschaft behalten will, verliert mit jedem Monat Spielraum.",
      ],
    },
    {
      typ: "etappen", id: "reinstatement", h2: "LLC reaktivieren: das Reinstatement Schritt für Schritt",
      lead: "Die Wiederherstellung heißt englisch Reinstatement, in Delaware Revival. In Florida wirkt sie ausdrücklich auf den Tag der Auflösung zurück (§ 605.0715); in Delaware gilt die Gesellschaft danach, als wäre sie nie gelöscht worden (6 Del. C. § 18-1109).",
      etappen: [
        { titel: "Registerauszug und Fristen", text: "Status, Tag und Grund der Auflösung, offene Jahresberichte aus dem Register des Bundesstaats. In Wyoming entscheidet das Datum, ob eine Wiederherstellung noch möglich ist: Sie steht nur in den ersten zwei Jahren offen." },
        { titel: "Registered Agent sichern", text: "Ohne Agent keine Wiederherstellung. In Florida unterschreibt der Agent den Antrag mit; ein neuer Agent erklärt schriftlich, dass er das Amt annimmt (§ 605.0114)." },
        { titel: "Antrag mit allen Angaben", text: "Florida verlangt Name, Anschrift des Hauptsitzes und Postanschrift, Gründungsdatum, EIN und mindestens eine Person, die die Gesellschaft führen darf. Alle offenen Gebühren und Strafen fallen zu den Sätzen an, die am Tag des Antrags gelten." },
        { titel: "Stand bei der IRS klären", text: "Welche Jahre fehlen, an welche Anschrift schreibt die IRS, wer ist als verantwortliche Person eingetragen? Änderungen meldet die Gesellschaft mit Form 8822-B; ein Wechsel der verantwortlichen Person muss der IRS binnen sechzig Tagen vorliegen." },
        { titel: "Meldungen nachholen", text: `Fehlende Form 5472 mit Pro-forma-Form 1120 für jedes offene Jahr, jeweils mit einer Begründung. Danach steht jeder Termin im Fristenkalender: der Jahresbericht beim Staat und Form 5472 zum ${IRS.frist5472}.` },
      ],
    },
    {
      typ: "text", id: "agent", h2: "Registered Agent gekündigt: was jetzt zählt",
      absaetze: [
        "Tritt ein Registered Agent zurück, reicht er beim Staat eine Erklärung ein. In Florida schickt er der Gesellschaft eine Kopie an ihre aktuelle Postanschrift; sein Amt endet am 31. Tag nach der Eintragung oder früher, sobald ein Nachfolger eingetragen ist (§ 605.0115). In Delaware muss er die Gesellschaft mindestens dreißig Tage vor der Einreichung schriftlich benachrichtigen (§ 18-104(d)). Liegt die Postanschrift beim alten Dienst selbst, kann die Nachricht den Inhaber verfehlen.",
        "Ohne Agent läuft die Zeit gegen die Gesellschaft. In Florida ist der fehlende Agent ein eigener Grund für die Auflösung von Amts wegen. In Delaware wird die LLC gelöscht, wenn nicht binnen dreißig Tagen nach Eintragung des Rücktritts ein neuer Agent benannt ist (§ 18-104(d)). Löst Wyoming die LLC deshalb auf, kostet die Wiederherstellung 350 $ statt 100 $.",
        "Der Wechsel selbst ist einfach, wenn er rechtzeitig geschieht: Der neue Agent nimmt das Amt schriftlich an, die Gesellschaft reicht die Änderung beim Staat ein — in Florida mit einem Statement of Change. Den alten Dienst beenden Sie erst danach. Zugleich gehört die Anschrift bei der IRS auf den neuen Stand, damit Schreiben der Behörde Sie erreichen.",
      ],
    },
    {
      typ: "text", id: "form5472", h2: "Form 5472 nachholen: Strafe, Begründung, Verjährung",
      absaetze: [
        `Gehört eine LLC einem einzigen Gesellschafter aus dem Ausland, meldet sie der IRS jedes Jahr ihre Geschäfte mit ihm — mit Form 5472 und einer Pro-forma-Form 1120, auch ohne Umsatz. Für jedes Jahr, in dem die Meldung fehlt, kann die IRS ${IRS.strafe5472} festsetzen, ebenso, wenn die nötigen Aufzeichnungen fehlen (26 U.S.C. § 6038A(d)). Eine wesentlich unvollständige Meldung gilt nach der Anleitung der IRS als nicht abgegeben. Bleibt die Meldung länger als 90 Tage nach einer Mitteilung der IRS aus, kommen für jeden weiteren angefangenen Zeitraum von 30 Tagen erneut 25.000 $ hinzu. Eine Obergrenze nennen weder das Gesetz noch die Anleitung der IRS.`,
        "Eine Löschung beim Staat beendet diese Pflichten nicht. Das Konto der EIN schließt die IRS erst, wenn alle nötigen Erklärungen abgegeben und alle Steuern bezahlt sind. Und solange die Angaben fehlen, läuft auch die Zeit nicht ab: Die Frist, in der die IRS Steuern für das betroffene Jahr festsetzen kann, endet frühestens drei Jahre, nachdem sie die Angaben erhalten hat; war das Versäumnis entschuldigt, gilt das nur für die damit verbundenen Posten (26 U.S.C. § 6501(c)(8)). Mit dem Warten erledigt sich eine fehlende Form 5472 also nicht.",
        "Für das Nachholen hat die IRS ein eigenes Verfahren für verspätete internationale Meldungen. Es steht offen, wer weder geprüft wird noch Gegenstand strafrechtlicher Ermittlungen ist und von der IRS zu diesen Meldungen noch nicht angeschrieben wurde. Jeder Meldung kann eine Begründung beiliegen, das Reasonable Cause Statement. Die IRS sagt dazu offen: Strafen können nach den üblichen Regeln festgesetzt werden, auch ohne dass die Begründung zunächst berücksichtigt wird; dann kann es nötig werden, auf Schreiben der IRS zu antworten und die Begründung erneut einzureichen.",
        "Ob eine Strafe entfällt, entscheidet die IRS im Einzelfall. Nach der Verordnung zu § 6038A ist ein Versäumnis entschuldigt, wenn die Gesellschaft in gutem Glauben und aus vernünftigem Grund gehandelt hat; die Tatsachen legt sie schriftlich und unter Strafandrohung für falsche Angaben dar. Für kleine Gesellschaften mit höchstens 20 Millionen US-Dollar Einnahmen im Jahr, die die Pflicht nicht kannten, kaum Bezug zu den USA haben und alle Anforderungen der IRS rasch und vollständig erfüllen, wendet die IRS diese Ausnahme großzügig an (26 CFR § 1.6038A-4(b)). Ein bestimmtes Ergebnis kann trotzdem niemand zusagen.",
        "Eingereicht wird auf Papier oder per Fax: Eine LLC in ausländischer Hand kann Form 5472 nicht elektronisch abgeben. Auf die Pro-forma-Form 1120 gehört oben der Vermerk „Foreign-owned U.S. DE“, ausgefüllt werden nur Name, Anschrift und die Felder B und E. Im letzten Jahr wird in Feld E „Final return“ angekreuzt.",
      ],
    },
    {
      typ: "etappen", id: "aufloesen", h2: "US-LLC auflösen: die Reihenfolge, die hält",
      lead: "Eine saubere Auflösung schließt drei Akten: die beim Bundesstaat, die bei der IRS und die bei Ihrem Finanzamt zu Hause. Die Reihenfolge entscheidet, ob am Ende etwas offen bleibt.",
      etappen: [
        { titel: "Bestandsaufnahme", text: "Status im Register, offene Jahresberichte und Gebühren, fehlende Meldungen bei der IRS, Konten, Händlerkonten und laufende Verträge auf den Namen der Gesellschaft." },
        { titel: "Beschluss und Abwicklung", text: "Die Gesellschafter beschließen die Auflösung nach dem Operating Agreement. Dann wird abgewickelt: Forderungen einziehen, Verbindlichkeiten begleichen, Konten schließen, das restliche Vermögen an die Gesellschafter verteilen." },
        { titel: "Meldungen bei der IRS", text: "Alle offenen Jahre nachholen, die Erklärung für das letzte Jahr als Schlusserklärung abgeben. Hat die LLC mehrere Gesellschafter, gibt sie Form 1065 als Schlusserklärung ab, mit einem „final K-1“ für jeden Gesellschafter. Ist sie per Form 8832 als Corporation eingeordnet, kommt Form 966 hinzu." },
        { titel: "Auflösung beim Staat", text: "In Florida Articles of Dissolution (§ 605.0707), in Wyoming Articles of Dissolution, in Delaware nach abgeschlossener Abwicklung das Certificate of Cancellation (§ 18-203), dort zusammen mit der Jahressteuer bis einschließlich des laufenden Jahres (§ 18-1107). Ist die Gesellschaft schon von Amts wegen aufgelöst, klären wir vorab beim Bundesstaat und, wo nötig, mit einem Partner-Anwalt, welcher Weg offensteht." },
        { titel: "Konto der EIN schließen", text: "Ein Brief an die IRS in Cincinnati, OH 45999, mit vollständigem Namen der Gesellschaft, EIN, Anschrift und Grund, dazu eine Kopie des Schreibens, mit dem die EIN vergeben wurde, falls es noch vorliegt. Die IRS schließt das Konto erst, wenn alle nötigen Erklärungen vorliegen und alle Steuern beglichen sind." },
        { titel: "Zu Hause abschließen", text: "Steuerliche Folgen der Auflösung klären, die Mitteilung nach § 138 AO abgeben und alle Unterlagen aufbewahren — für die Fristen in den USA und zu Hause." },
      ],
    },
    {
      typ: "text", id: "dach", h2: "Die Folgen in Deutschland, Österreich und der Schweiz",
      absaetze: [
        "Was für die Gründung galt, gilt auch für das Ende. Eine US-Gesellschaft, die aus dem deutschsprachigen Raum geführt wird, ist dort steuerpflichtig — in Deutschland, weil der Ort der Geschäftsleitung hier liegt (§ 10 AO) und die Gesellschaft dann unbeschränkt körperschaftsteuerpflichtig sein kann (§ 1 KStG). Ihre Auflösung ist deshalb kein rein amerikanischer Vorgang.",
        "Auch die Mitteilung an das Finanzamt kennt das Ende. Nach § 138 Abs. 2 Satz 1 Nr. 2 AO ist die Aufgabe einer Beteiligung an einer ausländischen Personengesellschaft mitzuteilen; Nr. 3 erfasst Erwerb und Veräußerung von Beteiligungen an ausländischen Körperschaften, wenn damit eine Beteiligung von mindestens 10 Prozent erreicht wird oder die Anschaffungskosten aller Beteiligungen 150.000 Euro übersteigen. Die Mitteilung gehört zur Steuererklärung des Jahres, spätestens 14 Monate nach dessen Ablauf (§ 138 Abs. 5 AO).",
        "Steuerlich kommt es darauf an, wie das Finanzamt die LLC einordnet: als Kapitalgesellschaft oder als Personengesellschaft, nach einem Typenvergleich; die Wahl der Einordnung in den USA entscheidet darüber nicht (BMF-Schreiben vom 19.03.2004). Gilt sie als Kapitalgesellschaft, gilt ihre Auflösung für einen Gesellschafter, der die Anteile privat hält und in den letzten fünf Jahren mit mindestens 1 Prozent beteiligt war, als Veräußerung (§ 17 Abs. 1 und 4 EStG). Gilt sie als Personengesellschaft mit Gewerbebetrieb, kann die Abwicklung als Aufgabe des Betriebs zu versteuern sein (§ 16 Abs. 3 EStG). In Österreich und der Schweiz gelten eigene Regeln.",
        "Was im Einzelfall gilt, klärt unser Partner-Steuerberater mit Ihnen, bevor die Auflösung beim Staat eingereicht wird. Eine Auflösung, die zu Hause niemand kennt, ist nur zur Hälfte erledigt.",
      ],
    },
    {
      typ: "karten", id: "wege", h2: "Retten, übergeben oder auflösen?", spalten: 3,
      karten: [
        { tag: "Retten", titel: "Die Gesellschaft wird noch gebraucht", text: "Ein Konto, ein Händlerkonto, Verträge oder eine Marke hängen an ihr. Dann zuerst Agent und Status sichern, danach die Meldungen nachholen." },
        { tag: "Übergeben", titel: "Sie soll weiterlaufen, ohne den alten Dienst", text: "Neuer Registered Agent per Änderungsmeldung, neue Anschrift bei der IRS, ein Fristenkalender — und jemand, der jedes Jahr daran denkt." },
        { tag: "Auflösen", titel: "Sie hat keinen Zweck mehr", text: "Erst offene Meldungen und Gebühren, dann die Abwicklung, dann die Auflösung beim Staat und der Brief an die IRS. Nichts tun ist keine Auflösung." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global Ihre bestehende LLC",
      absaetze: [
        "FIAON Global ist eine Unternehmensberatung für Unternehmer aus Deutschland, Österreich und der Schweiz mit einer US-Gesellschaft. Unser Grundsatz gilt auch für eine Gesellschaft, die anderswo gegründet wurde: ein Ansprechpartner statt acht. Sie geben uns, was Sie haben — Gründungsunterlagen, das Schreiben zur EIN, Post der IRS und des Bundesstaats —, und wir übernehmen die Wege zu Bundesstaat und IRS.",
        "Zuerst prüfen wir: Status im Register, Registered Agent, offene Jahresberichte und Gebühren, welche Jahre bei der IRS fehlen, an welche Anschrift die IRS schreibt und welche Konten und Plattformen an der Gesellschaft hängen. Das Ergebnis erhalten Sie schriftlich — die Wege, die offenstehen, die Gebühren des Staats und unser Festpreis —, bevor irgendetwas eingereicht wird. Die rechtlichen und steuerlichen Folgen jedes Weges klären Partner-Anwalt und Partner-Steuerberater in Ihrem Mandat.",
        "Dann holen wir nach. Mit Ihrer Vollmacht stellen wir die Anträge für Sie: Wiederherstellung, Wechsel des Registered Agent, nachzuholende Jahresberichte, Änderungen bei der IRS mit Form 8822-B. Die offenen Form 5472 mit Pro-forma-Form 1120 erstellt unser US-CPA in Ihrem Mandat, mit einer Begründung für jedes Jahr; die Folgen zu Hause klärt unser Partner-Steuerberater. Partner-Steuerberater, US-CPA und Partner-Anwälte arbeiten auf Ihr Mandat, ihre Honorare für die vereinbarten Leistungen sind im Festpreis enthalten.",
        "Soll die Gesellschaft gehen, lösen wir sie sauber auf: Abwicklung nach Plan, Auflösung beim Staat — erst auf Ihre Weisung in Textform —, Schlusserklärung bei der IRS und der Brief zum Konto der EIN. Konten bei Banken und Zahlungsplattformen schließen Sie selbst; wir bereiten jeden Schritt dafür vor. Jedes Dokument und jedes Schreiben der Behörden liegt danach in Ihrem Dokumentenraum.",
        "Vertragspartner ist die FIAON LTD in London; unser Team vor Ort in Miami nimmt Termine für Sie wahr, Zürich ist unser Partnerstandort. Soll die Gesellschaft weiterlaufen, halten wir auf Wunsch jedes Jahr Fristen und Meldungen im Blick — über die Jahresbetreuung, freiwillig und ohne automatische Verlängerung.",
      ],
    },
    { typ: "paket", id: "paket", h2: "Neu beginnen, sauber aufgestellt", lead: "Wer nach der Bereinigung neu gründen will: Gesellschaft, EIN, Vorbereitung der ITIN, Registered Agent, US-Adresse und US-Telefon im ersten Jahr und die erste jährliche US-Meldung durch unseren US-CPA — Global Struktur.", paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Eine Löschung beim Staat beendet offene Pflichten bei der IRS nicht. Fehlende Form 5472 bleiben offen, und die Frist für eine Festsetzung endet frühestens drei Jahre nach Eingang der Angaben.",
        "Ob die IRS eine Strafe festsetzt oder davon absieht, entscheidet allein die IRS. Eine Begründung kann helfen; das Ergebnis kann niemand zusagen.",
        "Über die Wiederherstellung entscheidet der Bundesstaat. In Wyoming ist sie nach zwei Jahren ausgeschlossen, in Florida kann ein inzwischen vergebener Name einen neuen Namen nötig machen.",
        "FIAON verfügt nicht über Konten und Guthaben Ihrer Gesellschaft. Konten bei Banken und Zahlungsplattformen schließen Sie selbst.",
        `${GLOBAL_ROLLEN.de.fiaon} Was im Einzelfall rechtlich und steuerlich gilt, klären Partner-Anwalt und Partner-Steuerberater in Ihrem Mandat.`,
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
      ],
    },
  ],
  fragen: [
    { f: "Wie löse ich eine US-LLC auf?", a: "In drei Schritten: offene Jahresberichte, Gebühren und Meldungen nachholen und die Gesellschaft abwickeln; dann die Auflösung beim Bundesstaat einreichen — in Florida und Wyoming Articles of Dissolution, in Delaware ein Certificate of Cancellation —; zuletzt die Schlusserklärung bei der IRS und ein Brief, mit dem die IRS das Konto der EIN schließt." },
    { f: "Was kostet es, eine US-LLC aufzulösen?", a: "Beim Staat selbst wenig: in Florida 25 $, in Wyoming 60 $, in Delaware 220 $ und die Jahressteuer bis einschließlich des laufenden Jahres (Stand Oktober 2026). Teuer wird es, wenn Jahre fehlen: offene Jahresberichte, Gebühren und vor allem versäumte Form 5472, für die die IRS je Formular und Jahr 25.000 $ festsetzen kann." },
    { f: "Kann ich eine aufgelöste LLC reaktivieren?", a: "In vielen Fällen ja. Florida erlaubt die Wiederherstellung jederzeit, gegen 100 $ und alle offenen Gebühren; sie wirkt auf den Tag der Auflösung zurück. Wyoming lässt sie nur in den ersten zwei Jahren zu. Delaware stellt eine gelöschte LLC mit einem Certificate of Revival wieder her, für 220 $ und die offene Jahressteuer samt Strafen und Zinsen." },
    { f: "Ich habe die Form 5472 vergessen — was jetzt?", a: `Nachholen, für jedes offene Jahr mit Pro-forma-Form 1120 und einer Begründung. Wer von der IRS dazu noch nicht angeschrieben wurde, nicht geprüft wird und gegen den nicht ermittelt wird, kann das Verfahren der IRS für verspätete internationale Meldungen nutzen. Die Strafe von ${IRS.strafe5472} kann trotzdem festgesetzt werden; über die Begründung entscheidet die IRS.` },
    { f: "Muss ich die EIN löschen lassen, wenn ich die LLC auflöse?", a: "Die EIN bleibt nach den Worten der IRS die dauerhafte Steuernummer der Gesellschaft. Geschlossen wird ihr Konto bei der IRS: per Brief mit Name, EIN, Anschrift und Grund an die IRS in Cincinnati. Das geht erst, wenn alle Erklärungen vorliegen und alle Steuern beglichen sind." },
    { f: "Mein Registered Agent hat gekündigt — was nun?", a: "Rasch einen neuen Agent benennen. In Florida endet das Amt des alten Agent am 31. Tag nach Eintragung seines Rücktritts; ohne Agent droht die Auflösung von Amts wegen. In Delaware wird die LLC gelöscht, wenn nicht binnen dreißig Tagen ein Nachfolger eingetragen ist. Der neue Agent nimmt das Amt schriftlich an, die Gesellschaft meldet den Wechsel beim Staat." },
    { f: "Was muss ich in Deutschland melden, wenn ich die LLC auflöse?", a: "Das hängt von der Einordnung ab. Die Aufgabe einer Beteiligung an einer ausländischen Personengesellschaft ist nach § 138 Abs. 2 AO mitzuteilen, ebenso die Veräußerung einer Beteiligung an einer ausländischen Körperschaft ab den gesetzlichen Schwellen — mit der Steuererklärung, spätestens 14 Monate nach Ablauf des Jahres. Die steuerlichen Folgen klärt der Partner-Steuerberater vorab." },
    { f: "Übernimmt FIAON Global auch eine LLC, die woanders gegründet wurde?", a: "Ja. Wir prüfen zuerst Register, Registered Agent und den Stand bei der IRS und nennen Ihnen schriftlich die Wege und einen Festpreis. Danach stellen wir mit Ihrer Vollmacht die Anträge, unser US-CPA holt offene Meldungen in Ihrem Mandat nach, und eine Auflösung reichen wir erst auf Ihre Weisung in Textform ein." },
  ],
  paket: "global_struktur",
  weiter: ["/business/wissen/form-5472", "/business/wissen/registered-agent-adresse", "/business/wissen/us-llc-wohnsitz-deutschland", "/business/wissen/nachteile-us-llc"],
  quellen: [
    Q.floridaAufloesung,
    QUELLEN.fl0715,
    QUELLEN.fl0707,
    QUELLEN.fl0114,
    QUELLEN.fl0115,
    QUELLEN_STAATEN.florida[0],
    QUELLEN_STAATEN.florida[1],
    QUELLEN_STAATEN.florida[2],
    QUELLEN_STAATEN.wyoming[0],
    QUELLEN_STAATEN.wyoming[1],
    QUELLEN_STAATEN.delaware[0],
    QUELLEN_STAATEN.delaware[1],
    Q.delawareAgent,
    QUELLEN.deAufloesung,
    QUELLEN.de510,
    Q.i5472,
    Q.i1120,
    QUELLEN.usc6038A,
    QUELLEN.cfr6038A4,
    QUELLEN.usc6501,
    QUELLEN.irsNachholen,
    QUELLEN.irsSchliessen,
    Q.f8822b,
    Q.ao138,
    QUELLEN.ao10,
    QUELLEN.kstg1,
    QUELLEN.estg17,
    QUELLEN.estg16,
    QUELLEN.bmf2004,
  ],
};
