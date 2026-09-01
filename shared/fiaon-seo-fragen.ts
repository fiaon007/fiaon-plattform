// ═══════════════════════════════════════════════════════════════════════════
// GENERIERT — NICHT VON HAND BEARBEITEN.
//
// Erzeugt von scripts/seo-fragen-erzeugen.ts aus den FRAGEN-Konstanten der
// öffentlichen Seiten. Enthält je Seite genau die Fragen, die dort sichtbar
// stehen — damit das FAQPage-Markup im Vorrendering (E-079) nie etwas
// behauptet, was der Besucher nicht sieht.
//
// Neu erzeugen:   npx tsx scripts/seo-fragen-erzeugen.ts
// Nur prüfen:     npx tsx scripts/seo-fragen-erzeugen.ts --pruefen
//
// Seiten: / (6), /was-ist-fiaon (6), /privatkunden (7), /business (4), /preise (5), /kreditkarte (5), /oesterreich (5), /schweiz (5), /sicherheit (10), /kontakt (3), /karriere (5), /partner (3), /presse (3), /investoren (4), /datenraum (3), /plattform-konzept (5), /fiaon-erfahrungen (7), /werkzeuge (4), /werkzeuge/kreditrechner (5), /werkzeuge/umschuldung (5), /werkzeuge/schulden-check (5), /kredit-ohne-schufa (6), /schufa-eintrag-loeschen (5), /bonitaet-verbessern (6), /auskunfteien (5), /schufa-score-verstehen (6), /bonitaetsauskunft-beantragen (7), /inkasso-brief-erhalten (6), /eintrag-verjaehrung (6), /girokonto-trotz-negativer-bonitaet (7), /ratenzahlung-und-bonitaet (6), /selbstauskunft-checkliste (6), /schufa-neutral-anfragen (6)
// ═══════════════════════════════════════════════════════════════════════════
export type SeoFrage = { f: string; a: string };

