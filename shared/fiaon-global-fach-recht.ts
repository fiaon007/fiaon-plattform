// ═══════════════════════════════════════════════════════════════════════════
// RECHT & VERTRÄGE — Verzeichnis und Vorlagen des Global-Portals (E-341, 12.10.2026)
//
// Zwei Teile:
//   FACH_RECHT_KAPITEL — zwölf Kapitel allgemeiner Rechtsinformation (Deutsch,
//                        „Sie“), gruppiert nach „Ihre LLC“, „Verträge“,
//                        „Bank & Behörden“, „Schutz & Pflichten“.
//   FACH_VORLAGEN      — acht englische Standardvorlagen für eine Ein-Personen-
//                        LLC (gebaut für Florida), vorbelegt aus der Akte,
//                        zum Selbstausfüllen, als PDF und mit E-Unterschrift.
//
// RAHMEN: FIAON ist keine Kanzlei. Erlaubt sind allgemeine Information und ein
// Vertragsgenerator (BGH I ZR 113/20 „Smartlaw“); der Einzelfall geht über
// „Einzelfall prüfen lassen“ an FIAON. Gebühren nennen wir nie als Zahl,
// sondern „laut Sunbiz“ — sie ändern sich, die Quelle bleibt.
//
// PRÜFSTAND: npx tsx scripts/pruef-global-fach.ts (Wortwand + Global-Regeln
// für jeden deutschen Satz; Platzhalter ↔ Felder; Vorlagentext nur in der
// PDF-Schrift: Latin-1 plus “ ” ‘ ’ – — … • €).
// ═══════════════════════════════════════════════════════════════════════════
import type { FachKapitel, FachVorlage, FachVorlageFeld } from "./fiaon-global-fach";

const STAND = "Stand: Oktober 2026";
const FL = "https://www.flsenate.gov/Laws/Statutes/2025";
const SUNBIZ = { titel: "Sunbiz — Florida Division of Corporations", url: "https://dos.fl.gov/sunbiz/" };
const EINZELFALL = "Für Ihren Einzelfall: „Einzelfall prüfen lassen“.";

