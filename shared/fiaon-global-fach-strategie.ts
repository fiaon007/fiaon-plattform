// ═══════════════════════════════════════════════════════════════════════════
// STRATEGIEBUCH — Bereich „Strategie & Wachstum“ des Global-Portals (E-341, 12.10.2026)
//
// Zwölf Kapitel, die ein Kunde wie ein Buch liest UND abarbeitet: je Kapitel
// Wissen in Abschnitten, ein Merksatz, „Jetzt umsetzen“ und amtliche Quellen.
// Wortregeln: scripts/pruef-global-fach.ts (Hauswand + Global-Regeln E-188).
// Kein Bankname, keine Frist mit Ziffer, nichts zusagen — über Konto, Karte
// und Kredit entscheidet das jeweilige Institut.
// ═══════════════════════════════════════════════════════════════════════════
import type { FachKapitel } from "./fiaon-global-fach";

const STAND = "Stand: Oktober 2026";

export const FACH_STRATEGIE_KAPITEL: FachKapitel[] = [
  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    id: "erste-wochen-llc",
    bereich: "strategie",
    gruppe: "Fundament",
    titel: "Die ersten Wochen Ihrer LLC — was in welcher Reihenfolge zählt",
    kurz: "Welche Schritte nach der Gründung aufeinander aufbauen und warum die Reihenfolge über Tempo und Bankfähigkeit entscheidet.",
    minuten: 6,
    abschnitte: [
      {
        titel: "Warum die Reihenfolge zählt",
        absaetze: [
          "Mit der Eintragung Ihrer LLC beginnt die eigentliche Arbeit: Aus einer registrierten Gesellschaft wird ein Unternehmen, mit dem Banken, Kunden und Behörden arbeiten können. Fast jeder Schritt setzt einen vorherigen voraus — ohne Steuernummer kein Geschäftskonto, ohne Geschäftskonto keine saubere Buchhaltung, ohne saubere Buchhaltung später kein Kreditgespräch.",
          "Wer die Schritte in der richtigen Reihenfolge geht, spart Rückfragen und vermeidet den häufigsten Fehler der Anfangszeit: Firmendaten, die an verschiedenen Stellen unterschiedlich geschrieben sind. Solche Unstimmigkeiten fallen später bei Bankprüfungen und Auskunfteien auf und lassen sich nur mühsam bereinigen.",
        ],
      },
      {
        titel: "Register, EIN, Geschäftskonto",
        absaetze: [
          "Am Anfang steht die Prüfung der Eintragung. Kontrollieren Sie im Register des Bundesstaats — in Florida auf Sunbiz — den exakten Firmennamen samt Zusatz „LLC“, die Dokumentnummer, die Anschrift des Registered Agent und das Gründungsdatum. Diese Schreibweise ist ab jetzt die einzige, die Sie verwenden.",
          "Danach folgt die Employer Identification Number (EIN), die Steuernummer Ihrer LLC beim IRS. Ohne US-Sozialversicherungsnummer oder ITIN ist der Online-Antrag nicht möglich; ausländische Inhaber beantragen die EIN mit Form SS-4 per Fax oder Post. Die Vergabe ist beim IRS kostenlos. Das Bestätigungsschreiben (CP 575) oder das Fax mit der zugeteilten Nummer gehört zu den wichtigsten Dokumenten Ihrer Firma; geht es verloren, stellt der IRS auf Anfrage eine Bestätigung aus (Letter 147C).",
          "Mit Gründungsurkunde (Articles of Organization), Operating Agreement, EIN-Bestätigung und Reisepass folgt das Geschäftskonto. Bereiten Sie zusätzlich eine kurze Beschreibung Ihres Geschäfts, Ihrer Kunden und der erwarteten Umsätze vor — das verkürzt die Prüfung, weil die Bank genau danach fragt.",
        ],
        liste: [
          "Articles of Organization mit Eintragungsvermerk des Bundesstaats",
          "Operating Agreement, unterschrieben",
          "EIN-Bestätigung (CP 575, Fax des IRS oder Letter 147C)",
          "Reisepass und aktueller Adressnachweis des Inhabers",
          "Vertrag mit dem Registered Agent",
          "Kurzbeschreibung des Geschäfts mit erwarteten Monatsumsätzen",
        ],
      },
      {
        titel: "Adresse, Telefon und Auftritt",
        absaetze: [
          "Die Anschrift Ihres Registered Agent steht beim Bundesstaat als Sitz- und Postanschrift Ihrer Gesellschaft; Zustellungen und Behördenpost kommen dort an. Für Kunden, Lieferanten oder als Shop-Adresse (etwa bei Amazon oder Google) ist sie nicht gedacht — dafür nutzen Sie eine eigene Geschäftsanschrift, und bei FIAON Global helfen wir Ihnen dabei.",
          "Eine US-Telefonnummer, eine Domain mit eigener E-Mail-Adresse und ein schlichter Webauftritt gehören zur Grundausstattung. Name, Anschrift und Telefonnummer müssen überall identisch sein: im Register, bei der Bank, auf der Website, auf Rechnungen und später bei den Auskunfteien.",
        ],
        merke: "Eine Schreibweise, eine Anschrift, eine Telefonnummer — überall. Was im Register steht, ist der Maßstab.",
      },
      {
        titel: "Getrennte Kasse und Belegablage vom ersten Tag an",
        absaetze: [
          "Die Haftungstrennung der LLC lebt davon, dass Firmengeld und Privatgeld nie vermischt werden. Zahlen Sie Ausgaben der LLC ausschließlich vom Geschäftskonto oder mit der Firmenkarte. Bringen Sie Kapital ein, überweisen Sie es mit dem Vermerk „Kapitaleinlage“; entnehmen Sie Gewinne, dann als dokumentierte Entnahme.",
          "Für Einpersonen-LLCs mit ausländischem Inhaber gibt es einen zusätzlichen Grund: Zahlungen zwischen Ihnen und der Gesellschaft — Einlagen, Entnahmen, Darlehen, Erstattungen — sind gegenüber dem IRS jährlich auf Form 5472 zu melden. Wer sie von Anfang an festhält, erspart sich am Jahresende die mühsame Rekonstruktion.",
          "Legen Sie eine digitale Belegablage mit fester Ordnung an: je Monat ein Ordner, darin Rechnungen, Quittungen und Kontoauszüge, einheitlich benannt nach Datum, Vertragspartner und Betrag. Gründungsdokumente und Bescheide gehören in Ihren Tresor im Portal.",
        ],
      },
      {
        titel: "Meldepflichten und Termine im Blick",
        absaetze: [
          "Die Meldung der wirtschaftlich Berechtigten an FinCEN (Beneficial Ownership Information) wurde im März 2025 per Übergangsregel für in den USA gegründete Gesellschaften ausgesetzt; meldepflichtig blieben ausländische Gesellschaften, die in den USA registriert sind. Diese Lage kann sich ändern — prüfen Sie den aktuellen Stand auf fincen.gov oder fragen Sie uns.",
          "Tragen Sie die wiederkehrenden Termine sofort in Ihren Kalender ein: den jährlichen Annual Report im Bundesstaat, die Bundesformulare in Zusammenarbeit mit Ihrer Steuerkanzlei und die jährliche Verlängerung des Registered Agent (bei FIAON Global erledigen wir sie für Sie). Der Bereich „Pflichten“ im Portal zeigt die Termine Ihrer LLC.",
        ],
      },
    ],
    umsetzen: [
      "Firmennamen, Dokumentnummer und Anschrift im Register prüfen und als verbindliche Schreibweise festhalten.",
      "Die EIN mit Form SS-4 beantragen oder die vorhandene Bestätigung im Tresor ablegen.",
      "Die Kontoeröffnungsmappe zusammenstellen: Articles, Operating Agreement, EIN-Bestätigung, Pass, Geschäftsbeschreibung mit erwarteten Umsätzen.",
      "Geschäftsanschrift, US-Telefonnummer und Domain einrichten und überall identisch eintragen.",
      "Die Kapitaleinlage mit klarem Verwendungszweck vom Privat- auf das Geschäftskonto überweisen.",
      "Die Belegablage nach Monaten anlegen und jede Zahlung zwischen Ihnen und der LLC in einer Jahresliste festhalten.",
      "Annual Report, Bundesformulare und Registered Agent als wiederkehrende Termine in den Kalender eintragen.",
    ],
    quellen: [
      { titel: "IRS — EIN beantragen", url: "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online" },
      { titel: "IRS — Form SS-4", url: "https://www.irs.gov/forms-pubs/about-form-ss-4" },
      { titel: "IRS — Form 5472", url: "https://www.irs.gov/forms-pubs/about-form-5472" },
      { titel: "FinCEN — Beneficial Ownership Information", url: "https://www.fincen.gov/boi" },
      { titel: "Florida Division of Corporations (Sunbiz)", url: "https://dos.fl.gov/sunbiz/" },
      { titel: "SBA — Geschäftskonto eröffnen", url: "https://www.sba.gov/business-guide/launch-your-business/open-business-bank-account" },
    ],
    stand: STAND,
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    id: "business-credit-aufbauen",
    bereich: "strategie",
    gruppe: "Bank & Kredit",
    titel: "Geschäftliche Kreditwürdigkeit in den USA aufbauen",
    kurz: "Wie Ihre LLC ein eigenes Kreditprofil bei den Wirtschaftsauskunfteien bekommt und welche Daten darin zählen.",
    minuten: 7,
    abschnitte: [
      {
        titel: "Zwei Profile, die getrennt zählen",
        absaetze: [
          "In den USA gibt es zwei Welten der Kreditwürdigkeit: das persönliche Profil bei den Verbraucher-Auskunfteien, gebunden an eine Sozialversicherungsnummer oder ITIN, und das Profil Ihrer Firma bei den Wirtschaftsauskunfteien, gebunden an Firmenname, Anschrift und EIN. Ihre Bonitätshistorie aus Deutschland, Österreich oder der Schweiz wird dabei nicht übernommen — die LLC startet ohne Vorgeschichte.",
          "Das Firmenprofil entsteht nicht durch einen Antrag, sondern aus Daten: Registereinträge, Zahlungserfahrungen von Lieferanten, Kreditkonten, öffentliche Einträge. Die drei großen Wirtschaftsauskunfteien sind Dun & Bradstreet, Experian Business und Equifax Business. Jede führt eigene Profile und eigene Kennzahlen, und nicht jeder Gläubiger meldet an alle drei.",
          "Anders als private Kreditberichte sind Wirtschaftsauskünfte in den USA grundsätzlich für Geschäftspartner abrufbar. Lieferanten, Vermieter, Versicherer und Banken schauen dort nach — oft, bevor Sie davon wissen.",
        ],
      },
      {
        titel: "Die D-U-N-S-Nummer und der Paydex",
        absaetze: [
          "Dun & Bradstreet vergibt die D-U-N-S-Nummer, eine neunstellige Kennung für Ihr Unternehmen. Die Vergabe ist kostenlos; kostenpflichtige Zusatzpakete, die im Antragsweg angeboten werden, sind dafür nicht nötig. Viele Lieferanten, Plattformen und Geschäftspartner nutzen die Nummer, um Ihre Firma eindeutig zu identifizieren.",
          "Der Paydex von Dun & Bradstreet bildet ab, wie pünktlich Ihre Firma ihre Lieferanten bezahlt, auf einer Skala bis 100. Ein Wert von 80 steht für Zahlung zum vereinbarten Termin, höhere Werte für Zahlung vor Fälligkeit, niedrigere für Verzug. Der Wert entsteht erst, wenn mehrere Zahlungserfahrungen gemeldet sind, und er gewichtet nach Rechnungsbetrag.",
          "Experian Business und Equifax Business führen eigene Kennzahlen, die neben dem Zahlungsverhalten auch Firmenalter, Branche, öffentliche Einträge und die Auslastung von Kreditkonten berücksichtigen. Welche Kennzahl ein Geldgeber heranzieht, entscheidet er selbst.",
        ],
      },
      {
        titel: "Konsistente Firmendaten als Fundament",
        absaetze: [
          "Wirtschaftsauskunfteien ordnen Meldungen anhand von Name, Anschrift und Telefonnummer zu. Weicht eine Schreibweise ab — „Inc.“ statt „LLC“, eine fehlende Suite-Nummer, eine alte Telefonnummer —, landen Zahlungserfahrungen womöglich in einer zweiten, unvollständigen Akte. Achten Sie deshalb darauf, dass Register, Bank, Website, Rechnungen, Branchenverzeichnisse und Lieferantenkonten exakt dieselben Daten tragen.",
        ],
        liste: [
          "Exakter Firmenname laut Register, einschließlich „LLC“",
          "Eine feste Geschäftsanschrift, die nicht wechselt",
          "Eine US-Telefonnummer, unter der die Firma erreichbar ist",
          "EIN und D-U-N-S-Nummer",
          "Website und geschäftliche E-Mail-Adresse auf eigener Domain",
        ],
      },
      {
        titel: "Lieferanten mit Zahlungsziel: Net 30",
        absaetze: [
          "Der klassische Einstieg sind Lieferantenkonten mit Zahlungsziel, in den USA meist „Net 30“ genannt: Sie beziehen Ware oder Leistung und begleichen die Rechnung binnen dreißig Tagen. Jede pünktlich bezahlte Rechnung wird zu einer Zahlungserfahrung — sofern der Lieferant sie meldet.",
          "Genau darauf kommt es an. Fragen Sie vor der Kontoeröffnung ausdrücklich, an welche Wirtschaftsauskunftei der Lieferant meldet. Bürobedarf, Verpackung, Versand oder Software sind typische Bereiche, in denen solche Konten angeboten werden — kaufen Sie dort, was Ihr Unternehmen ohnehin braucht, statt Umsätze nur für das Profil zu erzeugen.",
          "Zahlen Sie früh statt gerade noch pünktlich, wo es Ihre Liquidität zulässt. Bewährt hat sich, Rechnungen einige Tage vor Fälligkeit zu begleichen und die Zahlungsbelege abzulegen. Ein einziger deutlich verspäteter Posten wiegt in einem jungen Profil schwer, weil es noch wenige andere Erfahrungen gibt.",
        ],
        merke: "Ein Firmenprofil wächst aus gemeldeten Zahlungen. Kaufen Sie, was Sie brauchen, bei Lieferanten, die melden — und zahlen Sie vor der Fälligkeit.",
      },
      {
        titel: "Profil prüfen und pflegen",
        absaetze: [
          "Sehen Sie sich Ihre Profile in regelmäßigen Abständen an. Dun & Bradstreet bietet Unternehmen die Möglichkeit, den eigenen Eintrag einzusehen und Firmendaten zu aktualisieren. Falsche Einträge — etwa eine fremde Zahlungserfahrung oder ein falsches Gründungsjahr — können Sie bei der jeweiligen Auskunftei mit Belegen beanstanden.",
          "Abkürzungen gibt es nicht. Angebote, die gegen Gebühr ein fertiges Kreditprofil oder gekaufte Lieferantenmeldungen in Aussicht stellen, sind mit großer Vorsicht zu betrachten. Der verlässliche Weg ist langsam, aber belastbar: echte Einkäufe, pünktliche Zahlungen, konsistente Daten — über viele Monate.",
        ],
      },
    ],
    umsetzen: [
      "Die D-U-N-S-Nummer kostenlos bei Dun & Bradstreet beantragen und die Firmendaten exakt wie im Register angeben.",
      "Firmendaten bei Bank, Website, Rechnungen und Verzeichnissen abgleichen und jede Abweichung bereinigen.",
      "Zwei bis drei Lieferanten auswählen, die Zahlungserfahrungen an eine Wirtschaftsauskunftei melden, und dort laufenden Bedarf einkaufen.",
      "Rechnungen einige Tage vor Fälligkeit bezahlen und die Zahlungsbelege im Tresor ablegen.",
      "Einmal im Quartal die eigenen Einträge bei Dun & Bradstreet, Experian Business und Equifax Business ansehen.",
      "Falsche Einträge mit Belegen bei der jeweiligen Auskunftei beanstanden und die Antwort festhalten.",
    ],
    quellen: [
      { titel: "Dun & Bradstreet", url: "https://www.dnb.com/" },
      { titel: "Experian Business", url: "https://www.experian.com/business/" },
      { titel: "Equifax Business", url: "https://www.equifax.com/business/" },
    ],
    stand: STAND,
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    id: "bankbeziehung",
    bereich: "strategie",
    gruppe: "Bank & Kredit",
    titel: "Die Bankbeziehung: Konto, Umsätze, Unterlagen",
    kurz: "Was Banken bei der Eröffnung und im laufenden Betrieb sehen wollen und wie Sie eine Kontobeziehung über Jahre stabil halten.",
    minuten: 7,
    abschnitte: [
      {
        titel: "Was die Bank bei der Eröffnung prüft",
        absaetze: [
          "US-Banken sind gesetzlich verpflichtet, ihre Kunden zu identifizieren und die wirtschaftlich Berechtigten einer Gesellschaft festzustellen (Know Your Customer und Customer Due Diligence). Bei einer LLC mit ausländischem Inhaber fällt diese Prüfung gründlicher aus: Die Bank will verstehen, wer hinter der Firma steht, was sie tut, woher das Geld kommt und welche Umsätze zu erwarten sind.",
          "Aus Ihren Angaben bildet die Bank ein Erwartungsprofil: Branche, Länder der Kunden und Lieferanten, Höhe und Häufigkeit der Zahlungen. Dieses Profil ist der Maßstab für die laufende Überwachung. Je genauer und ehrlicher Sie es bei der Eröffnung beschreiben, desto seltener lösen spätere Buchungen Rückfragen aus.",
        ],
        liste: [
          "Gründungsdokumente und Operating Agreement",
          "EIN-Bestätigung",
          "Reisepass und Adressnachweis des Inhabers",
          "Beschreibung des Geschäftsmodells mit Website",
          "Erwartete Monatsumsätze, Herkunftsländer der Zahlungen, wichtigste Kunden und Lieferanten",
          "Nachweis der Herkunft des Startkapitals",
        ],
      },
      {
        titel: "Herkunft der Mittel: die Mappe, die Sie immer bereithalten",
        absaetze: [
          "Fragen zur Herkunft der Mittel (Source of Funds) gehören zum Alltag. Halten Sie für jede größere Einzahlung einen Beleg griffbereit: die Rechnung, zu der eine Kundenzahlung gehört, den Vertrag, den Auszug des Privatkontos bei einer Kapitaleinlage, den Darlehensvertrag bei einem Gesellschafterdarlehen.",
          "Kommt eine Rückfrage der Bank (Request for Information), antworten Sie zügig, vollständig und sachlich — mit Dokumenten statt Erklärungen. Unbeantwortete oder ausweichend beantwortete Rückfragen gehören zu den häufigsten Gründen, aus denen Banken Konten schließen.",
        ],
        merke: "Jede Zahlung braucht eine Geschichte, die ein Dokument belegt. Wer die Belege griffbereit hat, beantwortet Rückfragen in Minuten statt in Tagen.",
      },
      {
        titel: "Umsätze, die Vertrauen schaffen",
        absaetze: [
          "Banken achten auf ein schlüssiges Bild: regelmäßige Eingänge von Kunden, Ausgaben, die zum Geschäftsmodell passen, und einen Saldo, der nicht ständig gegen null läuft. Ein Konto, auf dem Zahlungen nur eingehen, um sofort weiterzufließen, wirkt wie eine Durchlaufstation — genau das Muster, nach dem Prüfsysteme suchen.",
          "Auffällig sind zudem viele kleine Eingänge von unbekannten Privatpersonen, Zahlungen aus Ländern, die nicht zum beschriebenen Geschäft passen, runde Beträge ohne Rechnungsbezug sowie Kryptowerte ohne nachvollziehbare Herkunft. Ändert sich Ihr Geschäft — neues Produkt, neuer Markt, deutlich höhere Umsätze —, informieren Sie die Bank vorab, nicht erst auf Nachfrage.",
        ],
      },
      {
        titel: "Bargeld: klare Regeln",
        absaetze: [
          "Bareinzahlungen von mehr als 10.000 US-Dollar an einem Geschäftstag meldet die Bank automatisch an die Behörden (Currency Transaction Report). Das ist Routine und kein Vorwurf. Strafbar ist dagegen, Bareinzahlungen absichtlich aufzuteilen, um diese Meldung zu vermeiden (Structuring) — auch dann, wenn das Geld selbst aus legalen Geschäften stammt.",
          "Nimmt Ihr Unternehmen selbst Bargeld von mehr als 10.000 US-Dollar in einem Geschäftsvorgang an, ist dafür eine eigene Meldung an den IRS vorgesehen (Form 8300). Die meisten Dienstleistungs- und Onlinefirmen arbeiten ohnehin bargeldlos — und sind damit für Banken leichter nachzuvollziehen.",
        ],
      },
      {
        titel: "Stabilität: zweites Konto und Einlagenschutz",
        absaetze: [
          "Auch ohne Fehlverhalten kann eine Bank eine Geschäftsbeziehung beenden, häufig ohne Angabe von Gründen. Bewährt hat sich deshalb ein zweites Geschäftskonto bei einem anderen Institut, auf dem eine Reserve liegt und über das Sie im Ernstfall weiterarbeiten können.",
          "Einlagen bei US-Banken sind über die FDIC je Einleger, je Bank und je Eigentumskategorie bis 250.000 US-Dollar abgesichert. Viele Finanz-Apps sind selbst keine Bank, sondern arbeiten mit Partnerbanken. Prüfen Sie, bei welcher Bank Ihr Geld tatsächlich liegt und wie der Einlagenschutz dort geregelt ist.",
        ],
      },
    ],
    umsetzen: [
      "Ein kurzes Geschäftsprofil schreiben — Tätigkeit, Kunden, Länder, erwartete Monatsumsätze — und es der Bank vorlegen.",
      "Eine Mappe zur Herkunft der Mittel anlegen: Einlagenbelege, Verträge, Rechnungen zu großen Eingängen.",
      "Rückfragen der Bank am selben oder nächsten Werktag mit Dokumenten beantworten.",
      "Jede Kundenzahlung einer Rechnung zuordnen und die Rechnungsnummer im Verwendungszweck erbitten.",
      "Bargeld meiden; falls es doch anfällt, Einzahlungen niemals aufteilen.",
      "Ein zweites Geschäftskonto bei einem anderen Institut als Reserve eröffnen.",
      "Prüfen, bei welcher Bank Ihre Einlagen tatsächlich liegen und wie sie gesichert sind.",
    ],
    quellen: [
      { titel: "FinCEN — Financial Crimes Enforcement Network", url: "https://www.fincen.gov/" },
      { titel: "IRS — Form 8300", url: "https://www.irs.gov/forms-pubs/about-form-8300" },
      { titel: "FDIC — Einlagensicherung", url: "https://www.fdic.gov/" },
      { titel: "SBA — Geschäftskonto eröffnen", url: "https://www.sba.gov/business-guide/launch-your-business/open-business-bank-account" },
    ],
    stand: STAND,
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    id: "kartenleiter",
    bereich: "strategie",
    gruppe: "Bank & Kredit",
    titel: "Die Kartenleiter — Firmenkarten Schritt für Schritt",
    kurz: "Wie eine Abfolge von Firmenkarten entsteht, was die persönliche Haftung bedeutet und welches Verhalten Herausgeber über Monate beobachten.",
    minuten: 7,
    abschnitte: [
      {
        titel: "Das Prinzip",
        absaetze: [
          "Die Kartenleiter beschreibt einen Weg in Stufen: zuerst eine Karte, die mit wenig Vorgeschichte erreichbar ist, dann — nach einigen Monaten sauberer Nutzung — die nächste Stufe mit höherem Rahmen oder besseren Konditionen. Jede Stufe liefert Daten, auf die sich die nächste Entscheidung stützen kann.",
          "Über jede Karte und jeden Rahmen entscheidet allein der Herausgeber. Er prüft Firmenprofil, Bankumsätze, Angaben zum Inhaber und häufig dessen persönliche Kredithistorie. Die Kartenleiter ist deshalb kein Automatismus, sondern eine Ordnung, die Ihre Ausgangslage Schritt für Schritt belastbarer macht. FIAON bereitet die Anträge jeder Stufe mit Ihnen vor; die Entscheidung trifft das Institut.",
        ],
      },
      {
        titel: "Die typischen Stufen",
        absaetze: [
          "Welche Stufe für Sie der Einstieg ist, hängt von Ihrer Ausgangslage ab. Viele Herausgeber verlangen für den Antrag eine US-Sozialversicherungsnummer oder ITIN und eine persönliche US-Kredithistorie; ohne sie kommen zunächst Karten in Betracht, die sich auf ein hinterlegtes Guthaben oder auf die bestehende Bankbeziehung stützen. Eine ITIN gibt es nur aus steuerlichem Anlass (Form W-7) — sie ist kein Werkzeug für Kartenanträge.",
        ],
        liste: [
          "Einstieg: gesicherte Firmenkarte gegen Hinterlegung eines Guthabens oder Karte der kontoführenden Bank, die Ihre Umsätze bereits kennt",
          "Zweite Stufe: Karte mit monatlicher Ausgleichspflicht (Charge Card), deren Saldo jeden Monat vollständig beglichen wird",
          "Dritte Stufe: Kreditkarte mit revolvierendem Rahmen, später Anfragen nach einer Rahmenanpassung",
          "Danach: Kreditlinie der Bank, gestützt auf Umsatzhistorie und Jahresabschlüsse",
        ],
      },
      {
        titel: "Persönliche Haftung: was Sie unterschreiben",
        absaetze: [
          "Die meisten Firmenkarten in den USA setzen eine persönliche Haftung des Inhabers voraus (Personal Guarantee). Sie unterschreiben damit, dass Sie persönlich für den Saldo einstehen, wenn die LLC nicht zahlt. Die Haftungstrennung der LLC gilt für diese Schuld also nicht — die persönliche Haftung ist die eigentliche Sicherheit des Herausgebers.",
          "Hinzu kommt: Schutzvorschriften für Verbraucherkarten, etwa aus dem CARD Act, gelten für Firmenkarten weitgehend nicht. Herausgeber können Konditionen bei Firmenkarten freier anpassen. Lesen Sie die Kartenbedingungen deshalb vollständig, besonders zu Zinsen, Gebühren und Rahmenänderungen.",
        ],
        merke: "Eine Firmenkarte ist fast immer auch Ihre persönliche Verpflichtung. Nutzen Sie sie so, als wäre es Ihr eigenes Konto.",
      },
      {
        titel: "Verhalten, das Herausgeber sehen",
        absaetze: [
          "Pünktlichkeit ist die wichtigste Größe. Richten Sie eine automatische Zahlung mindestens des Mindestbetrags ein und begleichen Sie den vollständigen Saldo zusätzlich von Hand. Eine einzige verspätete Zahlung bleibt lange sichtbar.",
          "Halten Sie die Auslastung niedrig. Wo Herausgeber Kartendaten an Auskunfteien melden, ist das in der Regel der Saldo zum Abrechnungsstichtag, nicht der Saldo am Fälligkeitstag. Wer vor dem Stichtag einen Teil zurückzahlt, zeigt eine niedrige Auslastung, auch wenn die Karte im Monat stark genutzt wurde. Als Faustregel gilt häufig: deutlich unter einem Drittel des Rahmens.",
          "Nutzen Sie jede Karte regelmäßig mit echten Geschäftsausgaben. Eine Karte, die monatelang ruht, liefert keine Daten; ein Rahmen, der dauernd ausgeschöpft ist, signalisiert Engpässe. Manche Firmenkarten erscheinen nur in den Wirtschaftsauskünften, andere zusätzlich in der persönlichen Kredithistorie — fragen Sie vor dem Antrag, wohin der Herausgeber meldet.",
        ],
      },
      {
        titel: "Anträge mit Abstand",
        absaetze: [
          "Jeder Kartenantrag löst in der Regel eine harte Anfrage (Hard Inquiry) aus, die in der persönlichen Kredithistorie erscheint. Mehrere Anfragen in kurzer Folge wirken auf Herausgeber wie dringender Geldbedarf. Bewährt hat sich, zwischen zwei Anträgen einige Monate verstreichen zu lassen und die nächste Stufe erst anzugehen, wenn die aktuelle Karte eine saubere Zahlungshistorie zeigt.",
          "Wird ein Antrag abgelehnt, nennt der Herausgeber auf Nachfrage in der Regel die Gründe. Notieren Sie sie und arbeiten Sie gezielt daran, bevor Sie einen neuen Antrag stellen — ein sofortiger zweiter Antrag bei einem anderen Herausgeber ändert die Ausgangslage nicht, er fügt nur eine weitere Anfrage hinzu.",
        ],
      },
    ],
    umsetzen: [
      "Klären, ob Sie eine SSN oder ITIN besitzen, und daraus den passenden Einstieg ableiten.",
      "Kartenbedingungen vor dem Antrag vollständig lesen, besonders zu persönlicher Haftung, Zinsen und Gebühren.",
      "Eine automatische Zahlung für den Mindestbetrag einrichten und den Saldo jeden Monat vollständig begleichen.",
      "Den Abrechnungsstichtag jeder Karte notieren und vor diesem Tag einen Teil des Saldos zurückzahlen.",
      "Jede Karte monatlich mit regulären Geschäftsausgaben nutzen.",
      "Zwischen zwei Anträgen einige Monate Abstand halten und jeden Antrag mit Datum festhalten.",
      "Ablehnungsgründe schriftlich anfordern und vor dem nächsten Antrag bearbeiten.",
    ],
    quellen: [
      { titel: "IRS — Individual Taxpayer Identification Number (ITIN)", url: "https://www.irs.gov/individuals/individual-taxpayer-identification-number" },
      { titel: "IRS — Form W-7", url: "https://www.irs.gov/forms-pubs/about-form-w-7" },
      { titel: "SBA — Finanzierung Ihres Unternehmens", url: "https://www.sba.gov/business-guide/plan-your-business/fund-your-business" },
    ],
    stand: STAND,
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    id: "kredit-vorbereiten",
    bereich: "strategie",
    gruppe: "Bank & Kredit",
    titel: "Kreditrahmen und Darlehen vorbereiten",
    kurz: "Welche Kennzahlen und Unterlagen Banken bei Kreditlinien und Darlehen prüfen und wie Sie eine Mappe aufbauen, die Fragen vorwegnimmt.",
    minuten: 7,
    abschnitte: [
      {
        titel: "Wie Kreditgeber denken",
        absaetze: [
          "Kreditentscheidungen in den USA folgen häufig dem Raster der „fünf C“: Character (Verlässlichkeit und Vorgeschichte), Capacity (Fähigkeit, aus laufenden Erträgen zu tilgen), Capital (eigenes Geld im Unternehmen), Collateral (Sicherheiten) und Conditions (Verwendungszweck, Branche, Marktlage). Eine gute Kreditmappe beantwortet jede dieser Fragen, bevor sie gestellt wird.",
          "Die zentrale Frage lautet fast immer: Kann das Unternehmen die Raten aus seinem laufenden Ergebnis bezahlen? Persönliches Vermögen und Sicherheiten sind die zweite Verteidigungslinie, nicht die erste.",
        ],
      },
      {
        titel: "Die Kennzahlen, auf die Banken achten",
        absaetze: [
          "Banken lesen Ihre Zahlen nicht einzeln, sondern als Bild. Eine wachsende Firma mit dünner Marge wird anders bewertet als eine stabile mit hoher Marge; ein sauber geführtes Konto zählt oft so viel wie der Jahresabschluss.",
        ],
        liste: [
          "Umsatz und Umsatzentwicklung, möglichst über mehrere Jahre und monatlich nachvollziehbar",
          "Bruttomarge und Nettomarge: Was bleibt vom Umsatz nach direkten Kosten und nach allen Kosten?",
          "Schuldendienstdeckung (DSCR): Ergebnis im Verhältnis zu allen Zins- und Tilgungszahlungen",
          "Liquidität: kurzfristige Mittel im Verhältnis zu kurzfristigen Verbindlichkeiten",
          "Verschuldung: bestehende Kredite, Kartenrahmen und Leasingverträge im Verhältnis zum Ergebnis",
          "Kontoführung: durchschnittlicher Saldo, keine Überziehungen, keine Rücklastschriften",
          "Firmenalter: Viele Banken achten auf eine Geschäftshistorie von mehr als zwei Jahren",
        ],
      },
      {
        titel: "Die DSCR verständlich",
        absaetze: [
          "Die Debt Service Coverage Ratio setzt das Ergebnis, aus dem Zins und Tilgung bezahlt werden, ins Verhältnis zu den jährlichen Raten. Als Ergebnis wird meist der Gewinn vor Zinsen, Steuern und Abschreibungen herangezogen, bereinigt um Entnahmen des Inhabers.",
          "Ein Beispiel: Erwirtschaftet Ihre LLC jährlich 150.000 US-Dollar vor Zinsen, Steuern und Abschreibungen und betragen alle Raten zusammen 100.000 US-Dollar, liegt die DSCR bei 1,5. Viele Banken achten auf einen Wert von etwa 1,25 oder höher; ein Wert unter 1 bedeutet, dass die Raten aus dem laufenden Geschäft nicht gedeckt sind.",
          "Rechnen Sie die DSCR selbst, bevor Sie anfragen — einschließlich der neuen Rate, die Sie beantragen wollen. Liegt der Wert knapp, kann ein kleinerer Betrag, eine längere Laufzeit oder ein späterer Zeitpunkt die stärkere Anfrage sein.",
        ],
      },
      {
        titel: "Die Unterlagen-Mappe",
        absaetze: [
          "Eine vollständige Mappe verkürzt die Prüfung und zeigt Professionalität. Legen Sie sie digital an, mit klaren Dateinamen und einem Inhaltsverzeichnis, und halten Sie sie laufend aktuell.",
        ],
        liste: [
          "Gründungsunterlagen, Operating Agreement, EIN-Bestätigung und aktuelle Bestandsbestätigung des Bundesstaats (Certificate of Status)",
          "Lückenlose Kontoauszüge der Geschäftskonten der letzten Monate",
          "Gewinn- und Verlustrechnung sowie Bilanz für das laufende Jahr und die Vorjahre",
          "Steuererklärungen der Firma und, falls verlangt, des Inhabers",
          "Offene-Posten-Listen der Forderungen und Verbindlichkeiten",
          "Übersicht aller bestehenden Kredite, Karten und Leasingverträge",
          "Kurzer Geschäftsplan mit Verwendungszweck des Kredits",
          "Persönliche Vermögensaufstellung des Inhabers (Personal Financial Statement), wenn eine persönliche Haftung vorgesehen ist",
        ],
      },
      {
        titel: "Verwendungszweck, Sicherungsrechte und Auflagen",
        absaetze: [
          "Banken finanzieren lieber einen konkreten Zweck als einen allgemeinen Bedarf. Beschreiben Sie, wofür das Geld eingesetzt wird, welchen Ertrag es bringen soll und wie die Rückzahlung aus diesem Ertrag aussieht. Ein Lagerbestand, der sich innerhalb eines Quartals umschlägt, oder eine Maschine mit klarer Auslastung sind leichter zu bewerten als „Wachstum“.",
          "Kreditlinien und Darlehen sind in den USA häufig mit einer öffentlichen Eintragung zugunsten des Kreditgebers verbunden (UCC-1 Financing Statement), die ein Sicherungsrecht an Firmenvermögen dokumentiert. Fragen Sie vorab, welche Vermögenswerte erfasst sind und welche Auflagen (Covenants) gelten, etwa Mindestguthaben oder Kennzahlen, die Sie während der Laufzeit einhalten müssen.",
        ],
        merke: "Die stärkste Kreditanfrage ist die, deren Antworten die Bank schon in der Mappe findet.",
      },
    ],
    umsetzen: [
      "Die DSCR für das letzte Geschäftsjahr berechnen — einmal ohne und einmal mit der geplanten neuen Rate.",
      "Die Unterlagen-Mappe nach der Liste anlegen und im Tresor ablegen.",
      "Monatliche Gewinn- und Verlustrechnungen für die zurückliegenden zwölf Monate erstellen lassen.",
      "Den Verwendungszweck auf einer Seite beschreiben: Betrag, Zweck, erwarteter Ertrag, Rückzahlung.",
      "Alle bestehenden Verpflichtungen in einer Tabelle zusammenführen.",
      "Im Bankgespräch nach UCC-Eintragung, Covenants und persönlicher Haftung fragen und die Antworten schriftlich festhalten.",
    ],
    quellen: [
      { titel: "SBA — Geschäftsplan schreiben", url: "https://www.sba.gov/business-guide/plan-your-business/write-your-business-plan" },
      { titel: "SBA — Finanzierung Ihres Unternehmens", url: "https://www.sba.gov/business-guide/plan-your-business/fund-your-business" },
      { titel: "Florida Division of Corporations (Sunbiz)", url: "https://dos.fl.gov/sunbiz/" },
    ],
    stand: STAND,
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    id: "liquiditaetsplan",
    bereich: "strategie",
    gruppe: "Führung & Zahlen",
    titel: "Liquidität planen — der 12-Monats-Plan",
    kurz: "Wie Sie mit einer einfachen, rollierenden Planung sehen, wann Geld knapp wird, und rechtzeitig handeln.",
    minuten: 6,
    abschnitte: [
      {
        titel: "Gewinn ist nicht gleich Liquidität",
        absaetze: [
          "Ein Unternehmen kann auf dem Papier profitabel sein und trotzdem in Zahlungsschwierigkeiten geraten: Kunden zahlen später als geplant, Wareneinkauf und Steuern fallen vorher an, Jahreszahlungen treffen auf einen schwachen Monat. Der Liquiditätsplan zeigt nicht, ob Sie Geld verdienen, sondern ob Sie jederzeit zahlen können.",
          "Für eine LLC im Aufbau reicht eine schlichte Tabelle: zwölf Monate in Spalten, Ein- und Auszahlungen in Zeilen, am Ende jedes Monats der Kontostand. Entscheidend ist nicht die Software, sondern die Disziplin, den Plan monatlich fortzuschreiben.",
        ],
      },
      {
        titel: "Der Aufbau",
        absaetze: [
          "Planen Sie in der Währung, in der Ihr Konto geführt wird, also meist in US-Dollar. Kosten in Euro oder Franken rechnen Sie mit einem vorsichtigen Kurs um, nicht mit dem Tageskurs, der gerade günstig erscheint.",
        ],
        liste: [
          "Anfangsbestand: Guthaben aller Geschäftskonten zum Monatsbeginn",
          "Einzahlungen: je Kunde oder Umsatzquelle, mit dem realistischen Zahlungstermin statt dem Rechnungsdatum",
          "Feste Auszahlungen: Software, Miete, Registered Agent, Versicherungen, Gehälter, Kartenraten",
          "Variable Auszahlungen: Wareneinsatz, Werbung, Provisionen — gekoppelt an den Umsatz",
          "Jährliche und seltene Posten: Annual Report, Steuerkanzlei, Versicherungsprämien, Lizenzen",
          "Einlagen und Entnahmen des Inhabers",
          "Endbestand: Anfangsbestand plus Einzahlungen minus Auszahlungen",
        ],
      },
      {
        titel: "Der Puffer",
        absaetze: [
          "Bewährt hat sich eine Reserve von drei bis sechs Monaten fixer Kosten auf einem getrennten Konto. Junge Unternehmen mit wenigen großen Kunden oder schwankenden Umsätzen liegen eher am oberen Ende. Der Puffer ist kein totes Kapital: Er verschafft Ihnen in einem schwachen Quartal Handlungsfreiheit — und Banken sehen ihn bei der Kontoführung als Zeichen von Stabilität.",
          "Ein Kartenrahmen oder eine Kreditlinie ersetzt keinen Puffer. Rahmen können vom Herausgeber gesenkt werden — häufig gerade dann, wenn die Umsätze sinken und das Geld am dringendsten gebraucht wird.",
        ],
      },
      {
        titel: "Drei Szenarien",
        absaetze: [
          "Rechnen Sie den Plan in drei Varianten: ein Basisszenario mit Ihren realistischen Erwartungen, ein vorsichtiges Szenario mit spürbar weniger Umsatz und späteren Zahlungseingängen und ein Belastungsszenario, in dem Ihr größter Kunde ausfällt. Für jedes Szenario sehen Sie den Monat, in dem der Kontostand unter Ihren Puffer fällt.",
          "Legen Sie für das vorsichtige und das Belastungsszenario vorab Maßnahmen fest: welche Kosten Sie pausieren, welche Zahlungsziele Sie verkürzen, welche Ausgaben Sie verschieben. Entscheidungen, die in ruhigen Zeiten vorbereitet werden, fallen in angespannten Zeiten leichter und schneller.",
        ],
        merke: "Ein Plan ist dann gut, wenn er Ihnen den kritischen Monat zeigt, solange noch Zeit zum Handeln bleibt.",
      },
      {
        titel: "Monatlicher Abgleich und Reichweite",
        absaetze: [
          "Vergleichen Sie zu jedem Monatsende Plan und Ist. Abweichungen sind keine Fehler, sondern Information: Zahlt ein Kunde regelmäßig später, gehört das in die Planung. Danach schreiben Sie den Plan um einen Monat fort, sodass stets zwölf Monate vor Ihnen liegen.",
          "Die Kennzahl, die Sie dauerhaft im Blick behalten, ist die Reichweite: Wie viele Monate deckt Ihr Bestand die festen Kosten, wenn keine neuen Einnahmen kämen? Diese eine Zahl sagt mehr über die Lage als jeder Umsatzrekord.",
        ],
      },
    ],
    umsetzen: [
      "Eine Tabelle mit zwölf Monatsspalten anlegen und den aktuellen Bestand aller Geschäftskonten eintragen.",
      "Alle festen und jährlichen Kosten mit ihrem Fälligkeitsmonat erfassen.",
      "Einzahlungen je Kunde mit realistischem Zahlungstermin planen.",
      "Einen vorsichtigen Umrechnungskurs für Kosten in Euro oder Franken festlegen.",
      "Das vorsichtige und das Belastungsszenario rechnen und je Szenario drei Maßnahmen notieren.",
      "Die Puffergröße in Monatsfixkosten festlegen und ein getrenntes Reservekonto einrichten.",
      "Am Monatsende Plan und Ist abgleichen und den Plan um einen Monat fortschreiben.",
    ],
    quellen: [
      { titel: "SBA — Finanzen führen", url: "https://www.sba.gov/business-guide/manage-your-business/manage-your-finances" },
      { titel: "SBA — Gründungskosten berechnen", url: "https://www.sba.gov/business-guide/plan-your-business/calculate-your-startup-costs" },
    ],
    stand: STAND,
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    id: "preise-rechnungen-waehrung",
    bereich: "strategie",
    gruppe: "Wachstum",
    titel: "Preise, Rechnungen und Währung",
    kurz: "Wie Sie Preise in US-Dollar festlegen, vollständige Rechnungen stellen und das Wechselkursrisiko zwischen Dollar und Euro beherrschen.",
    minuten: 7,
    abschnitte: [
      {
        titel: "Preise für den US-Markt",
        absaetze: [
          "US-Kunden erwarten Preise in US-Dollar, klar gegliedert und ohne versteckte Posten. Leiten Sie Ihre Preise nicht einfach aus dem Euro-Preis ab, sondern aus drei Größen: Ihren vollständigen Kosten je Auftrag, dem Marktpreis vergleichbarer Anbieter und dem Wert, den Ihre Leistung für den Kunden schafft.",
          "Rechnen Sie Zahlungskosten, Wechselkursspanne und Ausfallrisiko in den Preis ein. Kartenzahlungen kosten den Händler eine Gebühr, häufig im Bereich weniger Prozent; internationale Überweisungen und Währungstausch verursachen Spannen. Was nicht im Preis steht, geht von Ihrer Marge ab.",
        ],
      },
      {
        titel: "Was auf eine Rechnung Ihrer LLC gehört",
        absaetze: [
          "Anders als das europäische Umsatzsteuerrecht kennt das US-Recht keine bundesweit einheitlichen Pflichtangaben für Rechnungen. Eine vollständige Rechnung schützt Sie trotzdem: Sie belegt die Forderung, erleichtert die Buchhaltung und beschleunigt die Zahlung.",
        ],
        liste: [
          "Exakter Firmenname laut Register mit Zusatz „LLC“, Anschrift, Telefon, E-Mail",
          "Fortlaufende, eindeutige Rechnungsnummer und Rechnungsdatum",
          "Name und Anschrift des Kunden, bei Firmen mit Rechtsform",
          "Leistungsbeschreibung, Menge, Einzelpreis, Gesamtbetrag in US-Dollar",
          "Gegebenenfalls Sales Tax, getrennt ausgewiesen",
          "Zahlungsbedingungen wie „Net 30“, Fälligkeitsdatum und Zahlungswege mit Kontodaten",
          "Hinweis auf Verzugsgebühren, sofern vertraglich vereinbart",
        ],
      },
      {
        titel: "Sales Tax, Steuerformulare und Rechnungen nach Europa",
        absaetze: [
          "Ob Sales Tax anfällt, hängt vom Bundesstaat, von der Art der Leistung und davon ab, ob Ihre Firma dort steuerlich präsent ist. Bei Rechnungen an Kunden in Deutschland, Österreich oder der Schweiz stellen sich zudem umsatzsteuerliche Fragen auf europäischer Seite. Klären Sie Ihren Rechnungstext einmal mit Ihrer Steuerkanzlei und nutzen Sie ihn dann als feste Vorlage.",
          "Geschäftskunden in den USA fragen vor der ersten Zahlung häufig nach einem Steuerformular der W-Reihe. Bei einer Einpersonen-LLC mit ausländischem Inhaber ist das in der Regel nicht Form W-9, sondern ein Formular der W-8-Reihe, ausgestellt vom Inhaber. Welches genau, klärt Ihre Steuerkanzlei; halten Sie das Formular danach griffbereit.",
        ],
      },
      {
        titel: "Zahlungsziele und Zahlungseingang",
        absaetze: [
          "In den USA sind Zahlungsziele wie „Net 15“ oder „Net 30“ üblich; große Unternehmen verlangen teils deutlich längere Fristen. Jedes Zahlungsziel ist ein Kredit, den Sie Ihrem Kunden geben. Bei Projektarbeit hat sich eine Anzahlung bei Auftragserteilung bewährt, bei laufenden Leistungen die Abrechnung im Voraus.",
          "Gängige Zahlungswege sind die inländische Überweisung über das ACH-Netz, die Eilüberweisung (Wire), die Kartenzahlung und — noch immer — der Scheck. Für US-Kunden ist eine ACH-Verbindung zu Ihrem US-Konto am bequemsten. Erinnern Sie freundlich, aber konsequent: eine Nachricht kurz vor Fälligkeit, eine am Tag danach, dann ein persönlicher Anruf.",
        ],
      },
      {
        titel: "Wechselkursrisiko zwischen Dollar und Euro",
        absaetze: [
          "Verdienen Sie in US-Dollar und kalkulieren privat in Euro oder Franken, tragen Sie ein Währungsrisiko. Schwankungen von einigen Prozent im Laufe eines Jahres sind zwischen Dollar und Euro keine Ausnahme; bei schmalen Margen können sie einen spürbaren Teil des Gewinns aufzehren.",
          "Der einfachste Schutz ist die natürliche Absicherung: Kosten möglichst in derselben Währung tragen, in der Sie Umsatz erzielen. Halten Sie Dollar auf dem US-Konto, statt jede Zahlung sofort umzutauschen, und tauschen Sie in geplanten Tranchen statt unter Zeitdruck. Für größere, planbare Beträge bieten manche Banken Termingeschäfte an, mit denen ein Kurs für einen künftigen Zeitpunkt festgelegt wird — das kostet Gebühren und bindet Sie an diesen Kurs.",
          "Für die Buchhaltung braucht es einen nachvollziehbaren Umrechnungskurs, etwa die Referenzkurse der Europäischen Zentralbank. Legen Sie mit Ihrer Steuerkanzlei fest, welchen Kurs Sie verwenden, und bleiben Sie dabei.",
        ],
        merke: "Preis in Dollar, Kosten möglichst in Dollar, Umtausch geplant — so bleibt der Wechselkurs eine Rechengröße statt einer Überraschung.",
      },
    ],
    umsetzen: [
      "Die Kosten je Auftrag vollständig in US-Dollar kalkulieren, einschließlich Zahlungs- und Umtauschkosten.",
      "Eine Rechnungsvorlage mit allen Angaben aus der Liste anlegen und mit der Steuerkanzlei abstimmen.",
      "Einen fortlaufenden Nummernkreis für Rechnungen festlegen.",
      "Für Projekte eine Anzahlung in Angebot und Vertrag aufnehmen.",
      "Einen festen Erinnerungsrhythmus für offene Rechnungen definieren und im Kalender hinterlegen.",
      "Klären, welches Formular der W-Reihe Ihre LLC an US-Kunden gibt, und es im Tresor bereithalten.",
      "Einen Umrechnungskurs für die Buchhaltung festlegen und Umtausch in geplanten Tranchen durchführen.",
    ],
    quellen: [
      { titel: "IRS — Form W-9", url: "https://www.irs.gov/forms-pubs/about-form-w-9" },
      { titel: "IRS — Form W-8BEN", url: "https://www.irs.gov/forms-pubs/about-form-w-8-ben" },
      { titel: "Europäische Zentralbank — Euro-Referenzkurse", url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" },
      { titel: "Florida Department of Revenue", url: "https://floridarevenue.com/" },
    ],
    stand: STAND,
  },

  // ── 8 ────────────────────────────────────────────────────────────────────
  {
    id: "kunden-usa",
    bereich: "strategie",
    gruppe: "Wachstum",
    titel: "Kunden in den USA gewinnen",
    kurz: "Positionierung, Auftritt, Vertrauen und Verträge: was US-Kunden erwarten, bevor sie bei einem neuen Anbieter kaufen.",
    minuten: 7,
    abschnitte: [
      {
        titel: "Positionierung: eng statt breit",
        absaetze: [
          "Der US-Markt ist groß, aber er belohnt Klarheit. Kunden kaufen eher bei einem Anbieter, der eine bestimmte Gruppe mit einem bestimmten Problem besonders gut bedient, als bei einem, der alles für alle anbietet. Beschreiben Sie in einem Satz, für wen Sie arbeiten, welches Ergebnis Sie liefern und warum Sie es anders oder besser lösen.",
          "Ihre europäische Herkunft kann ein Argument sein — für Qualität, Präzision, Datenschutz oder besonderes Fachwissen. Sie ist aber kein Argument an sich. Übersetzen Sie sie in einen konkreten Nutzen für den Kunden.",
          "Prüfen Sie den Markt, bevor Sie investieren: Wer sind die drei wichtigsten Wettbewerber, was kosten sie, was bemängeln deren Kunden in Bewertungen? Diese Lücken sind Ihr Ansatzpunkt.",
        ],
      },
      {
        titel: "Ein Auftritt, der nach US-Unternehmen aussieht",
        absaetze: [
          "Vertrauen entsteht an Details: eine US-Geschäftsanschrift, eine US-Telefonnummer mit erreichbarer Mailbox, eine Website in amerikanischem Englisch mit Preisen in US-Dollar, mit dem Datumsformat und der Zeitzone des Marktes. Nennen Sie Ihre Erreichbarkeitszeiten und halten Sie sie ein.",
          "Die Anschrift Ihres Registered Agent ist dafür in der Regel nicht gedacht. Nutzen Sie eine Geschäftsanschrift, die Sie dauerhaft halten können — jeder Umzug erzeugt neue Unstimmigkeiten in Verzeichnissen und bei den Auskunfteien.",
        ],
        liste: [
          "Website mit klarer Leistung, Preisen oder Preisspanne und einfachem Kontaktweg",
          "Einträge in Online-Verzeichnissen und Navigationsdiensten mit identischen Firmendaten",
          "Geschäftliche E-Mail-Adresse auf eigener Domain",
          "Professionelles Profil in den Netzwerken, in denen Ihre Kunden tatsächlich unterwegs sind",
          "Fallbeispiele mit messbaren Ergebnissen, sofern Kunden der Nennung zustimmen",
        ],
      },
      {
        titel: "Bewertungen und Referenzen",
        absaetze: [
          "Für viele US-Kunden sind Bewertungen der erste Prüfstein. Bitten Sie zufriedene Kunden zeitnah nach Abschluss eines Auftrags um eine ehrliche Bewertung und machen Sie es ihnen mit einem direkten Link leicht. Antworten Sie auf jede Bewertung, auch auf kritische — sachlich, freundlich, mit Lösung.",
          "Gekaufte oder erfundene Bewertungen sind tabu. Die US-Handelsaufsicht FTC hat im Jahr 2024 eine Regel erlassen, die gefälschte Bewertungen und Testimonials ausdrücklich verbietet und Verstöße mit Geldbußen belegt. Darunter fallen auch Belohnungen, die an eine positive Bewertung geknüpft sind, und das Unterdrücken negativer Bewertungen.",
        ],
        merke: "Eine sachlich beantwortete kritische Bewertung schafft oft mehr Vertrauen als eine Reihe ungeprüfter Lobeshymnen.",
      },
      {
        titel: "Zahlungsabwicklung ohne Reibung",
        absaetze: [
          "Bieten Sie die Zahlungswege an, die Ihre Kunden gewohnt sind: Kartenzahlung für kleinere Beträge und Onlinekäufe, ACH-Überweisung und Wire für Geschäftskunden und größere Rechnungen. Ein Zahlungslink direkt in der Rechnung verkürzt den Weg zum Geld spürbar.",
          "Zahlungsdienstleister prüfen Ihre LLC ähnlich wie eine Bank: Geschäftsmodell, Website, Rückerstattungsregeln, Inhaber. Halten Sie Geschäftsbedingungen, Rückerstattungs- und Stornoregeln sowie eine Datenschutzerklärung auf der Website aktuell — fehlende Angaben sind ein häufiger Grund für Rückfragen oder einbehaltene Zahlungen.",
        ],
      },
      {
        titel: "Verträge, die schützen",
        absaetze: [
          "Arbeiten Sie mit schriftlichen Verträgen oder zumindest unterschriebenen Angeboten. Im US-Geschäft üblich sind ein Rahmenvertrag (Master Services Agreement) und je Auftrag eine Leistungsbeschreibung (Statement of Work). Achten Sie auf Leistungsumfang, Abnahme, Zahlungsbedingungen, Haftungsbegrenzung, anwendbares Recht und Gerichtsstand.",
          "Unterschreiben Sie immer im Namen der LLC und mit Ihrer Funktion: Firmenname, darunter Ihr Name und „Managing Member“ oder „Manager“. So ist klar, dass die Gesellschaft Vertragspartner ist und nicht Sie persönlich. Vorlagen für typische Verträge finden Sie im Bereich „Recht & Verträge“.",
        ],
      },
    ],
    umsetzen: [
      "Ihre Positionierung in einem Satz formulieren: für wen, welches Ergebnis, warum Sie.",
      "Drei Wettbewerber analysieren: Leistung, Preis und Kritik in deren Bewertungen.",
      "Website, Telefon und Anschrift auf US-Standard bringen und Erreichbarkeitszeiten nennen.",
      "Nach jedem abgeschlossenen Auftrag um eine ehrliche Bewertung bitten und jede Bewertung beantworten.",
      "Zahlungslink und ACH-Daten in die Rechnungsvorlage aufnehmen.",
      "Geschäftsbedingungen, Rückerstattungsregeln und Datenschutzerklärung auf der Website prüfen.",
      "Den Unterschriftenblock „Firmenname, Name, Funktion“ als feste Vorlage anlegen.",
    ],
    quellen: [
      { titel: "FTC — Business Guidance", url: "https://www.ftc.gov/business-guidance" },
      { titel: "SBA — Marktforschung und Wettbewerbsanalyse", url: "https://www.sba.gov/business-guide/plan-your-business/market-research-competitive-analysis" },
    ],
    stand: STAND,
  },

  // ── 9 ────────────────────────────────────────────────────────────────────
  {
    id: "saubere-zahlen",
    bereich: "strategie",
    gruppe: "Führung & Zahlen",
    titel: "Saubere Zahlen: Buchhaltung, Belege, Monatsabschluss",
    kurz: "Wie Sie mit getrennten Konten, festen Kategorien und einem monatlichen Abschluss jederzeit belastbare Zahlen haben.",
    minuten: 6,
    abschnitte: [
      {
        titel: "Warum saubere Zahlen Geld wert sind",
        absaetze: [
          "Saubere Zahlen sind die Grundlage für fast alles in diesem Strategiebuch: für das Kreditgespräch, für die Rückfrage der Bank, für die Steuererklärung und für Ihre eigenen Entscheidungen. Wer erst am Jahresende sortiert, zahlt doppelt — mit Zeit, mit Honorar für die Steuerkanzlei und oft mit Lücken, die sich nicht mehr belegen lassen.",
          "Eine US-LLC führt ihre Bücher üblicherweise in US-Dollar. Ob eine Buchführung nach Zahlungsfluss (Cash Basis) oder nach Entstehung (Accrual Basis) passt, legen Sie mit Ihrer Steuerkanzlei fest — auch mit Blick auf die steuerliche Behandlung in Ihrem Heimatland.",
        ],
      },
      {
        titel: "Getrennte Konten, feste Kategorien",
        absaetze: [
          "Die Grundregel: Alles, was die LLC betrifft, läuft über Geschäftskonto und Firmenkarte, nichts über private Konten. Ein Kontenplan mit festen Kategorien sorgt dafür, dass gleiche Ausgaben immer gleich gebucht werden und Monate vergleichbar bleiben.",
        ],
        liste: [
          "Umsatzerlöse, getrennt nach Leistungsart oder Markt",
          "Direkte Kosten: Wareneinsatz, Fremdleistungen, Zahlungsgebühren",
          "Marketing und Vertrieb",
          "Software und Abonnements",
          "Kanzleien, Registered Agent und Behördengebühren",
          "Reisen und Bewirtung, jeweils mit Anlass und Teilnehmern",
          "Bankgebühren und Währungsumtausch",
          "Einlagen, Entnahmen und Darlehen des Inhabers — getrennt von allem anderen",
        ],
      },
      {
        titel: "Belege: digital, vollständig, auffindbar",
        absaetze: [
          "Jede Buchung braucht einen Beleg: Rechnung, Quittung, Vertrag oder Kontoauszug. Erfassen Sie Belege sofort, etwa per Foto oder als weitergeleitete E-Mail, und benennen Sie sie einheitlich nach Datum, Vertragspartner und Betrag. Bei Bewirtung und Reisen notieren Sie zusätzlich den geschäftlichen Anlass.",
          "Für die Aufbewahrung gilt: lieber zu lange als zu kurz. Der IRS nennt je nach Fall Fristen von drei Jahren und länger; in Deutschland, Österreich und der Schweiz gelten für Bücher und Belege teils deutlich längere Fristen. Bewahren Sie Belege so lange auf, wie die längste für Sie geltende Frist reicht.",
        ],
      },
      {
        titel: "Der Monatsabschluss in sechs Schritten",
        absaetze: [
          "Ein fester Monatsabschluss kostet anfangs einige Stunden, mit Routine deutlich weniger. Er sorgt dafür, dass Ihre Zahlen nie älter als einen Monat sind.",
        ],
        liste: [
          "Alle Konten und Karten mit den Auszügen abstimmen: jede Buchung erfasst, jeder Saldo stimmig",
          "Fehlende Belege nachfordern und Buchungen ohne Beleg klären",
          "Kategorien prüfen und Fehlbuchungen korrigieren",
          "Offene Forderungen ansehen und überfällige Rechnungen anmahnen",
          "Einlagen, Entnahmen und sonstige Zahlungen zwischen Ihnen und der LLC in der Jahresliste nachtragen",
          "Gewinn- und Verlustrechnung und Bilanz mit Vormonat und Plan vergleichen und den Liquiditätsplan fortschreiben",
        ],
      },
      {
        titel: "Software und Zusammenarbeit",
        absaetze: [
          "Eine Buchhaltungssoftware, die Kontoumsätze automatisch einliest und Belege zuordnet, nimmt den größten Teil der Routine ab. Achten Sie bei der Auswahl auf die Anbindung Ihrer Konten, Mehrwährungsfähigkeit, Belegerfassung per Handy und einen eigenen Zugang für Ihre Steuerkanzlei.",
          "Ist ein Monat abgeschlossen, sperren Sie ihn in der Software gegen nachträgliche Änderungen. So bleiben Berichte, die Sie Banken oder Partnern übergeben haben, stimmig mit Ihren Büchern.",
        ],
        merke: "Ein Monat ist erst abgeschlossen, wenn jede Buchung einen Beleg und jedes Konto einen abgestimmten Saldo hat.",
      },
    ],
    umsetzen: [
      "Einen Kontenplan mit festen Kategorien anlegen und mit der Steuerkanzlei abstimmen.",
      "Die Buchungsmethode — Cash Basis oder Accrual Basis — festlegen.",
      "Belege ab sofort am Tag des Eingangs erfassen und einheitlich benennen.",
      "Eine Jahresliste aller Zahlungen zwischen Ihnen und der LLC führen.",
      "Einen festen Termin in der ersten Woche jedes Folgemonats für den Abschluss blocken.",
      "Abgeschlossene Monate in der Software gegen Änderungen sperren.",
    ],
    quellen: [
      { titel: "IRS — Recordkeeping", url: "https://www.irs.gov/businesses/small-businesses-self-employed/recordkeeping" },
      { titel: "IRS — Wie lange Unterlagen aufzubewahren sind", url: "https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records" },
      { titel: "SBA — Finanzen führen", url: "https://www.sba.gov/business-guide/manage-your-business/manage-your-finances" },
    ],
    stand: STAND,
  },

  // ── 10 ───────────────────────────────────────────────────────────────────
  {
    id: "haftung-risiko",
    bereich: "strategie",
    gruppe: "Fundament",
    titel: "Haftung und Risiko verstehen",
    kurz: "Was die Haftungstrennung der LLC leistet, wo sie endet und wie Sie Risiken mit Verhalten, Verträgen und Versicherungen begrenzen.",
    minuten: 6,
    abschnitte: [
      {
        titel: "Was die LLC schützt",
        absaetze: [
          "Die Limited Liability Company trennt grundsätzlich das Vermögen der Firma vom Vermögen ihrer Mitglieder. Für Verbindlichkeiten der LLC — Lieferantenrechnungen, Vertragsansprüche, Schadenersatz aus dem Geschäftsbetrieb — haftet in der Regel nur das Firmenvermögen. Ihr Privatvermögen bleibt außen vor, solange die Trennung respektiert wird.",
          "Dieser Schutz ist einer der wichtigsten Gründe für die Rechtsform. Er ist aber kein Schutzschild für jede Lage, sondern eine Regel mit Ausnahmen, die Sie kennen sollten.",
        ],
      },
      {
        titel: "Wo die Haftungstrennung endet",
        absaetze: [
          "Für die Durchgriffshaftung schauen Gerichte typischerweise auf vermischte Konten, fehlende Dokumentation, eine von Anfang an unzureichende Kapitalausstattung und darauf, ob die Firma nur als Hülle für private Zwecke dient. Jede Gewohnheit, die Firma und Person trennt, stärkt Ihre Position.",
        ],
        liste: [
          "Persönliche Haftung, die Sie selbst unterschreiben: bei Firmenkarten, Kreditlinien, Mietverträgen und Leasing",
          "Eigenes Handeln: Wer selbst fahrlässig oder vorsätzlich Schaden verursacht, haftet dafür persönlich",
          "Durchgriffshaftung (Piercing the Corporate Veil): Gerichte können die Trennung aufheben, wenn Firma und Inhaber faktisch nicht getrennt sind",
          "Bestimmte Steuern: Einbehaltene Lohnsteuer oder vereinnahmte Sales Tax können verantwortliche Personen persönlich treffen",
          "Betrug und bewusst falsche Angaben, etwa in Anträgen",
        ],
      },
      {
        titel: "Trennung im Alltag",
        absaetze: [
          "Die Haftungstrennung wird nicht im Gründungsdokument gewonnen, sondern im Alltag: getrenntes Konto, Verträge im Namen der LLC mit Funktionsangabe, ein unterschriebenes Operating Agreement, dokumentierte Einlagen und Entnahmen und eine Kapitalausstattung, die zum Geschäft passt.",
          "Wichtige Entscheidungen — größere Verträge, Kreditaufnahme, Aufnahme eines Partners — halten Sie in einem kurzen schriftlichen Beschluss fest (Written Consent of the Member). Das kostet Minuten und zeigt im Streitfall, dass die LLC als eigenständiges Unternehmen geführt wird.",
        ],
        merke: "Führen Sie Ihre LLC wie ein fremdes Unternehmen, dessen Geschäftsführer Sie sind — dann sehen Gerichte und Banken sie auch so.",
      },
      {
        titel: "Versicherungen als zweite Linie",
        absaetze: [
          "Was die Haftungstrennung nicht abdeckt, kann eine Versicherung auffangen. Übliche Bausteine für kleine US-Unternehmen sind die allgemeine Betriebshaftpflicht (General Liability), die Vermögensschadenhaftpflicht für fachliche Dienstleistungen (Professional Liability, auch Errors & Omissions), eine Cyber-Versicherung für Datenpannen und Betrugsfälle sowie — sobald Sie Mitarbeiter beschäftigen — die in den meisten Bundesstaaten vorgeschriebene Arbeitsunfallversicherung (Workers’ Compensation).",
          "Große Kunden verlangen häufig einen Versicherungsnachweis (Certificate of Insurance) mit bestimmten Deckungssummen, bevor sie einen Vertrag unterschreiben. Klären Sie den Bedarf, bevor die Anfrage kommt, und vergleichen Sie Angebote nach Deckung, Ausschlüssen und Selbstbehalt — nicht nur nach der Prämie.",
        ],
      },
      {
        titel: "Risiken, die man leicht übersieht",
        absaetze: [
          "Viele Schäden entstehen nicht im Kerngeschäft, sondern am Rand: eine gefälschte Zahlungsanweisung per E-Mail, die zur Überweisung auf ein fremdes Konto führt; ein Kunde mit hohem offenen Posten, der ausfällt; ein Lieferant, an dem das ganze Geschäft hängt. Legen Sie fest, dass geänderte Kontodaten von Zahlungsempfängern immer telefonisch über eine bekannte Nummer bestätigt werden.",
          "Führen Sie eine kurze Risikoliste: die fünf größten Risiken Ihres Geschäfts, ihre mögliche Auswirkung und Ihre Gegenmaßnahme. Einmal im Quartal angesehen, verhindert sie, dass ein bekanntes Risiko zur Überraschung wird.",
        ],
      },
    ],
    umsetzen: [
      "Alle Verträge mit persönlicher Haftung — Karten, Kredite, Miete, Leasing — in einer Liste erfassen.",
      "Das Operating Agreement prüfen und unterschrieben im Tresor ablegen.",
      "Eine Vorlage für den schriftlichen Beschluss des Mitglieds anlegen und für wichtige Entscheidungen nutzen.",
      "Den Versicherungsbedarf klären: Betriebshaftpflicht, Vermögensschaden, Cyber und bei Mitarbeitern Workers’ Compensation.",
      "Die Regel einführen, neue Kontodaten von Zahlungsempfängern nur nach telefonischer Bestätigung zu übernehmen.",
      "Eine Risikoliste mit den fünf größten Risiken und Gegenmaßnahmen erstellen und vierteljährlich ansehen.",
    ],
    quellen: [
      { titel: "SBA — Geschäftsversicherungen", url: "https://www.sba.gov/business-guide/launch-your-business/get-business-insurance" },
      { titel: "SBA — Rechtsform wählen", url: "https://www.sba.gov/business-guide/launch-your-business/choose-business-structure" },
      { titel: "IRS — Single Member Limited Liability Companies", url: "https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies" },
    ],
    stand: STAND,
  },

  // ── 11 ───────────────────────────────────────────────────────────────────
  {
    id: "wachstum-finanzieren",
    bereich: "strategie",
    gruppe: "Wachstum",
    titel: "Wachstum finanzieren — welche Wege es gibt",
    kurz: "Eigenmittel, Lieferantenkredit, Karten, Bankdarlehen und umsatzbasierte Modelle im Vergleich: Kosten, Voraussetzungen und Fallstricke.",
    minuten: 7,
    abschnitte: [
      {
        titel: "Erst die Frage, dann das Instrument",
        absaetze: [
          "Bevor Sie über eine Finanzierung nachdenken, klären Sie drei Fragen: Wofür genau wird das Geld gebraucht? Wann und woraus fließt es zurück? Was passiert, wenn sich der Plan verzögert? Kurzfristiger Bedarf — etwa Ware, die sich schnell verkauft — gehört in kurzfristige Instrumente, langfristige Investitionen in langfristige.",
          "Jede Finanzierung hat einen Preis, der nicht nur im Zins steckt: Gebühren, Sicherheiten, persönliche Haftung, Auflagen und die Abhängigkeit von einem Geldgeber. Vergleichen Sie Angebote deshalb über die effektiven Gesamtkosten pro Jahr, nicht über die Monatsrate.",
        ],
      },
      {
        titel: "Die Wege im Überblick",
        absaetze: [
          "Die folgenden Wege unterscheiden sich in Kosten, Tempo und Voraussetzungen. Über jede Finanzierung entscheidet der jeweilige Geldgeber nach seinen eigenen Kriterien.",
        ],
        liste: [
          "Eigenmittel und einbehaltene Gewinne: am günstigsten und ohne Auflagen, aber begrenzt",
          "Lieferantenkredit: Zahlungsziele wie „Net 30“ finanzieren den Wareneinsatz, ohne dass Zinsen sichtbar werden",
          "Firmenkarten: flexibel für laufende Ausgaben, teuer, wenn Salden über Monate getragen werden",
          "Kreditlinie der Bank: für schwankenden Bedarf, setzt meist Umsatzhistorie und Jahresabschlüsse voraus",
          "Bankdarlehen: für Investitionen mit festem Tilgungsplan, häufig mit Sicherheiten und persönlicher Haftung",
          "Objektfinanzierung und Leasing: Das finanzierte Gerät dient selbst als Sicherheit",
          "Forderungsfinanzierung: Offene Rechnungen werden vorfinanziert oder verkauft (Factoring)",
          "Umsatzbasierte Finanzierung: Rückzahlung als Anteil am laufenden Umsatz",
          "Beteiligungskapital: Investoren erhalten Anteile statt Zinsen",
        ],
      },
      {
        titel: "Umsatzbasierte Modelle und Händlervorschüsse",
        absaetze: [
          "Umsatzbasierte Finanzierungen werden schnell und mit wenigen Unterlagen angeboten. Die Rückzahlung erfolgt als fester Anteil an Ihren Umsätzen oder als tägliche oder wöchentliche Abbuchung. Bei sogenannten Händlervorschüssen (Merchant Cash Advance) wird statt eines Zinses ein Faktor genannt, etwa 1,3. Das klingt nach 30 Prozent, kann bei kurzer Laufzeit aber auf ein Mehrfaches davon pro Jahr hinauslaufen.",
          "Rechnen Sie solche Angebote immer in Jahreskosten um und prüfen Sie, wie sich die Abbuchungen in schwachen Wochen auf Ihre Liquidität auswirken. Mehrere solcher Finanzierungen übereinander (Stacking) sind ein bekanntes Muster in Liquiditätskrisen kleiner Unternehmen.",
        ],
        merke: "Schnelles Geld ist selten günstiges Geld. Rechnen Sie jedes Angebot in effektive Jahreskosten um, bevor Sie unterschreiben.",
      },
      {
        titel: "Staatliche Programme: Voraussetzungen prüfen",
        absaetze: [
          "Die US Small Business Administration (SBA) vergibt meist nicht selbst Kredite, sondern stützt Darlehen von Banken und Partnerorganisationen durch eine teilweise Absicherung, etwa im 7(a)- oder 504-Programm. Diese Programme stellen unter anderem Anforderungen an Eigentum, Staatsangehörigkeit oder Aufenthaltsstatus der Inhaber. Nach den derzeitigen Regeln der SBA sind Firmen, deren Inhaber weder US-Bürger noch dauerhaft in den USA aufenthaltsberechtigt sind, in den Darlehensprogrammen in der Regel nicht förderfähig.",
          "Die Regeln haben sich zuletzt mehrfach geändert — prüfen Sie den aktuellen Stand direkt bei der SBA, bevor Sie Zeit in einen Antrag investieren. Auch Programme einzelner Bundesstaaten oder Städte knüpfen Fördermittel oft an Sitz, Arbeitsplätze vor Ort oder den Status der Inhaber. Lesen Sie die Voraussetzungen in der amtlichen Quelle, nicht in Zusammenfassungen Dritter.",
        ],
      },
      {
        titel: "Eine Abfolge, die sich bewährt hat",
        absaetze: [
          "Für viele junge LLCs ergibt sich eine natürliche Abfolge: zuerst Eigenmittel und Lieferantenkredit, parallel die Kartenleiter, nach einer belastbaren Umsatzhistorie die Kreditlinie der Bank, für größere Investitionen das Darlehen oder die Objektfinanzierung. Jede Stufe erzeugt die Daten, auf die sich die nächste Entscheidung des Geldgebers stützen kann.",
          "Halten Sie Ihre Finanzierungsstruktur einfach und dokumentiert: eine Übersicht aller Verpflichtungen mit Betrag, Rate, Laufzeit, Sicherheiten und persönlicher Haftung. Wer diese Liste aktuell hält, verhandelt aus einer stärkeren Position.",
          "Nehmen Sie Investoren auf, berührt das Wertpapierrecht und Ihr Operating Agreement. Dieser Schritt gehört vorher in die Hände einer Kanzlei.",
        ],
      },
    ],
    umsetzen: [
      "Den Finanzierungsbedarf beschreiben: Zweck, Betrag, Zeitpunkt, Rückfluss.",
      "Für jedes Angebot die effektiven Jahreskosten und die Wirkung auf den Liquiditätsplan berechnen.",
      "Eine Übersicht aller bestehenden Verpflichtungen mit Rate, Laufzeit, Sicherheiten und persönlicher Haftung anlegen.",
      "Bei staatlichen Programmen die Voraussetzungen zu Eigentum und Aufenthaltsstatus direkt in der amtlichen Quelle prüfen.",
      "Händlervorschüsse nur nach Umrechnung in Jahreskosten und Prüfung der Liquidität in schwachen Wochen in Betracht ziehen.",
      "Vor der Aufnahme von Investoren eine Kanzlei einbinden.",
    ],
    quellen: [
      { titel: "SBA — Darlehensprogramme", url: "https://www.sba.gov/funding-programs/loans" },
      { titel: "SBA — Finanzierung Ihres Unternehmens", url: "https://www.sba.gov/business-guide/plan-your-business/fund-your-business" },
    ],
    stand: STAND,
  },

  // ── 12 ───────────────────────────────────────────────────────────────────
  {
    id: "jahresroutine",
    bereich: "strategie",
    gruppe: "Führung & Zahlen",
    titel: "Die Jahresroutine einer gesunden LLC",
    kurz: "Welche Pflichten, Prüfungen und Ziele in jedes Geschäftsjahr gehören — als Kalender, den Sie Jahr für Jahr wiederverwenden.",
    minuten: 6,
    abschnitte: [
      {
        titel: "Warum eine feste Routine schützt",
        absaetze: [
          "Die meisten Probleme einer LLC entstehen nicht aus großen Fehlern, sondern aus vergessenen Terminen: ein verpasster Annual Report, ein abgelaufener Registered-Agent-Vertrag, ein Bundesformular, das niemand eingereicht hat. Die Folgen reichen von Verspätungsgebühren bis zur behördlichen Auflösung der Gesellschaft.",
          "Eine Jahresroutine macht aus diesen Pflichten einen Kalender, den Sie einmal aufsetzen und jedes Jahr wiederverwenden. Der Bereich „Pflichten“ im Portal zeigt die Termine Ihrer LLC; die folgende Übersicht erklärt, was dahintersteht.",
        ],
      },
      {
        titel: "Pflichten gegenüber dem Bundesstaat",
        absaetze: [
          "In Florida ist der Annual Report jedes Jahr zwischen dem 1. Januar und dem 1. Mai über Sunbiz einzureichen. Wird er nach dem 1. Mai eingereicht, fällt für LLCs eine Verspätungsgebühr von 400 US-Dollar an; bleibt er ganz aus, löst der Staat die LLC im Herbst behördlich auf. Prüfen Sie dabei Anschrift, Manager und Registered Agent — der Annual Report ist zugleich die Gelegenheit, Angaben zu aktualisieren.",
          "Der Registered Agent muss durchgehend bestellt sein. Bei FIAON Global verlängern wir ihn jedes Jahr für Sie, und Zustellungen liegen in der Regel innerhalb eines Tages eingescannt in Ihrem Tresor. Viele Städte und Countys in Florida verlangen zudem eine jährlich zu erneuernde Gewerbesteuerquittung (Local Business Tax Receipt), die bis zum 30. September zu verlängern ist — sofern Ihr Standort eine verlangt.",
        ],
      },
      {
        titel: "Bundesformulare mit Ihrer Steuerkanzlei",
        absaetze: [
          "Eine Einpersonen-LLC mit ausländischem Inhaber reicht beim IRS in der Regel jährlich Form 5472 zusammen mit einer Pro-forma-Form 1120 ein, auch wenn kein Gewinn angefallen ist. Fällig ist das bei einem Geschäftsjahr gleich Kalenderjahr am 15. April; mit Form 7004 lässt sich die Frist bis zum 15. Oktober verlängern. Ein Versäumnis kann eine Strafe von 25.000 US-Dollar je Formular und Jahr nach sich ziehen.",
          "Hat Ihre LLC Dienstleister in den USA bezahlt, können zu Jahresbeginn Meldungen auf Formularen der 1099-Reihe fällig sein; beschäftigen Sie Mitarbeiter, kommen Lohnsteuermeldungen hinzu. In Ihrem Heimatland gehört die LLC in Ihre Steuererklärung — wie sie dort behandelt wird, klärt Ihre Steuerkanzlei. Formulare und Fristen erklärt der Bereich „Steuern & Pflichten“ im Detail.",
        ],
      },
      {
        titel: "Prüfungen zum Jahresende",
        absaetze: [
          "Zum Jahreswechsel lohnt eine Prüfliste, die Sie jedes Jahr gleich abarbeiten. Sie dauert einen Nachmittag und erspart Ihnen im Folgejahr Rückfragen und Suchaufwand.",
        ],
        liste: [
          "Kontoauszüge aller Konten und Karten des Jahres vollständig abgelegt und abgestimmt",
          "Jahresliste der Zahlungen zwischen Ihnen und der LLC vollständig — sie ist Grundlage für Form 5472",
          "Profile bei Dun & Bradstreet, Experian Business und Equifax Business angesehen und Fehler beanstandet",
          "Firmendaten bei Banken, Kartenherausgebern, Verzeichnissen und auf der Website identisch",
          "Versicherungen auf Deckung und Ablaufdatum geprüft",
          "Verträge mit automatischer Verlängerung und ihre Kündigungstermine geprüft",
          "Stand der FinCEN-Meldepflicht (BOI) für Ihre LLC geprüft",
          "Zugänge zu Konten, Software und Domain geprüft: Wer hat Zugriff, sind Notfallkontakte aktuell?",
        ],
      },
      {
        titel: "Das Jahresgespräch mit sich selbst",
        absaetze: [
          "Nehmen Sie sich einmal im Jahr einen halben Tag Zeit, um an Ihrem Unternehmen zu arbeiten statt in ihm: Wie haben sich Umsatz, Marge und Liquidität entwickelt? Welche Kunden tragen das Geschäft, welche kosten mehr, als sie bringen? Welche Stufe der Kartenleiter und der Finanzierung ist als Nächstes realistisch?",
          "Leiten Sie daraus drei bis fünf Ziele für das kommende Jahr ab, jeweils mit einer messbaren Größe und einem Termin, und übertragen Sie sie in Ihren Liquiditätsplan. Ein Jahresziel, das im Plan keine Zahl hat, bleibt ein Wunsch.",
        ],
        merke: "Einmal im Jahr aufräumen, einmal im Quartal prüfen, einmal im Monat abschließen — das ist die ganze Routine einer gesunden LLC.",
      },
    ],
    umsetzen: [
      "Den Annual Report als wiederkehrenden Termin mit Erinnerung Anfang Januar eintragen, spätestens zum 1. Mai erledigen.",
      "Die Termine für Form 5472 und die Pro-forma-1120 mit der Steuerkanzlei festlegen, einschließlich einer möglichen Verlängerung.",
      "Verlängerung des Registered Agent im Blick behalten (bei FIAON Global erledigen wir sie) und, falls nötig, die Local Business Tax Receipt prüfen.",
      "Die Prüfliste zum Jahresende abarbeiten und das Ergebnis im Tresor ablegen.",
      "Einen halben Tag für das Jahresgespräch mit sich selbst im Kalender blocken.",
      "Drei bis fünf messbare Jahresziele festlegen und in den Liquiditätsplan übertragen.",
    ],
    quellen: [
      { titel: "Florida Division of Corporations (Sunbiz)", url: "https://dos.fl.gov/sunbiz/" },
      { titel: "IRS — Form 5472", url: "https://www.irs.gov/forms-pubs/about-form-5472" },
      { titel: "IRS — Form 7004", url: "https://www.irs.gov/forms-pubs/about-form-7004" },
      { titel: "IRS — Form 1099-NEC", url: "https://www.irs.gov/forms-pubs/about-form-1099-nec" },
      { titel: "FinCEN — Beneficial Ownership Information", url: "https://www.fincen.gov/boi" },
    ],
    stand: STAND,
  },
];