export const SEO_FRAGEN: Record<string, SeoFrage[]> = {
  "/": [
    {
      "f": "Beantragt FIAON die Auskunft für mich?",
      "a": "Ja. Sie geben uns einmal Ihre Daten, FIAON beantragt Ihre Auskunft bei SCHUFA, KSV oder CRIF. Sie müssen kein Formular ausfüllen und nichts hochladen. Innerhalb von 24 Stunden sehen Sie in Ihrem Bereich, was dort steht."
    },
    {
      "f": "Was passiert mit meinen Einträgen?",
      "a": "Jeder Eintrag bekommt eine Einschätzung: erledigt, löschbar, berichtigbar oder angreifbar. Für alles, was sich ändern lässt, bereitet FIAON das Schreiben vor. Sie geben es frei – FIAON versendet es und verfolgt die Antwort."
    },
    {
      "f": "Bekomme ich eine Kreditkarte?",
      "a": "Über die Vergabe entscheidet immer die Bank. FIAON bringt Ihre Bonität in Ordnung und bereitet Sie vor: Ein Girokonto ist für jeden Kunden erreichbar, eine Kreditkarte mit Rahmen bis 25.000 € bei guter Bonität. Ihr Fahrplan zeigt, wie weit Sie noch entfernt sind."
    },
    {
      "f": "Wie arbeitet die FIAON-Analyse?",
      "a": "Sie liest Auskünfte und Kontoauszüge, erklärt Einträge in Klartext und bereitet Schreiben vor. Sie ersetzt keine Rechts- oder Steuerberatung – jedes Schreiben ist anwaltlich geprüft und geht erst hinaus, wenn Sie es freigeben."
    },
    {
      "f": "Wie lange läuft ein Paket?",
      "a": "Zwölf monatliche Raten per SEPA-Lastschrift. Nach der zwölften Rate fragen wir Sie, ob Sie bleiben möchten – keine stille Verlängerung."
    },
    {
      "f": "Wo liegen meine Daten?",
      "a": "Verschlüsselt auf Servern in der EU, DSGVO-konform. Sie entscheiden, was Sie hochladen, und können es jederzeit löschen lassen."
    }
  ],
  "/was-ist-fiaon": [
    {
      "f": "Ist FIAON eine Bank?",
      "a": "Nein. FIAON ist kein Kreditinstitut und vergibt weder Konten noch Karten. Über die Vergabe entscheidet immer die jeweilige Partnerbank. FIAON bereitet Sie vor und dokumentiert Ihre Bonität."
    },
    {
      "f": "Was unterscheidet FIAON von einer Score-App?",
      "a": "Eine Score-App zeigt eine Zahl. FIAON holt die Auskunft, erklärt jeden Eintrag, bereitet das Schreiben vor und versendet es nach Ihrer Freigabe – und verfolgt die Antwort. Anzeigen ist die erste Schicht. FIAON hat drei."
    },
    {
      "f": "Wer prüft die Schreiben?",
      "a": "Jeder Brieftyp wird vom Anwaltsteam freigegeben und versioniert. Kein Schreiben geht hinaus, das nicht geprüft ist – und keines ohne Ihre Freigabe."
    },
    {
      "f": "Für welche Länder gilt das?",
      "a": "Deutschland (SCHUFA), Österreich (KSV) und die Schweiz (CRIF). Die Plattform erkennt Ihr Land und stellt die Anfrage bei der richtigen Auskunftei."
    },
    {
      "f": "Was kostet FIAON?",
      "a": "Pakete ab 7,99 € im Monat, zwölf Raten per SEPA-Lastschrift, danach entscheiden Sie, ob Sie bleiben. Nur die Auskunft? 74 € einmalig."
    },
    {
      "f": "Wo liegen meine Daten?",
      "a": "Verschlüsselt auf Servern in der EU, DSGVO-konform. Sie entscheiden, was Sie hochladen, und können es jederzeit löschen lassen."
    }
  ],
  "/privatkunden": [
    {
      "f": "Bekomme ich garantiert eine Kreditkarte?",
      "a": "Nein – über Karte und Rahmen entscheidet die Bank. Was FIAON tut: Ihre Akte in Ordnung bringen, Ihre Readiness berechnen und den Antrag vorbereiten, wenn es realistisch ist. Ein Girokonto bekommt jeder Kunde."
    },
    {
      "f": "Wie schnell sehe ich meine Auskunft?",
      "a": "In der Regel innerhalb von 24 Stunden nach der Aktivierung. FIAON stellt die Anfrage bei SCHUFA, KSV oder CRIF mit Ihrer Vollmacht – Sie füllen kein Formular aus."
    },
    {
      "f": "Was passiert, wenn ein Eintrag berechtigt ist?",
      "a": "Dann sagen wir es. Berechtigte Einträge verschwinden, wenn die Forderung erledigt ist und die Frist abläuft – seit 2024 schon nach 18 Monaten, wenn Sie innerhalb von 100 Tagen nach der Meldung zahlen. FIAON hilft bei Ratenvereinbarung und Erledigungsvermerk."
    },
    {
      "f": "Kann ich das Paket später ändern?",
      "a": "Ja – im Antrag direkt, und im Startgespräch prüfen wir gemeinsam, ob es passt."
    },
    {
      "f": "Gilt das auch in Österreich und der Schweiz?",
      "a": "Ja. FIAON arbeitet mit KSV1870 und CRIF (Österreich) sowie CRIF und Intrum (Schweiz). Die Rechte aus DSGVO bzw. DSG sind vergleichbar, die Fristen unterscheiden sich – wir kennen beide."
    },
    {
      "f": "Was braucht FIAON von mir?",
      "a": "Für den Antrag nur wenige Angaben. Danach Ausweis und Kontoauszug der letzten drei Monate – ein Handyfoto genügt. Die Auskunft beschafft FIAON."
    },
    {
      "f": "Wie erreiche ich meine Ansprechpartnerin?",
      "a": "Im Bereich, per E-Mail, telefonisch – und für viele Kunden per WhatsApp. Jede Frage landet bei der Person, die Ihre Akte kennt."
    }
  ],
  "/business": [
    {
      "f": "Garantiert FIAON einen Kartenrahmen?",
      "a": "Nein. Über Karte und Rahmen entscheidet der Herausgeber. FIAON sorgt dafür, dass Auskunft und Unterlagen so sind, dass die Entscheidung positiv ausfallen kann – und bereitet Aufstockungen vor."
    },
    {
      "f": "Mein Unternehmen ist jung – geht das trotzdem?",
      "a": "Ja. Bei jungen Unternehmen zählt die Bonität der Inhaber. FIAON beschafft beide Auskünfte, trennt privat und geschäftlich und beginnt mit einem Rahmen, der wächst."
    },
    {
      "f": "Welche Karten sind möglich?",
      "a": "Firmenkreditkarten mit Monatsabrechnung (Charge) internationaler Herausgeber, je nach Land und Profil. Welche konkret, klärt das Startgespräch – abhängig von Rechtsform, Umsatz und Auskunft."
    },
    {
      "f": "Auch in Österreich und der Schweiz?",
      "a": "Ja. FIAON kennt KSV1870, CRIF und das Betreibungsregister und arbeitet mit Kartenpartnern in allen drei Ländern."
    }
  ],
  "/preise": [
    {
      "f": "Kann ich jederzeit kündigen?",
      "a": "Ja – jederzeit zum Ende des laufenden Monats, formlos und ohne Grund: im Kundenbereich unter Abo & Zahlungen oder per E-Mail. Das Paket ist auf zwölf Raten angelegt; danach fragen wir ausdrücklich, ob Sie bleiben – keine stille Verlängerung."
    },
    {
      "f": "Wird die Auskunft angerechnet, wenn ich später ein Paket nehme?",
      "a": "Ja. Wer zuerst nur die Auskunft bucht und innerhalb von 30 Tagen ein Paket wählt, bekommt den Betrag angerechnet."
    },
    {
      "f": "Gibt es Kosten je Schreiben oder Erfolgsprovisionen?",
      "a": "Nein. Weder je Schreiben noch auf Löschungen, Konten oder Kartenrahmen. Der Paketpreis ist der Preis."
    },
    {
      "f": "Wie wird bezahlt?",
      "a": "Erste Rate per Überweisung (Zahlungsdaten mit QR-Code im Kundenbereich), danach SEPA-Lastschrift über einen verifizierten Kreditor. Keine Kreditkarte nötig."
    },
    {
      "f": "Kann ich das Paket wechseln?",
      "a": "Im Antrag, im Startgespräch und danach jederzeit nach oben; nach unten zum nächsten Ratenlauf."
    }
  ],
  "/kreditkarte": [
    {
      "f": "Bekomme ich mit einem offenen Eintrag eine Kreditkarte?",
      "a": "Mit Rahmen praktisch nie. Eine Debit- oder Prepaid-Karte ja – und parallel gehört der Eintrag geprüft: Ist er berechtigt? Wann läuft die Frist? Oft ist die Sperre kürzer als gedacht."
    },
    {
      "f": "Wie hoch ist der Rahmen am Anfang?",
      "a": "Bei erledigten Einträgen oder kurzer Historie meist 500 bis 2.000 Euro. Nach sechs Monaten pünktlicher Abrechnung prüfen Herausgeber neu. Die Schwelle des Kartenpartners liegt bei 25.000 Euro."
    },
    {
      "f": "Schadet die Anfrage für die Karte meiner Auskunft?",
      "a": "Eine Kreditanfrage wird zwölf Monate gespeichert und ist zehn Tage für andere sichtbar. Deshalb stellt FIAON den Antrag erst, wenn die Auskunft trägt – und nie mehrere gleichzeitig."
    },
    {
      "f": "Welche Karte bekomme ich über FIAON?",
      "a": "Eine Kreditkarte eines Kartenpartners, je nach Profil Mastercard oder Visa, mit Monatsabrechnung. Welche konkret, klärt das Startgespräch anhand Ihrer Auskunft."
    },
    {
      "f": "Was kostet die Karte?",
      "a": "Die Kartengebühr legt der Herausgeber fest und wird vorher genannt. FIAON nimmt keine Provision auf Karte oder Rahmen – der Paketpreis ist der Preis."
    }
  ],
  "/oesterreich": [
    {
      "f": "Gibt es in Österreich die SCHUFA?",
      "a": "Nein. Die Rolle übernehmen KSV1870 und CRIF, daneben die Warnlisten der Banken. Wer aus Deutschland nach Österreich zieht, beginnt bei KSV und CRIF ohne Historie – die SCHUFA-Daten werden nicht übertragen."
    },
    {
      "f": "Wie lange bleibt ein Eintrag beim KSV?",
      "a": "Erledigte Forderungen in der Regel drei Jahre nach Erledigung; Insolvenzdaten entsprechend der Ediktsdatei. Länger gespeicherte Daten sind nach Art. 17 DSGVO zu löschen."
    },
    {
      "f": "Warum wurde mein Handyvertrag abgelehnt, obwohl der KSV nichts hat?",
      "a": "Mobilfunkanbieter fragen häufig bei CRIF an. Fordern Sie dort die Selbstauskunft – FIAON tut das für Sie."
    },
    {
      "f": "Kann ich trotz Eintrag ein Konto eröffnen?",
      "a": "Ja. Auf ein Basiskonto besteht nach dem Verbraucherzahlungskontogesetz ein Rechtsanspruch. FIAON bereitet die Eröffnung bei einer Partnerbank vor."
    },
    {
      "f": "Arbeitet FIAON mit österreichischem Recht?",
      "a": "Ja. Schreiben, Fristen und Paragraphen sind für Österreich angepasst: DSGVO, DSG, GewO, Verbraucherzahlungskontogesetz. Der Ansprechpartner kennt beide Länder."
    }
  ],
  "/schweiz": [
    {
      "f": "Eine Betreibung war unberechtigt – warum steht sie trotzdem im Auszug?",
      "a": "Weil das Register jede Betreibung einträgt, unabhängig von ihrer Berechtigung. Sichtbar bleibt sie fünf Jahre – es sei denn, Sie lassen sie nach Art. 8a SchKG sperren oder der Gläubiger zieht sie zurück."
    },
    {
      "f": "Ich habe bezahlt – ist die Betreibung jetzt weg?",
      "a": "Nein, sie trägt den Vermerk „bezahlt“ und bleibt sichtbar. Erst die Rückzugserklärung des Gläubigers entfernt sie. FIAON formuliert das Gesuch – oft als Bedingung der Zahlung."
    },
    {
      "f": "Gilt die deutsche SCHUFA in der Schweiz?",
      "a": "Nein. Schweizer Banken und Händler fragen Betreibungsregister, CRIF und Intrum ab. Wer aus Deutschland zuzieht, beginnt ohne Historie – und sollte den ersten Auszug früh prüfen."
    },
    {
      "f": "Bekomme ich mit Betreibungen ein Konto?",
      "a": "Banken dürfen ablehnen; PostFinance führt Konten für Personen mit Wohnsitz in der Schweiz weitgehend unabhängig von Betreibungen. FIAON bereitet die Eröffnung vor."
    },
    {
      "f": "Wie lange dauert die Nichtbekanntgabe nach Art. 8a?",
      "a": "Das Gesuch ist frühestens drei Monate nach Zustellung des Zahlungsbefehls möglich; das Amt fragt den Gläubiger an, der 20 Tage Zeit hat, ein Verfahren nachzuweisen. Danach wird die Betreibung Dritten nicht mehr angezeigt."
    }
  ],
  "/sicherheit": [
    {
      "f": "Darf eine Bank meine SCHUFA-Daten ohne mein Wissen abfragen?",
      "a": "Nur mit Rechtsgrundlage – in der Regel Ihrer Einwilligung im Antrag (SCHUFA-Klausel) oder einem berechtigten Interesse bei Vertragsanbahnung. Jede Abfrage steht als Anfrage in Ihrer Datenkopie, mit Datum und Empfänger."
    },
    {
      "f": "Darf mein Vermieter eine Bonitätsauskunft verlangen?",
      "a": "Er darf sie erbitten, Sie müssen sie nicht geben – praktisch ist sie aber üblich. Geben Sie die Bonitätsauskunft für Vermieter (ohne Details), nie die vollständige Datenkopie."
    },
    {
      "f": "Darf ein Inkassobüro meine Daten an die SCHUFA melden?",
      "a": "Nur unter den Voraussetzungen des § 31 Abs. 2 BDSG: fällige, unbestrittene Forderung, zwei Mahnungen, Hinweis auf die Meldung. Fehlt eines davon, ist die Meldung unzulässig."
    },
    {
      "f": "Darf FIAON meine Auskunft an Dritte weitergeben?",
      "a": "Nein. FIAON gibt Daten nur weiter, wenn Sie es für einen konkreten Zweck freigeben – etwa die Unterlagen für einen Kartenantrag an den Kartenpartner. Nie zu Werbezwecken, nie verkauft."
    },
    {
      "f": "Darf ich die Löschung meiner Daten bei FIAON verlangen?",
      "a": "Jederzeit (Art. 17 DSGVO). Nach Vertragsende löschen wir Auskunft und Unterlagen; gesetzliche Aufbewahrungspflichten für Rechnungen bleiben (zehn Jahre, nur Buchhaltungsdaten)."
    },
    {
      "f": "Darf eine Auskunftei Daten aus sozialen Netzwerken nutzen?",
      "a": "Nach den Verhaltensregeln der Auskunfteien nicht; der Gesetzentwurf zum Scoring (2024) soll das ausdrücklich verbieten, ebenso Daten über Herkunft, Gesundheit oder Anschrift als Score-Merkmal."
    },
    {
      "f": "Sieht FIAON mein Online-Banking?",
      "a": "Nein. Sie laden einen Kontoauszug als Foto oder PDF hoch. Die Kontoanbindung (Open Banking) kommt als Option – ausdrücklich von Ihnen freigeschaltet, jederzeit widerrufbar."
    },
    {
      "f": "Werden meine Daten für KI-Training verwendet?",
      "a": "Nein. Personenbezogene Daten werden nicht zum Training von Modellen genutzt. Anonymisierte Erfahrungen (welche Schreiben wirken) verbessern Vorlagen – ohne Namen, ohne Referenzen."
    },
    {
      "f": "Was passiert bei einer Datenpanne?",
      "a": "Meldung an die Aufsichtsbehörde innerhalb von 72 Stunden und Information der Betroffenen, wenn ein Risiko besteht (Art. 33, 34 DSGVO). Dafür gibt es einen Plan, keine Improvisation."
    },
    {
      "f": "Kann ich FIAON nutzen, ohne Unterlagen hochzuladen?",
      "a": "Die Auskunft lässt sich mit Vollmacht beschaffen; für die Finanzauswertung braucht es den Kontoauszug, für Konto und Karte den Ausweis. Was Sie nicht hochladen, bleibt außen vor – und wir sagen, was dann nicht geht."
    }
  ],
  "/kontakt": [
    {
      "f": "Ich bin Kunde – wo stelle ich Fragen zu meiner Akte?",
      "a": "Am besten im Kundenbereich unter „Hilfe“: Dort sieht Ihre Ansprechpartnerin die Akte gleich mit. Dringendes über diese Seite mit „An meine Ansprechpartnerin“."
    },
    {
      "f": "Kann der Assistent meine Zahlung oder meinen Termin prüfen?",
      "a": "Nein – er hat keinen Zugriff auf Kundendaten. Zahlung, Termin und Unterlagen sehen Sie im Kundenbereich; bei Unstimmigkeiten hilft der Support."
    },
    {
      "f": "Wie schnell reagiert die Geschäftsführung auf „Dringend“?",
      "a": "Die Meldung erscheint sofort mit Priorität „heute“ in der Aufgabenliste der Geschäftsführung. Eine Rückmeldung erhalten Sie in der Regel am selben Werktag per Telefon oder E-Mail."
    }
  ],
  "/karriere": [
    {
      "f": "Stellt FIAON fest an oder nur auf Provision?",
      "a": "Beides. Festanstellungen in allen Bereichen, freie Mitarbeit vor allem im Vertrieb, Onboarding und Forderungsmanagement, Werkstudenten in Marketing, Technik, Onboarding und Operations."
    },
    {
      "f": "Wo arbeite ich?",
      "a": "Überwiegend remote in Deutschland, Österreich oder der Schweiz. Treffen finden in Zürich statt; Recht und Operations teils vor Ort."
    },
    {
      "f": "Brauche ich Erfahrung?",
      "a": "Je nach Bereich. Im Vertrieb und Onboarding bringt die Academy Ihnen alles bei; in Technik, Recht und Operations erwarten wir Erfahrung. Sagen Sie uns ehrlich, wo Sie stehen."
    },
    {
      "f": "Wie läuft das Gespräch?",
      "a": "Ein Videogespräch mit Florentine oder Daniel, 30 Minuten, ohne Fangfragen. Danach ein Probetag oder eine Probeaufgabe – und eine Entscheidung innerhalb einer Woche."
    },
    {
      "f": "Wann kann ich anfangen?",
      "a": "Sobald es passt. Wir wachsen schnell und brauchen immer Unterstützung – ein Start ist jederzeit möglich."
    }
  ],
  "/partner": [
    {
      "f": "Bekomme ich Daten ohne Einwilligung des Kunden?",
      "a": "Nein. Der Kunde entscheidet, wem FIAON seine Akte zeigt. Die Einwilligung wird protokolliert und kann jederzeit widerrufen werden."
    },
    {
      "f": "Entscheidet FIAON über Konto oder Karte?",
      "a": "Nein. FIAON bereitet vor und dokumentiert. Über Konto, Karte und Rahmen entscheiden Sie – nach Ihren Kriterien."
    },
    {
      "f": "Wie wird die Vergütung geregelt?",
      "a": "Je Abschluss, auf Wunsch je eingezogener Rate. Die Regel steht im Vertrag, jede Abrechnung ist in der Plattform nachvollziehbar."
    }
  ],
  "/presse": [
    {
      "f": "Darf ich Kunden von FIAON befragen?",
      "a": "Ja, auf Wunsch vermitteln wir Kundinnen und Kunden, die ihre Geschichte erzählen möchten – mit deren Einwilligung und auf Wunsch anonymisiert."
    },
    {
      "f": "Gibt es Zahlen zu Kunden und Umsatz?",
      "a": "Für die Berichterstattung stellen wir geprüfte Kennzahlen auf Anfrage bereit. Quellen zu den Marktzahlen nennen wir auf Nachfrage."
    },
    {
      "f": "Ist FIAON eine Bank oder ein Kreditvermittler?",
      "a": "Weder noch. FIAON ist eine Plattform, die Bonität sichtbar macht und repariert. Über Konto, Karte und Rahmen entscheidet immer die jeweilige Partnerbank."
    }
  ],
  "/investoren": [
    {
      "f": "Wie verdient FIAON Geld?",
      "a": "Mit dem Abo des Kunden (7,99 € bis 99,99 € im Monat, zwölf Raten), mit der einmaligen Bonitätsauskunft und mit Provisionen der Partnerbanken, wenn ein Kunde über FIAON ein Konto oder eine Finanzierung erhält."
    },
    {
      "f": "Ist FIAON eine Bank?",
      "a": "Nein. FIAON ist kein Kreditinstitut. Über Konto und Finanzierung entscheidet immer die jeweilige Partnerbank. FIAON bereitet den Kunden vor und dokumentiert seine Bonität."
    },
    {
      "f": "Wo sitzt das Unternehmen?",
      "a": "FIAON LTD, London (Companies House No. 17318250). Die Kunden sitzen in Deutschland, Österreich und der Schweiz; die Plattform läuft auf EU-Servern (Frankfurt), die Zahlungen laufen per SEPA über einen verifizierten Kreditor."
    },
    {
      "f": "Was bekomme ich im Datenraum?",
      "a": "Sechs Kapitel: Unternehmen, Finanzen, Produkt und Technik, Recht und Datenschutz, Team und Verträge, Markt. Dazu das Entscheidungsregister und das Logbuch – beides wird seit dem ersten Tag geführt."
    }
  ],
  "/datenraum": [
    {
      "f": "Warum ein Datenraum, wenn nicht verkauft wird?",
      "a": "Weil ein Unternehmen, das jederzeit geprüft werden kann, besser geführt wird. Der Datenraum ist kein Projekt, sondern der Zustand, in dem FIAON immer ist."
    },
    {
      "f": "Wie aktuell sind die Unterlagen?",
      "a": "Das Logbuch täglich, die Kennzahlen monatlich, das Register bei jeder Entscheidung. Jede Datei trägt ihr Datum."
    },
    {
      "f": "Wer sieht meine Anfrage?",
      "a": "Justin Schwarzott persönlich. Ihre Angaben werden nicht weitergegeben und nicht für Werbung genutzt."
    }
  ],
  "/plattform-konzept": [
    {
      "f": "Wie lange dauert es, bis ich meine Auskunft sehe?",
      "a": "In der Regel innerhalb von 24 Stunden nach Eingang bei FIAON. Die Auskunfteien selbst brauchen je nach Land und Weg zwischen wenigen Tagen und vier Wochen."
    },
    {
      "f": "Was, wenn alle Einträge berechtigt sind?",
      "a": "Dann sagen wir das. Sie bekommen die Löschdaten, die 100-Tage-Regel, wo sie greift, und den Weg zu Konto und Karte über den Wert statt über die Bereinigung."
    },
    {
      "f": "Kann ich das Paket wechseln oder kündigen?",
      "a": "Ja – im Antrag, im Startgespräch und im Kundenbereich unter Abo & Zahlungen. Zwölf Raten, dann entscheiden Sie frei."
    },
    {
      "f": "Muss ich mit jemandem sprechen?",
      "a": "Einmal, 15 Minuten. Das Startgespräch ist Pflicht, weil es den Unterschied macht. Danach läuft alles über den Bereich, Telefon und E-Mail nach Bedarf."
    },
    {
      "f": "Wer sieht meine Daten?",
      "a": "Ihr Ansprechpartner und die Mitarbeiter, die an Ihrer Akte arbeiten. Niemand sonst. Daten werden nie verkauft oder für Werbung weitergegeben."
    }
  ],
  "/fiaon-erfahrungen": [
    {
      "f": "Ist FIAON seriös?",
      "a": "Prüfen Sie uns an den Kriterien, die für jeden Anbieter gelten — sie stehen weiter oben auf dieser Seite: transparente Festpreise statt Erfolgsbeteiligung, keine Löschgarantien, der Hinweis auf Ihre kostenlosen Rechte, ein Impressum mit erreichbaren Menschen und der Satz „die Entscheidung trifft die Bank“. FIAON erfüllt jeden dieser Punkte — und schreibt sie deshalb öffentlich hin."
    },
    {
      "f": "Was macht FIAON genau?",
      "a": "FIAON beschafft Ihre Bonitätsauskünfte bei SCHUFA, KSV und CRIF, erklärt jede Zeile in Klartext, prüft jeden Eintrag auf Zulässigkeit und Verfristung und führt den Schriftwechsel für alles Angreifbare. Dazu kommt der Weg zum Girokonto beim Partnerinstitut — Konto und Karte als Ziel, die Eröffnung entscheidet die Bank."
    },
    {
      "f": "Was kostet FIAON?",
      "a": "Die Bonitätsauskunft mit Prüfung kostet einmalig 74 Euro. Die Pakete für die laufende Begleitung laufen über zwölf Monatsraten; alle Preise stehen offen auf der Preisseite. Es gibt keine Erfolgsbeteiligung und keine versteckten Gebühren — was es kostet, steht fest, bevor Sie unterschreiben."
    },
    {
      "f": "Kann FIAON meine SCHUFA-Einträge löschen?",
      "a": "FIAON kann durchsetzen, was das Gesetz hergibt: die Löschung unzulässig gemeldeter, inhaltlich falscher oder verfristeter Einträge. Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf — wer Ihnen anderes verspricht, arbeitet unseriös. Diese Ehrlichkeit ist Teil unseres Modells."
    },
    {
      "f": "Wie sehe ich, was FIAON für mich tut?",
      "a": "In Ihrem Kundenbereich: jeder Auftrag, jede eingegangene Auskunft, jedes Schreiben und jede Frist als nachvollziehbarer Verlauf. Sie müssen nicht anrufen, um den Stand zu erfahren — er steht da, und bei Fragen antwortet ein Mensch, in der Regel binnen eines Werktags."
    },
    {
      "f": "Arbeitet FIAON auch in Österreich und der Schweiz?",
      "a": "Ja, FIAON ist für den gesamten DACH-Raum gebaut: SCHUFA in Deutschland, KSV in Österreich, CRIF in der Schweiz — aus einer Hand, mit den jeweiligen Rechtsgrundlagen (DSGVO bzw. revidiertes DSG)."
    },
    {
      "f": "Wie kündige ich, wenn ich nicht zufrieden bin?",
      "a": "Die Pakete laufen über zwölf Monate und enden, wie vereinbart; die Kündigungswege stehen transparent im Kundenbereich und auf der Abo-Kündigen-Seite — ohne Rückhalte-Schleifen. Ihr gesetzliches Widerrufsrecht bleibt davon unberührt."
    }
  ],
  "/werkzeuge": [
    {
      "f": "Was kosten die FIAON-Werkzeuge?",
      "a": "Nichts. Alle Werkzeuge sind kostenlos, verlangen keine Anmeldung und keine E-Mail-Adresse. Die Berechnungen laufen in Ihrem Browser — es wird nichts übertragen und nichts gespeichert."
    },
    {
      "f": "Ersetzen die Werkzeuge eine Beratung?",
      "a": "Nein. Sie geben eine fundierte erste Einschätzung nach den geltenden Regeln — die verbindliche Prüfung Ihres Einzelfalls leisten sie nicht. Bei ernster Überschuldung gehört der erste Weg zur kostenlosen, staatlich anerkannten Schuldnerberatung."
    },
    {
      "f": "Woher stammen die Regeln in den Werkzeugen?",
      "a": "Aus den veröffentlichten Quellen: Verhaltensregeln der Wirtschaftsauskunfteien (Fassung 2024), § 31 BDSG, Art. 15 und 17 DSGVO, § 6a PAngV, §§ 195 ff. und 500 ff. BGB, RVG für Inkassokosten sowie der Rechtsprechung von BGH und EuGH. Jedes Werkzeug nennt seine Grundlage unten auf der Seite."
    },
    {
      "f": "Warum stellt FIAON das kostenlos bereit?",
      "a": "Weil die erste Frage — was steht über mich drin, und was davon ist angreifbar? — jeder selbst beantworten können sollte. Wer danach möchte, dass jemand die Beschaffung, Prüfung und Durchsetzung übernimmt, kennt uns dann schon."
    }
  ],
  "/werkzeuge/kreditrechner": [
    {
      "f": "Wie wird die Monatsrate bei einem Ratenkredit berechnet?",
      "a": "Nach der Annuitätenformel: Die Rate bleibt jeden Monat gleich, aber ihre Zusammensetzung ändert sich. Am Anfang steckt viel Zins und wenig Tilgung darin, am Ende ist es umgekehrt. Der Rechner nutzt genau diese Formel mit monatlicher Verzinsung."
    },
    {
      "f": "Was ist der Zwei-Drittel-Zins?",
      "a": "Banken müssen nach § 6a der Preisangabenverordnung angeben, zu welchem effektiven Jahreszins mindestens zwei Drittel der Kunden den beworbenen Kredit tatsächlich bekommen. Der Schaufensterzins in der Werbung gilt oft nur für die beste Bonität — der Zwei-Drittel-Zins ist die realistischere Zahl."
    },
    {
      "f": "Warum bekomme ich einen höheren Zins als beworben?",
      "a": "Die meisten Banken vergeben bonitätsabhängige Zinsen: Je besser Score und Kapitaldienstfähigkeit, desto günstiger der Kredit. Negativeinträge, viele Anfragen in kurzer Zeit oder ein ausgereizter Dispo verteuern denselben Kredit erheblich — oft um mehrere Prozentpunkte."
    },
    {
      "f": "Lohnt sich eine kürzere Laufzeit?",
      "a": "Fast immer, wenn die Rate tragbar bleibt: Bei gleichem Zins sinken die Gesamtkosten mit jeder eingesparten Monatsrate. Der Rechner zeigt die Gesamtkosten für Ihre Eingabe — verändern Sie die Laufzeit und vergleichen Sie selbst."
    },
    {
      "f": "Speichert dieser Rechner meine Daten?",
      "a": "Nein. Alle Berechnungen laufen in Ihrem Browser. Es wird nichts übertragen, nichts gespeichert und keine Anmeldung verlangt."
    }
  ],
  "/werkzeuge/umschuldung": [
    {
      "f": "Was ist eine Umschuldung?",
      "a": "Sie nehmen einen neuen Kredit auf und lösen damit bestehende Kredite und den Dispo ab. Sinnvoll ist das, wenn der neue Zins niedriger ist als der gewichtete Zins der alten Verträge — dann sinken Rate, Gesamtkosten oder beides."
    },
    {
      "f": "Wann lohnt sich eine Umschuldung?",
      "a": "Als Faustregel: je höher die alten Zinsen und je länger die Restlaufzeit, desto größer der Hebel. Am stärksten wirkt die Ablösung eines dauerhaft genutzten Dispos, der mit 10 bis 13 Prozent verzinst wird. Bei Altkrediten mit Restlaufzeit unter einem Jahr lohnt der Aufwand selten."
    },
    {
      "f": "Darf ich meinen Ratenkredit vorzeitig ablösen?",
      "a": "Ja. Bei Verbraucherdarlehen ist die vorzeitige Rückzahlung gesetzlich erlaubt (§ 500 BGB). Die Bank darf eine Vorfälligkeitsentschädigung von höchstens einem Prozent der Restschuld verlangen — bei weniger als zwölf Monaten Restlaufzeit höchstens 0,5 Prozent."
    },
    {
      "f": "Verschlechtert eine Umschuldung meinen Score?",
      "a": "Kurzfristig kann die neue Kreditanfrage sichtbar sein; stellen Sie sie als Konditionsanfrage, ist sie score-neutral. Mittelfristig wirkt eine Umschuldung oft positiv: weniger parallele Verträge, ein ausgeglichener Dispo und pünktliche Raten sind genau das, was Auskunfteien als Ordnung lesen."
    },
    {
      "f": "Speichert dieser Rechner meine Daten?",
      "a": "Nein. Alle Berechnungen laufen in Ihrem Browser. Es wird nichts übertragen, nichts gespeichert und keine Anmeldung verlangt."
    }
  ],
  "/werkzeuge/schulden-check": [
    {
      "f": "Ab wann gilt man als überschuldet?",
      "a": "Überschuldet ist, wer seine fälligen Zahlungsverpflichtungen mit dem verfügbaren Einkommen und Vermögen auf Dauer nicht mehr erfüllen kann. Ein einzelner enger Monat ist keine Überschuldung — entscheidend ist, ob sich die Lücke Monat für Monat wiederholt und die Rückstände wachsen."
    },
    {
      "f": "Welche Schuldenquote ist noch in Ordnung?",
      "a": "Als Faustregel der Kreditpraxis gilt: Alle Raten zusammen sollten 30 bis 35 Prozent des Nettoeinkommens nicht übersteigen. Oberhalb von 40 Prozent wird es eng, weil unvorhergesehene Ausgaben keinen Platz mehr haben. Der Check rechnet genau diese Quote aus."
    },
    {
      "f": "Was macht eine Schuldnerberatung — und was kostet sie?",
      "a": "Staatlich anerkannte Schuldnerberatungsstellen (etwa von Caritas, Diakonie, AWO oder den Verbraucherzentralen) sind kostenlos. Sie verschaffen einen Überblick, verhandeln mit Gläubigern, schützen das Existenzminimum (P-Konto) und begleiten notfalls in die Verbraucherinsolvenz."
    },
    {
      "f": "Ist die Verbraucherinsolvenz das Ende?",
      "a": "Nein — sie ist ein geregelter Neuanfang: Seit 2020 dauert das Verfahren nur noch drei Jahre, danach sind die restlichen Schulden erlassen. Der Eintrag über die Restschuldbefreiung wird seit 2023 bereits sechs Monate nach der Erteilung gelöscht."
    },
    {
      "f": "Speichert dieser Check meine Angaben?",
      "a": "Nein. Alle Berechnungen laufen in Ihrem Browser. Es wird nichts übertragen, nichts gespeichert und keine Anmeldung verlangt."
    }
  ],
  "/kredit-ohne-schufa": [
    {
      "f": "Gibt es seriöse Kredite ohne SCHUFA?",
      "a": "Ja, aber nur eine schmale Kategorie: sogenannte Schweizer Kredite ausländischer Banken, die keine SCHUFA-Abfrage stellen und nicht an sie melden. Sie sind auf kleine Summen begrenzt (meist 3.500 bis 7.500 Euro), deutlich teurer als normale Ratenkredite und setzen ein pfändbares Einkommen voraus. Ohne festes Einkommen gibt es auch dort nichts — wer anderes verspricht, verkauft kein Darlehen, sondern eine Falle."
    },
    {
      "f": "Woran erkenne ich unseriöse Anbieter?",
      "a": "An drei Mustern: Vorkosten (Gebühren, Auslagen oder „Versicherungen“, die vor der Auszahlung fällig werden), Hausbesuche oder Vertreterverträge mit Nebenprodukten, und Garantieversprechen wie „100 % Zusage trotz negativer Schufa“. Seriöse Kreditgeber verlangen niemals Geld, bevor Geld fließt."
    },
    {
      "f": "Was kostet ein Kredit ohne SCHUFA?",
      "a": "Deutlich mehr: Die effektiven Jahreszinsen liegen üblicherweise zwischen 10 und 16 Prozent — beim regulären Ratenkredit mit ordentlicher Bonität sind es 5 bis 9. Auf 5.000 Euro über 40 Monate macht das schnell 1.000 Euro und mehr Unterschied."
    },
    {
      "f": "Sieht meine Bank, dass ich einen Kredit ohne SCHUFA aufgenommen habe?",
      "a": "In der Auskunftei nicht — genau das ist der Zweck. Aber die Rate erscheint auf Ihrem Kontoauszug, und bei jeder späteren Kreditprüfung zählt sie in der Haushaltsrechnung mit. Verschwiegene Raten, die dort auftauchen, kosten mehr Vertrauen als ein erklärter Eintrag."
    },
    {
      "f": "Was ist der bessere Weg?",
      "a": "In den meisten Fällen: die Auskunft in Ordnung bringen statt sie umgehen. Viele Negativeinträge sind angreifbar — falsch gemeldet, verfristet oder ohne die gesetzlichen Voraussetzungen eingetragen. Ist die Auskunft sauber, steht der normale Kreditmarkt wieder offen, zu normalen Zinsen."
    },
    {
      "f": "Hilft FIAON bei der Kreditvermittlung?",
      "a": "Nein — FIAON vermittelt keine Kredite und verkauft keine Finanzprodukte. FIAON beschafft Ihre Auskünfte bei SCHUFA, KSV und CRIF, prüft jeden Eintrag auf Angreifbarkeit und setzt Löschung oder Berichtigung durch, wo die Rechtslage es hergibt. Das Ziel ist, dass Sie keinen Umgehungskredit brauchen."
    }
  ],
  "/schufa-eintrag-loeschen": [
    {
      "f": "Kann man einen berechtigten SCHUFA-Eintrag löschen lassen?",
      "a": "Einen inhaltlich richtigen, zulässig gemeldeten Eintrag vor Fristablauf: nein — Anbieter, die genau das pauschal versprechen, arbeiten unseriös. Aber ein erheblicher Teil der Einträge ist eben NICHT zulässig gemeldet: ohne die zwei vorgeschriebenen Mahnungen, trotz bestrittener Forderung oder nach Ablauf der Löschfrist. Diese Einträge sind angreifbar, und ihre Löschung ist ein Rechtsanspruch."
    },
    {
      "f": "Wie lange bleibt ein erledigter Eintrag gespeichert?",
      "a": "Grundsätzlich drei Jahre ab Erledigung, taggenau. Seit 2024 gilt die 100-Tage-Regel: Wer innerhalb von 100 Tagen nach der Meldung bezahlt und sonst keine Negativmerkmale hat, ist nach 18 Monaten raus. Die Restschuldbefreiung nach Insolvenz wird schon nach sechs Monaten gelöscht."
    },
    {
      "f": "Was kostet es, einen Eintrag löschen zu lassen?",
      "a": "Selbst machen kostet nichts außer Zeit: Datenkopie, Prüfung, Schreiben, Fristen — alle Vorlagen und Regeln sind öffentlich, unsere Werkzeuge bereiten jeden Schritt kostenlos vor. Wer die Beschaffung, Prüfung und Durchsetzung abgeben will, beauftragt einen Dienst wie FIAON mit transparenten Paketpreisen — seriöse Anbieter rechnen nie erfolgsabhängig pro „gelöschtem Eintrag“ ab und versprechen keine Garantien."
    },
    {
      "f": "Bringt die Löschung eines Eintrags wirklich etwas?",
      "a": "Ja, oft erheblich: Negativeinträge sind das schwerste Einzelmerkmal im Score. Fällt der Eintrag, verbessern sich Score-Klasse und Konditionen — vom Handyvertrag über die Wohnung bis zum Kreditzins. Die Wirkung tritt nicht über Nacht ein; die Auskunfteien rechnen ihre Scores in Abständen neu."
    },
    {
      "f": "Kann ich das auch bei KSV (Österreich) und CRIF (Schweiz) machen?",
      "a": "Ja. Die DSGVO gilt in Österreich unmittelbar, die Schweiz hat mit dem revidierten DSG vergleichbare Auskunfts- und Berichtigungsrechte. Die Fristen und Gepflogenheiten unterscheiden sich im Detail — die Länderseiten für Österreich und die Schweiz erklären sie."
    }
  ],
  "/bonitaet-verbessern": [
    {
      "f": "Wie schnell kann ich meine Bonität verbessern?",
      "a": "Das hängt vom Hebel ab: Ein gelöschter Negativeintrag oder ein ausgeglichener Dispo wirkt innerhalb weniger Wochen bis Monate, sobald die Auskunftei neu rechnet. Eine Historie aus pünktlichen Zahlungen und langen, stabilen Vertragsbeziehungen wächst über Jahre. Realistisch ist: erste messbare Verbesserung in drei Monaten, deutliche in zwölf."
    },
    {
      "f": "Was schadet dem Score am meisten?",
      "a": "In dieser Reihenfolge: harte Negativmerkmale (Vollstreckung, Insolvenz), gemeldete Zahlungsausfälle, viele Kreditanfragen in kurzer Zeit, viele parallele Kredite und Konten, häufige Kontowechsel. Wohnort und Einkommen fließen bei SCHUFA übrigens nicht ein — das Einkommen kennt sie gar nicht."
    },
    {
      "f": "Hilft es, alte Konten und Karten zu kündigen?",
      "a": "Meist nein — eher das Gegenteil: Lange bestehende, unauffällig geführte Verträge sind ein Positivmerkmal. Kündigen Sie ungenutzte ZWEITE Kreditkarten und Zweitkonten, aber behalten Sie die älteste Bankbeziehung. Viele kurzlebige Verträge lesen die Scores als Unruhe."
    },
    {
      "f": "Bringen „Score-Verbesserer“-Apps etwas?",
      "a": "Den messbaren Kern können Sie selbst: Datenkopie ziehen, Fehler berichtigen lassen, Fristen prüfen. Apps, die dafür ein Abo verlangen oder „Geheimtricks“ versprechen, verkaufen verpacktes Standardwissen. Vorsicht bei allem, was eine Garantie verspricht — den Score berechnet die Auskunftei, niemand sonst."
    },
    {
      "f": "Wie oft wird der Score neu berechnet?",
      "a": "SCHUFA-Scores werden in Abständen neu gerechnet (der Basisscore quartalsweise, branchenspezifische Scores bei Abfrage). Eine Löschung oder Berichtigung wirkt deshalb nicht am selben Tag — aber verlässlich beim nächsten Rechenlauf. Wer im Oktober aufräumt, geht mit besseren Zahlen ins neue Jahr."
    },
    {
      "f": "Was hat mein Girokonto mit meiner Bonität zu tun?",
      "a": "Bei der Auskunftei: nur die Existenz des Vertrags. Bei der Bank selbst: sehr viel — die Kontoführung ist Teil jeder Kreditprüfung. Ein dauerhaft genutzter Dispo, Rücklastschriften und geplatzte Daueraufträge stehen dort sichtbar. Kontoauszüge der letzten drei Monate entscheiden häufiger über Kredite als der Score."
    }
  ],
  "/auskunfteien": [
    {
      "f": "Welche Auskunftei ist für mich zuständig?",
      "a": "Die des Landes, in dem Sie Verträge schließen: in Deutschland vor allem SCHUFA (daneben Creditreform Boniversum und CRIF), in Österreich KSV1870 und CRIF Österreich, in der Schweiz CRIF und Intrum. Wer umzieht oder grenzüberschreitend arbeitet, hat oft in zwei Ländern Daten — und sollte beide prüfen."
    },
    {
      "f": "Bekomme ich überall eine kostenlose Auskunft?",
      "a": "Ja. In Deutschland und Österreich über Art. 15 DSGVO, in der Schweiz über Art. 25 des revidierten Datenschutzgesetzes. Die Auskunfteien verkaufen daneben Bezahlprodukte — für die Prüfung der eigenen Daten reicht die kostenlose Datenkopie immer."
    },
    {
      "f": "Werden Daten zwischen den Ländern ausgetauscht?",
      "a": "Nicht automatisch: SCHUFA-Einträge sieht eine Schweizer Bank nicht, ein KSV-Eintrag bleibt in Österreich. Aber internationale Konzerne wie CRIF sind in mehreren Ländern aktiv, und bei grenzüberschreitenden Verträgen (etwa Auto-Leasing) fragen Anbieter mitunter im Nachbarland an. Verlassen sollte man sich auf die Trennung nicht."
    },
    {
      "f": "Gelten die Löschfristen überall gleich?",
      "a": "Nein — das ist der wichtigste Unterschied: Deutschland löscht erledigte Forderungen nach drei Jahren (18 Monate mit 100-Tage-Regel), Österreich kennt für den „KSV-Eintrag“ nach vollständiger Zahlung eine Löschung nach drei Jahren in der Warnliste, die Schweiz speichert Betreibungen fünf Jahre im Betreibungsregister. Wer Fristen aus einem Land aufs andere überträgt, rechnet falsch."
    },
    {
      "f": "Hilft FIAON in allen drei Ländern?",
      "a": "Ja — das ist der Kern des Angebots: Beschaffung, Prüfung und Durchsetzung bei SCHUFA, KSV1870 und CRIF aus einer Hand, mit den jeweiligen Landesregeln. Die Länderseiten für Österreich und die Schweiz erklären die Besonderheiten."
    }
  ],
  "/schufa-score-verstehen": [
    {
      "f": "Was ist ein guter SCHUFA-Score?",
      "a": "Als Faustregel gilt: Ab etwa 97,5 % stufen die meisten Banken das Ausfallrisiko als sehr gering ein, zwischen 95 und 97,5 % als gering. Unter 90 % wird es spürbar — Ratenkäufe, Verträge und Kredite werden teurer oder scheitern. Wichtig: Jede Bank legt die Grenzen selbst fest; dieselbe Zahl kann bei zwei Instituten zwei verschiedene Antworten auslösen."
    },
    {
      "f": "Wo sehe ich meinen SCHUFA-Score kostenlos?",
      "a": "Über die Datenkopie nach Art. 15 DSGVO — sie ist gesetzlich kostenlos und enthält Ihre gespeicherten Daten samt Score-Informationen. FIAON bestellt sie im Rahmen der Bonitätsauskunft für Sie mit und erklärt jeden Eintrag. Die Bezahlprodukte der Auskunfteien zeigen nicht mehr Daten als die Datenkopie."
    },
    {
      "f": "Wie oft wird der SCHUFA-Score aktualisiert?",
      "a": "Der Basisscore wird alle drei Monate neu berechnet. Branchenscores, die Banken abfragen, entstehen tagesaktuell im Moment der Anfrage. Eine Löschung oder Berichtigung wirkt deshalb nicht immer sofort sichtbar — beim nächsten Berechnungslauf aber schon."
    },
    {
      "f": "Warum bekomme ich bei zwei Banken unterschiedliche Entscheidungen bei gleichem Score?",
      "a": "Weil der SCHUFA-Score nur EIN Baustein ist. Banken rechnen eigene Scorings mit eigenen Grenzen und gewichten Einkommen, Kontoführung und Produktart dazu. Deshalb formulieren wir bei FIAON immer gleich: Die Entscheidung trifft die Bank — der Score öffnet oder verschließt nur die Tür zum Gespräch."
    },
    {
      "f": "Schaden Kontowechsel oder viele Girokonten dem Score?",
      "a": "Viele parallel geführte Konten und Karten können sich auswirken, weil sie als Merkmal in die Berechnung einfließen. Ein normaler Kontowechsel ist unkritisch. Kritischer sind viele KREDITanfragen in kurzer Zeit — dafür gibt es die Konditionsanfrage, die scorefrei bleibt."
    },
    {
      "f": "Wie schnell verbessert sich die Zahl nach einer Löschung?",
      "a": "Der Eintrag verschwindet mit der Löschung aus der Auskunft; die Score-Neuberechnung folgt im nächsten Lauf, beim Basisscore also binnen bis zu drei Monaten. Ein Versprechen, dass eine bestimmte Zahl erreicht wird, gibt es nicht — die Berechnungsformel ist Geschäftsgeheimnis der SCHUFA."
    }
  ],
  "/bonitaetsauskunft-beantragen": [
    {
      "f": "Ist eine Bonitätsauskunft wirklich kostenlos möglich?",
      "a": "Ja. Die Datenkopie nach Art. 15 DSGVO ist gesetzlich kostenlos — bei SCHUFA, KSV und CRIF. Sie enthält alle gespeicherten Daten samt Meldedatum und meldender Stelle. Kostenpflichtig ist bei den Auskunfteien nur die Verpackung (Bonitätszertifikat zum Weitergeben) — und bei FIAON die Arbeit drumherum: beschaffen, erklären, prüfen."
    },
    {
      "f": "Was kostet die Bonitätsauskunft über FIAON?",
      "a": "74 Euro, einmalig. Darin enthalten: die Beschaffung Ihrer Auskünfte, die Aufbereitung in Klartext, die Prüfung jedes Eintrags auf Zulässigkeit und Verfristung sowie ein Handlungsplan. Keine Erfolgsbeteiligung, kein Abo-Zwang — seriöse Arbeit rechnet nicht pro „gelöschtem Eintrag“ ab."
    },
    {
      "f": "Wie lange dauert es, bis ich meine Auskunft habe?",
      "a": "Der Antrag dauert etwa zwei Minuten. Die Auskunfteien liefern die Datenkopie je nach Haus und Weg innerhalb weniger Tage bis etwa vier Wochen (gesetzliche Obergrenze: ein Monat). Sobald sie vorliegt, sehen Sie Aufbereitung und Prüfung in Ihrem Kundenbereich — in der Regel binnen 24 Stunden."
    },
    {
      "f": "Was ist der Unterschied zwischen Datenkopie und Bonitätszertifikat?",
      "a": "Die Datenkopie ist für SIE: vollständig, mit jedem Eintrag und jedem Detail — und kostenlos. Das Bonitätszertifikat der Auskunfteien ist für DRITTE (z. B. Vermieter): gekürzt, dafür zum Vorzeigen gedacht und kostenpflichtig. Wer seine Lage verstehen oder verbessern will, braucht die Datenkopie."
    },
    {
      "f": "Sieht die SCHUFA, dass ich eine Auskunft beantrage?",
      "a": "Die Eigenauskunft ist neutral: Sie wird nicht als Anfrage gespeichert, die andere Banken sehen, und sie verändert Ihren Score nicht. Sie können sie so oft anfordern, wie Sie wollen."
    },
    {
      "f": "Prüft FIAON auch KSV (Österreich) und CRIF (Schweiz)?",
      "a": "Ja. FIAON arbeitet für den gesamten DACH-Raum und beschafft die Auskünfte aller drei Häuser aus einer Hand. Die Rechte sind vergleichbar: In Österreich gilt die DSGVO unmittelbar, die Schweiz kennt mit dem revidierten DSG eigene Auskunfts- und Berichtigungsrechte."
    },
    {
      "f": "Kann FIAON garantieren, dass Einträge gelöscht werden?",
      "a": "Nein — und niemand kann das seriös. Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf. Was FIAON leistet: jeden Eintrag gegen die gesetzlichen Voraussetzungen halten und angreifen, was angreifbar ist. Anbieter mit Löschgarantie erkennen Sie als unseriös."
    }
  ],
  "/inkasso-brief-erhalten": [
    {
      "f": "Muss ich auf einen Inkassobrief überhaupt reagieren?",
      "a": "Ignorieren ist die schlechteste Option — aber reagieren heißt nicht zahlen. Reagieren heißt: prüfen, und je nach Ergebnis zahlen oder schriftlich widersprechen. Wer gar nichts tut, riskiert gerichtlichen Mahnbescheid, weitere Kosten und am Ende einen Negativeintrag."
    },
    {
      "f": "Darf Inkasso einfach einen SCHUFA-Eintrag machen?",
      "a": "Nein. § 31 BDSG verlangt unter anderem zwei Mahnungen mit mindestens vier Wochen Abstand, einen rechtzeitigen Hinweis auf die bevorstehende Meldung — und die Forderung darf nicht bestritten sein. Wer rechtzeitig und begründet widerspricht, blockiert die Meldung, bis die Sache geklärt ist."
    },
    {
      "f": "Was passiert, wenn ich die Forderung wirklich nicht zahlen kann?",
      "a": "Melden Sie sich schriftlich und schlagen Sie realistische Raten vor — Inkassobüros nehmen fast immer an, weil eine zahlende Rate mehr wert ist als ein Titel. Wichtig: nur Beträge zusagen, die Sie sicher halten können. Eine geplatzte Vereinbarung verschlechtert Ihre Position."
    },
    {
      "f": "Sind die hohen Inkassogebühren rechtens?",
      "a": "Oft nicht in voller Höhe. Die Vergütung ist gedeckelt; bei kleinen, unbestrittenen Forderungen liegt die Grenze niedrig. Verlangen Sie eine Aufschlüsselung und zahlen Sie zunächst die Hauptforderung plus die zulässigen Kosten — überhöhte Posten dürfen Sie bestreiten."
    },
    {
      "f": "Woran erkenne ich Fake-Inkasso?",
      "a": "Druck mit unrealistischen Fristen (24 bis 48 Stunden), Zahlung nur auf ausländische Konten oder per Gutscheinkarte, kein Eintrag im Rechtsdienstleistungsregister, keine nachvollziehbare Forderung. Im Zweifel: nicht zahlen, nicht anrufen, schriftlich Nachweise verlangen."
    },
    {
      "f": "Ich habe schon einen Eintrag — was jetzt?",
      "a": "Prüfen, ob er zulässig gemeldet wurde (zwei Mahnungen, Hinweis, nicht bestritten) und ob die Löschfrist läuft oder abgelaufen ist. Erledigte Forderungen werden nach drei Jahren gelöscht, bei Ausgleich binnen 100 Tagen nach 18 Monaten. FIAON prüft das für Sie — die Regeln stehen im Ratgeber zum Eintrag löschen."
    }
  ],
  "/eintrag-verjaehrung": [
    {
      "f": "Verschwindet ein SCHUFA-Eintrag automatisch nach der Frist?",
      "a": "Er sollte — die Auskunfteien löschen nach ihren Verhaltensregeln taggenau. In der Praxis bleiben verfristete Einträge trotzdem immer wieder stehen: nach Systemumstellungen, bei nie nachgetragenen Erledigungen, bei Doppelmeldungen. Deshalb lohnt der Abgleich der eigenen Datenkopie gegen die Fristen — eine überschrittene Frist ist der klarste Löschgrund überhaupt."
    },
    {
      "f": "Ist Verjährung dasselbe wie die Löschfrist?",
      "a": "Nein, und diese Verwechslung kostet bares Geld: Die VERJÄHRUNG betrifft die Forderung selbst (meist drei Jahre zum Jahresende) — danach müssen Sie nicht mehr zahlen, wenn Sie sich darauf berufen. Die SPEICHERFRIST betrifft den Eintrag bei der Auskunftei und läuft unabhängig davon. Eine verjährte Forderung kann noch eingetragen sein — und eine bezahlte Forderung bleibt trotz Zahlung bis zu drei Jahre sichtbar."
    },
    {
      "f": "Wann genau greift die 18-Monats-Regel?",
      "a": "Wenn die gemeldete Forderung innerhalb von 100 Tagen nach der Meldung vollständig bezahlt wird und sonst keine weiteren Negativmerkmale bestehen. Dann verkürzt sich die Speicherfrist von drei Jahren auf 18 Monate. Die Regel gilt seit 2024 und wird taggenau gerechnet."
    },
    {
      "f": "Kann ich eine vorzeitige Löschung erreichen?",
      "a": "Bei zulässig gemeldeten, inhaltlich richtigen Einträgen vor Fristablauf grundsätzlich nicht — Anbieter, die das pauschal versprechen, arbeiten unseriös. Angreifbar sind Einträge, die ohne die Voraussetzungen des § 31 BDSG gemeldet wurden, inhaltlich falsch sind oder deren Frist bereits abgelaufen ist. Das ist häufiger, als viele denken."
    },
    {
      "f": "Zählt die Frist ab Rechnung, Mahnung oder Zahlung?",
      "a": "Bei erledigten Forderungen zählt die Frist ab dem Datum der ERLEDIGUNG (Zahlung), nicht ab Rechnung oder Meldung. Bei Kreditanfragen ab dem Tag der Anfrage, bei der Restschuldbefreiung ab der Erteilung. Genau deshalb fragt der Checker oben nach dem passenden Datum je Eintragsart."
    },
    {
      "f": "Gilt das auch in Österreich und der Schweiz?",
      "a": "Die Grundrechte (Auskunft, Berichtigung, Löschung) sind vergleichbar — die DSGVO gilt in Österreich unmittelbar, die Schweiz hat das revidierte DSG. Die konkreten Speicherpraktiken von KSV und CRIF unterscheiden sich im Detail. FIAON prüft alle drei Häuser; die Länderseiten für Österreich und die Schweiz erklären die Unterschiede."
    }
  ],
  "/girokonto-trotz-negativer-bonitaet": [
    {
      "f": "Bekomme ich trotz negativer SCHUFA wirklich ein Girokonto?",
      "a": "Ein Konto auf Guthabenbasis ist für die meisten Menschen erreichbar — und auf das Basiskonto besteht in Deutschland sogar ein gesetzlicher Anspruch (§ 31 ZKG). FIAON bereitet den Weg vor und räumt die Datenlage auf; die Eröffnung selbst entscheidet immer die Bank. Genau deshalb versprechen wir keine Eröffnung — sondern einen sauber vorbereiteten Antrag."
    },
    {
      "f": "Was bringt ein aktives Konto für meine Bonität?",
      "a": "Ein geführtes Konto mit regelmäßigen Eingängen und pünktlichen Abbuchungen erzeugt über die Zeit genau die Datenlage, die Risiko-Modelle positiv lesen: Stabilität, Historie, Verlässlichkeit. Es ist kein Zaubertrick und wirkt nicht über Nacht — es ist die Grundlage, auf der alles Weitere aufbaut."
    },
    {
      "f": "Was ist der Unterschied zwischen Basiskonto und dem Konto über FIAON?",
      "a": "Das Basiskonto ist Ihr gesetzlicher Anspruch bei jeder kontoführenden Bank — Guthabenbasis, volle Grundfunktionen, aber oft vergleichsweise teuer und ohne Weg zu Karte oder Rahmen. Der FIAON-Weg zielt auf ein vollwertiges Girokonto beim Partner samt Karte als ZIEL — verbunden mit der Aufräumarbeit an Ihrer Datenlage. Beide Wege stehen in der Tabelle auf dieser Seite."
    },
    {
      "f": "Führt FIAON selbst Konten?",
      "a": "Nein. FIAON ist keine Bank. Konto und Karte entstehen beim Partnerinstitut; FIAON beschafft und prüft Ihre Auskünfte, bereitet den Antrag vor und begleitet den Weg. Über Eröffnung, Karte und Rahmen entscheidet die Bank nach eigenen Regeln."
    },
    {
      "f": "Wie lange dauert der Weg zum Konto?",
      "a": "Der FIAON-Antrag dauert etwa zwei Minuten. Danach hängt das Tempo von zwei Dingen ab: wie schnell die Auskunfteien liefern (Tage bis etwa vier Wochen) und wie die Bank entscheidet. Einen festen Termin verspricht Ihnen hier niemand seriös — Sie sehen aber jeden Schritt in Ihrem Kundenbereich."
    },
    {
      "f": "Kostet der Kontoantrag bei FIAON extra?",
      "a": "Der Weg zum Konto ist Teil der FIAON-Pakete; die Preise stehen transparent auf der Preisseite. Es gibt keine Erfolgsprovision auf eine Kontoeröffnung — so bleibt unser Rat frei von falschen Anreizen."
    },
    {
      "f": "Was passiert, wenn die Bank ablehnt?",
      "a": "Dann sagen wir Ihnen das ehrlich — mit dem, was sich aus der Datenlage ableiten lässt: welche Einträge stören, welche angreifbar sind, was die 100-Tage-Regel bringen kann. Häufig ist die Ablehnung der Anfang der eigentlichen Arbeit: Datenlage bereinigen, dann erneut antragen. Ein Rechtsanspruch auf das Basiskonto bleibt Ihnen daneben immer."
    }
  ],
  "/ratenzahlung-und-bonitaet": [
    {
      "f": "Verbessern pünktliche Raten wirklich meine Bonität?",
      "a": "Ja — Zahlungsverhalten ist das Kernmerkmal jedes Risiko-Modells. Ein Ratenvertrag, der über Monate vertragsgemäß läuft, erzeugt fortlaufend Positivdaten: Historie, Verlässlichkeit, Stabilität. Eine konkrete Score-Zahl kann daraus niemand seriös versprechen — die Richtung ist aber eindeutig, und sie liegt komplett in Ihrer Hand."
    },
    {
      "f": "Schadet ein Ratenkauf grundsätzlich dem Score?",
      "a": "Ein einzelner, bedienter Ratenvertrag ist kein Makel. Was das Bild kippt: viele parallele Finanzierungen, ausgereizte Rahmen und Null-Prozent-Käufe im Dutzend — sie lesen sich als dünne Decke. Faustregel: so wenige parallele Verträge wie möglich, und jeder davon pünktlich."
    },
    {
      "f": "Was passiert nach EINER verpassten Rate?",
      "a": "Eine einzelne verspätete Rate löst noch keinen SCHUFA-Eintrag aus — sie startet die Eskalation: Erinnerung, Mahnung, Verzugskosten. Gefährlich wird es ab der zweiten Mahnung mit Meldedrohung (§ 31 BDSG verlangt genau diese Kette vor einer Meldung). Wer in dieser Phase reagiert und zahlt oder eine Vereinbarung trifft, verhindert den Eintrag fast immer."
    },
    {
      "f": "Rücklastschrift — wie schlimm ist das?",
      "a": "Eine Rücklastschrift kostet Gebühren und ist ein Warnsignal an den Vertragspartner, wird aber nicht automatisch gemeldet. Häufige Rückgaben führen zu Kündigungen von Verträgen — und DIE landen dann in der Auskunft. Der beste Schutz ist banal: Dauerauftrag oder Lastschrift aufs richtige Konto und ein Blick in den Kalender vor dem Abbuchungstag."
    },
    {
      "f": "Bringt es etwas, Raten VORZEITIG zu zahlen?",
      "a": "Für die Bonität zählt vor allem VERTRAGSGEMÄSS — pünktlich ist der Standard, den die Modelle belohnen. Vorzeitige Ablösung spart Zinsen und schließt den Vertrag positiv ab; ein Turbo für den Score ist sie nicht. Wichtiger ist, dass nie eine Rate reißt."
    },
    {
      "f": "Ich habe schon einen Rückstand — was ist jetzt klug?",
      "a": "Sofort handeln, schriftlich: Kontakt zum Gläubiger, realistische Raten anbieten, Bestätigung einholen. Wird eine gemeldete Forderung innerhalb von 100 Tagen vollständig ausgeglichen, verkürzt sich die Speicherfrist auf 18 Monate. Und prüfen Sie parallel, ob eine bereits erfolgte Meldung überhaupt zulässig war — die Regeln stehen in unserem Inkasso-Ratgeber."
    }
  ],
  "/selbstauskunft-checkliste": [
    {
      "f": "Wie bekomme ich meine Selbstauskunft kostenlos?",
      "a": "Über die Datenkopie nach Art. 15 DSGVO — formlos oder über die Formulare der Auskunfteien, gesetzlich kostenlos und beliebig oft. Unser kostenloses Werkzeug bereitet den Antrag für SCHUFA, KSV und CRIF vor. Die Häuser haben einen Monat Zeit, meist kommt sie schneller."
    },
    {
      "f": "Was ist der Unterschied zwischen Selbstauskunft und Datenkopie?",
      "a": "Umgangssprachlich meint beides dasselbe: die Auskunft über die eigenen Daten. Juristisch sauber ist die Datenkopie nach Art. 15 DSGVO — vollständig und kostenlos. Die Bezahlprodukte der Auskunfteien (Bonitätszertifikat) sind gekürzte Fassungen zum Vorzeigen, nicht zum Prüfen."
    },
    {
      "f": "In welcher Reihenfolge lese ich die Auskunft am besten?",
      "a": "Genau in der Reihenfolge der Checkliste oben: erst Stammdaten, dann Verträge, dann Forderungen samt Kennzeichen und Fristen, dann Anfragen — und zuletzt der Score. Wer andersherum liest, sucht die Ursache am falschen Ende."
    },
    {
      "f": "Was mache ich mit einem Eintrag, den ich nicht zuordnen kann?",
      "a": "Nicht ignorieren: schriftlich bei der Auskunftei nachfragen, wer gemeldet hat und auf welcher Grundlage (das steht teils schon in der Datenkopie). Kennen Sie den Vorgang trotzdem nicht, widersprechen Sie und verlangen Belege. Unbekannte Einträge können auf Verwechslung oder Missbrauch hindeuten."
    },
    {
      "f": "Wie oft sollte ich meine Auskunft prüfen?",
      "a": "Einmal im Jahr als Routine — und zusätzlich vor jedem großen Schritt: Wohnungssuche, Finanzierung, Selbstständigkeit. Die Eigenauskunft ist neutral, sie verändert Ihren Score nicht und wird anderen nicht angezeigt."
    },
    {
      "f": "Übernimmt FIAON diese Prüfung komplett?",
      "a": "Ja — das ist die Bonitätsauskunft mit Prüfung: FIAON beschafft die Datenkopien aller drei Häuser, erklärt jede Zeile in Klartext und hält jeden Eintrag gegen § 31 BDSG und die Löschfristen. Sie bekommen die Liste, die Sie hier von Hand erstellen würden — fertig und mit Handlungsplan."
    }
  ],
  "/schufa-neutral-anfragen": [
    {
      "f": "Was genau bedeutet „SCHUFA-neutral“?",
      "a": "Neutral heißt: Die Anfrage wird als Konditionsanfrage gespeichert — nur für Sie sichtbar, ohne jede Wirkung auf Ihren Score. Banken, die später anfragen, sehen sie nicht. Die Kreditanfrage dagegen ist zehn Tage für andere Institute sichtbar und fließt in die Berechnung ein."
    },
    {
      "f": "Bekomme ich mit einer Konditionsanfrage schlechtere Angebote?",
      "a": "Nein. Die Bank prüft dieselben Daten und nennt Ihnen die Konditionen, die sie bei einem echten Antrag anbieten würde. Der Unterschied liegt allein in der Meldung an die SCHUFA — nicht in der Qualität des Angebots. Erst wenn Sie den Vertrag wirklich wollen, wird aus der Konditions- eine Kreditanfrage."
    },
    {
      "f": "Wie erkenne ich, welche Anfrageart die Bank stellt?",
      "a": "Fragen Sie wörtlich: „Stellen Sie eine Konditionsanfrage oder eine Kreditanfrage?“ Seriöse Institute und Vergleichsportale antworten klar und werben oft selbst mit „SCHUFA-neutral“. Im Zweifel steht es in den Unterlagen — das Merkmal heißt „Anfrage Kreditkonditionen“."
    },
    {
      "f": "Was tue ich, wenn eine Konditionsanfrage falsch als Kreditanfrage gespeichert wurde?",
      "a": "Das kommt vor und ist korrigierbar: Verlangen Sie bei der Bank die Umschlüsselung und bei der SCHUFA die Berichtigung (Art. 16 DSGVO), mit Ihrem Schriftverkehr als Beleg. In der eigenen Datenkopie sehen Sie, wie jede Anfrage gespeichert ist."
    },
    {
      "f": "Wie stark drücken mehrere Kreditanfragen den Score?",
      "a": "Eine exakte Zahl nennt die SCHUFA nicht — die Formel ist Geschäftsgeheimnis. Belegt ist der Mechanismus: Mehrere Kreditanfragen in kurzer Zeit lesen sich als gescheiterte Finanzierungsversuche. Deshalb gilt: vergleichen ausschließlich über Konditionsanfragen, die echte Kreditanfrage erst für den Vertrag, den Sie wirklich abschließen."
    },
    {
      "f": "Gilt der Unterschied auch bei Girokonten und Handyverträgen?",
      "a": "Dort läuft es anders: Konto- und Vertragsanfragen sind eigene Anfragearten mit eigener Behandlung. Der Konditions-Trick ist ein Kredit-Thema. Bei Konten zählt eher, wie viele Sie führen — dazu mehr auf der Score-Seite."
    }
  ],
};