// ═══════════════════════════════════════════════════════════════════════════
// (A) DAS VERZEICHNIS — zwölf Kapitel
// ═══════════════════════════════════════════════════════════════════════════
export const FACH_RECHT_KAPITEL: FachKapitel[] = [
  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    id: "florida-llc-ueberblick",
    bereich: "recht",
    gruppe: "Ihre LLC",
    titel: "Die Florida-LLC im Überblick",
    kurz: "Was eine Florida-LLC rechtlich ist, wer darin welche Rolle hat und wie die Trennung zwischen Firmen- und Privatvermögen funktioniert.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Das Gesetz dahinter",
        absaetze: [
          "Eine Limited Liability Company (LLC) ist eine eigenständige Gesellschaft des US-Bundesstaats, in dem sie gegründet wurde. Für Florida regelt das der Florida Revised Limited Liability Company Act, Chapter 605 der Florida Statutes. Das Gesetz gilt seit dem 1. Januar 2015 für alle Florida-LLCs, auch für ältere.",
          "Die LLC entsteht mit der Einreichung der Articles of Organization bei der Division of Corporations des Florida Department of State, bekannt unter dem Namen Sunbiz. Dort steht sie öffentlich mit Dokumentnummer, Hauptadresse, Registered Agent und den eingetragenen vertretungsberechtigten Personen. Was im Inneren gilt — wer entscheidet, wer Gewinne erhält, was beim Ausscheiden passiert —, regelt das Operating Agreement, ein privater Vertrag, der nicht beim Staat liegt.",
          "Der Name muss den Zusatz „Limited Liability Company“, „LLC“ oder „L.L.C.“ tragen (§ 605.0112). Im Geschäftsverkehr verwenden Sie den Namen genau so, wie er auf Sunbiz steht — auf Rechnungen, Verträgen, der Website und gegenüber Banken.",
        ],
      },
      {
        titel: "Member und Manager",
        absaetze: [
          "Member ist, wem die LLC gehört — bei Ihrer Ein-Personen-LLC sind das allein Sie. Manager ist, wer die Geschäfte führt. Beide Rollen können bei derselben Person liegen, müssen es aber nicht.",
        ],
        liste: [
          "Member-managed: Die Mitglieder führen die LLC selbst. Das ist nach Chapter 605 der Normalfall, wenn Articles oder Operating Agreement nicht ausdrücklich etwas anderes bestimmen",
          "Manager-managed: Ein oder mehrere Manager führen die Geschäfte; die Mitglieder behalten Mitsprache bei grundlegenden Fragen, deren Einzelheiten das Operating Agreement regelt",
          "Auf Sunbiz erscheinen die vertretungsberechtigten Personen mit Kürzeln, etwa MGR für Manager oder AMBR für Authorized Member",
        ],
        merke: "Die Rolle auf Sunbiz, im Operating Agreement und unter Ihrer Unterschrift sollte dieselbe sein — Banken vergleichen genau das.",
      },
      {
        titel: "Die Trennung der Haftung — und ihre Grenzen",
        absaetze: [
          "Nach § 605.0304 haftet für Schulden der LLC grundsätzlich nur die LLC. Ein Member oder Manager haftet nicht schon deshalb persönlich, weil er Member oder Manager ist. Das ist der Kern des Modells.",
          "Diese Trennung hält nur, wenn Sie sie im Alltag leben. Gerichte in Florida können sie in Ausnahmefällen durchbrechen, etwa wenn die LLC nur als Werkzeug für unredliches Handeln dient. Typische Warnzeichen sind vermischte Konten, fehlende Unterlagen und Verträge, die privat statt im Namen der LLC geschlossen wurden.",
          "Persönlich haften Sie außerdem immer für eigenes Fehlverhalten, für persönlich unterschriebene Bürgschaften und für Erklärungen, die Sie ausdrücklich im eigenen Namen abgeben.",
        ],
        liste: [
          "Ein eigenes Geschäftskonto nur für die LLC",
          "Verträge, Rechnungen und Website immer mit dem vollen LLC-Namen",
          "Wichtige Entscheidungen schriftlich festhalten",
          "Einlagen und Entnahmen sauber buchen statt Geld formlos hin- und herzuschieben",
        ],
      },
      {
        titel: "Besonderheiten der Ein-Personen-LLC",
        absaetze: [
          "Für Gläubiger eines Mitglieds sieht Florida beim Zugriff auf LLC-Anteile die sogenannte Charging Order vor: Der Gläubiger erhält Ausschüttungen, die sonst an das Mitglied gingen. Bei einer LLC mit nur einem Mitglied kann ein Gericht nach § 605.0503 unter bestimmten Voraussetzungen weitergehen und den Verkauf des Anteils anordnen. Die Trennung zwischen Firmenschulden und Privatvermögen bleibt davon unberührt — es geht um den umgekehrten Fall, die privaten Schulden des Inhabers.",
          "Steuerlich wird eine Ein-Personen-LLC in den USA standardmäßig anders behandelt als eine Kapitalgesellschaft. Was das für Sie und Ihr Heimatland bedeutet, erklärt der Bereich „Steuern & Pflichten“; für Ihre konkreten Erklärungen ist Ihre Steuerkanzlei zuständig.",
        ],
      },
    ],
    umsetzen: [
      "Rufen Sie Ihre LLC in der Sunbiz-Suche auf und prüfen Sie Name, Dokumentnummer, Adressen und Registered Agent.",
      "Prüfen Sie, mit welchem Titel Sie dort eingetragen sind, zum Beispiel MGR oder AMBR.",
      "Legen Sie Articles of Organization, EIN-Bestätigung und Operating Agreement zusammen im Tresor ab.",
      "Wickeln Sie alle Zahlungen der LLC ausschließlich über das Geschäftskonto ab.",
      "Halten Sie wichtige Entscheidungen ab heute mit einem Written Consent fest — die Vorlage liegt unter „Vorlagen“.",
      EINZELFALL,
    ],
    quellen: [
      { titel: "Florida Statutes, Chapter 605 — Florida Revised Limited Liability Company Act", url: `${FL}/Chapter605` },
      { titel: "§ 605.0304 Florida Statutes — Haftung von Members und Managern", url: `${FL}/605.0304` },
      SUNBIZ,
      { titel: "Sunbiz — Firmensuche", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName" },
    ],
    stand: STAND,
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    id: "operating-agreement",
    bereich: "recht",
    gruppe: "Ihre LLC",
    titel: "Das Operating Agreement — warum es zählt, was hineingehört",
    kurz: "Der Gesellschaftsvertrag Ihrer LLC: in Florida nicht beim Staat einzureichen, für Bank, Partner und Ernstfall aber oft das wichtigste Papier.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Was es ist",
        absaetze: [
          "Das Operating Agreement ist der Gesellschaftsvertrag der LLC. Es regelt das Innenverhältnis: wem die LLC gehört, wer entscheidet, wie Gewinne verteilt werden und was bei Tod, Verkauf oder Auflösung gilt. Chapter 605 enthält dazu Grundregeln, die greifen, soweit das Operating Agreement nichts anderes bestimmt.",
          "In Florida wird das Operating Agreement nicht beim Staat eingereicht und ist nicht öffentlich. Nach der Begriffsbestimmung in § 605.0102 kann es sogar mündlich oder stillschweigend bestehen. Für die Praxis reicht das nicht: Wer etwas nachweisen muss, braucht ein unterschriebenes Dokument.",
        ],
      },
      {
        titel: "Warum es auch bei einer einzigen Person zählt",
        absaetze: [
          "Bei einer Ein-Personen-LLC wirkt ein Vertrag mit sich selbst zunächst überflüssig. Er erfüllt aber drei Aufgaben, die sonst kein Dokument erfüllt:",
        ],
        liste: [
          "Nachweis gegenüber Banken und Zahlungsdienstleistern, wem die LLC gehört und wer sie vertreten darf",
          "Beleg für die Trennung zwischen Ihnen und der LLC — ein wichtiger Baustein, falls diese Trennung je geprüft wird",
          "Klare Regeln für den Ernstfall, etwa wer bei Ihrem Tod oder Ihrer Geschäftsunfähigkeit handeln darf, damit die LLC handlungsfähig bleibt",
        ],
        merke: "Banken verlangen das Operating Agreement oft bei der Kontoeröffnung. Halten Sie eine unterschriebene Fassung als PDF im Tresor.",
      },
      {
        titel: "Was hineingehört",
        absaetze: [
          "Üblich sind bei einer Ein-Personen-LLC diese Bausteine:",
        ],
        liste: [
          "Name, Bundesstaat, Gründungsdatum und Dokumentnummer der LLC",
          "Unternehmensgegenstand — eng beschrieben oder als jede erlaubte Tätigkeit",
          "Das Mitglied mit Anschrift und Anteil, bei Ihnen hundert Prozent",
          "Einlagen und die Regel, dass keine Pflicht zu Nachschüssen besteht",
          "Zuweisung von Gewinnen und Verlusten, Regeln für Ausschüttungen",
          "Geschäftsführung: member-managed oder manager-managed, Vertretungsmacht, Bankkonten",
          "Freistellung (Indemnification) und Haftungsbeschränkung",
          "Übertragung von Anteilen, Aufnahme neuer Mitglieder, Nachfolge bei Tod oder Geschäftsunfähigkeit",
          "Auflösung, Abwicklung und anwendbares Recht",
        ],
      },
      {
        titel: "Grenzen der Vertragsfreiheit",
        absaetze: [
          "Chapter 605 lässt viel Gestaltung zu, aber nicht alles. Bestimmte Schutzregeln kann das Operating Agreement nicht aufheben, zum Beispiel kann es niemanden von der Haftung für Handeln in böser Absicht, vorsätzliches Fehlverhalten oder bewusste Gesetzesverstöße freistellen (§ 605.0105). Eine Klausel, die dagegen verstößt, bleibt insoweit ohne Wirkung.",
          "Ändert sich etwas Grundlegendes — ein zweites Mitglied, ein Verkauf, ein Wechsel zur Führung durch Manager —, passen Sie das Operating Agreement an. Ein zweites Mitglied ändert außerdem in der Regel die steuerliche Einordnung der LLC; das gehört vorher zu Ihrer Steuerkanzlei.",
        ],
      },
      {
        titel: "Die Vorlage im Portal",
        absaetze: [
          "Unter „Vorlagen“ finden Sie ein Operating Agreement für eine Ein-Personen-LLC, das mit Ihren Firmendaten vorausgefüllt ist. Sie ergänzen Unternehmensgegenstand, Einlage und die Vertrauensperson für den Ernstfall, prüfen den Text und unterschreiben im Portal. Es ist eine Standardvorlage: Gestaltungen für mehrere Mitglieder, Investoren oder besondere Gewinnverteilungen gehören in die Hände einer US-Anwaltskanzlei.",
        ],
      },
    ],
    umsetzen: [
      "Prüfen Sie, ob für Ihre LLC bereits ein unterschriebenes Operating Agreement im Tresor liegt.",
      "Falls nicht: Öffnen Sie die Vorlage „Operating Agreement für Ihre Ein-Personen-LLC“ und ergänzen Sie die offenen Felder.",
      "Gleichen Sie Ihren Titel im Vertrag mit dem Eintrag auf Sunbiz ab.",
      "Unterschreiben Sie und legen Sie das PDF im Tresor unter „Operating Agreement“ ab.",
      "Stellen Sie dazu die Anteilsbescheinigung (Certificate of Membership Interest) aus.",
      "Bei mehreren Mitgliedern, Investoren oder Besonderheiten: „Einzelfall prüfen lassen“.",
    ],
    quellen: [
      { titel: "§ 605.0105 Florida Statutes — Operating Agreement: Inhalt und Grenzen", url: `${FL}/605.0105` },
      { titel: "§ 605.0102 Florida Statutes — Begriffsbestimmungen", url: `${FL}/605.0102` },
      { titel: "IRS — Single Member Limited Liability Companies", url: "https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies" },
    ],
    stand: STAND,
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    id: "registered-agent",
    bereich: "recht",
    gruppe: "Bank & Behörden",
    titel: "Der Registered Agent — Aufgaben, Wechsel, amtliche Post",
    kurz: "Ihre offizielle Zustellanschrift in Florida: was der Registered Agent tut, warum er nie fehlen darf und wie ein Wechsel funktioniert.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Wozu es ihn gibt",
        absaetze: [
          "Jede Florida-LLC muss dauerhaft einen Registered Agent mit einer Anschrift in Florida unterhalten (§ 605.0113). Ein Postfach reicht nicht: Es muss eine Straßenanschrift sein, unter der zu den üblichen Geschäftszeiten jemand Schriftstücke annimmt.",
          "Der Registered Agent nimmt für die LLC amtliche Schriftstücke entgegen — vor allem Klagen und gerichtliche Zustellungen (Service of Process), aber auch Schreiben von Behörden. Name und Anschrift stehen öffentlich auf Sunbiz.",
          "Registered Agent kann eine Person mit Wohnsitz in Florida oder ein dafür zugelassenes Unternehmen sein. Wer im Ausland lebt, nutzt in aller Regel einen professionellen Dienst.",
        ],
      },
      {
        titel: "Warum er nie fehlen darf",
        absaetze: [
          "Eine Zustellung an den Registered Agent gilt als Zustellung an die LLC. Eine Frist beginnt mit dieser Zustellung — auch wenn Sie selbst erst später davon erfahren. Wer Post vom Agenten liegen lässt, riskiert im schlimmsten Fall ein Versäumnisurteil gegen die LLC.",
          "Hat die LLC über längere Zeit keinen Registered Agent oder keine gültige Anschrift für ihn, kann der Staat sie administrativ auflösen (§ 605.0714).",
        ],
        merke: "Die Anschrift des Registered Agent ist die Anschrift Ihrer Gesellschaft in den Unterlagen beim Staat — nicht Ihr Lager, Ihre Kunden- oder Shop-Adresse und nicht Ihre persönliche Anschrift.",
      },
      {
        titel: "Amtliche Post richtig behandeln",
        absaetze: [
          "Nicht jede Post landet beim Agenten, und nicht jede Post, die amtlich aussieht, ist amtlich. Diese Unterscheidung hilft:",
        ],
        liste: [
          "Klagen und gerichtliche Zustellungen: sofort lesen, Frist notieren, „Einzelfall prüfen lassen“",
          "Schreiben des IRS: Formularnummer und Frist im Schreiben prüfen; viele IRS-Briefe gehen an die Anschrift aus dem EIN-Antrag, nicht an den Agenten",
          "Erinnerungen zum Annual Report: kommen von Sunbiz in der Regel per E-Mail an die hinterlegte Adresse",
          "Angebote, die wie Behördenpost aussehen: Absender genau prüfen, bevor Sie etwas bezahlen",
        ],
      },
      {
        titel: "Vorsicht bei amtlich wirkenden Angeboten",
        absaetze: [
          "Achten Sie besonders auf Schreiben, die Gebühren für „Compliance-Pakete“, „Certificates“ oder Registereinträge verlangen und dabei amtlich wirken. Solche Angebote kommen häufig von privaten Firmen. Der amtliche Weg zu Sunbiz führt immer über dos.fl.gov oder sunbiz.org.",
        ],
      },
      {
        titel: "Den Registered Agent wechseln",
        absaetze: [
          "Ein Wechsel ist jederzeit möglich. Die LLC reicht dazu bei Sunbiz eine Änderungserklärung ein (Statement of Change of Registered Agent); der neue Agent bestätigt darin schriftlich, dass er das Amt annimmt (§ 605.0114). Die Gebühr steht laut Sunbiz fest. Auch mit dem jährlichen Annual Report lässt sich der Agent ändern.",
          "Der Agent selbst kann sein Amt niederlegen (§ 605.0115). Dann benennt die LLC zügig einen neuen, sonst droht die administrative Auflösung.",
        ],
      },
    ],
    umsetzen: [
      "Prüfen Sie auf Sunbiz, welcher Registered Agent für Ihre LLC eingetragen ist.",
      "Bei FIAON Global liegen Zustellungen und Behördenpost in der Regel innerhalb eines Tages eingescannt in Ihrem Tresor unter „Eingegangene Post“.",
      "Hinterlegen Sie bei Sunbiz eine E-Mail-Adresse, die Sie täglich lesen.",
      "Legen Sie Zustellungen und Behördenpost sofort im Tresor unter „Eingegangene Post“ ab.",
      "Notieren Sie Fristen aus Schreiben noch am selben Tag.",
      "Bei einer Klage oder einem unklaren Schreiben: „Einzelfall prüfen lassen“.",
    ],
    quellen: [
      { titel: "§ 605.0113 Florida Statutes — Registered Agent", url: `${FL}/605.0113` },
      { titel: "§ 605.0114 Florida Statutes — Wechsel des Registered Agent", url: `${FL}/605.0114` },
      SUNBIZ,
    ],
    stand: STAND,
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    id: "beschluesse-protokolle",
    bereich: "recht",
    gruppe: "Ihre LLC",
    titel: "Beschlüsse und Protokolle — Entscheidungen festhalten",
    kurz: "Wie eine Ein-Personen-LLC ihre Entscheidungen mit einem Written Consent dokumentiert und warum das Ordnung und Schutz schafft.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Warum Sie sich selbst Beschlüsse schreiben",
        absaetze: [
          "In einer Ein-Personen-LLC entscheiden Sie allein. Trotzdem lohnt es sich, wichtige Entscheidungen schriftlich festzuhalten. Ein Beschluss zeigt, dass die LLC entschieden hat — nicht Sie als Privatperson. Das stützt die Trennung zwischen Ihnen und der Gesellschaft und beantwortet später Fragen von Bank, Steuerkanzlei oder Vertragspartnern.",
          "Eine Versammlung mit sich selbst ist nicht nötig. Üblich ist der Written Consent in Lieu of Meeting: ein schriftlicher Beschluss, den das Mitglied unterschreibt und datiert. Chapter 605 lässt Entscheidungen ohne Versammlung zu, soweit das Operating Agreement nichts anderes vorsieht.",
        ],
      },
      {
        titel: "Wofür ein Beschluss üblich ist",
        absaetze: [],
        liste: [
          "Eröffnung oder Schließung eines Geschäftskontos und Bestimmung der Zeichnungsberechtigten",
          "Abschluss größerer oder langfristiger Verträge, etwa Miet- und Leasingverträge",
          "Aufnahme eines Darlehens oder Bestellung einer Sicherheit",
          "Ausschüttungen an Sie als Mitglied",
          "Erteilung oder Widerruf einer Vollmacht",
          "Wechsel des Registered Agent, Änderung von Adresse oder Namen",
          "Aufnahme eines neuen Mitglieds, Verkauf von Anteilen oder Auflösung",
        ],
      },
      {
        titel: "Ausschüttungen: eine gesetzliche Grenze",
        absaetze: [
          "Bevor die LLC an Sie ausschüttet, gilt nach § 605.0405 eine doppelte Prüfung: Kann die LLC danach ihre Schulden bei Fälligkeit noch bezahlen? Und übersteigt ihr Vermögen danach noch ihre Verbindlichkeiten? Fällt eine der beiden Antworten negativ aus, ist die Ausschüttung unzulässig.",
          "Ein kurzer Beschluss mit diesen beiden Angaben dokumentiert, dass die Prüfung stattgefunden hat. Das ist besonders wertvoll, wenn die LLC später in Schwierigkeiten gerät und Gläubiger nachfragen.",
        ],
      },
      {
        titel: "So ist ein Written Consent aufgebaut",
        absaetze: [],
        liste: [
          "Überschrift mit Name der LLC und Bundesstaat",
          "Hinweis, dass das alleinige Mitglied ohne Versammlung beschließt",
          "Hintergrund (Whereas): warum entschieden wird",
          "Beschluss (Resolved): was genau gilt, mit Beträgen, Namen und Daten",
          "Ermächtigung, alle Schritte zur Umsetzung zu unternehmen",
          "Datum, Unterschrift, Name und Titel",
        ],
        merke: "Ein Beschluss pro Thema, klar datiert, im Tresor abgelegt — mehr Formalität braucht eine Ein-Personen-LLC in der Regel nicht.",
      },
      {
        titel: "Das Firmenbuch",
        absaetze: [
          "Chapter 605 verlangt, dass die LLC bestimmte Unterlagen aufbewahrt, etwa die Articles of Organization, das Operating Agreement und Angaben zu den Mitgliedern (§ 605.0410). Üblich ist ein digitales Firmenbuch mit Articles, Operating Agreement, Anteilsbescheinigung, Beschlüssen, Annual Reports und Steuerunterlagen. Der Tresor im Portal kann diese Rolle übernehmen — vorausgesetzt, Sie legen jedes Dokument dort ab, sobald es unterschrieben ist.",
        ],
      },
    ],
    umsetzen: [
      "Legen Sie im Tresor eine Ablage für Beschlüsse an und nummerieren Sie sie fortlaufend.",
      "Halten Sie Ihre Kontoeröffnung mit dem Bankbeschluss (Banking Resolution) fest, falls das noch nicht geschehen ist.",
      "Nutzen Sie für jede größere Entscheidung die Vorlage „Written Consent“.",
      "Dokumentieren Sie vor jeder Ausschüttung kurz die Zahlungsfähigkeit der LLC.",
      "Unterschreiben Sie jeden Beschluss mit Datum, Name und Titel.",
      "Bei Darlehen, Sicherheiten oder neuen Mitgliedern: „Einzelfall prüfen lassen“.",
    ],
    quellen: [
      { titel: "§ 605.0405 Florida Statutes — Grenzen für Ausschüttungen", url: `${FL}/605.0405` },
      { titel: "§ 605.0410 Florida Statutes — Aufzubewahrende Unterlagen", url: `${FL}/605.0410` },
      { titel: "Florida Statutes, Chapter 605", url: `${FL}/Chapter605` },
    ],
    stand: STAND,
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    id: "richtig-unterschreiben",
    bereich: "recht",
    gruppe: "Verträge",
    titel: "Richtig unterschreiben als LLC",
    kurz: "Wie Sie so unterschreiben, dass die LLC verpflichtet wird und nicht Sie persönlich — und wie Sie Ihre Vertretungsmacht belegen.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Der Grundsatz",
        absaetze: [
          "Eine LLC kann nicht selbst unterschreiben. Für sie handelt ein Mensch mit Vertretungsmacht. Damit klar ist, dass die LLC Vertragspartei ist und nicht Sie, gehören immer drei Dinge in den Unterschriftsblock: der volle Name der LLC, Ihre Unterschrift und Ihr Name mit Titel.",
          "Ein üblicher Unterschriftsblock sieht so aus:",
        ],
        liste: [
          "XYZ Holdings LLC, a Florida limited liability company",
          "By: (Unterschrift)",
          "Name: Max Mustermann",
          "Title: Manager",
        ],
        merke: "Im Fließtext lautet die kurze Form „Max Mustermann, Manager of XYZ Holdings LLC“. Entscheidend sind die Wörter „By“ und „of“ — sie zeigen, dass Sie für die LLC handeln.",
      },
      {
        titel: "Welcher Titel der richtige ist",
        absaetze: [
          "Der Titel folgt aus Sunbiz und Operating Agreement. In einer member-managed LLC handelt das Mitglied selbst; üblich sind „Sole Member“, „Managing Member“ oder „Authorized Member“. In einer manager-managed LLC unterschreibt der Manager als „Manager“. Viele Florida-LLCs führen ihr einziges Mitglied auf Sunbiz zusätzlich als MGR — dann ist auch „Manager“ stimmig.",
          "Titel wie „CEO“ oder „President“ sind bei einer LLC möglich, wenn das Operating Agreement sie vorsieht. Ohne diese Grundlage fragen Banken und Vertragspartner nach. Titel auf Sunbiz, im Operating Agreement und unter der Unterschrift gleichen — das erspart Rückfragen.",
        ],
      },
      {
        titel: "Typische Fehler",
        absaetze: [],
        liste: [
          "Unterschrift nur mit dem eigenen Namen, ohne LLC-Namen: Der Vertragspartner kann geltend machen, Sie hätten persönlich unterschrieben",
          "Abgekürzter oder falscher Firmenname, etwa ohne „LLC“",
          "Persönliche Bürgschaft im Kleingedruckten: Viele Miet-, Leasing- und Kartenverträge enthalten eine persönliche Haftung des Inhabers, die auch bei korrekter Unterschrift für die LLC gilt",
          "Privatanschrift statt Geschäftsanschrift im Vertragskopf",
        ],
      },
      {
        titel: "Vertretungsmacht nachweisen",
        absaetze: [
          "Banken, Behörden und Geschäftspartner möchten oft sehen, dass Sie die LLC vertreten dürfen. Nach § 605.04074 handelt in einer member-managed LLC jedes Mitglied als Vertreter der Gesellschaft; im Detail regelt es das Operating Agreement. Üblich sind diese Nachweise:",
        ],
        liste: [
          "Certificate of Incumbency: bestätigt, wer Mitglied oder Manager ist, mit Musterunterschrift",
          "Banking Resolution: Beschluss, der bestimmte Personen für Konten zeichnungsberechtigt macht",
          "Sunbiz-Auszug oder Certificate of Status: amtliche Bestätigung, dass die LLC aktiv ist",
          "Operating Agreement: die Vertretungsmacht im Detail",
        ],
      },
      {
        titel: "Unterlagen für Europa und elektronische Unterschrift",
        absaetze: [
          "Für die Verwendung in Deutschland, Österreich oder der Schweiz verlangen manche Stellen eine notarielle Beglaubigung und eine Apostille nach dem Haager Übereinkommen. Für in Florida ausgestellte oder beglaubigte Urkunden erteilt das Florida Department of State die Apostille.",
          "Elektronische Unterschriften sind in den USA nach dem Bundesgesetz ESIGN Act und in Florida nach dem Uniform Electronic Transaction Act (§ 668.50) grundsätzlich wirksam. Ausnahmen gelten für einzelne Dokumentarten, etwa Testamente. Wo eine Stelle ausdrücklich Tinte oder Notar verlangt, gilt deren Vorgabe.",
        ],
      },
    ],
    umsetzen: [
      "Speichern Sie Ihren Unterschriftsblock als Textbaustein: LLC-Name, By, Name, Title.",
      "Prüfen Sie, mit welchem Titel Sie auf Sunbiz stehen, und verwenden Sie genau diesen.",
      "Erstellen Sie ein Certificate of Incumbency mit der Vorlage im Portal.",
      "Lesen Sie vor jeder Unterschrift, ob der Vertrag eine persönliche Haftung enthält.",
      "Klären Sie bei Unterlagen für Europa vorab, ob Notar und Apostille nötig sind.",
      "Bei Unsicherheit über Ihre Vertretungsmacht: „Einzelfall prüfen lassen“.",
    ],
    quellen: [
      { titel: "§ 605.04074 Florida Statutes — Vertretungsmacht von Members und Managern", url: `${FL}/605.04074` },
      { titel: "§ 668.50 Florida Statutes — Uniform Electronic Transaction Act", url: `${FL}/668.50` },
      SUNBIZ,
    ],
    stand: STAND,
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    id: "vertraege-grundbausteine",
    bereich: "recht",
    gruppe: "Verträge",
    titel: "Verträge mit Kunden und Lieferanten — die Grundbausteine",
    kurz: "Welche Klauseln in einen tragfähigen Geschäftsvertrag gehören und worauf Sie bei Vertragspartnern in Europa achten.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Warum schriftlich",
        absaetze: [
          "Viele Verträge sind auch mündlich wirksam. Nützlich wird ein Vertrag aber erst schriftlich: Er hält fest, was genau geschuldet ist, und gibt Ihnen im Streitfall eine Grundlage. Manche Geschäfte verlangen ohnehin die Schriftform — in Florida etwa Vereinbarungen, die sich nicht innerhalb eines Jahres erfüllen lassen (Statute of Frauds, § 725.01).",
        ],
      },
      {
        titel: "Die Bausteine",
        absaetze: [],
        liste: [
          "Parteien: volle Namen, Rechtsform, Anschrift — für Ihre LLC mit dem Zusatz „a Florida limited liability company“",
          "Leistung: was genau geliefert oder erbracht wird, gern als Anlage (Statement of Work)",
          "Vergütung und Zahlung: Betrag, Währung, Fälligkeit, Verzug, Auslagen",
          "Laufzeit und Kündigung: ordentliche Kündigung, Kündigung aus wichtigem Grund, Folgen",
          "Rechte an Arbeitsergebnissen (Intellectual Property): wem was gehört und wann es übergeht",
          "Gewährleistung und Haftungsbegrenzung: welche Zusagen gelten, Höchstbetrag, Ausschluss von Folgeschäden",
          "Vertraulichkeit",
          "Rechtswahl und Gerichtsstand",
          "Schlussklauseln: vollständige Vereinbarung, Änderungen nur schriftlich, Abtretung, Mitteilungen",
        ],
        merke: "Ein guter Vertrag beantwortet vier Fragen ohne Auslegung: Wer schuldet was, bis wann, zu welchem Preis — und was passiert, wenn es schiefgeht.",
      },
      {
        titel: "Haftungsbegrenzung",
        absaetze: [
          "US-Verträge begrenzen die Haftung üblicherweise auf einen Höchstbetrag, oft die Vergütung eines bestimmten Zeitraums, und schließen Folgeschäden wie entgangenen Gewinn aus. Solche Klauseln stehen meist in Großbuchstaben, weil deutlich erkennbare Klauseln vor Gericht eher Bestand haben. Für Vorsatz und grobes Fehlverhalten lässt sich die Haftung in der Regel nicht ausschließen.",
        ],
      },
      {
        titel: "Rechtswahl und Gerichtsstand",
        absaetze: [
          "Die Rechtswahl bestimmt, welches Recht für den Vertrag gilt; der Gerichtsstand, wo gestritten wird. Für Ihre LLC liegt Florida-Recht mit einem Gericht in Florida nahe. Alternativ lässt sich ein Schiedsverfahren vereinbaren, dessen Spruch sich nach dem New Yorker Übereinkommen in vielen Staaten vollstrecken lässt.",
          "Bei Verbrauchern in der EU hat die Rechtswahl Grenzen: Nach Art. 6 der Rom-I-Verordnung verliert ein Verbraucher, an den Sie Ihr Angebot gezielt richten, nicht den Schutz der zwingenden Regeln seines Heimatrechts, und er kann in vielen Fällen an seinem Wohnsitz klagen. Widerrufsrecht und Informationspflichten gelten dann trotz Florida-Klausel. Für die Schweiz gelten eigene, ähnliche Regeln.",
          "Kaufen oder verkaufen Sie Waren zwischen Unternehmen aus verschiedenen Vertragsstaaten, etwa den USA und Deutschland, gilt automatisch das UN-Kaufrecht (CISG), sofern der Vertrag es nicht ausdrücklich ausschließt. Wer das nicht möchte, schreibt den Ausschluss hinein.",
        ],
      },
    ],
    umsetzen: [
      "Nutzen Sie die Vorlage „Dienstleistungsvertrag (Services Agreement)“ als Ausgangspunkt.",
      "Beschreiben Sie die Leistung so konkret, dass ein Dritter sie prüfen könnte.",
      "Legen Sie Zahlungsziel, Währung und Verzugsfolgen fest.",
      "Lesen Sie bei jedem fremden Vertrag zuerst Haftung, Kündigung, Rechtswahl und Gerichtsstand.",
      "Klären Sie bei Verbrauchern in der EU Widerrufsrecht und Informationspflichten.",
      "Unterschreiben Sie immer im Namen der LLC mit vollständigem Unterschriftsblock.",
      "Bei hohem Auftragswert oder ungewöhnlichen Klauseln: „Einzelfall prüfen lassen“.",
    ],
    quellen: [
      { titel: "Rom-I-Verordnung (EG) Nr. 593/2008 — anwendbares Recht für vertragliche Schuldverhältnisse", url: "https://eur-lex.europa.eu/eli/reg/2008/593/oj" },
      { titel: "Verbraucherrechte-Richtlinie 2011/83/EU", url: "https://eur-lex.europa.eu/eli/dir/2011/83/oj" },
      { titel: "§ 725.01 Florida Statutes — Statute of Frauds", url: `${FL}/725.01` },
    ],
    stand: STAND,
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    id: "vertraulichkeit-nda",
    bereich: "recht",
    gruppe: "Verträge",
    titel: "Vertraulichkeit (NDA) — wann und wie",
    kurz: "Wann eine Geheimhaltungsvereinbarung sinnvoll ist, was hineingehört und wo ihre Grenzen liegen.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Wann eine NDA sinnvoll ist",
        absaetze: [
          "Eine Non-Disclosure Agreement (NDA) schützt Informationen, die Sie oder Ihr Gegenüber vor einem möglichen Geschäft offenlegen: Preise, Kundenlisten, Technik, Pläne, Zahlen. Sinnvoll ist sie, bevor Sie solche Informationen teilen — nicht danach.",
        ],
        liste: [
          "Gespräche mit möglichen Partnern, Lieferanten oder Käufern",
          "Zusammenarbeit mit Freelancern und Dienstleistern",
          "Gespräche mit Investoren, soweit diese überhaupt NDAs unterschreiben",
          "Weitergabe von Software, Rezepturen oder Abläufen zur Prüfung",
        ],
      },
      {
        titel: "Einseitig oder gegenseitig",
        absaetze: [
          "Bei einer einseitigen NDA legt nur eine Seite offen, bei einer gegenseitigen (Mutual NDA) beide. Die gegenseitige Form ist ausgewogener und wird von Partnern meist leichter akzeptiert. Die Vorlage im Portal ist gegenseitig aufgebaut.",
          "Schließen Sie die NDA im Namen der LLC und nennen Sie die Gegenpartei mit vollem Firmennamen und Rechtsform. Legt Ihnen die andere Seite ihre eigene Vorlage vor, lohnt ein Blick auf versteckte Zusätze: Wettbewerbsverbote, Abwerbeverbote, Vertragsstrafen oder eine sehr lange Bindung gehören nicht in eine gewöhnliche NDA.",
        ],
      },
      {
        titel: "Was hineingehört",
        absaetze: [],
        liste: [
          "Definition der vertraulichen Informationen — weit genug, aber nicht grenzenlos",
          "Übliche Ausnahmen: bereits öffentlich, schon vorher bekannt, unabhängig entwickelt, rechtmäßig von Dritten erhalten",
          "Zweckbindung: Nutzung nur für das konkrete Vorhaben",
          "Kreis der Berechtigten: eigene Leute und beauftragte Fachleute mit Kenntnisbedarf, die ebenfalls zur Verschwiegenheit verpflichtet sind",
          "Laufzeit und Nachwirkung: wie lange offengelegt wird und wie lange die Pflicht danach gilt",
          "Rückgabe oder Löschung auf Verlangen",
          "Gerichtliche Eilmaßnahmen (Injunctive Relief), anwendbares Recht, Gerichtsstand",
        ],
      },
      {
        titel: "Grenzen und Ergänzungen",
        absaetze: [
          "Eine NDA verhindert keinen Verstoß, sie macht ihn verfolgbar. Ein Schaden lässt sich oft schwer beziffern; deshalb sind Unterlassungsansprüche so wichtig. Geben Sie nur preis, was für den Zweck wirklich nötig ist.",
          "Geschäftsgeheimnisse schützt in Florida zusätzlich der Uniform Trade Secrets Act (Chapter 688), auf Bundesebene der Defend Trade Secrets Act. In Deutschland setzt das Geschäftsgeheimnisgesetz „angemessene Geheimhaltungsmaßnahmen“ voraus — eine unterschriebene NDA ist ein Baustein davon.",
          "Bei Verträgen mit Beschäftigten und freien Mitarbeitern in den USA gehört ein Hinweis auf die Immunität von Hinweisgebern nach dem Defend Trade Secrets Act in den Vertrag (18 U.S.C. § 1833(b)); fehlt er, entfallen bestimmte Ansprüche gegen diese Personen.",
        ],
        merke: "Vertraulich ist nur, was Sie auch vertraulich behandeln: Unterlagen kennzeichnen, Zugriff begrenzen und festhalten, wem Sie was gegeben haben.",
      },
    ],
    umsetzen: [
      "Legen Sie fest, welche Informationen Sie im Gespräch wirklich teilen müssen.",
      "Öffnen Sie die Vorlage „Gegenseitige Geheimhaltungsvereinbarung (Mutual NDA)“ und tragen Sie Partner, Zweck und Laufzeit ein.",
      "Lassen Sie die NDA unterschreiben, bevor Sie Unterlagen übergeben.",
      "Kennzeichnen Sie vertrauliche Dokumente mit „Confidential“.",
      "Führen Sie eine kurze Liste, was Sie wann an wen gegeben haben.",
      "Bei einer fremden NDA mit Wettbewerbsverbot, Abwerbeverbot oder Vertragsstrafe: „Einzelfall prüfen lassen“.",
    ],
    quellen: [
      { titel: "Florida Statutes, Chapter 688 — Uniform Trade Secrets Act", url: `${FL}/Chapter688` },
      { titel: "Gesetz zum Schutz von Geschäftsgeheimnissen (GeschGehG)", url: "https://www.gesetze-im-internet.de/geschgehg/" },
    ],
    stand: STAND,
  },

  // ── 8 ────────────────────────────────────────────────────────────────────
  {
    id: "annual-report-status",
    bereich: "recht",
    gruppe: "Bank & Behörden",
    titel: "Annual Report, Status „Active“ und Reinstatement",
    kurz: "Die jährliche Pflichtmeldung in Florida: wann sie fällig ist, was bei Versäumnis passiert und wie eine aufgelöste LLC zurückkommt.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Die jährliche Pflicht",
        absaetze: [
          "Jede Florida-LLC reicht jedes Jahr einen Annual Report bei Sunbiz ein (§ 605.0212). Er bestätigt oder aktualisiert die Grunddaten: Hauptanschrift, Postanschrift, Registered Agent, vertretungsberechtigte Personen und die EIN. Finanzzahlen enthält er nicht.",
          "Der Zeitraum ist fest: zwischen dem 1. Januar und dem 1. Mai. Der erste Annual Report ist im Kalenderjahr nach der Gründung fällig. Eingereicht wird online auf Sunbiz; die Gebühr laut Sunbiz wird bei der Einreichung bezahlt.",
        ],
      },
      {
        titel: "Was bei Verspätung passiert",
        absaetze: [],
        liste: [
          "Einreichung nach dem 1. Mai: Zur Gebühr kommt eine deutliche Verspätungsgebühr hinzu, Höhe laut Sunbiz",
          "Kein Annual Report bis zum Stichtag im September, in der Regel dem dritten Freitag: Der Staat löst die LLC administrativ auf, auf Sunbiz steht dann „Inactive“ mit dem Vermerk der Auflösung wegen des fehlenden Annual Report",
          "Folge der Auflösung: Die LLC darf nur noch Geschäfte führen, die ihrer Abwicklung dienen (§ 605.0715)",
          "Banken, Zahlungsdienste und Partner sehen den Status öffentlich und reagieren oft mit Rückfragen oder Einschränkungen",
        ],
        merke: "Ein „Inactive“ auf Sunbiz ist für jede Bank ein Warnsignal. Der Annual Report gehört deshalb in den Kalender, nicht auf die lange Bank.",
      },
      {
        titel: "Reinstatement — der Weg zurück",
        absaetze: [
          "Eine administrativ aufgelöste LLC kann ihre Wiederherstellung beantragen (§ 605.0716). Dazu reicht sie bei Sunbiz einen Antrag auf Reinstatement ein, holt alle fehlenden Annual Reports nach und zahlt die Reinstatement-Gebühr sowie die offenen Jahresgebühren, jeweils laut Sunbiz.",
          "Mit der Wiederherstellung gilt die Auflösung rückwirkend als nicht eingetreten: Die LLC führt ihre Geschäfte weiter, als wäre sie nie aufgelöst worden. Hat in der Zwischenzeit eine andere Gesellschaft den Namen übernommen, muss die LLC beim Reinstatement einen neuen Namen wählen.",
        ],
      },
      {
        titel: "Status prüfen und nachweisen",
        absaetze: [
          "Den aktuellen Status sehen Sie jederzeit kostenlos in der Sunbiz-Suche, zusammen mit der Liste der eingereichten Dokumente. Brauchen Sie einen amtlichen Nachweis, etwa für eine Bank, bestellen Sie ein Certificate of Status — das Florida-Gegenstück zum Certificate of Good Standing anderer Bundesstaaten.",
          "Prüfen Sie beim Annual Report jedes Mal, ob die eingetragenen Personen und Anschriften noch stimmen. Der Bericht ist der einfachste Weg, Änderungen ohne gesonderten Antrag nachzutragen.",
        ],
      },
    ],
    umsetzen: [
      "Tragen Sie den 1. Januar und den 1. Mai als feste Termine in Ihren Kalender ein.",
      "Prüfen Sie vor der Einreichung Anschriften, Registered Agent und eingetragene Personen.",
      "Reichen Sie den Annual Report früh im Zeitraum ein, nicht erst kurz vor dem 1. Mai.",
      "Legen Sie die Eingangsbestätigung im Tresor unter „Jahresbericht“ ab.",
      "Prüfen Sie den Status Ihrer LLC auf Sunbiz einmal im Quartal.",
      "Steht Ihre LLC auf „Inactive“: „Einzelfall prüfen lassen“ und das Reinstatement zügig angehen.",
    ],
    quellen: [
      { titel: "Sunbiz — Annual Report", url: "https://dos.fl.gov/sunbiz/manage-business/efile/annual-report/" },
      { titel: "§ 605.0212 Florida Statutes — Annual Report", url: `${FL}/605.0212` },
      { titel: "§ 605.0716 Florida Statutes — Reinstatement", url: `${FL}/605.0716` },
      { titel: "Sunbiz — Firmensuche", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName" },
    ],
    stand: STAND,
  },

  // ── 9 ────────────────────────────────────────────────────────────────────
  {
    id: "marke-name-schuetzen",
    bereich: "recht",
    gruppe: "Schutz & Pflichten",
    titel: "Marke und Name schützen",
    kurz: "Warum der eingetragene LLC-Name noch keine Marke ist und welche Wege es in den USA und in Europa gibt.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Firmenname ist nicht Marke",
        absaetze: [
          "Sunbiz prüft bei der Gründung nur, ob sich Ihr Name von den bereits eingetragenen Florida-Namen unterscheidet. Das ist keine Markenprüfung. Der Eintrag gibt Ihnen kein Recht, anderen die Nutzung des Namens als Marke zu untersagen — und er schützt Sie nicht davor, selbst eine fremde Marke zu verletzen.",
          "Auch ein Fictitious Name (DBA), den Sie in Florida registrieren, ist eine reine Offenlegung, wer hinter einem Geschäftsnamen steht. Ein Markenrecht entsteht daraus nicht.",
        ],
      },
      {
        titel: "Markenschutz in den USA",
        absaetze: [
          "In den USA gibt es drei Stufen:",
        ],
        liste: [
          "Benutzungsmarke (Common Law): entsteht durch tatsächliche Nutzung im Geschäftsverkehr, wirkt aber nur regional und ist schwer nachzuweisen",
          "Florida-Marke: Registrierung beim Florida Department of State nach Chapter 495, Schutz nur in Florida",
          "Bundesmarke beim USPTO: Schutz in allen Bundesstaaten, öffentliches Register, das Zeichen ® erst nach der Eintragung",
        ],
      },
      {
        titel: "Die Anmeldung beim USPTO",
        absaetze: [
          "Beim USPTO melden Sie eine Marke für bestimmte Klassen von Waren und Dienstleistungen an; je Klasse fällt eine Gebühr an. Grundlage ist entweder die bereits laufende Nutzung oder die ernsthafte Absicht, die Marke zu nutzen (Intent to Use).",
          "Wichtig für Inhaber aus Europa: Wer seinen Hauptgeschäftssitz außerhalb der USA hat, muss sich vor dem USPTO durch eine in den USA zugelassene Anwaltsperson vertreten lassen. Maßgeblich ist der Ort, von dem aus das Geschäft tatsächlich geleitet wird — nicht die Anschrift des Registered Agent.",
        ],
      },
      {
        titel: "Markenschutz in Europa",
        absaetze: [
          "Für Kunden in der EU ist die Unionsmarke beim Amt der Europäischen Union für geistiges Eigentum (EUIPO) der übliche Weg: eine Anmeldung, Schutz in allen Mitgliedstaaten. Daneben gibt es nationale Marken, etwa beim Deutschen Patent- und Markenamt, beim Österreichischen Patentamt oder beim Eidgenössischen Institut für Geistiges Eigentum für die Schweiz. Über das Madrider System der WIPO lässt sich eine Marke auf weitere Länder erstrecken.",
        ],
      },
      {
        titel: "Vor der Anmeldung",
        absaetze: [],
        liste: [
          "Recherche in den Registern von USPTO, EUIPO und nationalen Ämtern nach gleichen und ähnlichen Marken",
          "Prüfung der Unterscheidungskraft: Rein beschreibende Begriffe lassen sich schwer schützen",
          "Domains und Profilnamen in sozialen Netzwerken sichern",
          "Klären, wer Inhaber werden soll: die LLC oder Sie persönlich",
        ],
        merke: "Erst recherchieren, dann investieren: Ein Name, den Sie nicht schützen können, ist für Logo, Website und Werbung ein Risiko.",
      },
    ],
    umsetzen: [
      "Prüfen Sie Ihren Namen in der Markensuche des USPTO und im Register des EUIPO.",
      "Legen Sie fest, in welchen Ländern und für welche Waren oder Dienstleistungen Sie den Namen nutzen.",
      "Entscheiden Sie, ob die LLC oder Sie persönlich Inhaber der Marke werden.",
      "Sichern Sie passende Domains und Profilnamen.",
      "Verwenden Sie das Zeichen ® erst nach der Eintragung, vorher höchstens „TM“.",
      "Für eine US-Anmeldung mit Geschäftssitz in Europa: „Einzelfall prüfen lassen“ und eine US-Anwaltskanzlei einbinden.",
    ],
    quellen: [
      { titel: "USPTO — Trademarks", url: "https://www.uspto.gov/trademarks" },
      { titel: "USPTO — Trademark basics", url: "https://www.uspto.gov/trademarks/basics" },
      { titel: "EUIPO — Amt der Europäischen Union für geistiges Eigentum", url: "https://www.euipo.europa.eu/" },
      { titel: "WIPO — Madrid System", url: "https://www.wipo.int/madrid/en/" },
      { titel: "Florida Statutes, Chapter 495 — Registrierung von Marken", url: `${FL}/Chapter495` },
    ],
    stand: STAND,
  },

  // ── 10 ───────────────────────────────────────────────────────────────────
  {
    id: "datenschutz-impressum",
    bereich: "recht",
    gruppe: "Schutz & Pflichten",
    titel: "Datenschutz und Impressum beim Verkauf in die EU",
    kurz: "Warum die DSGVO auch für Ihre US-LLC gelten kann und welche Angaben Ihre Website für Kunden im deutschsprachigen Raum braucht.",
    minuten: 5,
    abschnitte: [
      {
        titel: "Die DSGVO gilt auch für Sie",
        absaetze: [
          "Die Datenschutz-Grundverordnung gilt nicht nur für Firmen in der EU. Nach Art. 3 Abs. 2 DSGVO erfasst sie auch Unternehmen außerhalb der EU, wenn diese Personen in der EU Waren oder Dienstleistungen anbieten oder deren Verhalten in der EU beobachten, etwa durch Tracking. Eine Florida-LLC mit deutschsprachiger Website, Preisen in Euro und Kunden in Deutschland oder Österreich fällt damit typischerweise darunter.",
          "Für die Schweiz gilt das revidierte Datenschutzgesetz (DSG) mit ähnlichen Grundgedanken.",
        ],
      },
      {
        titel: "Was das praktisch bedeutet",
        absaetze: [],
        liste: [
          "Datenschutzerklärung auf der Website: wer verarbeitet, welche Daten, wozu, auf welcher Rechtsgrundlage, wie lange und welche Rechte bestehen",
          "Eine Rechtsgrundlage für jede Verarbeitung, etwa Vertrag, Einwilligung oder berechtigtes Interesse",
          "Einwilligung für nicht notwendige Cookies und Tracking, bevor sie laufen",
          "Verträge mit Dienstleistern, die Daten in Ihrem Auftrag verarbeiten (Auftragsverarbeitung)",
          "Ein Ablauf für Auskunfts- und Löschanfragen",
          "Ein Verzeichnis der Verarbeitungstätigkeiten, soweit keine Ausnahme greift",
        ],
      },
      {
        titel: "Vertreter in der EU",
        absaetze: [
          "Unternehmen ohne Niederlassung in der EU müssen nach Art. 27 DSGVO in vielen Fällen einen Vertreter in der EU schriftlich benennen. Ausnahmen gelten für nur gelegentliche Verarbeitung mit geringem Risiko, die keine besonders sensiblen Daten in großem Umfang betrifft. Ob die Ausnahme passt, ist eine Frage des Einzelfalls.",
        ],
      },
      {
        titel: "Impressum",
        absaetze: [
          "In Deutschland verlangt § 5 des Digitale-Dienste-Gesetzes (DDG) von Anbietern geschäftsmäßiger, in der Regel gegen Entgelt angebotener digitaler Dienste leicht erreichbare Pflichtangaben; früher stand diese Pflicht im Telemediengesetz. Österreich (E-Commerce-Gesetz, Mediengesetz) und die Schweiz (Gesetz gegen den unlauteren Wettbewerb) kennen vergleichbare Pflichten.",
          "Wie weit diese Pflichten eine US-Gesellschaft treffen, hängt davon ab, wie gezielt sich das Angebot an Kunden in diesen Ländern richtet. Üblich ist ein vollständiges Impressum, sobald Sie sich erkennbar an Kunden im deutschsprachigen Raum wenden. Typische Angaben:",
        ],
        liste: [
          "Voller Name der LLC mit Rechtsform und Bundesstaat",
          "Ladungsfähige Anschrift, kein Postfach",
          "Vertretungsberechtigte Person mit Name und Titel",
          "Schnelle elektronische Kontaktmöglichkeit, in der Regel E-Mail und ein weiterer Weg",
          "Register und Registernummer: Florida Division of Corporations mit Dokumentnummer",
          "Umsatzsteuer-Identifikationsnummer, soweit vorhanden",
        ],
      },
      {
        titel: "Was in den USA dazukommt",
        absaetze: [
          "Auch in den USA gibt es Datenschutzregeln, vor allem auf Ebene der Bundesstaaten und für bestimmte Branchen. Die Federal Trade Commission geht gegen irreführende Angaben zum Datenschutz vor: Was in Ihrer Datenschutzerklärung steht, muss stimmen.",
        ],
        merke: "Ihre Website ist Ihr Schaufenster nach Europa. Datenschutzerklärung, Cookie-Einwilligung und Impressum gehören vor den ersten Werbe-Euro, nicht danach.",
      },
    ],
    umsetzen: [
      "Listen Sie auf, welche Daten Ihre Website, Ihr Shop und Ihre Werkzeuge erheben.",
      "Erstellen Sie eine Datenschutzerklärung, die zu dieser Liste passt.",
      "Richten Sie eine Cookie-Einwilligung ein, die Tracking erst nach Zustimmung startet.",
      "Schließen Sie mit Ihren Dienstleistern Verträge zur Auftragsverarbeitung.",
      "Ergänzen Sie ein Impressum mit LLC-Name, Anschrift, vertretungsberechtigter Person, Kontakt und Dokumentnummer.",
      "Prüfen Sie, ob Sie nach Art. 27 DSGVO einen Vertreter in der EU benennen müssen.",
      EINZELFALL,
    ],
    quellen: [
      { titel: "Datenschutz-Grundverordnung (EU) 2016/679", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj" },
      { titel: "§ 5 Digitale-Dienste-Gesetz (DDG) — Allgemeine Informationspflichten", url: "https://www.gesetze-im-internet.de/ddg/__5.html" },
      { titel: "FTC — Privacy and Security (Business Guidance)", url: "https://www.ftc.gov/business-guidance/privacy-security" },
    ],
    stand: STAND,
  },

  // ── 11 ───────────────────────────────────────────────────────────────────
  {
    id: "bank-kyc-unterlagen",
    bereich: "recht",
    gruppe: "Bank & Behörden",
    titel: "Bank & KYC — welche Firmendokumente Banken verlangen",
    kurz: "Welche Unterlagen bei Kontoeröffnung und Kartenantrag üblich sind und wie Sie sie vollständig und stimmig bereithalten.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Warum Banken so genau fragen",
        absaetze: [
          "US-Banken sind gesetzlich verpflichtet, ihre Kunden zu identifizieren (Know Your Customer). Für Gesellschaften verlangt die Customer-Due-Diligence-Regel zusätzlich Angaben zu den wirtschaftlich Berechtigten: zu jeder Person, der ein Viertel oder mehr gehört, und zu einer Person, die die Gesellschaft maßgeblich steuert (31 CFR 1010.230). Bei Ihrer Ein-Personen-LLC sind das in der Regel Sie.",
          "Über Konto, Karte und Kreditlinie entscheidet allein das jeweilige Institut. Vollständige und stimmige Unterlagen verkürzen aber Rückfragen und vermeiden unnötige Verzögerungen.",
        ],
      },
      {
        titel: "Die übliche Unterlagenliste",
        absaetze: [],
        liste: [
          "Articles of Organization mit Eingangsvermerk oder Sunbiz-Auszug, bei Bedarf ein aktuelles Certificate of Status",
          "EIN-Bestätigung des IRS: das Schreiben CP 575 aus der Vergabe oder, falls es fehlt, das Bestätigungsschreiben 147C",
          "Operating Agreement, unterschrieben",
          "Reisepass oder anderer amtlicher Lichtbildausweis jeder wirtschaftlich berechtigten Person",
          "Nachweis Ihrer Privatanschrift, etwa Meldebescheinigung, Versorgerrechnung oder Kontoauszug, aktuell und auf Ihren Namen",
          "Geschäftsanschrift der LLC und eine Beschreibung der Tätigkeit, oft mit Website",
          "Angaben zu den wirtschaftlich Berechtigten (Beneficial Ownership) und gegebenenfalls ein Beschluss zur Kontoeröffnung (Banking Resolution)",
          "Das Steuerformular der Bank — W-9 oder ein Formular der W-8-Reihe; welches passt, hängt von der steuerlichen Einordnung ab",
        ],
      },
      {
        titel: "Stimmigkeit zählt mehr als Menge",
        absaetze: [
          "Banken gleichen die Angaben untereinander ab. Häufige Gründe für Rückfragen sind kleine Abweichungen:",
        ],
        liste: [
          "Name der LLC anders geschrieben als auf Sunbiz oder im EIN-Schreiben",
          "Titel im Operating Agreement passt nicht zum Eintrag auf Sunbiz",
          "Anschrift im Antrag weicht von der Anschrift beim IRS oder auf Sunbiz ab",
          "Tätigkeitsbeschreibung unklar oder anders als auf der Website",
          "Status auf Sunbiz „Inactive“",
        ],
        merke: "Ein Name, eine Anschrift, ein Titel — in jedem Dokument gleich. Das ist der einfachste Hebel für eine glatte Prüfung.",
      },
      {
        titel: "Meldung an FinCEN (BOI)",
        absaetze: [
          "Von der Prüfung durch die Bank zu unterscheiden ist die Meldung wirtschaftlich Berechtigter an FinCEN nach dem Corporate Transparency Act. Nach einer Übergangsregel von FinCEN aus dem März 2025 sind in den USA gegründete Gesellschaften derzeit von dieser Meldung ausgenommen; sie betrifft vor allem im Ausland gegründete Gesellschaften, die in den USA registriert sind. Weil sich diese Regeln mehrfach geändert haben, lohnt vor jeder Entscheidung ein Blick auf den aktuellen Stand bei FinCEN.",
        ],
      },
      {
        titel: "EIN-Schreiben nicht mehr auffindbar?",
        absaetze: [
          "Das Schreiben CP 575 stellt der IRS nur einmal aus. Fehlt es, können Sie beim IRS ein Bestätigungsschreiben 147C anfordern; berechtigt ist eine Person, die die LLC vertreten darf. Viele Banken akzeptieren beide Schreiben gleichermaßen.",
        ],
      },
    ],
    umsetzen: [
      "Sammeln Sie die Unterlagen aus der Liste als PDF im Tresor.",
      "Prüfen Sie Name, Anschrift und Titel in allen Dokumenten auf exakte Übereinstimmung.",
      "Prüfen Sie Ihren Status auf Sunbiz, bevor Sie einen Antrag stellen.",
      "Halten Sie einen aktuellen Adressnachweis und einen gültigen Reisepass bereit.",
      "Erstellen Sie bei Bedarf eine Banking Resolution und ein Certificate of Incumbency mit den Vorlagen.",
      "Fehlt das EIN-Schreiben: Fordern Sie beim IRS das Schreiben 147C an.",
      "Bei Rückfragen der Bank zur Herkunft der Mittel oder zur Tätigkeit: „Einzelfall prüfen lassen“.",
    ],
    quellen: [
      { titel: "31 CFR 1010.230 — Wirtschaftlich Berechtigte von Gesellschaftskunden", url: "https://www.ecfr.gov/current/title-31/section-1010.230" },
      { titel: "FinCEN — Beneficial Ownership Information", url: "https://www.fincen.gov/boi" },
      { titel: "IRS — Employer Identification Number", url: "https://www.irs.gov/businesses/small-businesses-self-employed/employer-identification-number" },
      { titel: "IRS — Lost or misplaced your EIN?", url: "https://www.irs.gov/businesses/employer-identification-number" },
    ],
    stand: STAND,
  },

  // ── 12 ───────────────────────────────────────────────────────────────────
  {
    id: "aufloesung-umstrukturierung",
    bereich: "recht",
    gruppe: "Ihre LLC",
    titel: "Auflösung und Umstrukturierung",
    kurz: "Wie eine LLC geordnet endet, welche Pflichten bis zuletzt bleiben und welche Wege es statt einer Auflösung gibt.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Liegenlassen ist keine Auflösung",
        absaetze: [
          "Eine LLC endet nicht dadurch, dass Sie sie nicht mehr nutzen. Wer nur den Annual Report weglässt, riskiert die administrative Auflösung — die Pflichten gegenüber Steuerbehörden und Gläubigern bleiben aber bestehen, und offene Forderungen laufen weiter. Der geordnete Weg ist die freiwillige Auflösung.",
        ],
      },
      {
        titel: "Die Bausteine der freiwilligen Auflösung",
        absaetze: [],
        liste: [
          "Beschluss des Mitglieds über die Auflösung, festgehalten mit einem Written Consent",
          "Articles of Dissolution bei Sunbiz einreichen (§ 605.0707), Gebühr laut Sunbiz",
          "Abwicklung (Winding up): laufende Verträge beenden, Forderungen einziehen, Vermögen verwerten, Schulden bezahlen (§ 605.0709)",
          "Bekannte Gläubiger schriftlich benachrichtigen; Chapter 605 sieht dafür ein eigenes Verfahren vor",
          "Restvermögen erst nach Begleichung der Schulden an das Mitglied verteilen",
          "Konten schließen, Registered Agent und laufende Abonnements kündigen",
        ],
        merke: "Erst zahlen, dann verteilen: Wer Restvermögen ausschüttet, bevor die Schulden beglichen sind, riskiert, es zurückgeben zu müssen.",
      },
      {
        titel: "Pflichten bis zum Ende",
        absaetze: [],
        liste: [
          "Steuern: letzte Erklärungen und Meldungen für das Jahr der Auflösung, oft als „final“ gekennzeichnet — Einzelheiten im Bereich „Steuern & Pflichten“",
          "IRS: Das Konto zur EIN lässt sich schließen, indem Sie dem IRS die Auflösung schriftlich mitteilen; die EIN selbst wird nie neu vergeben",
          "Unterlagen: Firmenunterlagen nach dem Ende weiter aufbewahren, für Steuer- und Haftungsfragen",
          "Verträge, Lizenzen, Domains und Marken: kündigen, übertragen oder bewusst behalten",
        ],
      },
      {
        titel: "Statt Auflösung: umstrukturieren",
        absaetze: [
          "Nicht jede Veränderung verlangt das Ende der LLC. Chapter 605 kennt mehrere Wege:",
        ],
        liste: [
          "Anteilsübertragung: Ein Käufer übernimmt die LLC mit allen Verträgen, der Name bleibt",
          "Neues Mitglied: Aufnahme durch Beschluss und geändertes Operating Agreement — steuerlich wird aus der Ein-Personen-LLC dann in der Regel eine Personengesellschaft",
          "Wechsel zur Führung durch Manager: Änderung des Operating Agreement und der Angaben bei Sunbiz",
          "Umwandlung (Conversion) oder Verschmelzung (Merger) mit einer anderen Gesellschaft",
          "Wechsel in einen anderen Bundesstaat durch Umwandlung oder Domestication, soweit beide Staaten das zulassen",
        ],
      },
      {
        titel: "Vor der Unterschrift",
        absaetze: [
          "Jede dieser Änderungen hat steuerliche Folgen in den USA und oft auch in Ihrem Heimatland. Das gehört vor der Unterschrift zu Ihrer Steuerkanzlei. Den Beschluss selbst, die Anteilsbescheinigung und das angepasste Operating Agreement können Sie mit den Vorlagen im Portal vorbereiten.",
        ],
      },
    ],
    umsetzen: [
      "Klären Sie, ob Sie die LLC beenden oder nur verändern möchten.",
      "Fassen Sie den Beschluss mit der Vorlage „Written Consent“.",
      "Listen Sie alle Verträge, Konten, Abonnements und Gläubiger der LLC auf.",
      "Begleichen Sie Schulden, bevor Sie Restvermögen verteilen.",
      "Reichen Sie die Articles of Dissolution bei Sunbiz ein.",
      "Klären Sie mit Ihrer Steuerkanzlei die letzten Erklärungen in den USA und im Heimatland.",
      "Für Verkauf, neues Mitglied oder Umwandlung: „Einzelfall prüfen lassen“.",
    ],
    quellen: [
      { titel: "§ 605.0707 Florida Statutes — Articles of Dissolution", url: `${FL}/605.0707` },
      { titel: "§ 605.0709 Florida Statutes — Abwicklung (Winding up)", url: `${FL}/605.0709` },
      { titel: "IRS — Closing a business", url: "https://www.irs.gov/businesses/small-businesses-self-employed/closing-a-business" },
      SUNBIZ,
    ],
    stand: STAND,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// (B) DIE VORLAGEN — acht englische Standarddokumente
