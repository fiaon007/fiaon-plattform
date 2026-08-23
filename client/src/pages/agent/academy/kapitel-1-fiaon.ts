// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 1 — Was FIAON ist (23.08.2026, Plan §11)
// Quellen: shared/fiaon-wissen.ts, Plan §1/§2/§10, Memory „Was FIAON ist“.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, p, ul, merk, warn, tab, sagen, kacheln, sichten, frage } from "./typen";
import { SUPPORT } from "@shared/fiaon-wissen";

export const KAPITEL_1: KapitelInhalt = {
  inhalte: {
    vision: {
      einleitung: "FIAON ist das Betriebssystem für Bonität in Deutschland, Österreich und der Schweiz. Der Satz, der alles trägt: Bonität ist ein Weg, kein Urteil.",
      bloecke: [
        p("Für die meisten Menschen ist Bonität eine Zahl, die jemand anderes über sie ausrechnet – und ein Nein, das daraus folgt: keine Karte, kein Konto, keine Wohnung, kein Handyvertrag. Die Zahl erklärt sich nicht. Das Nein begründet sich nicht. Und der Weg zurück ist unbekannt."),
        p("FIAON dreht das um. Wir holen die Auskunft des Kunden, zerlegen sie in einzelne Einträge, erklären jeden in Menschensprache, greifen an, was angreifbar ist, und bereiten den Zugang vor: Konto, Karte, später Finanzierung. Der Kunde sieht jeden Schritt in seinem Bereich – und hat einen Menschen mit Namen, der seine Akte kennt: dich."),
        merk("Wir verkaufen keine Zahl und kein Versprechen. Wir verkaufen Arbeit, die sichtbar ist: Auskunft, Einordnung, Schreiben, Fristen, Zugang."),
        p("Die Vision ist groß: Im DACH-Raum leben rund 100 Millionen Menschen; die SCHUFA allein speichert Daten zu rund 68 Millionen Personen in Deutschland. Jeder von ihnen hat das Recht zu wissen, was über ihn gespeichert ist, und das Recht, Falsches löschen zu lassen. Fast niemand nutzt es – weil es Aufwand ist. FIAON senkt den Aufwand auf einen Klick."),
        kacheln(["Einsicht", "Die Auskunft beschaffen und jeden Eintrag erklären."], ["Aktion", "Anwaltlich geprüfte Schreiben vorbereiten, versenden, Fristen halten."], ["Zugang", "Girokonto, Kreditkarte, Finanzierung – die Bank entscheidet, FIAON bereitet vor."]),
        p("Warum das ein Abo ist: Ein Eintrag fällt nicht an einem Tag. Eine Datenkopie braucht bis zu einen Monat, ein Gläubiger antwortet nach Wochen, eine Löschfrist läuft über Monate. Zwölf Raten bedeuten zwölf Monate, in denen jeden Monat etwas passiert – und der Kunde es sieht."),
      ],
    },
    "drei-schichten": {
      einleitung: "Drei Schichten, die aufeinander aufbauen. Wer sie erklären kann, kann jedes Kundengespräch führen.",
      bloecke: [
        tab(["Schicht", "Was passiert", "Wer handelt"],
          ["1 · Einsicht", "Auskunft mit Vollmacht beschaffen (SCHUFA in Deutschland, KSV1870/CRIF in Österreich, CRIF/Intrum und Betreibungsregister in der Schweiz); jeden Eintrag erklären; Kontoauszug auswerten (Einnahmen, Fixkosten, Spielraum).", "FIAON beschafft und erklärt; du ordnest im Startgespräch ein."],
          ["2 · Aktion", "Für angreifbare Einträge liegen geprüfte Schreiben bereit: Datenkopie Art. 15, Berichtigung Art. 16, Löschung Art. 17, Widerspruch, Ratenangebot. Der Kunde gibt frei, FIAON versendet per Einschreiben, verfolgt Fristen und Antworten.", "Der Kunde gibt frei; das Back-Office versendet; du erklärst und hältst nach."],
          ["3 · Zugang", "Girokonto für jeden Kunden (unabhängig von der Bonität, z. B. DKB), Kreditkarte, sobald der Wert die Schwelle des Kartenpartners erreicht (bis 25.000 € bei guter Bonität), später Finanzierung.", "Die Bank entscheidet. FIAON bereitet vor. Niemand verspricht."],
        ),
        sichten(
          "Eine Übersicht mit Fahrplan: Startgespräch, Unterlagen, Bonitätsauskunft, Analyse, Schreiben, Girokonto, Kreditkarte. Jeder Eintrag mit Erklärung und Stand. Jedes Schreiben mit Datum, Weg und Frist.",
          "Die Akte in der Pipeline: Phase, Auskunft, Raten, Schreiben, Verlauf. Dein Gesprächsblatt vor jedem Anruf. Deine Provision je bezahlter Rate im Wallet.",
          "Vollmacht, Beschaffung, Einschreiben, Fristenkalender, Kontoabgleich, Zahlungsmotor, Tickets an das Back-Office. Vieles automatisch, nichts unsichtbar.",
        ),
        merk("Schicht 3 ist der Grund, warum der Kunde kam. Schicht 1 und 2 sind der Grund, warum er bleibt."),
      ],
    },
    zielgruppe: {
      einleitung: "Wer ruft an, wer füllt das Facebook-Formular aus, wer sitzt am anderen Ende der Leitung?",
      bloecke: [
        p("Die Statistik ist klar, und sie widerspricht dem Vorurteil: Nach dem SchuldnerAtlas der Creditreform gelten in Deutschland rund 5,6 Millionen Erwachsene als überschuldet (2024: rund 8,1 Prozent). Die häufigsten Auslöser nach dem Statistischen Bundesamt sind Arbeitslosigkeit, Krankheit und Trennung – zusammen rund die Hälfte aller Fälle. „Unwirtschaftliche Haushaltsführung“ kommt erst danach."),
        p("Der typische negative Eintrag ist kein geplatzter Kredit. Er ist eine Handyrechnung nach dem Umzug, eine Bestellung, die zurückging, eine Rücklastschrift nach einem Kontowechsel – zwischen 50 und 500 Euro. Und ein Eintrag über 80 Euro sperrt dieselben Türen wie einer über 8.000."),
        kacheln(
          ["Der Abgelehnte", "Kreditkarte, Konto oder Wohnung abgelehnt – weiß nicht genau warum, vermutet „SCHUFA“. Will eine Erklärung und einen Weg."],
          ["Der Überraschte", "Hat einen Inkassobrief oder eine Mahnung mit Meldungsandrohung – hat Angst vor dem Eintrag. Braucht Struktur, sofort."],
          ["Der Wiederaufsteiger", "Nach Insolvenz, Trennung, Krankheit. Will zurück zu einem normalen Konto und einer Karte. Braucht Geduld und sichtbaren Fortschritt."],
          ["Der Geschäftskunde", "Firmenkarte, Zahlungsziel, Limit – Pakete Business Starter bis Enterprise, Zielrahmen 5.000 bis 250.000 €; die Bank entscheidet."],
        ),
        p("Gemeinsam ist allen: Sie haben sich überwunden, jemanden anzurufen oder ein Formular auszufüllen. Scham ist der größte Gegner unseres Geschäfts – nicht die Konkurrenz. Deshalb ist der Ton das Wichtigste, was du lernst."),
        warn("Der Kunde ist kein „Schuldner“. Er ist ein Mensch mit einer Akte, die wir gemeinsam bereinigen. Dieses Wort benutzen wir intern nicht und nach außen nie."),
      ],
    },
    nicht: {
      einleitung: "Genauso wichtig wie das, was wir sind: was wir nicht sind. Diese Grenzen schützen den Kunden, dich und das Unternehmen.",
      bloecke: [
        tab(["Wir sind nicht …", "Warum", "Was wir stattdessen sagen"],
          ["eine Beratung", "Rechts- und Finanzberatung sind erlaubnispflichtig. FIAON berät nicht – wir erklären Regeln, zeigen Wege, bereiten vor.", "„FIAON begleitet Sie“, „wir zeigen Ihnen“, „wir sortieren das“, „wir bereiten vor und versenden“"],
          ["eine Garantie", "Niemand kann eine Löschung, eine Karte oder einen Score garantieren. Die Auskunftei prüft, die Bank entscheidet.", "„Wir prüfen, ob die Meldung zulässig war – und verlangen die Löschung, wo Voraussetzungen fehlen.“"],
          ["ein Score-Verbesserer", "Der Score ist ein Ergebnis, keine Stellschraube. Wer „Score verbessern“ verspricht, verspricht etwas, das er nicht kontrolliert.", "„Ein gelöschter rechtswidriger Eintrag ist ein Fakt. Was der Score daraus macht, berechnet die Auskunftei.“"],
          ["ein Kreditvermittler", "„Kredit ohne SCHUFA“ ist ein Suchbegriff, kein Produkt – und ein Feld voller Betrug.", "„Konto, Karte und Rahmen entscheidet die Bank. FIAON bereitet vor.“"],
          ["ein Inkassobüro", "Wir treiben für niemanden Forderungen ein. Unser Back-Office kümmert sich um unsere eigenen Raten – mit Respekt.", "„Wir sprechen mit Menschen, die Geld schulden – nicht mit Schuldnern.“"],
        ),
        merk("Die vier verbotenen Wörter: beraten · Beratung · Garantie · garantiert. Dazu nie: „sicher“, „auf jeden Fall“, „Score verbessern“, „Kredit ohne SCHUFA“."),
        p("Das ist keine Schwäche im Verkauf. Ehrlichkeit ist unser stärkstes Argument in einem Markt, in dem Kunden schon einmal belogen wurden. Wer „keine Garantie, aber jeden Schritt sichtbar“ sagt, wird geglaubt."),
      ],
    },
    ton: {
      einleitung: "Eine Marke, ein Ton: FIAON – immer so geschrieben. Kunden werden gesiezt, Kollegen geduzt.",
      bloecke: [
        ul(
          "Marke: nur „FIAON“ – nicht „Fiaon“, nicht „die FIAON“, nicht „FIAON GmbH“. Firma: " + SUPPORT.firma + ", " + SUPPORT.adresse + " (" + SUPPORT.register + ").",
          "Kunden: Sie. In jeder Nachricht, in jedem Gespräch, in jeder Vorlage. Auch bei jungen Kunden, auch wenn der Kunde duzt (freundlich beim Sie bleiben, außer er bittet ausdrücklich darum).",
          "Kollegen und das Office: Du. Das Office spricht dich mit Du an, du sprichst Kollegen mit Du an.",
          "Rolle: Bonitätsmanager / Bonitätsmanagerin. Kundenseitig: „Ihr persönlicher Bonitätsmanager“. Nie „Berater“.",
          "Ton: ruhig, konkret, kurz. Zahlen statt Adjektive. Keine Emojis in Kundentexten. Keine Druckwörter („nur heute“, „letzte Chance“).",
        ),
        sagen(
          ["„Ich bin Ihre Ansprechpartnerin bei FIAON und kenne Ihre Akte.“", "„Wir beschaffen Ihre Auskunft und erklären Ihnen jeden Eintrag.“", "„Über die Karte entscheidet die Bank – wir bereiten alles vor.“", "„Das kann ich Ihnen nicht sicher sagen – ich prüfe es und melde mich bis morgen 12 Uhr.“"],
          ["„Ich berate Sie gern.“", "„Das klappt garantiert.“", "„Wir verbessern Ihren Score.“", "„Sie bekommen auf jeden Fall eine Karte.“", "„Kredit ohne SCHUFA – kein Problem.“"],
        ),
        merk("Der beste Satz, wenn du etwas nicht weißt: „Das prüfe ich und melde mich bis … Uhr.“ Und dann tust du es."),
      ],
    },
    wortpruefer: {
      einleitung: "Drei Sätze, wie sie im Alltag fallen – jeder enthält mindestens ein verbotenes Wort. Schreib sie so um, dass sie FIAON-tauglich sind. Der Wortwächter prüft mit derselben Liste, die auch unsere Nachfass-Mails prüft.",
      uebung: { art: "wortpruefer", aufgaben: [
        { satz: "Ich berate Sie gern, welches Paket für Sie das richtige ist – die Kreditkarte bekommen Sie dann garantiert.", hinweis: "Ersetze „berate“ durch ein Verb, das beschreibt, was du tust (zeigen, erklären, sortieren) – und streiche das Versprechen: Die Bank entscheidet." },
        { satz: "Wir verbessern Ihren Score auf jeden Fall, das ist bei uns sicher.", hinweis: "Ein gelöschter Eintrag ist ein Fakt; was der Score daraus macht, berechnet die Auskunftei. Sag, was wir tun – nicht, was die SCHUFA dann tut." },
        { satz: "Nur heute gibt es den Sofortkredit ohne SCHUFA mit unserer Beratung dazu.", hinweis: "Kein Druck, kein Kredit, keine Beratung. Was bleibt, ist der ehrliche Weg: Auskunft, Einordnung, Schreiben, Zugang über die Bank." },
      ] },
    },
    team: {
      einleitung: "Wer bei FIAON was macht – damit du weißt, wen du wofür erreichst.",
      bloecke: [
        tab(["Rolle", "Wer", "Aufgabe"],
          ["Bonitätsmanager", "alle bisherigen Vertriebs- und Onboarding-Kollegen", "Eigener Kundenstamm: Lead, Verkauf, Startgespräch, Begleitung, Raten im Blick. Ein Kunde, ein Betreuer (E-035)."],
          ["Leitung Forderungen & Zahlungen (Back-Office)", "Diana", "Schreiben an Gläubiger und Auskunfteien (Einschreiben), Fristen, Eskalation; täglicher Kontoabgleich, Lastschrift-Rückgaben, Erstattungen; Mahnwesen ab Tag 30, Sperren, Übergaben. Aufträge kommen von dir als Ticket."],
          ["Teamleitung / Qualität", "Florentine", "Verteilung, Gesprächsqualität, Eskalationen, Zahlen."],
          ["Geschäftsführung", "Justin", "Admin-Office, Freigaben, Aufgabenpipeline, „Dringend melden“."],
        ),
        p("Support für Kunden: Telefon " + SUPPORT.telefon + ", E-Mail " + SUPPORT.email + ", Kontaktseite fiaon.com/kontakt mit „Dringend melden“ (geht als Aufgabe mit Priorität „heute“ an die Geschäftsführung oder – bei eingeloggtem Kunden – direkt an dich)."),
        merk("Ein Kunde, ein Betreuer. Übergaben zerstören Erreichbarkeit und Verantwortung. Wenn du einen Kunden gewinnst, bleibt er deiner – bis zur zwölften Rate und darüber hinaus."),
      ],
    },
  },
  test: [
    frage("Welcher Satz beschreibt die Vision von FIAON richtig?", ["Bonität ist ein Urteil, das man akzeptieren muss.", "Bonität ist ein Weg – FIAON macht jeden Schritt sichtbar.", "Bonität lässt sich mit einem Trick verbessern.", "Bonität ist nur für Banken wichtig."], 1, "„Bonität als Weg, nicht als Urteil“ ist der Kernsatz der Vision."),
    frage("Welche drei Schichten hat FIAON?", ["Beratung, Kredit, Karte", "Einsicht, Aktion, Zugang", "Auskunft, Garantie, Score", "Antrag, Vertrag, Rate"], 1, "Einsicht (Auskunft erklären), Aktion (Schreiben), Zugang (Konto, Karte, Finanzierung über die Bank)."),
    frage("Wer entscheidet über Girokonto, Kreditkarte und Rahmen?", ["FIAON", "Der Bonitätsmanager", "Immer die Bank – FIAON bereitet vor", "Die SCHUFA"], 2, "FIAON bereitet vor; über Konto, Karte und Rahmen entscheidet immer die Bank."),
    frage("Welches Wort darf in keinem Kundentext stehen?", ["begleiten", "vorbereiten", "Garantie", "Datenkopie"], 2, "Beraten/Beratung/Garantie/garantiert sind verboten – FIAON berät nicht und garantiert nichts."),
    frage("Wie sprichst du einen Kunden an, der dich duzt?", ["Du – wie er es vorgibt.", "Freundlich beim Sie bleiben, außer er bittet ausdrücklich darum.", "Gar nicht – ohne Anrede.", "Erst Du, dann Sie."], 1, "Kunden werden gesiezt; nur auf ausdrückliche Bitte wechselt man."),
    frage("Welche Auslöser stehen laut Destatis am häufigsten hinter Überschuldung?", ["Luxuskäufe und Reisen", "Arbeitslosigkeit, Krankheit, Trennung", "Aktienverluste", "Zu viele Kreditkarten"], 1, "Zusammen rund die Hälfte aller Fälle – Lebensereignisse, nicht Leichtsinn."),
    frage("Was ist das Back-Office (Diana) – und was nicht?", ["Telefon-Inkasso für Schuldner", "Schreiben, Kontoabgleich, Mahnwesen ab Tag 30 – keine Kundenakquise", "Der Vertrieb", "Die Geschäftsführung"], 1, "Diana führt Forderungen & Zahlungen; Leads und Verkauf bekommt sie nicht."),
  ],
};