/** Die Begriffe von /glossar-bonitaet (38). */
export const SEO_GLOSSAR: { wort: string; text: string }[] = [
  {
    "wort": "Anfrage (Kredit / Konditionen)",
    "text": "Jede Bonitätsprüfung einer Bank hinterlässt eine Anfrage in Ihrer Auskunft. Entscheidend ist die Art: Die Kreditanfrage ist zehn Tage für andere Banken sichtbar und fließt in den Score ein, die Konditionsanfrage bleibt neutral. Beim Vergleichen immer die neutrale Art verlangen."
  },
  {
    "wort": "Auskunftei",
    "text": "Ein Unternehmen, das bonitätsrelevante Daten sammelt und an Vertragspartner weitergibt: in Deutschland vor allem die SCHUFA, in Österreich der KSV, in der Schweiz die CRIF. Auskunfteien entscheiden nichts — sie liefern die Datenlage, auf der andere entscheiden."
  },
  {
    "wort": "Basiskonto",
    "text": "Das Jedermann-Konto nach § 31 ZKG: Jede kontoführende Bank in Deutschland muss es auf Antrag eröffnen, auf Guthabenbasis und mit Grundfunktionen — unabhängig von der Bonität. Es ist das gesetzliche Sicherheitsnetz, wenn sonst kein Konto zustande kommt."
  },
  {
    "wort": "Basisscore",
    "text": "Der Prozentwert (0 bis 100), den die SCHUFA vierteljährlich über Sie berechnet — die Schätzung, wie wahrscheinlich Sie Verpflichtungen erfüllen. 100 erreicht niemand; entscheidend ist der Bereich, in dem Ihr Wert liegt."
  },
  {
    "wort": "Bestrittene Forderung",
    "text": "Eine Forderung, der Sie begründet widersprochen haben. Sie darf nicht an Auskunfteien gemeldet werden (§ 31 BDSG) — der rechtzeitige, schriftliche Widerspruch ist deshalb Ihr stärkstes Werkzeug gegen drohende Einträge."
  },
  {
    "wort": "Bonität",
    "text": "Die Einschätzung, ob jemand seine Zahlungsverpflichtungen erfüllen kann und will. Sie speist sich aus Datenlage (Einträge, Historie) und Verhalten (pünktliche Zahlungen) — und sie ist veränderbar: Daten lassen sich bereinigen, Verhalten dokumentieren."
  },
  {
    "wort": "Bonitätsauskunft",
    "text": "Der Blick in die eigene Datenlage. Als Datenkopie nach Art. 15 DSGVO kostenlos; als geprüfte FIAON-Auskunft mit Beschaffung bei drei Häusern, Klartext-Erklärung und Prüfung jedes Eintrags für einmalig 74 Euro."
  },
  {
    "wort": "Branchenscore",
    "text": "Neben dem Basisscore berechnet die SCHUFA je Branche eigene Werte — Banken, Telekommunikation, Handel sehen unterschiedliche Scores. Sie entstehen tagesaktuell im Moment der Anfrage, deshalb kann eine Löschung schneller wirken als der vierteljährliche Basisscore vermuten lässt."
  },
  {
    "wort": "CRIF",
    "text": "Die führende Wirtschaftsauskunftei der Schweiz. Für Auskunft und Berichtigung gilt dort das revidierte Datenschutzgesetz (DSG) — die Rechte sind mit der DSGVO vergleichbar, die Abläufe unterscheiden sich im Detail."
  },
  {
    "wort": "Datenkopie (Art. 15 DSGVO)",
    "text": "Ihr gesetzliches Recht auf eine vollständige, kostenlose Kopie aller Daten, die eine Auskunftei über Sie speichert — samt Meldedatum und meldender Stelle. Die Grundlage jeder ernsthaften Prüfung; die Bezahlprodukte zeigen nicht mehr."
  },
  {
    "wort": "Eigenauskunft",
    "text": "Der umgangssprachliche Sammelbegriff für den Blick in die eigenen Auskunftei-Daten. Sie ist neutral: Sie verändert den Score nicht und ist für niemanden außer Ihnen sichtbar — beliebig oft möglich."
  },
  {
    "wort": "Erledigungsvermerk",
    "text": "Das Kennzeichen, dass eine gemeldete Forderung bezahlt wurde — mit Datum. Erst dieses Datum startet die Löschfrist (drei Jahre). Fehlt der Vermerk trotz Zahlung, ist das ein Berichtigungsfall mit Beleg."
  },
  {
    "wort": "Geoscoring",
    "text": "Die Bewertung anhand des Wohnorts. Sie darf nur eine Rolle spielen, wenn sonst kaum Daten vorliegen — und nie das einzige Kriterium sein. Wer eine Ablehnung „wegen der Adresse“ vermutet, sollte die eigene Datenlage prüfen: Meist liegt es an etwas anderem."
  },
  {
    "wort": "Girokonto (Vertragsdaten)",
    "text": "Konten und Karten stehen als Vertragsdaten in der Auskunft — nicht als Werturteil, sondern als Bestandsmeldung. Mit der Kündigung müssen sie ausgetragen werden; ein „aktives“ Konto von 2022 in der Auskunft von heute ist ein Berichtigungsfall."
  },
  {
    "wort": "Hundert-Tage-Regel",
    "text": "Seit 2024: Wird eine gemeldete Forderung innerhalb von 100 Tagen vollständig bezahlt und liegen sonst keine Negativmerkmale vor, verkürzt sich die Speicherfrist von drei Jahren auf 18 Monate. Schnelles Ausgleichen ist damit bares Geld für die Bonität."
  },
  {
    "wort": "Inkasso",
    "text": "Der gewerbliche Forderungseinzug im Auftrag eines Gläubigers. Ein Inkassobrief ist eine Behauptung mit Briefkopf — manche berechtigt, viele überhöht, einige erfunden. Erst prüfen (Register, Forderung, Kosten), dann zahlen oder widersprechen."
  },
  {
    "wort": "Konditionsanfrage",
    "text": "Die SCHUFA-neutrale Anfrageart: Die Bank prüft dieselben Daten und nennt echte Konditionen, aber die Anfrage bleibt für andere unsichtbar und scorefrei. Das richtige Werkzeug zum Kreditvergleich — ausdrücklich verlangen."
  },
  {
    "wort": "Kreditanfrage",
    "text": "Die echte Antragsart: zwölf Monate gespeichert, zehn Tage für andere Banken sichtbar, fließt in den Score ein. Gehört an den Vertrag, den Sie wirklich abschließen — nicht an den Vergleich davor."
  },
  {
    "wort": "KSV (Kreditschutzverband)",
    "text": "Österreichs große Wirtschaftsauskunftei (KSV1870). Die DSGVO gilt in Österreich unmittelbar — Datenkopie, Berichtigung und Löschung funktionieren nach denselben Artikeln wie in Deutschland."
  },
  {
    "wort": "Löschfrist",
    "text": "Die Zeitspanne, nach der ein Eintrag aus der Auskunft verschwinden muss: drei Jahre ab Erledigung, 18 Monate bei der 100-Tage-Regel, sechs Monate nach Restschuldbefreiung, zwölf Monate für Anfragen. Taggenau gerechnet — und erstaunlich oft überschritten."
  },
  {
    "wort": "Löschung (Art. 17 DSGVO)",
    "text": "Ihr Anspruch auf Entfernung unzulässiger, falscher oder verfristeter Daten. Kein Gnadenakt der Auskunftei, sondern ein Recht — schriftlich geltend machen, mit Begründung und Frist, an Auskunftei und meldende Stelle."
  },
  {
    "wort": "Mahnbescheid",
    "text": "Das gerichtliche Mahnverfahren (gelber Umschlag): Das Gericht prüft die Forderung NICHT inhaltlich. Gegen einen Mahnbescheid haben Sie 14 Tage für den Widerspruch — das Formular liegt bei. Verstreichen lassen führt zum Vollstreckungsbescheid."
  },
  {
    "wort": "Meldung (§ 31 BDSG)",
    "text": "Eine offene Forderung darf nur unter Voraussetzungen an Auskunfteien gemeldet werden: zwei Mahnungen mit mindestens vier Wochen Abstand, rechtzeitiger Hinweis auf die Meldung, Forderung nicht bestritten. Fehlt eine, ist der Eintrag angreifbar."
  },
  {
    "wort": "Negativmerkmal",
    "text": "Ein Eintrag über nicht vertragsgemäßes Verhalten: gemeldete offene Forderungen, Titel, Insolvenz. Negativmerkmale sind das schwerste Einzelgewicht im Score — und der erste Prüfpunkt jeder Auskunft: Sind sie zulässig, richtig und in der Frist?"
  },
  {
    "wort": "Ombudsmann",
    "text": "Die kostenlose Schlichtungsstelle der SCHUFA für Streitfälle zwischen Verbrauchern und Auskunftei. Der Weg dorthin steht offen, wenn Widerspruch und Löschverlangen ins Leere laufen — parallel bleibt die Datenschutz-Aufsichtsbehörde."
  },
  {
    "wort": "Positivmerkmal",
    "text": "Daten über vertragsgemäßes Verhalten: das lang geführte Konto, der bediente Kredit, die saubere Zahlungsreihe. Positivmerkmale entstehen nicht über Nacht — aber verlässlich, aus Zeit und Pünktlichkeit."
  },
  {
    "wort": "Ratenzahlung",
    "text": "Die Königsdisziplin der Bonität: Jede pünktliche Rate ist ein Positivdatum, jede geplatzte startet die Eskalationstreppe Richtung Eintrag. Ein Abbuchungstag, ein Puffer, eine Erinnerung — mehr braucht es meist nicht."
  },
  {
    "wort": "Restschuldbefreiung",
    "text": "Der Schlusspunkt der Privatinsolvenz: Die restlichen Schulden erlöschen. Der Eintrag darüber wird seit 2023 schon nach sechs Monaten gelöscht — steht er länger, ist das ein klarer Löschfall."
  },
  {
    "wort": "Rücklastschrift",
    "text": "Eine geplatzte Abbuchung. Sie wird nicht automatisch gemeldet, kostet aber Gebühren und Vertrauen beim Vertragspartner — und gehäufte Rückgaben führen zu Kündigungen, die dann sehr wohl in der Auskunft landen."
  },
  {
    "wort": "SCHUFA",
    "text": "Die größte deutsche Wirtschaftsauskunftei: Daten zu rund 68 Millionen Menschen, gespeist von Banken, Händlern und Telekommunikationsanbietern. Die SCHUFA entscheidet keine Anträge — sie liefert Daten und Scores an ihre Vertragspartner."
  },
  {
    "wort": "Score",
    "text": "Die statistische Schätzung Ihrer Zahlungswahrscheinlichkeit, als Zahl. Die Formel ist Geschäftsgeheimnis, die Merkmale dahinter sind bekannt: Zahlungshistorie, Negativmerkmale, Anfragen, Kontenlandschaft, Historie-Alter."
  },
  {
    "wort": "Selbstauskunft",
    "text": "Siehe Datenkopie und Eigenauskunft: der eigene, kostenlose Blick in die gespeicherten Daten. Wie man sie liest — Stammdaten, Kennzeichen, Fristen, Doppelmeldungen — steht in der Checkliste."
  },
  {
    "wort": "Speicherfrist",
    "text": "Die Zeit, die ein Eintrag stehen darf — nicht zu verwechseln mit der Verjährung der Forderung. Eine bezahlte Forderung bleibt trotz Zahlung bis zu drei Jahre sichtbar; eine verjährte kann noch eingetragen sein. Zwei Uhren, zwei Regeln."
  },
  {
    "wort": "Titulierte Forderung",
    "text": "Eine Forderung mit gerichtlichem Titel (Urteil, Vollstreckungsbescheid): 30 Jahre vollstreckbar und meldefähig unabhängig vom Bestreiten. Der Grund, warum man den Widerspruch gegen den Mahnbescheid nie verstreichen lässt."
  },
  {
    "wort": "Verjährung",
    "text": "Das Ende der Durchsetzbarkeit einer Forderung — bei Alltagsforderungen meist drei Jahre zum Jahresende. Verjährtes müssen Sie nicht zahlen, aber Sie müssen sich AUF die Verjährung BERUFEN; von selbst passiert nichts."
  },
  {
    "wort": "Vollstreckungsbescheid",
    "text": "Die zweite Stufe nach dem Mahnbescheid: Aus der Behauptung wird ein vollstreckbarer Titel — pfändbar, 30 Jahre gültig. Auch hier gilt eine 14-Tage-Frist für den Einspruch; danach wird es aufwendig."
  },
  {
    "wort": "Widerspruch",
    "text": "Ihr förmliches Nein — gegen eine Forderung (an Gläubiger und Inkasso), gegen einen Mahnbescheid (ans Gericht, 14 Tage) oder gegen einen Eintrag (an die Auskunftei). Immer schriftlich, immer nachweisbar, immer mit Begründung."
  },
  {
    "wort": "Zahlungshistorie",
    "text": "Die Chronik Ihres Zahlungsverhaltens — das Gedächtnis der Bonität. Sie lässt sich nicht kaufen und nicht faken, nur aufbauen: mit pünktlichen Raten, geführten Konten und der Zeit, die beides braucht."
  }
];