// Felder mit `vorbelegt` kommen aus der Akte; alles andere füllt der Kunde.
// ═══════════════════════════════════════════════════════════════════════════
const AUS_AKTE = "Aus Ihrer Akte vorausgefüllt — bitte prüfen.";

const F_LLC: FachVorlageFeld = { key: "llcName", label: "Name der LLC", typ: "text", pflicht: true, vorbelegt: "llcName", hilfe: "Genau wie auf Sunbiz, mit dem Zusatz „LLC“." };
const F_STAAT: FachVorlageFeld = { key: "bundesstaatName", label: "Bundesstaat", typ: "text", pflicht: true, vorbelegt: "bundesstaatName", hilfe: "Englisch ausgeschrieben, zum Beispiel „Florida“." };
const F_AZ: FachVorlageFeld = { key: "aktenzeichen", label: "Dokumentnummer (Sunbiz)", typ: "text", pflicht: true, vorbelegt: "aktenzeichen", hilfe: AUS_AKTE };
const F_EIN: FachVorlageFeld = { key: "ein", label: "EIN der LLC", typ: "text", pflicht: true, vorbelegt: "ein", hilfe: "Neunstellige Steuernummer der LLC aus dem IRS-Schreiben." };
const F_INHABER: FachVorlageFeld = { key: "inhaberName", label: "Ihr vollständiger Name", typ: "text", pflicht: true, vorbelegt: "inhaberName", hilfe: "Wie im Reisepass." };
const F_INH_ANSCHRIFT: FachVorlageFeld = { key: "inhaberAnschrift", label: "Ihre Privatanschrift", typ: "text", pflicht: true, vorbelegt: "inhaberAnschrift", hilfe: AUS_AKTE };
const F_US_ADRESSE: FachVorlageFeld = { key: "usAdresse", label: "Geschäftsanschrift der LLC", typ: "text", pflicht: true, vorbelegt: "usAdresse", hilfe: "Die Hauptanschrift wie auf Sunbiz." };
const F_AGENT: FachVorlageFeld = { key: "registeredAgent", label: "Registered Agent", typ: "text", pflicht: true, vorbelegt: "registeredAgent", hilfe: "Name und Anschrift des Registered Agent wie auf Sunbiz." };
const F_HEUTE: FachVorlageFeld = { key: "heute", label: "Datum", typ: "datum", pflicht: true, vorbelegt: "heute", hilfe: "Vorausgefüllt mit dem heutigen Datum; bei Bedarf anpassen." };
const F_GEGRUENDET: FachVorlageFeld = { key: "gegruendetAm", label: "Gründungsdatum", typ: "datum", pflicht: true, vorbelegt: "gegruendetAm", hilfe: "Tag der Einreichung der Articles of Organization." };
const F_GERICHT: FachVorlageFeld = { key: "gerichtsstand", label: "Gerichtsstand (County)", typ: "text", pflicht: true, hilfe: "Zum Beispiel „Miami-Dade County, Florida“; üblich ist das County Ihrer Geschäftsanschrift." };

