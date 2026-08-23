// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 7 — Österreich: KSV1870 und CRIF (23.08.2026, Plan §11 Nachtrag)
// Quellen: client/src/pages/site/oesterreich.tsx, shared/fiaon-wissen.ts,
// DSGVO/DSG, GewO, ABGB, IGV, VZKG. Keine deutschen Regeln übertragen.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, p, ul, merk, warn, tab, sagen, muster, schritte, quellen, frage } from "./typen";

export const KAPITEL_7: KapitelInhalt = {
  inhalte: {
    system: {
      einleitung: "In Österreich entscheiden andere Stellen über Konto, Karte und Handyvertrag als in Deutschland – mit eigenen Regeln und eigenen Fristen. Wer dort „SCHUFA“ sagt, hat schon verloren.",
      bloecke: [
        tab(["Stelle", "Was sie ist", "Wer fragt dort ab"],
          ["KSV1870", "Kreditschutzverband von 1870, Wien – die größte Auskunftei des Landes; führt auch die Warnliste und die Kreditevidenz der Banken", "Banken, Leasinggeber, Händler, Vermieter"],
          ["CRIF Austria", "Private Auskunftei (früher Deltavista); stark bei Telekommunikation, Versandhandel, Konsumentenkrediten", "Online-Händler, Mobilfunkanbieter, Banken"],
          ["Warnliste der Banken", "Gemeinsame Liste der Kreditinstitute über gekündigte Konten/Kredite und Missbrauch – geführt vom KSV1870 im Auftrag der Banken", "Alle Banken bei Kontoeröffnung und Kreditanfrage"],
          ["Ediktsdatei (edikte.justiz.gv.at)", "Öffentliches Verzeichnis der Justiz: Insolvenzen, Privatkonkurse, Zwangsversteigerungen", "Auskunfteien, Gläubiger, jeder"],
          ["Exekutionsdaten", "Vollstreckungen (Exekutionen) werden von Auskunfteien aus Gerichtsdaten übernommen", "Auskunfteien"],
        ),
        p("Viele Ablehnungen beim Handyvertrag gehen auf CRIF zurück, nicht auf den KSV. Und wer bei KSV1870 und CRIF sauber ist, aber kein Konto bekommt, steht oft auf der Warnliste – deshalb muss auch diese Auskunft her."),
        ul(
          "Rechtsrahmen: DSGVO gilt unmittelbar, ergänzt durch das österreichische Datenschutzgesetz (DSG). Zuständig ist die Datenschutzbehörde (DSB) in Wien.",
          "Auskunfteien über Kreditverhältnisse sind ein reglementiertes Gewerbe (§ 152 GewO) – sie dürfen Bonitätsdaten verarbeiten, müssen aber die DSGVO einhalten.",
          "Kein Gegenstück zu § 31 BDSG: Es gibt keine gesetzlich festgelegten zwei Mahnungen mit vier Wochen Abstand. Grundlage einer Meldung ist das berechtigte Interesse (Art. 6 Abs. 1 lit. f DSGVO) – sie muss verhältnismäßig sein, die Forderung fällig und unbestritten, der Betroffene muss informiert werden (Art. 14 DSGVO).",
        ),
        merk("Drei Auskünfte statt einer: KSV1870, CRIF – und die Warnliste. FIAON beschafft alle drei mit Vollmacht."),
        quellen("KSV1870 Holding AG: Informationen zu Konsumenten-Auskünften (ksv.at)", "CRIF GmbH Österreich (crif.at)", "§ 152 GewO; DSG; Art. 6, 14, 15 DSGVO", "Seite fiaon.com/oesterreich"),
      ],
    },
    ksv: {
      einleitung: "Der KSV1870: 1870 als Gläubigerschutzverband gegründet, heute die zentrale Bonitätsstelle Österreichs – für Unternehmen und Konsumenten.",
      bloecke: [
        ul(
          "Speichert Zahlungserfahrungen, Inkassofälle, Exekutionen, Insolvenzdaten – und berechnet einen Score, den Banken, Leasinggeber und Händler abfragen.",
          "Führt die KonsumentenKreditEvidenz (KKE): Kredite, Leasing, Kreditkarten der Banken – Positivdaten, die bei jeder Kreditanfrage eingesehen werden.",
          "Führt die Warnliste der österreichischen Kreditinstitute: Einträge bei Vertragsverletzungen (z. B. Kontokündigung wegen Missbrauch, Kreditkündigung). Ein Eintrag dort wirkt bankweit.",
          "Speicherdauer (Angaben der Auskunftei, im Einzelfall prüfen): Negativdaten zu erledigten Zahlungsanständen werden in der Regel drei Jahre nach vollständiger Begleichung gelöscht; Insolvenzdaten richten sich nach der Ediktsdatei. Es gibt keine 100-Tage-Regel.",
          "Selbstauskunft: kostenlos nach Art. 15 DSGVO – online oder schriftlich; Antwort innerhalb eines Monats.",
        ),
        p("Was der Kunde in seiner KSV-Auskunft sieht: Personendaten, Zahlungserfahrungen (positiv/negativ), Inkassodaten mit Gläubiger und Betrag, Exekutions- und Insolvenzdaten, Score mit Erläuterung, Empfänger der letzten Abfragen."),
        warn("Ein Kunde aus Graz fragt nach der 100-Tage-Regel: Sie stammt aus den Verhaltensregeln der deutschen Wirtschaftsauskunfteien und gilt nicht für KSV1870 oder CRIF. Dort zählen die Speicherfristen der jeweiligen Auskunftei – und die stehen in der Auskunft."),
        quellen("KSV1870: Konsumenten-Datenschutzinformation und Speicherfristen (ksv.at)", "Art. 15 DSGVO"),
      ],
    },
    crif: {
      einleitung: "CRIF und die Warnliste: die beiden Stellen, an denen Kunden scheitern, ohne es zu wissen.",
      bloecke: [
        tab(["", "CRIF Austria", "Warnliste der Banken"],
          ["Daten", "Zahlungserfahrungen aus Handel, Telekommunikation, Kredit; Inkassodaten; Adressdaten; Score", "Konten- und Kreditkündigungen wegen Vertragsverletzung, Missbrauch"],
          ["Wer meldet", "Vertragspartner (Händler, Mobilfunk, Inkasso)", "Die Kreditinstitute selbst"],
          ["Typische Folge", "Ablehnung beim Handyvertrag, Online-Kauf auf Rechnung, Konsumkredit", "Kein Konto, kein Kredit – bei jeder Bank"],
          ["Auskunft", "Kostenlos, Art. 15 DSGVO (crif.at)", "Kostenlos, Art. 15 DSGVO – über den KSV1870 als Betreiber oder die meldende Bank"],
          ["Löschung", "Nach Erledigung gemäß Speicherfristen der CRIF; bei unzulässiger Meldung Art. 17 DSGVO", "Nach Fristablauf (Angabe der Bank/KSV) oder bei unzulässigem Eintrag Art. 17 DSGVO"],
        ),
        p("Die Warnliste ist der Grund, warum FIAON in Österreich immer drei Auskünfte beschafft. Ein Kunde, der nur KSV und CRIF prüft, sieht den Eintrag nicht, der ihm das Konto verweigert."),
        merk("Basiskonto in Österreich: Verbraucherzahlungskontogesetz (VZKG) seit 2016 – Anspruch auf ein Konto mit grundlegenden Funktionen, auch mit Warnlisteneintrag. Das ist die erste Tür."),
        quellen("CRIF GmbH: Datenschutzinformation (crif.at)", "KSV1870: Warnliste der österreichischen Kreditinstitute", "Verbraucherzahlungskontogesetz (VZKG)"),
      ],
    },
    rechte: {
      einleitung: "Die Rechte-Landkarte für Österreich: dieselbe DSGVO, eine andere Behörde, andere Fristen im Zivilrecht.",
      bloecke: [
        tab(["Thema", "Österreich", "Nicht verwechseln mit Deutschland"],
          ["Auskunft", "Art. 15 DSGVO – kostenlos, ein Monat", "gleich"],
          ["Berichtigung / Löschung", "Art. 16 / 17 DSGVO", "gleich"],
          ["Beschwerde", "Datenschutzbehörde (DSB), Wien – Art. 77 DSGVO; zusätzlich Klage vor dem Zivilgericht möglich", "in DE Landesbehörden (für SCHUFA: Hessen)"],
          ["Meldevoraussetzungen", "Berechtigtes Interesse, Verhältnismäßigkeit, Information des Betroffenen (Art. 6, 14 DSGVO); DSB-Praxis: nur fällige, unbestrittene Forderungen", "§ 31 BDSG (zwei Mahnungen, vier Wochen) gilt NICHT"],
          ["Verjährung", "§ 1486 ABGB: drei Jahre für Forderungen des täglichen Lebens (Waren, Dienstleistungen, Miete); allgemein 30 Jahre (§ 1478 ABGB); Urteilsschulden 30 Jahre", "in DE drei Jahre ab Jahresende – in AT läuft die Frist ab Fälligkeit, nicht ab Jahresende"],
          ["Inkassokosten", "Inkassogebührenverordnung (IGV): Höchstsätze je nach Forderungshöhe; Inkassoinstitute nach § 118 GewO; Kosten müssen zweckentsprechend und verhältnismäßig sein (§ 1333 Abs. 2 ABGB)", "RVG/§ 13e RDG gilt NICHT"],
          ["Mahnspesen", "Nur bei Vereinbarung (AGB) und in angemessener Höhe; Verzugszinsen gesetzlich 4 % (Verbraucher)", "–"],
          ["Privatkonkurs", "Schuldenregulierungsverfahren; seit 2021 Restschuldbefreiung nach drei Jahren (Abschöpfungsplan) möglich; Veröffentlichung in der Ediktsdatei", "Fristen der Auskunfteien unterscheiden sich"],
          ["Basiskonto", "VZKG – Anspruch auf Konto mit grundlegenden Funktionen", "ZKG in DE"],
        ),
        warn("Der Verjährungs-Rechner und der Inkassokosten-Prüfer auf fiaon.com rechnen deutsche Regeln. Für Österreich: Regeln nennen, Fall an das Back-Office zur Prüfung – nie das deutsche Datum vorrechnen."),
        quellen("DSGVO Art. 6, 14, 15, 16, 17, 77; DSG", "§§ 1333, 1478, 1486 ABGB", "Inkassogebührenverordnung (IGV); § 118, § 152 GewO", "Insolvenzordnung (IO), Ediktsdatei", "VZKG"),
      ],
    },
    wege: {
      einleitung: "Richtigstellung und Löschung in Österreich – derselbe Dreischritt wie in Deutschland, mit den richtigen Adressen und Paragrafen.",
      bloecke: [
        schritte("Der Weg",
          ["1 · Drei Auskünfte", "KSV1870, CRIF, Warnliste – mit Vollmacht, Art. 15 DSGVO. Darin: Gläubiger, Betrag, Datum, Status, Score, Abfragen."],
          ["2 · Prüfung", "Fällig? Unbestritten? Informiert (Art. 14)? Verjährt (§ 1486 ABGB)? Erledigt, aber nicht vermerkt? Speicherfrist abgelaufen?"],
          ["3 · Richtigstellung (Art. 16) / Löschung (Art. 17)", "Schreiben an die Auskunftei mit Beleg; bei bestrittener Forderung gleichzeitig an den Gläubiger. Einschreiben, Frist ein Monat."],
          ["4 · Eskalation", "Beschwerde bei der Datenschutzbehörde (Wien) nach Art. 77 DSGVO – kostenlos, Formular online; alternativ Zivilklage. Bei Warnliste: zusätzlich die meldende Bank."],
          ["5 · Nachhalten", "Neue Auskunft nach Löschzusage; Erledigungsvermerk einfordern."],
        ),
        muster("Löschantrag an KSV1870 / CRIF", "Sehr geehrte Damen und Herren, in Ihrer Auskunft vom [Datum] ist zu meiner Person ein Eintrag [Gläubiger, Betrag, Datum] gespeichert. Die Forderung ist [bestritten / nicht fällig / verjährt nach § 1486 ABGB / seit dem … vollständig beglichen]. Die Verarbeitung ist damit nicht (mehr) erforderlich bzw. unrechtmäßig. Ich beantrage die Löschung nach Art. 17 DSGVO [hilfsweise Richtigstellung nach Art. 16 DSGVO] und ersuche um Bestätigung innerhalb eines Monats. Bei Nichterledigung behalte ich mir eine Beschwerde bei der Datenschutzbehörde vor."),
        muster("Information an den Gläubiger (bestrittene Forderung)", "Ich bestreite die Forderung [Bezeichnung] dem Grunde und der Höhe nach [Begründung]. Eine Weitergabe an Auskunfteien ist mangels berechtigten Interesses unzulässig; eine bereits erfolgte Meldung ersuche ich unverzüglich zurückzunehmen."),
        merk("Österreichische Schreiben schreibt das Back-Office nach österreichischem Recht. Deine Aufgabe: die drei Auskünfte beschaffen lassen, den Fall sauber in der Akte beschreiben, den Kunden siezen – und nichts Deutsches versprechen."),
        quellen("Datenschutzbehörde: Beschwerdeformular (dsb.gv.at)", "Art. 16, 17, 77 DSGVO", "§ 1486 ABGB"),
      ],
    },
    sagen: {
      einleitung: "Was ich dem Kunden aus Wien sage – und was ich nie sage.",
      bloecke: [
        sagen(
          ["„In Österreich sind das KSV1870 und CRIF – und die Warnliste der Banken. Wir beschaffen alle drei Auskünfte mit Ihrer Vollmacht.“", "„Ihr Auskunftsrecht steht in Art. 15 DSGVO, die Antwort muss innerhalb eines Monats kommen – kostenlos.“", "„Ob ein Eintrag zulässig war, prüfen wir: fällig, unbestritten, Sie wurden informiert. Wenn nicht, verlangen wir die Löschung – zuständig ist die Datenschutzbehörde in Wien.“", "„Forderungen des täglichen Lebens verjähren in Österreich nach drei Jahren ab Fälligkeit – wir prüfen das Datum in Ihrem Fall.“", "„Ein Basiskonto steht Ihnen nach dem VZKG zu.“"],
          ["„Die SCHUFA in Österreich …“", "„Nach 100 Tagen sind Sie nach 18 Monaten raus.“ (deutsche Regel)", "„Zwei Mahnungen mit vier Wochen Abstand sind Pflicht.“ (§ 31 BDSG gilt nicht)", "„Die Inkassokosten sind nach RVG zu hoch.“ (in AT gilt die IGV)", "„Das löschen wir garantiert.“"],
        ),
      ],
    },
  },
  test: [
    frage("Welche drei Auskünfte beschafft FIAON in Österreich?", ["SCHUFA, KSV, CRIF", "KSV1870, CRIF und die Warnliste der Banken", "Nur KSV1870", "Ediktsdatei und SCHUFA"], 1, "Die Warnliste wird oft vergessen – und verweigert das Konto."),
    frage("Gilt § 31 BDSG (zwei Mahnungen, vier Wochen) in Österreich?", ["Ja", "Nein – Grundlage ist das berechtigte Interesse nach DSGVO; DSB-Praxis: fällig, unbestritten, informiert", "Nur für Banken", "Nur bei CRIF"], 1, "Keine deutschen Regeln übertragen."),
    frage("Forderung des täglichen Lebens in Österreich – Verjährung?", ["3 Jahre ab Jahresende", "3 Jahre ab Fälligkeit (§ 1486 ABGB)", "30 Jahre immer", "5 Jahre"], 1, "In AT läuft die Frist ab Fälligkeit."),
    frage("Welche Behörde ist für Beschwerden gegen KSV1870 zuständig?", ["BaFin", "Datenschutzbehörde in Wien", "Hessischer Datenschutzbeauftragter", "Bundesamt für Justiz"], 1, "Art. 77 DSGVO, DSB Wien."),
    frage("Ein Kunde aus Linz fragt nach der 100-Tage-Regel.", ["Gilt überall", "Gilt nicht für KSV1870/CRIF – deutsche Verhaltensregeln; in AT zählen die Fristen der Auskunftei", "Gilt nur bei Banken", "In AT sind es 50 Tage"], 1, "Nichts Deutsches versprechen."),
    frage("Wie heißen Inkassokosten-Höchstsätze in Österreich?", ["RVG", "§ 13e RDG", "Inkassogebührenverordnung (IGV)", "Es gibt keine"], 2, "Dazu § 1333 Abs. 2 ABGB: zweckentsprechend und verhältnismäßig."),
  ],
};