export const FACH_VORLAGEN: FachVorlage[] = [
  // ── 1 Operating Agreement ────────────────────────────────────────────────
  {
    id: "operating-agreement-smllc",
    titel: "Operating Agreement für Ihre Ein-Personen-LLC",
    dokumentTitel: "Operating Agreement of a Single-Member Limited Liability Company",
    sprache: "en",
    wozu: "Regelt Eigentum, Geschäftsführung, Haftung, Nachfolge und Auflösung Ihrer LLC in einem unterschriebenen Dokument.",
    wann: "Bei der Kontoeröffnung, wenn eine Bank oder ein Partner danach fragt, und spätestens, sobald Ihre LLC aktiv Geschäfte macht.",
    felder: [
      F_LLC, F_STAAT, F_AZ, F_GEGRUENDET, F_EIN, F_INHABER, F_INH_ANSCHRIFT, F_US_ADRESSE, F_AGENT, F_HEUTE,
      { key: "zweck", label: "Unternehmensgegenstand (englisch)", typ: "langtext", pflicht: true, hilfe: "Kurz auf Englisch, zum Beispiel „the online retail of sporting goods“ oder allgemein „any lawful business“." },
      { key: "einlage", label: "Einlage (englisch)", typ: "text", pflicht: true, hilfe: "Zum Beispiel „USD 1,000 in cash“ oder „the business equipment listed in a separate schedule“." },
      { key: "nachfolger", label: "Vertrauensperson für den Ernstfall", typ: "text", pflicht: true, hilfe: "Name der Person, die bei Ihrem Tod oder Ihrer Geschäftsunfähigkeit die LLC vorübergehend weiterführen darf. Ohne Benennung: „the Member's personal representative“ eintragen." },
    ],
    text: [
      "This Operating Agreement (this “Agreement”) of {{llcName}}, a {{bundesstaatName}} limited liability company (the “Company”), is made and entered into effective as of {{heute}} by {{inhaberName}}, residing at {{inhaberAnschrift}}, as the sole member of the Company (the “Member”).",
      "## 1. Formation",
      "1.1 Formation. The Company was formed as a limited liability company under the laws of the State of {{bundesstaatName}} by the filing of its articles of organization with the competent state authority on {{gegruendetAm}} under document number {{aktenzeichen}}. The rights and obligations of the Member and the administration of the Company are governed by this Agreement, the articles of organization and the limited liability company act of the State of {{bundesstaatName}}, as amended from time to time (the “Act”). To the extent permitted by the Act, this Agreement controls where it differs from a default rule of the Act.",
      "1.2 Name. The name of the Company is {{llcName}}. The Company may conduct business under that name or under any fictitious name duly registered by the Company.",
      "1.3 Principal Office and Registered Agent. The principal office of the Company is located at {{usAdresse}}, or at such other place as the Member may designate. The registered agent of the Company in the State of {{bundesstaatName}} is {{registeredAgent}}, or such other registered agent as the Member may designate by making the required filing with the state.",
      "1.4 Employer Identification Number. The federal Employer Identification Number of the Company is {{ein}}.",
      "1.5 Term. The existence of the Company commenced on the date its articles of organization became effective and shall continue until the Company is dissolved and its affairs are wound up in accordance with this Agreement and the Act.",
      "## 2. Purpose and Powers",
      "2.1 Purpose. The purpose of the Company is {{zweck}}, and to engage in any other lawful act or activity for which limited liability companies may be organized under the Act.",
      "2.2 Powers. The Company has all powers necessary or convenient to carry out its purpose, including the power to enter into contracts, to open and maintain bank and payment accounts, to borrow money, to acquire, hold and dispose of property, and to sue and be sued in its own name.",
      "## 3. Member, Interest and Capital",
      "3.1 Sole Member. {{inhaberName}} is the sole member of the Company and holds one hundred percent (100%) of the membership interests in the Company (the “Interest”), as reflected in Schedule A.",
      "3.2 Capital Contribution. The Member has contributed or will contribute to the Company the following initial capital contribution: {{einlage}}. The Member may make additional capital contributions at the Member's sole discretion but is not required to do so.",
      "3.3 No Interest; No Withdrawal. No interest shall accrue on any capital contribution. The Member has no right to withdraw or to be repaid any capital contribution except as provided in this Agreement.",
      "3.4 Loans by the Member. The Member may lend money to the Company on terms approved in writing by the Member. A loan by the Member is not a capital contribution and shall be documented and recorded as a loan.",
      "3.5 Certificates. The Interest may, but need not, be evidenced by a certificate of membership interest issued by the Company.",
      "## 4. Allocations, Distributions and Tax Matters",
      "4.1 Allocations. All items of income, gain, loss, deduction and credit of the Company shall be allocated to the Member.",
      "4.2 Distributions. The Company may make distributions to the Member at such times and in such amounts as the Member determines, provided that no distribution shall be made if, after giving it effect, (a) the Company would not be able to pay its debts as they become due in the ordinary course of its activities, or (b) the Company's total assets would be less than the sum of its total liabilities, or if the distribution would otherwise violate the Act.",
      "4.3 Tax Classification. The Member acknowledges that, for United States federal income tax purposes, an eligible entity with a single owner is disregarded as an entity separate from its owner unless an election to be classified otherwise is made. Any election regarding the tax classification of the Company shall be made only by the Member. The tax treatment of the Company and of the Member in any jurisdiction is determined by applicable law and not by this Agreement.",
      "## 5. Management",
      "5.1 Member-Managed. The Company is a member-managed limited liability company. The Member has full, exclusive and complete authority to manage and control the business and affairs of the Company, to make all decisions regarding those matters and to perform any and all acts customary or incident to the management of the Company's business.",
      "5.2 Authority to Bind. The Member, acting alone, is authorized to execute any document and to take any action on behalf of the Company. The Member may sign on behalf of the Company under the title “Sole Member”, “Managing Member”, “Authorized Member” or “Manager”, each of which refers to the Member acting in the Member's capacity under this Agreement.",
      "5.3 Officers and Agents. The Member may appoint officers, employees and agents of the Company, define their duties and authority in writing, and revoke any such appointment at any time.",
      "5.4 Action by Written Consent. Any action required or permitted to be taken by the Member may be taken without a meeting by a written consent signed by the Member. Written consents shall be kept with the records of the Company.",
      "5.5 Other Activities. The Member may engage in other business activities, whether or not similar to those of the Company, without any obligation to offer an interest in such activities to the Company.",
      "## 6. Banking and Records",
      "6.1 Bank Accounts. All funds of the Company shall be deposited in one or more accounts maintained in the name of the Company with banks or other financial institutions selected by the Member. Company funds shall not be commingled with the personal funds of the Member or of any other person.",
      "6.2 Signatories. The Member is authorized to open, operate and close accounts of the Company and to designate in writing the persons authorized to sign or transact on such accounts.",
      "6.3 Books and Records. The Company shall maintain complete and accurate books and records of its business, including a copy of its articles of organization and all amendments, this Agreement and all amendments, all written consents of the Member, its federal, state and local tax returns and reports, and any other records required by the Act.",
      "6.4 Fiscal Year. The fiscal year of the Company is the calendar year unless the Member determines otherwise.",
      "## 7. Limited Liability and Indemnification",
      "7.1 Limited Liability. Except as otherwise required by the Act, the debts, obligations and other liabilities of the Company, whether arising in contract, tort or otherwise, are solely the debts, obligations and liabilities of the Company. The Member is not personally liable for any such debt, obligation or liability solely by reason of being or acting as a member or manager of the Company. The failure of the Company to observe formalities relating to the exercise of its powers or the management of its activities is not a ground for imposing liability on the Member.",
      "7.2 Indemnification. To the fullest extent permitted by the Act, the Company shall indemnify, defend and hold harmless the Member and any officer of the Company from and against any loss, damage, claim, cost or expense (including reasonable attorneys' fees) incurred by reason of any act or omission performed or omitted in good faith on behalf of the Company, except to the extent arising from conduct for which the Act does not permit indemnification, including conduct involving bad faith, willful or intentional misconduct, or a knowing violation of law.",
      "7.3 Advancement and Insurance. The Company may advance expenses to an indemnified person upon receipt of a written undertaking to repay such amounts if it is ultimately determined that the person is not entitled to indemnification, and may purchase insurance on behalf of any such person.",
      "7.4 No Third-Party Rights. The provisions of this Agreement, including this Article 7, are solely for the benefit of the Member and the Company and do not confer any rights upon any creditor or other third party.",
      "## 8. Transfer, Admission and Succession",
      "8.1 Transfer. The Member may transfer all or any part of the Interest at any time. A transferee of the entire Interest shall be admitted as a member upon signing a written acceptance of this Agreement or a new operating agreement.",
      "8.2 Additional Members. Additional members may be admitted only with the written consent of the Member. Upon the admission of an additional member, the members shall enter into an amended operating agreement that reflects the rights and obligations of multiple members.",
      "8.3 Death or Incapacity of the Member. Upon the death or adjudicated incapacity of the Member, to the extent permitted by the Act, (a) the Company shall not dissolve but shall continue, (b) {{nachfolger}} is authorized to exercise the rights of the Member for the limited purpose of preserving the assets and continuing the business of the Company until the Interest has been transferred in accordance with applicable law, and (c) the person or persons who acquire the Interest by will, intestate succession or other lawful transfer shall be admitted as members of the Company upon signing a written acceptance of this Agreement, effective as of the date of the Member's death or incapacity.",
      "## 9. Dissolution and Winding Up",
      "9.1 Events of Dissolution. The Company shall be dissolved only upon (a) the written decision of the Member to dissolve the Company, (b) the entry of a decree of judicial dissolution, or (c) any other event that requires dissolution under the Act and cannot be avoided under this Agreement.",
      "9.2 Winding Up. Upon dissolution, the Member or a person designated by the Member shall wind up the affairs of the Company, liquidate its assets, file articles of dissolution with the competent state authority and give notice to known creditors as provided in the Act.",
      "9.3 Order of Distribution. The assets of the Company shall be applied first to the payment of, or reasonable provision for, all debts and liabilities of the Company, including liabilities to the Member as a creditor, and thereafter distributed to the Member.",
      "## 10. General Provisions",
      "10.1 Governing Law. This Agreement is governed by and shall be construed in accordance with the laws of the State of {{bundesstaatName}}, without regard to its conflict of laws principles.",
      "10.2 Entire Agreement; Amendments. This Agreement, together with Schedule A, constitutes the entire agreement of the Member with respect to its subject matter and supersedes all prior agreements and understandings. This Agreement may be amended only by a written instrument signed by the Member.",
      "10.3 Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions remain in full force and effect, and the invalid provision shall be deemed replaced by a valid provision that comes closest to its intent.",
      "10.4 Electronic Signature. This Agreement may be signed electronically, and an electronic signature has the same effect as a handwritten signature.",
      "10.5 Headings. Headings are for convenience only and do not affect the interpretation of this Agreement.",
      "## Schedule A — Member, Capital Contribution and Interest",
      "Company: {{llcName}}, a {{bundesstaatName}} limited liability company, document number {{aktenzeichen}}, EIN {{ein}}.",
      "Member: {{inhaberName}}, {{inhaberAnschrift}}.",
      "Initial capital contribution: {{einlage}}.",
      "Percentage Interest: 100%.",
      "IN WITNESS WHEREOF, the undersigned, {{inhaberName}}, being the sole member of the Company, has executed this Operating Agreement effective as of {{heute}}.",
    ],
    unterschriften: ["Sole Member"],
    art: "operating_agreement",
  },

  // ── 2 Banking Resolution ─────────────────────────────────────────────────
  {
    id: "banking-resolution",
    titel: "Bankbeschluss: Konto eröffnen und Zeichnungsberechtigte festlegen",
    dokumentTitel: "Resolution of the Sole Member Regarding Bank Accounts",
    sprache: "en",
    wozu: "Belegt gegenüber dem Institut, dass Ihre LLC das Konto eröffnen darf und wer darüber verfügen darf.",
    wann: "Wenn ein Institut bei der Kontoeröffnung einen Beschluss (Banking Resolution) verlangt oder Sie weitere Zeichnungsberechtigte bestimmen möchten.",
    felder: [
      F_LLC, F_STAAT, F_AZ, F_EIN, F_INHABER, F_HEUTE,
      { key: "bankName", label: "Name des Instituts", typ: "text", pflicht: true, hilfe: "Genau wie im Kontoantrag. Für jedes Institut einen eigenen Beschluss erstellen." },
      { key: "kontoarten", label: "Kontoarten", typ: "auswahl", pflicht: true, optionen: ["business checking and savings accounts", "business checking accounts", "business deposit, card and payment accounts of any kind"], hilfe: "Welche Konten der Beschluss abdeckt." },
      { key: "zeichnungsberechtigte", label: "Zeichnungsberechtigte Personen", typ: "langtext", pflicht: true, hilfe: "Name und Funktion je Person, zum Beispiel „Max Mustermann, Sole Member“. Wenn nur Sie zeichnen, nur Ihren Namen mit Funktion." },
      { key: "zeichnungsregel", label: "Zeichnungsregel", typ: "auswahl", pflicht: true, optionen: ["any one Authorized Signatory acting alone", "any two Authorized Signatories acting jointly"], hilfe: "Einzeln oder nur zu zweit. Bei nur einer zeichnungsberechtigten Person: einzeln." },
    ],
    text: [
      "The undersigned, being the sole member (the “Member”) of {{llcName}}, a {{bundesstaatName}} limited liability company with document number {{aktenzeichen}} and Employer Identification Number {{ein}} (the “Company”), acting without a meeting pursuant to the operating agreement of the Company and the applicable limited liability company act, hereby adopts the following resolutions by written consent, effective as of {{heute}}:",
      "## Opening of Accounts",
      "RESOLVED, that the Company is authorized to open and maintain {{kontoarten}} with {{bankName}} (the “Bank”) in the name of the Company, and to enter into the account agreements, terms and conditions and related documents customarily required by the Bank;",
      "## Authorized Signatories",
      "RESOLVED FURTHER, that the following persons are designated as authorized signatories of the Company (each an “Authorized Signatory”): {{zeichnungsberechtigte}};",
      "RESOLVED FURTHER, that {{zeichnungsregel}} is authorized, on behalf of the Company, to sign checks, payment orders and withdrawal instructions, to make and authorize electronic transfers, to use online banking, to request debit or other payment cards linked to the accounts, and to give any other instructions regarding the accounts of the Company;",
      "RESOLVED FURTHER, that the Bank is authorized to honor any instrument or instruction signed or given in accordance with these resolutions, without inquiry as to the circumstances of its issue or the use of its proceeds;",
      "## Certifications and Duration",
      "RESOLVED FURTHER, that the Member is authorized to execute and deliver to the Bank any certificate, beneficial ownership certification, tax form or other document the Bank may reasonably require, and to certify these resolutions to the Bank;",
      "RESOLVED FURTHER, that these resolutions remain in full force and effect until the Bank has received written notice of their amendment or revocation, and that any action taken by the Member or an Authorized Signatory before the date hereof that is consistent with these resolutions is ratified and confirmed.",
      "## Certificate of the Member",
      "I, {{inhaberName}}, certify that I am the sole member of the Company, that the foregoing resolutions were duly adopted by written consent, that they are in full force and effect and have not been amended or revoked, and that the persons named above are the duly designated Authorized Signatories of the Company.",
    ],
    unterschriften: ["Sole Member"],
    art: "bank_vertrag",
  },

  // ── 3 Certificate of Incumbency ──────────────────────────────────────────
  {
    id: "certificate-of-incumbency",
    titel: "Vertretungsnachweis (Certificate of Incumbency)",
    dokumentTitel: "Certificate of Incumbency",
    sprache: "en",
    wozu: "Bestätigt, wer Ihre LLC vertritt, mit Musterunterschrift — für Banken, Behörden und Geschäftspartner.",
    wann: "Wenn jemand Ihre Vertretungsmacht nachgewiesen haben möchte, etwa bei einer Kontoeröffnung, einem Vertrag oder der Vorlage in Europa.",
    felder: [
      F_LLC, F_STAAT, F_AZ, F_GEGRUENDET, F_EIN, F_US_ADRESSE, F_AGENT, F_INHABER, F_HEUTE,
      { key: "funktion", label: "Ihre Funktion (wie auf Sunbiz)", typ: "auswahl", pflicht: true, optionen: ["Sole Member", "Sole Member and Manager", "Managing Member", "Authorized Member", "Manager"], hilfe: "Der Titel, unter dem Sie auf Sunbiz und im Operating Agreement geführt sind." },
      { key: "empfaenger", label: "Vorgesehen für", typ: "text", pflicht: true, hilfe: "Name der Stelle, die den Nachweis erhält, oder allgemein „any interested party“." },
    ],
    text: [
      "The undersigned, {{inhaberName}}, hereby certifies, effective as of {{heute}}, on behalf of {{llcName}}, a limited liability company organized under the laws of the State of {{bundesstaatName}} (the “Company”), as follows:",
      "## 1. Company Information",
      "1.1 The Company was formed on {{gegruendetAm}} under document number {{aktenzeichen}} and, to the knowledge of the undersigned, has not been dissolved and continues in existence under the laws of the State of {{bundesstaatName}} on the date of this certificate.",
      "1.2 The Company's federal Employer Identification Number is {{ein}}. Its principal office is located at {{usAdresse}}, and its registered agent is {{registeredAgent}}.",
      "## 2. Member and Authorized Person",
      "2.1 {{inhaberName}} is the sole member of the Company and holds one hundred percent (100%) of the membership interests in the Company.",
      "2.2 {{inhaberName}} holds the position of {{funktion}} of the Company and, acting alone, is duly authorized under the Company's operating agreement to execute and deliver agreements, instruments, certificates and other documents on behalf of the Company and thereby to bind the Company.",
      "2.3 No other person currently holds the position of member or manager of the Company, and no resolution limiting the authority described in Section 2.2 is in effect.",
      "## 3. Specimen Signature",
      "The signature appearing below is the genuine signature of {{inhaberName}}.",
      "Specimen signature: ______________________________",
      "## 4. Use of this Certificate",
      "This certificate is issued for presentation to {{empfaenger}}. Any person may rely on it until receiving written notice of a change in the facts certified herein. Where required by the recipient, the signature on this certificate may be acknowledged before a notary public in accordance with the law of the place of signing, and an apostille may be obtained from the competent authority.",
      "IN WITNESS WHEREOF, the undersigned has signed this Certificate of Incumbency as of {{heute}}.",
    ],
    unterschriften: ["Sole Member"],
    art: "sonstiges",
  },

  // ── 4 Written Consent ────────────────────────────────────────────────────
  {
    id: "written-consent",
    titel: "Schriftlicher Beschluss des Alleingesellschafters (Written Consent)",
    dokumentTitel: "Written Consent of the Sole Member in Lieu of a Meeting",
    sprache: "en",
    wozu: "Hält eine Entscheidung Ihrer LLC schriftlich fest — ohne Versammlung, mit Datum und Unterschrift.",
    wann: "Bei jeder wichtigen Entscheidung: Vertrag, Darlehen, Ausschüttung, Vollmacht, Adresswechsel oder Auflösung.",
    felder: [
      F_LLC, F_STAAT, F_INHABER, F_HEUTE,
      { key: "betreff", label: "Gegenstand des Beschlusses (englisch)", typ: "text", pflicht: true, hilfe: "Kurz, zum Beispiel „Approval of an office lease“." },
      { key: "hintergrund", label: "Hintergrund (englisch)", typ: "langtext", pflicht: true, hilfe: "Ein bis drei Sätze, warum entschieden wird. Klein beginnen, zum Beispiel „the Company intends to lease office space at …“." },
      { key: "beschluss", label: "Beschluss (englisch)", typ: "langtext", pflicht: true, hilfe: "Was genau gilt, mit Beträgen, Namen und Daten. Klein beginnen, zum Beispiel „the Company is authorized to enter into the lease agreement with …“." },
      { key: "wirksamAm", label: "Wirksam ab", typ: "datum", pflicht: true, hilfe: "Der Tag, ab dem der Beschluss gelten soll." },
    ],
    text: [
      "## Subject: {{betreff}}",
      "The undersigned, {{inhaberName}}, being the sole member (the “Member”) of {{llcName}}, a {{bundesstaatName}} limited liability company (the “Company”), acting pursuant to the operating agreement of the Company and the applicable limited liability company act, which permit the Member to take action without a meeting by written consent, hereby waives any requirement of a meeting or prior notice and adopts the following recitals and resolutions:",
      "## Recitals",
      "WHEREAS, {{hintergrund}};",
      "WHEREAS, the Member has determined that the action described below is in the best interests of the Company;",
      "## Resolutions",
      "NOW, THEREFORE, BE IT RESOLVED, that {{beschluss}};",
      "RESOLVED FURTHER, that the Member, acting alone, is authorized and directed to execute and deliver all agreements, certificates and other documents, to make all filings and payments and to take all other actions the Member considers necessary or appropriate to carry out the foregoing resolution;",
      "RESOLVED FURTHER, that any action taken by the Member before the date of this consent that is consistent with the foregoing resolutions is ratified, confirmed and approved in all respects.",
      "## Effectiveness",
      "This written consent is effective as of {{wirksamAm}}, shall be filed with the records of the Company, and may be signed electronically. It was signed on {{heute}}.",
    ],
    unterschriften: ["Sole Member"],
    art: "sonstiges",
  },

  // ── 5 Limited Power of Attorney ──────────────────────────────────────────
  {
    id: "limited-power-of-attorney",
    titel: "Beschränkte Vollmacht für Verwaltungsangelegenheiten",
    dokumentTitel: "Limited Power of Attorney",
    sprache: "en",
    wozu: "Erlaubt einer Person oder Firma, genau bestimmte Aufgaben für Ihre LLC zu erledigen — nicht mehr.",
    wann: "Wenn jemand für Ihre LLC Einreichungen oder Verwaltungsaufgaben übernehmen soll. Für Steuersachen beim IRS gelten eigene Formulare (Form 2848 oder Form 8821).",
    felder: [
      F_LLC, F_STAAT, F_AZ, F_US_ADRESSE, F_INHABER, F_HEUTE,
      { key: "bevollmaechtigter", label: "Bevollmächtigte Person oder Firma", typ: "text", pflicht: true, hilfe: "Voller Name; bei einer Firma mit Rechtsform." },
      { key: "bevollmaechtigterAnschrift", label: "Anschrift der bevollmächtigten Person", typ: "text", pflicht: true },
      { key: "umfang", label: "Umfang der Vollmacht (englisch)", typ: "langtext", pflicht: true, hilfe: "Jede Aufgabe einzeln aufzählen, zum Beispiel „to prepare and file the annual report and statements of change with the Florida Division of Corporations“. Keine Steuersachen — dafür gibt es die IRS-Formulare." },
      { key: "gueltigBis", label: "Gültig bis", typ: "datum", pflicht: true, hilfe: "Ein festes Enddatum; die Vollmacht lässt sich vorher jederzeit widerrufen." },
    ],
    text: [
      "KNOW ALL PERSONS BY THESE PRESENTS, that {{llcName}}, a {{bundesstaatName}} limited liability company with document number {{aktenzeichen}} and its principal office at {{usAdresse}} (the “Company”), acting through its sole member {{inhaberName}}, hereby appoints {{bevollmaechtigter}}, of {{bevollmaechtigterAnschrift}} (the “Attorney-in-Fact”), as its true and lawful attorney-in-fact, with the limited authority set forth below.",
      "## 1. Scope of Authority",
      "1.1 The Attorney-in-Fact is authorized, in the name and on behalf of the Company, to perform the following acts and no others: {{umfang}}.",
      "1.2 The Attorney-in-Fact may sign, file and deliver the documents and take the actions reasonably necessary to carry out the matters listed in Section 1.1, and may receive correspondence relating to those matters.",
      "## 2. Limitations",
      "2.1 Unless expressly listed in Section 1.1, the Attorney-in-Fact has no authority to (a) borrow money or grant security interests or guarantees on behalf of the Company, (b) sell, transfer or encumber any asset of the Company, (c) open or close any bank or payment account of the Company or give payment instructions on it, (d) enter into contracts other than those required for the listed matters, (e) admit members, transfer membership interests or amend the Company's articles of organization or operating agreement, or (f) dissolve the Company.",
      "2.2 This power of attorney does not authorize the Attorney-in-Fact to represent the Company or its member before the Internal Revenue Service or to receive confidential tax information. Authorization for federal tax matters requires the forms prescribed by the Internal Revenue Service, in particular Form 2848 (Power of Attorney and Declaration of Representative) or Form 8821 (Tax Information Authorization).",
      "2.3 The Attorney-in-Fact may not delegate the authority granted herein without the prior written consent of the Company.",
      "## 3. Term and Revocation",
      "3.1 This power of attorney is effective as of {{heute}} and terminates automatically at the end of {{gueltigBis}}, unless revoked earlier.",
      "3.2 The Company may revoke this power of attorney at any time by written notice to the Attorney-in-Fact. A revocation is effective against a third party once the third party has received written notice of it or has actual knowledge of it.",
      "3.3 This power of attorney also terminates upon the filing of articles of dissolution of the Company.",
      "## 4. Reliance, Duties and Governing Law",
      "4.1 Any third party may rely on this power of attorney, or on a copy of it, until the third party receives written notice of its revocation or termination.",
      "4.2 The Attorney-in-Fact shall act in good faith, within the scope of the authority granted and in the best interests of the Company, shall keep a record of all acts performed under this power of attorney, and shall report them to the Company upon request.",
      "4.3 This power of attorney is governed by the laws of the State of {{bundesstaatName}}. Where a recipient requires that the signature be witnessed or acknowledged before a notary public, the Company will arrange for such formalities.",
      "IN WITNESS WHEREOF, the Company has caused this Limited Power of Attorney to be executed by its sole member as of {{heute}}.",
      "## Acceptance by the Attorney-in-Fact",
      "The undersigned Attorney-in-Fact, {{bevollmaechtigter}}, accepts this appointment and agrees to act in accordance with its terms.",
    ],
    unterschriften: ["Sole Member, for the Company", "Attorney-in-Fact", "Witness (name and address)"],
    art: "vollmacht",
  },

  // ── 6 Mutual NDA ─────────────────────────────────────────────────────────
  {
    id: "mutual-nda",
    titel: "Gegenseitige Geheimhaltungsvereinbarung (Mutual NDA)",
    dokumentTitel: "Mutual Non-Disclosure Agreement",
    sprache: "en",
    wozu: "Schützt vertrauliche Informationen, die Sie und Ihr Gegenüber vor einem möglichen Geschäft austauschen.",
    wann: "Bevor Sie Preise, Kundendaten, Technik oder Pläne mit einem möglichen Partner, Lieferanten oder Käufer teilen.",
    felder: [
      F_LLC, F_STAAT, F_US_ADRESSE, F_INHABER, F_HEUTE,
      { key: "gegenpartei", label: "Name der Gegenpartei", typ: "text", pflicht: true, hilfe: "Voller Name, bei Firmen mit Rechtsform, zum Beispiel „Muster GmbH, a German limited liability company“." },
      { key: "gegenparteiAnschrift", label: "Anschrift der Gegenpartei", typ: "text", pflicht: true },
      { key: "gegenparteiVertreter", label: "Unterzeichner der Gegenpartei", typ: "text", pflicht: true, hilfe: "Name und Titel, zum Beispiel „Erika Muster, Managing Director“." },
      { key: "zweck", label: "Zweck des Austauschs (englisch)", typ: "langtext", pflicht: true, hilfe: "Klein beginnen, zum Beispiel „evaluating a potential distribution partnership for the Company's products“." },
      { key: "laufzeit", label: "Zeitraum für den Austausch", typ: "auswahl", pflicht: true, optionen: ["one (1) year", "two (2) years", "three (3) years"], hilfe: "So lange gelten neu ausgetauschte Informationen als erfasst." },
      { key: "nachwirkung", label: "Geheimhaltung danach", typ: "auswahl", pflicht: true, optionen: ["two (2) years", "three (3) years", "five (5) years"], hilfe: "So lange gilt die Pflicht nach dem Ende des Austauschs; Geschäftsgeheimnisse sind unbefristet geschützt, solange sie geheim sind." },
      F_GERICHT,
    ],
    text: [
      "This Mutual Non-Disclosure Agreement (this “Agreement”) is entered into as of {{heute}} (the “Effective Date”) between {{llcName}}, a {{bundesstaatName}} limited liability company with its principal office at {{usAdresse}} (the “Company”), and {{gegenpartei}}, with its address at {{gegenparteiAnschrift}} (the “Counterparty”). The Company and the Counterparty are each a “Party” and together the “Parties”.",
      "## 1. Purpose",
      "The Parties wish to exchange certain confidential information solely for the purpose of {{zweck}} (the “Purpose”). Each Party may act as a disclosing party (“Discloser”) and as a receiving party (“Recipient”).",
      "## 2. Confidential Information",
      "2.1 “Confidential Information” means all non-public information disclosed by or on behalf of a Discloser to the Recipient, whether before or after the Effective Date and whether in oral, written, electronic or any other form, that is marked or identified as confidential or that a reasonable person would understand to be confidential given the nature of the information and the circumstances of disclosure, including business plans, customer and supplier information, pricing, financial information, know-how, software, designs and trade secrets.",
      "2.2 Confidential Information does not include information that the Recipient can demonstrate (a) is or becomes publicly available through no fault of the Recipient, (b) was lawfully known to the Recipient before disclosure without an obligation of confidentiality, (c) is lawfully received from a third party without an obligation of confidentiality, or (d) is independently developed by the Recipient without use of or reference to the Discloser's Confidential Information.",
      "## 3. Obligations of the Recipient",
      "3.1 The Recipient shall (a) use the Discloser's Confidential Information solely for the Purpose, (b) not disclose it to any third party except as permitted in this Agreement, and (c) protect it with at least the degree of care it uses to protect its own confidential information of a similar nature, and in no event with less than reasonable care.",
      "3.2 The Recipient may disclose Confidential Information to its owners, managers, employees, contractors and professional advisers who need to know it for the Purpose and who are bound by confidentiality obligations no less protective than those in this Agreement. The Recipient is responsible for any breach of this Agreement by such persons.",
      "3.3 If the Recipient is required by law, regulation or court order to disclose Confidential Information, it may do so to the extent required, provided that, where legally permitted, it gives the Discloser prompt written notice and reasonable assistance in seeking a protective order.",
      "## 4. No License; No Obligation to Proceed",
      "All Confidential Information remains the property of the Discloser. Nothing in this Agreement grants the Recipient any license or right in any patent, trademark, copyright, trade secret or other intellectual property of the Discloser. Neither Party is obligated to disclose any particular information or to enter into any further agreement or transaction. Confidential Information is provided “as is”, without any warranty as to its accuracy or completeness.",
      "## 5. Term and Return of Information",
      "5.1 This Agreement applies to Confidential Information disclosed during a period of {{laufzeit}} from the Effective Date (the “Disclosure Period”). Either Party may end the Disclosure Period earlier by written notice to the other Party.",
      "5.2 The obligations of the Recipient under this Agreement survive for {{nachwirkung}} after the end of the Disclosure Period and, with respect to trade secrets, for as long as such information remains a trade secret under applicable law.",
      "5.3 Upon the Discloser's written request, the Recipient shall promptly return or destroy the Discloser's Confidential Information and confirm this in writing, except for copies that must be retained under mandatory law or that exist in automatic electronic backups, which remain subject to this Agreement.",
      "## 6. Remedies",
      "Each Party acknowledges that unauthorized use or disclosure of Confidential Information may cause irreparable harm for which monetary damages would be an inadequate remedy. The Discloser is therefore entitled to seek injunctive relief, in addition to any other remedies available at law or in equity, without posting a bond to the extent permitted by law.",
      "## 7. Governing Law and Venue",
      "This Agreement is governed by the laws of the State of {{bundesstaatName}}, without regard to its conflict of laws principles. The state and federal courts located in {{gerichtsstand}} have exclusive jurisdiction over any dispute arising out of or relating to this Agreement, except that either Party may seek injunctive relief in any competent court.",
      "## 8. Miscellaneous",
      "This Agreement constitutes the entire agreement between the Parties regarding its subject matter and supersedes all prior understandings. It may be amended only in a writing signed by both Parties. Neither Party may assign this Agreement without the prior written consent of the other Party. If any provision is held unenforceable, the remaining provisions remain in effect. This Agreement may be signed electronically and in counterparts.",
      "Signed for the Company by {{inhaberName}}, Sole Member, and for the Counterparty by {{gegenparteiVertreter}}.",
    ],
    unterschriften: ["For the Company: Sole Member", "For the Counterparty: Authorized Signatory"],
    art: "sonstiges",
  },

  // ── 7 Services Agreement ─────────────────────────────────────────────────
  {
    id: "service-agreement",
    titel: "Dienstleistungsvertrag (Services Agreement)",
    dokumentTitel: "Services Agreement",
    sprache: "en",
    wozu: "Regelt Leistung, Vergütung, Rechte an Ergebnissen, Haftung und Kündigung, wenn Ihre LLC Leistungen für Geschäftskunden erbringt.",
    wann: "Vor Beginn eines Auftrags für einen Geschäftskunden. Für Verbraucher gelten zusätzliche Regeln, besonders in der EU.",
    felder: [
      F_LLC, F_STAAT, F_US_ADRESSE, F_INHABER, F_HEUTE,
      { key: "kunde", label: "Name des Auftraggebers", typ: "text", pflicht: true, hilfe: "Voller Name mit Rechtsform, zum Beispiel „Muster AG, a Swiss stock corporation“." },
      { key: "kundeAnschrift", label: "Anschrift des Auftraggebers", typ: "text", pflicht: true },
      { key: "kundeVertreter", label: "Unterzeichner des Auftraggebers", typ: "text", pflicht: true, hilfe: "Name und Titel der Person, die für den Auftraggeber unterschreibt." },
      { key: "leistung", label: "Leistungsbeschreibung (englisch)", typ: "langtext", pflicht: true, hilfe: "Was genau Sie liefern, mit Ergebnissen, Umfang und Terminen. Je konkreter, desto weniger Streit." },
      { key: "beginn", label: "Leistungsbeginn", typ: "datum", pflicht: true },
      { key: "verguetung", label: "Vergütung (englisch)", typ: "text", pflicht: true, hilfe: "Betrag, Währung und Abrechnungsart, zum Beispiel „USD 4,500 per month, invoiced monthly in advance“." },
      { key: "zahlungsziel", label: "Zahlungsziel", typ: "auswahl", pflicht: true, optionen: ["upon receipt of the invoice", "within fifteen (15) days after the invoice date", "within thirty (30) days after the invoice date"] },
      { key: "kuendigungsfrist", label: "Ordentliche Kündigungsfrist", typ: "auswahl", pflicht: true, optionen: ["thirty (30) days'", "sixty (60) days'", "ninety (90) days'"], hilfe: "Wie lange vorher eine Seite ohne besonderen Grund kündigen muss." },
      F_GERICHT,
    ],
    text: [
      "This Services Agreement (this “Agreement”) is entered into as of {{heute}} between {{llcName}}, a {{bundesstaatName}} limited liability company with its principal office at {{usAdresse}} (the “Provider”), and {{kunde}}, with its address at {{kundeAnschrift}} (the “Client”). The Provider and the Client are each a “Party” and together the “Parties”. This Agreement is intended for business customers and not for consumers.",
      "## 1. Services",
      "1.1 The Provider shall perform the following services (the “Services”), beginning on {{beginn}}: {{leistung}}.",
      "1.2 The Provider shall perform the Services in a professional and workmanlike manner, using personnel with appropriate skills. The Provider determines the manner and means of performing the Services and may use subcontractors, for whose performance it remains responsible.",
      "1.3 The Client shall provide in a timely manner the information, access and decisions reasonably required for the Services. The Provider is not responsible for delays caused by the Client's failure to do so.",
      "1.4 Any change to the scope of the Services requires a written change order signed by both Parties, including any adjustment of fees and schedule.",
      "## 2. Fees and Payment",
      "2.1 The Client shall pay the Provider the following fees: {{verguetung}}. Unless stated otherwise, fees are exclusive of any sales, use, value added or similar taxes, which shall be borne by the Client where applicable.",
      "2.2 Invoices are payable {{zahlungsziel}}. Amounts not paid when due bear interest at the lesser of one percent (1%) per month or the maximum rate permitted by law, and the Provider may, after written notice, suspend the Services until all overdue amounts have been paid.",
      "2.3 The Client shall reimburse reasonable expenses that it has approved in advance and that the Provider incurs in performing the Services, against receipts.",
      "## 3. Intellectual Property",
      "3.1 Upon full payment of all fees due, the Client shall own the deliverables created specifically for the Client under this Agreement (the “Deliverables”).",
      "3.2 The Provider retains all rights in its pre-existing materials, tools, templates, know-how and general skills (the “Provider Materials”) and grants the Client a non-exclusive, perpetual, royalty-free license to use Provider Materials incorporated in the Deliverables solely in connection with the Deliverables.",
      "## 4. Confidentiality",
      "Each Party shall keep confidential all non-public information received from the other Party in connection with this Agreement, use it only to perform or receive the Services, and protect it with reasonable care. This obligation survives termination for three (3) years and, for trade secrets, for as long as they remain trade secrets.",
      "## 5. Warranties and Limitation of Liability",
      "5.1 Each Party represents that it has full power and authority to enter into this Agreement. Except as expressly stated in this Agreement, the Provider makes no warranties, express or implied, including any implied warranties of merchantability or fitness for a particular purpose.",
      "5.2 EXCEPT FOR LIABILITY ARISING FROM GROSS NEGLIGENCE, WILLFUL MISCONDUCT, FRAUD OR A PARTY'S PAYMENT OBLIGATIONS, NEITHER PARTY SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE OR DATA, ARISING OUT OF OR RELATING TO THIS AGREEMENT, EVEN IF ADVISED OF THEIR POSSIBILITY.",
      "5.3 EXCEPT FOR THE LIABILITIES EXCLUDED FROM SECTION 5.2, EACH PARTY'S TOTAL LIABILITY ARISING OUT OF OR RELATING TO THIS AGREEMENT SHALL NOT EXCEED THE TOTAL FEES PAID OR PAYABLE UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.",
      "## 6. Term and Termination",
      "6.1 This Agreement begins on the date stated above and continues until terminated in accordance with this Section 6.",
      "6.2 Either Party may terminate this Agreement for convenience upon {{kuendigungsfrist}} prior written notice to the other Party.",
      "6.3 Either Party may terminate this Agreement immediately by written notice if the other Party materially breaches this Agreement and fails to cure the breach within fifteen (15) days after receiving written notice of it, or if the other Party becomes insolvent or becomes subject to bankruptcy proceedings.",
      "6.4 Upon termination, the Client shall pay for all Services performed and all approved expenses incurred up to the effective date of termination. Sections 2, 3, 4, 5, 7 and 8 survive termination.",
      "## 7. Independent Contractor",
      "The Provider is an independent contractor. Nothing in this Agreement creates a partnership, joint venture, employment or agency relationship between the Parties. Each Party is responsible for its own taxes, insurance and personnel.",
      "## 8. Governing Law, Venue and General Provisions",
      "8.1 This Agreement is governed by the laws of the State of {{bundesstaatName}}, without regard to its conflict of laws principles. The United Nations Convention on Contracts for the International Sale of Goods does not apply. The state and federal courts located in {{gerichtsstand}} have exclusive jurisdiction over any dispute arising out of or relating to this Agreement.",
      "8.2 This Agreement, including any written change orders, is the entire agreement between the Parties regarding its subject matter and supersedes all prior proposals and understandings. Amendments must be in writing and signed by both Parties. Neither Party may assign this Agreement without the other Party's prior written consent, except to a successor to its entire business. Notices must be given in writing to the addresses stated above or to an e-mail address designated in writing. If any provision is held unenforceable, the remaining provisions remain in effect. Neither Party is liable for delays caused by events beyond its reasonable control. This Agreement may be signed electronically and in counterparts.",
      "Signed for the Provider by {{inhaberName}}, Sole Member, and for the Client by {{kundeVertreter}}.",
    ],
    unterschriften: ["For the Provider: Sole Member", "For the Client: Authorized Signatory"],
    art: "sonstiges",
  },

  // ── 8 Certificate of Membership Interest ─────────────────────────────────
  {
    id: "membership-interest-certificate",
    titel: "Anteilsbescheinigung über 100 % (Certificate of Membership Interest)",
    dokumentTitel: "Certificate of Membership Interest",
    sprache: "en",
    wozu: "Bescheinigt, dass Ihnen alle Anteile an Ihrer LLC gehören.",
    wann: "Zusammen mit dem Operating Agreement, wenn eine Bank, ein Käufer oder ein Partner einen Nachweis über das Eigentum an der LLC sehen möchte.",
    felder: [
      F_LLC, F_STAAT, F_AZ, F_GEGRUENDET, F_INHABER, F_INH_ANSCHRIFT, F_HEUTE,
      { key: "zertifikatNummer", label: "Nummer der Bescheinigung", typ: "text", pflicht: true, hilfe: "Fortlaufend; die erste Bescheinigung trägt üblicherweise die Nummer „1“." },
    ],
    text: [
      "## Certificate No. {{zertifikatNummer}} — Membership Interest: 100%",
      "{{llcName}}, a limited liability company organized under the laws of the State of {{bundesstaatName}} on {{gegruendetAm}} under document number {{aktenzeichen}} (the “Company”), hereby certifies that {{inhaberName}}, of {{inhaberAnschrift}}, is the registered holder of one hundred percent (100%) of the membership interests in the Company (the “Interest”), including all rights to share in the profits, losses and distributions of the Company and to participate in its management, subject to the operating agreement of the Company, as amended from time to time (the “Operating Agreement”).",
      "The Interest is transferable only on the books of the Company by the holder in person or by a duly authorized attorney, upon surrender of this certificate properly endorsed, and only in compliance with the Operating Agreement.",
      "## Restrictive Legend",
      "THE INTEREST REPRESENTED BY THIS CERTIFICATE HAS NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933, AS AMENDED, OR UNDER THE SECURITIES LAWS OF ANY STATE OR OTHER JURISDICTION. IT MAY NOT BE SOLD, ASSIGNED, PLEDGED OR OTHERWISE TRANSFERRED EXCEPT PURSUANT TO AN EFFECTIVE REGISTRATION STATEMENT OR AN AVAILABLE EXEMPTION FROM REGISTRATION, AND ONLY IN ACCORDANCE WITH THE OPERATING AGREEMENT.",
      "This certificate is issued as of {{heute}} and is executed on behalf of the Company by its sole member.",
      "## Assignment (to be completed only upon a permitted transfer)",
      "FOR VALUE RECEIVED, the undersigned holder hereby assigns and transfers the Interest represented by this certificate to ______________________________ and irrevocably appoints ______________________________ as attorney to transfer the Interest on the books of the Company, with full power of substitution.",
      "Date: ____________________   Signature of holder: ______________________________",
    ],
    unterschriften: ["Sole Member, for the Company"],
    art: "sonstiges",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// (C) OPERATING AGREEMENT FÜR MEHRERE MITGLIEDER — und die Manager-Fassung (22.10.2026)
// Das Mandat setzt das Operating Agreement selbst (shared/fiaon-global-us-dokumente.ts, US-Format, digital
// unterschrieben). Ein Mitglied: die Vorlage oben (operating-agreement-smllc) — dieselbe Quelle wie das Portal.
// Mehrere Mitglieder: dieser Text. Er steht bewusst NICHT in FACH_VORLAGEN (die Portal-Vorlagen bleiben für die
// Ein-Personen-LLC); Gestaltungen für Investoren oder besondere Gewinnverteilungen gehören zu einer US-Kanzlei.
// „[[SCHEDULE]]“ wird zur Tabelle der Mitglieder mit Anschrift und Anteil.
// ═══════════════════════════════════════════════════════════════════════════
export const OA_MEHRERE_TEXT: readonly string[] = [
  "This Operating Agreement (this “Agreement”) of {{llcName}}, a {{bundesstaatName}} limited liability company (the “Company”), is made and entered into effective as of {{heute}} by and among the {{anzahlWort}} persons listed in Schedule A as members of the Company (each a “Member” and together the “Members”).",
  "## 1. Formation",
  "1.1 Formation. The Company was formed as a limited liability company under the laws of the State of {{bundesstaatName}} by the filing of its articles of organization with the competent state authority on {{gegruendetAm}} under document number {{aktenzeichen}}. The rights and obligations of the Members and the administration of the Company are governed by this Agreement, the articles of organization and the limited liability company act of the State of {{bundesstaatName}}, as amended from time to time (the “Act”). To the extent permitted by the Act, this Agreement controls where it differs from a default rule of the Act.",
  "1.2 Name. The name of the Company is {{llcName}}. The Company may conduct business under that name or under any fictitious name duly registered by the Company.",
  "1.3 Principal Office and Registered Agent. The principal office of the Company is located at {{usAdresse}}, or at such other place as the Members may designate. The registered agent of the Company in the State of {{bundesstaatName}} is {{registeredAgent}}, or such other registered agent as the Members may designate by making the required filing with the state.",
  "1.4 Employer Identification Number. The federal Employer Identification Number of the Company is {{ein}}.",
  "1.5 Term. The existence of the Company commenced on the date its articles of organization became effective and shall continue until the Company is dissolved and its affairs are wound up in accordance with this Agreement and the Act.",
  "## 2. Purpose and Powers",
  "2.1 Purpose. The purpose of the Company is {{zweck}}, and to engage in any other lawful act or activity for which limited liability companies may be organized under the Act.",
  "2.2 Powers. The Company has all powers necessary or convenient to carry out its purpose, including the power to enter into contracts, to open and maintain bank and payment accounts, to borrow money, to acquire, hold and dispose of property, and to sue and be sued in its own name.",
  "## 3. Members, Interests and Capital",
  "3.1 Members and Percentage Interests. The Members of the Company are {{mitgliederListe}}. Each Member holds the percentage of the membership interests in the Company set out next to that Member’s name in Schedule A (the “Percentage Interest”).",
  "3.2 Capital Contributions. Each Member has contributed or will contribute to the Company its initial capital contribution as follows: {{einlage}}. No Member is required to make any additional capital contribution. Additional capital contributions require the consent of Members holding a majority of the Percentage Interests and, unless all Members agree otherwise, shall be made in proportion to the Percentage Interests.",
  "3.3 No Interest; No Withdrawal. No interest shall accrue on any capital contribution. No Member has the right to withdraw or to be repaid any capital contribution except as provided in this Agreement.",
  "3.4 Loans by Members. A Member may lend money to the Company on terms approved in writing by Members holding a majority of the Percentage Interests. A loan by a Member is not a capital contribution and shall be documented and recorded as a loan.",
  "3.5 Capital Accounts. A separate capital account shall be maintained for each Member in accordance with the applicable Treasury Regulations.",
  "## 4. Allocations, Distributions and Tax Matters",
  "4.1 Allocations. Items of income, gain, loss, deduction and credit of the Company shall be allocated among the Members in proportion to their Percentage Interests, except as otherwise required by the Internal Revenue Code and the Treasury Regulations.",
  "4.2 Distributions. The Company may make distributions at such times and in such amounts as Members holding a majority of the Percentage Interests determine. Distributions shall be made to the Members in proportion to their Percentage Interests. No distribution shall be made if, after giving it effect, (a) the Company would not be able to pay its debts as they become due in the ordinary course of its activities, or (b) the Company's total assets would be less than the sum of its total liabilities, or if the distribution would otherwise violate the Act.",
  "4.3 Tax Classification and Partnership Representative. The Members acknowledge that, for United States federal income tax purposes, an eligible entity with two or more owners is classified as a partnership unless an election to be classified otherwise is made. Any election regarding the tax classification of the Company requires the consent of all Members. The Member listed first in Schedule A is designated as the partnership representative of the Company for purposes of the Internal Revenue Code and shall keep the other Members informed of all material tax proceedings. The tax treatment of the Company and of the Members in any jurisdiction is determined by applicable law and not by this Agreement.",
  "## 5. Management",
  "5.1 Member-Managed. The Company is a member-managed limited liability company. Except as provided in Section 5.3, decisions of the Company are made by Members holding a majority of the Percentage Interests.",
  "5.2 Authority to Bind. Each Member, acting alone, is authorized to execute documents and to take actions on behalf of the Company in the ordinary course of its business. A Member may sign on behalf of the Company under the title “Member” or “Managing Member”.",
  "5.3 Major Decisions. The following actions require the written consent of all Members: (a) amending this Agreement or the articles of organization; (b) admitting a new Member; (c) selling, leasing or otherwise disposing of all or substantially all of the assets of the Company; (d) merging, converting or dissolving the Company; and (e) changing the tax classification of the Company.",
  "5.4 Action by Written Consent. Any action required or permitted to be taken by the Members may be taken without a meeting by a written consent signed by Members holding the Percentage Interests required for that action. Written consents shall be kept with the records of the Company.",
  "5.5 Other Activities. A Member may engage in other business activities, whether or not similar to those of the Company, without any obligation to offer an interest in such activities to the Company or the other Members.",
  "## 6. Banking and Records",
  "6.1 Bank Accounts. All funds of the Company shall be deposited in one or more accounts maintained in the name of the Company with banks or other financial institutions selected by the Members. Company funds shall not be commingled with the personal funds of any Member or of any other person.",
  "6.2 Signatories. The Members may designate in writing the persons authorized to sign or transact on the accounts of the Company.",
  "6.3 Books and Records. The Company shall maintain complete and accurate books and records of its business, including a copy of its articles of organization and all amendments, this Agreement and all amendments, all written consents of the Members, its federal, state and local tax returns and reports, and any other records required by the Act. Each Member may inspect the books and records of the Company upon reasonable notice.",
  "6.4 Fiscal Year. The fiscal year of the Company is the calendar year unless the Members determine otherwise.",
  "## 7. Limited Liability and Indemnification",
  "7.1 Limited Liability. Except as otherwise required by the Act, the debts, obligations and other liabilities of the Company, whether arising in contract, tort or otherwise, are solely the debts, obligations and liabilities of the Company. No Member is personally liable for any such debt, obligation or liability solely by reason of being or acting as a member or manager of the Company.",
  "7.2 Indemnification. To the fullest extent permitted by the Act, the Company shall indemnify, defend and hold harmless each Member and any officer of the Company from and against any loss, damage, claim, cost or expense (including reasonable attorneys' fees) incurred by reason of any act or omission performed or omitted in good faith on behalf of the Company, except to the extent arising from conduct for which the Act does not permit indemnification, including conduct involving bad faith, willful or intentional misconduct, or a knowing violation of law.",
  "7.3 No Third-Party Rights. The provisions of this Agreement are solely for the benefit of the Members and the Company and do not confer any rights upon any creditor or other third party.",
  "## 8. Transfer, Admission and Succession",
  "8.1 Restrictions on Transfer. No Member may transfer, pledge or otherwise encumber all or any part of its membership interest without the prior written consent of all other Members. Any transfer in violation of this Section is void.",
  "8.2 Right of First Refusal. A Member wishing to transfer its membership interest to a third party shall first offer it to the other Members, in proportion to their Percentage Interests, on the same terms. The other Members may accept the offer in writing within thirty days.",
  "8.3 Admission of Members. A transferee or a new member is admitted only with the written consent of all Members and upon signing a written acceptance of this Agreement.",
  "8.4 Death or Incapacity of a Member. Upon the death or adjudicated incapacity of a Member, to the extent permitted by the Act, the Company shall not dissolve but shall continue with the remaining Members, and the personal representative or successor of that Member shall hold the economic rights of the membership interest until admitted as a Member in accordance with Section 8.3.",
  "## 9. Dissolution and Winding Up",
  "9.1 Events of Dissolution. The Company shall be dissolved only upon (a) the written decision of all Members to dissolve the Company, (b) the entry of a decree of judicial dissolution, or (c) any other event that requires dissolution under the Act and cannot be avoided under this Agreement.",
  "9.2 Winding Up. Upon dissolution, the Members or a person designated by them shall wind up the affairs of the Company, liquidate its assets, file articles of dissolution with the competent state authority and give notice to known creditors as provided in the Act.",
  "9.3 Order of Distribution. The assets of the Company shall be applied first to the payment of, or reasonable provision for, all debts and liabilities of the Company, including liabilities to Members as creditors, and thereafter distributed to the Members in accordance with their positive capital account balances and then in proportion to their Percentage Interests.",
  "## 10. General Provisions",
  "10.1 Governing Law. This Agreement is governed by and shall be construed in accordance with the laws of the State of {{bundesstaatName}}, without regard to its conflict of laws principles.",
  "10.2 Entire Agreement; Amendments. This Agreement, together with Schedule A, constitutes the entire agreement of the Members with respect to its subject matter and supersedes all prior agreements and understandings. This Agreement may be amended only by a written instrument signed by all Members.",
  "10.3 Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions remain in full force and effect, and the invalid provision shall be deemed replaced by a valid provision that comes closest to its intent.",
  "10.4 Electronic Signature; Counterparts. This Agreement may be signed electronically and in counterparts, and an electronic signature has the same effect as a handwritten signature.",
  "10.5 Headings. Headings are for convenience only and do not affect the interpretation of this Agreement.",
  "## Schedule A — Members and Percentage Interests",
  "Company: {{llcName}}, a {{bundesstaatName}} limited liability company, document number {{aktenzeichen}}, EIN {{ein}}.",
  "[[SCHEDULE]]",
  "IN WITNESS WHEREOF, the undersigned Members have executed this Operating Agreement effective as of {{heute}}.",
];

/** Manager-Fassung: Ziffer 5.1 und 5.2 ersetzen (ein oder mehrere Mitglieder) — gewählt im Mandat („manager-managed“). */
export const OA_MANAGER_ERSATZ: Readonly<Record<string, string>> = {
  "5.1 ": "5.1 Manager-Managed. The Company is a manager-managed limited liability company. {{managerName}} is appointed as the manager of the Company (the “Manager”). The Manager has full authority to manage and control the business and affairs of the Company in the ordinary course, subject to the matters reserved to the members by this Agreement or the Act. The members may remove and replace the Manager at any time by written consent.",
  "5.2 ": "5.2 Authority to Bind. The Manager, acting alone, is authorized to execute any document and to take any action on behalf of the Company in the ordinary course of its business and signs under the title “Manager”. No member acting solely in its capacity as member has authority to bind the Company.",
};
