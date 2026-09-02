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
// Seiten: / (6), /was-ist-fiaon (6), /en/what-is-fiaon (6), /privatkunden (8), /en/personal (8), /business (5), /en/business (5), /preise (6), /en/pricing (6), /en (4), /kreditkarte (5), /en/credit-card (5), /oesterreich (5), /en/austria (5), /schweiz (5), /en/switzerland (5), /sicherheit (11), /en/security (11), /kontakt (5), /en/contact (5), /investoren (4), /datenraum (3), /fiaon-erfahrungen (8), /en/how-fiaon-works (8), /termin (6), /en/book-a-call (6), /vergleich (5), /en/compare (5), /hilfe (36), /en/help (36), /ueber-uns (5), /en/about (5), /transparenz (4), /en/transparency (4), /kredit-ohne-schufa (6), /en/loans-without-schufa (6), /bonitaet-verbessern (6), /en/strengthen-your-credit-file (6), /auskunfteien (5), /en/credit-bureaus (5), /schufa-score-verstehen (6), /en/schufa-score (6), /bonitaetsauskunft-beantragen (7), /en/request-your-credit-report (7), /inkasso-brief-erhalten (6), /en/debt-collection-letter (6), /eintrag-verjaehrung (6), /en/entries-and-limitation (6), /girokonto-trotz-negativer-bonitaet (7), /en/current-account-despite-poor-credit (7), /ratenzahlung-und-bonitaet (6), /en/instalments-and-credit-file (6), /selbstauskunft-checkliste (6), /en/reading-your-credit-report (6), /schufa-neutral-anfragen (6), /en/schufa-neutral-enquiries (6), /schufa-eintrag-loeschen (5), /en/delete-a-schufa-entry (5), /plattform-konzept (5), /en/how-the-platform-works (5), /werkzeuge/basiskonto (5), /en/tools/basic-account (5), /werkzeuge/kartenkosten (5), /en/tools/card-costs (5), /werkzeuge/schuldenplan (5), /en/tools/debt-free-plan (5), /werkzeuge/dispo-rechner (5), /en/tools/overdraft-calculator (5), /werkzeuge/pfaendungsrechner (5), /en/tools/attachment-calculator (5), /werkzeuge/widerspruch (5), /en/tools/deletion-request (5), /werkzeuge/mahnbescheid (5), /en/tools/court-payment-order (5), /werkzeuge/inkasso-antwort (5), /en/tools/reply-to-debt-collector (5), /werkzeuge/mahngebuehren (5), /en/tools/reminder-fees (5), /werkzeuge/ratenplan (5), /en/tools/instalment-plan (5), /werkzeuge (4), /en/tools (4), /status (5), /en/status (5), /karriere (5), /en/careers (5), /partner (3), /en/partners (3), /presse (3), /en/press (3), /werkzeuge/kreditrechner (5), /en/tools/loan-calculator (5), /werkzeuge/umschuldung (5), /en/tools/debt-consolidation (5), /werkzeuge/schulden-check (5), /en/tools/debt-check (5)
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
  "/en/what-is-fiaon": [
    {
      "f": "Is FIAON a bank?",
      "a": "No. FIAON is not a credit institution and issues neither accounts nor cards. The respective partner bank always decides on the issue. FIAON prepares you and documents your credit file."
    },
    {
      "f": "What makes FIAON different from a score app?",
      "a": "A score app shows a number. FIAON obtains the report, explains every entry, prepares the letter and sends it after your approval — and tracks the reply. Displaying is the first layer. FIAON has three."
    },
    {
      "f": "Who reviews the letters?",
      "a": "Every letter type is approved and versioned by the legal team. No letter goes out that has not been reviewed — and none without your approval."
    },
    {
      "f": "Which countries does this apply to?",
      "a": "Germany (SCHUFA), Austria (KSV) and Switzerland (CRIF). The platform recognises your country and makes the request to the right credit bureau."
    },
    {
      "f": "What does FIAON cost?",
      "a": "Plans from €7.99 a month, twelve instalments by SEPA direct debit, then you decide whether to stay. Just the report? €74 one-off."
    },
    {
      "f": "Where is my data held?",
      "a": "Encrypted on servers in the EU, GDPR-compliant. You decide what you upload and can have it deleted at any time."
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
      "f": "Was kostet es – und wie lange bin ich gebunden?",
      "a": "Pakete ab 7,99 € im Monat, zwölf Raten per Lastschrift. Nach der zwölften fragen wir, ob Sie bleiben. Nur die Auskunft: 74,00 € einmalig."
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
  "/en/personal": [
    {
      "f": "Am I guaranteed a credit card?",
      "a": "No — the bank decides on card and limit. What FIAON does: put your file in order, calculate your readiness and prepare the application when it is realistic. Every customer gets a current account."
    },
    {
      "f": "How quickly do I see my report?",
      "a": "Usually within 24 hours of activation. FIAON makes the request to SCHUFA, KSV or CRIF with your authorisation — you fill in no forms."
    },
    {
      "f": "What happens if an entry is justified?",
      "a": "Then we say so. Justified entries disappear once the claim is settled and the deadline expires — since 2024 already after 18 months if you pay within 100 days of the report. FIAON helps with instalment agreements and the settled marker."
    },
    {
      "f": "What does it cost — and how long am I tied in?",
      "a": "Plans from €7.99 a month, twelve instalments by direct debit. After the twelfth we ask whether you want to stay. Just the report: €74.00 one-off."
    },
    {
      "f": "Can I change the plan later?",
      "a": "Yes — directly in the application, and in the onboarding call we check together whether it fits."
    },
    {
      "f": "Does this also apply in Austria and Switzerland?",
      "a": "Yes. FIAON works with KSV1870 and CRIF (Austria) and with CRIF and Intrum (Switzerland). The rights under the GDPR and the Swiss DSG are comparable, the deadlines differ — we know both."
    },
    {
      "f": "What does FIAON need from me?",
      "a": "Only a few details for the application. Then your ID and bank statements for the last three months — a phone photo is enough. FIAON obtains the report."
    },
    {
      "f": "How do I reach my contact person?",
      "a": "In your area, by e-mail, by phone — and for many customers by WhatsApp. Every question lands with the person who knows your file."
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
      "f": "Was kostet es – und gibt es versteckte Gebühren?",
      "a": "Die Pakete kosten zwischen Business Starter und Business Enterprise je nach Stufe, zwölf Raten. Kartengebühren legt der Herausgeber fest; FIAON nennt sie vorher. Keine Provision auf Rahmen."
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
  "/en/business": [
    {
      "f": "Does FIAON guarantee a card limit?",
      "a": "No. The issuer decides on card and limit. FIAON makes sure the report and documents are such that the decision can be positive — and prepares increases."
    },
    {
      "f": "My company is young — does it still work?",
      "a": "Yes. With young companies the owners' credit file counts. FIAON obtains both reports, separates private and business and starts with a limit that grows."
    },
    {
      "f": "What does it cost — and are there hidden fees?",
      "a": "The plans range from Business Starter to Business Enterprise depending on the tier, twelve instalments. Card fees are set by the issuer; FIAON tells you beforehand. No commission on limits."
    },
    {
      "f": "Which cards are possible?",
      "a": "Company charge cards with monthly statements from international issuers, depending on country and profile. Which one exactly is settled in the onboarding call — depending on legal form, turnover and report."
    },
    {
      "f": "Also in Austria and Switzerland?",
      "a": "Yes. FIAON knows KSV1870, CRIF and the Swiss debt enforcement register (Betreibungsregister) and works with card partners in all three countries."
    }
  ],
  "/preise": [
    {
      "f": "Kann ich jederzeit kündigen?",
      "a": "Ja – jederzeit zum Ende des laufenden Monats, formlos und ohne Grund: im Kundenbereich unter Abo & Zahlungen oder per E-Mail. Das Paket ist auf zwölf Raten angelegt, weil Auskunft, Schreiben und Antworten Zeit brauchen – aber niemand ist gebunden. Das gesetzliche Widerrufsrecht von 14 Tagen gilt zusätzlich."
    },
    {
      "f": "Wird die Auskunft angerechnet, wenn ich später ein Paket nehme?",
      "a": "Ja. Wer zuerst nur die Auskunft bucht und innerhalb von 30 Tagen ein Paket wählt, bekommt den Betrag auf die erste Rate angerechnet. Sagen Sie es im Startgespräch oder im Kundenbereich – Ihr Ansprechpartner trägt es ein."
    },
    {
      "f": "Gibt es Kosten je Schreiben oder Erfolgsprovisionen?",
      "a": "Nein. Weder je Schreiben noch auf Löschungen, Konten oder Kartenrahmen. Der Paketpreis ist der Preis. Einschreiben-Porto, Nachfassen, Eskalation – alles enthalten."
    },
    {
      "f": "Wie wird bezahlt?",
      "a": "Erste Rate per Überweisung (Zahlungsdaten mit QR-Code im Kundenbereich), danach SEPA-Lastschrift über einen verifizierten Kreditor, jeweils zum Monatsanfang. Keine Kreditkarte nötig, keine Vorkasse für Leistungen, die noch nicht erbracht sind."
    },
    {
      "f": "Kann ich das Paket wechseln?",
      "a": "Im Antrag, im Startgespräch und danach jederzeit nach oben; nach unten zum nächsten Ratenlauf. Der Paketfinder auf dieser Seite gibt die erste Orientierung – die endgültige Zuordnung besprechen Sie im Startgespräch."
    },
    {
      "f": "Was, wenn alle meine Einträge berechtigt sind?",
      "a": "Dann sagen wir es Ihnen nach der Auskunft – und Sie entscheiden, ob Sie weitermachen. Auch bei berechtigten Einträgen gibt es einen Weg: Erledigt-Vermerke, Ratenvereinbarungen mit Meldeverzicht, das Girokonto, die Zahlungshistorie. Nur Löschung gibt es dann nicht, und das versprechen wir auch nicht."
    }
  ],
  "/en/pricing": [
    {
      "f": "Can I cancel at any time?",
      "a": "Yes — at any time to the end of the current month, informally and without giving a reason: in your customer area under Subscription & payments or by e-mail. The plan is set up for twelve instalments because reports, letters and replies take time — but nobody is tied in. The statutory 14-day right of withdrawal applies in addition."
    },
    {
      "f": "Is the report credited if I choose a plan later?",
      "a": "Yes. If you buy the report on its own first and choose a plan within 30 days, the amount is credited against the first instalment. Say so in the onboarding call or in your customer area — your contact person records it."
    },
    {
      "f": "Are there fees per letter or success commissions?",
      "a": "No. Neither per letter nor on deletions, accounts or card limits. The plan price is the price. Registered-letter postage, follow-up, escalation — all included."
    },
    {
      "f": "How do I pay?",
      "a": "First instalment by bank transfer (payment details with a QR code in your customer area), then SEPA direct debit through a verified creditor at the start of each month. No credit card needed, no payment in advance for services not yet delivered."
    },
    {
      "f": "Can I change plans?",
      "a": "In the application, in the onboarding call and upwards at any time afterwards; downwards from the next instalment cycle. The plan finder on this page gives a first orientation — the final choice is discussed in the onboarding call."
    },
    {
      "f": "What if all my entries are justified?",
      "a": "Then we tell you so after the report — and you decide whether to continue. Even with justified entries there is a way forward: settled markers, instalment agreements with a waiver of reporting, the current account, your payment history. Only deletion is off the table then, and we do not promise it."
    }
  ],
  "/en": [
    {
      "f": "Is FIAON available in English?",
      "a": "The website is being translated page by page; the application and the customer area are currently in German. Our team speaks English on the phone and by e-mail."
    },
    {
      "f": "Which credit bureaus does FIAON work with?",
      "a": "SCHUFA in Germany, KSV1870 and CRIF in Austria, CRIF and Intrum in Switzerland — always with your written authorisation."
    },
    {
      "f": "Can I cancel?",
      "a": "Yes, at any time to the end of the current month, informally. The plan runs for twelve instalments; after that we ask you whether you want to stay — no silent renewal."
    },
    {
      "f": "How long does a settled debt stay on file?",
      "a": "Under the credit bureaus' code of conduct, three years after settlement to the day; if you settle within 100 days of the entry and have no other entries, 18 months. FIAON tracks the exact date for every entry."
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
  "/en/credit-card": [
    {
      "f": "Can I get a credit card with an open entry?",
      "a": "With a limit, practically never. A debit or prepaid card, yes — and in parallel the entry should be checked: is it justified? When does the deadline expire? The block is often shorter than you think."
    },
    {
      "f": "How high is the limit at the start?",
      "a": "With settled entries or a short history usually €500 to €2,000. After six months of statements settled on time, issuers review. The card partner's threshold is €25,000."
    },
    {
      "f": "Does the card application hurt my report?",
      "a": "A credit enquiry is stored for twelve months and visible to others for ten days. That is why FIAON only applies once the report supports it — and never several at once."
    },
    {
      "f": "Which card do I get through FIAON?",
      "a": "A credit card from a card partner, Mastercard or Visa depending on your profile, with a monthly statement. Which one exactly is settled in the onboarding call on the basis of your report."
    },
    {
      "f": "What does the card cost?",
      "a": "The card fee is set by the issuer and named beforehand. FIAON takes no commission on card or limit — the plan price is the price."
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
  "/en/austria": [
    {
      "f": "Is there a SCHUFA in Austria?",
      "a": "No. The role is taken by KSV1870 and CRIF, alongside the banks' warning lists. Anyone who moves from Germany to Austria starts at KSV and CRIF without a history — the SCHUFA data is not transferred."
    },
    {
      "f": "How long does an entry stay at KSV?",
      "a": "Settled claims usually three years after settlement; insolvency data according to the insolvency register (Ediktsdatei). Data stored longer is to be erased under Art. 17 GDPR."
    },
    {
      "f": "Why was my mobile contract rejected although KSV has nothing?",
      "a": "Mobile providers frequently enquire at CRIF. Request the self-disclosure there — FIAON does that for you."
    },
    {
      "f": "Can I open an account despite an entry?",
      "a": "Yes. There is a legal right to a basic account under the Consumer Payment Accounts Act (Verbraucherzahlungskontogesetz). FIAON prepares the opening with a partner bank."
    },
    {
      "f": "Does FIAON work under Austrian law?",
      "a": "Yes. Letters, deadlines and sections are adapted for Austria: GDPR, DSG, GewO, Consumer Payment Accounts Act. Your contact person knows both countries."
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
  "/en/switzerland": [
    {
      "f": "An enforcement was unjustified — why is it still in the extract?",
      "a": "Because the register records every enforcement regardless of whether it is justified. It stays visible for five years — unless you have it blocked under Art. 8a SchKG or the creditor withdraws it."
    },
    {
      "f": "I have paid — is the enforcement gone now?",
      "a": "No, it carries the marker “paid” and remains visible. Only the creditor's withdrawal declaration removes it. FIAON drafts the request — often as a condition of payment."
    },
    {
      "f": "Does the German SCHUFA apply in Switzerland?",
      "a": "No. Swiss banks and retailers query the debt enforcement register, CRIF and Intrum. Anyone who moves in from Germany starts without a history — and should check the first extract early."
    },
    {
      "f": "Can I get an account with enforcements?",
      "a": "Banks may refuse; PostFinance runs accounts for people resident in Switzerland largely regardless of enforcements. FIAON prepares the opening."
    },
    {
      "f": "How long does non-disclosure under Art. 8a take?",
      "a": "The request is possible at the earliest three months after service of the payment order; the office asks the creditor, who has 20 days to prove proceedings. After that the enforcement is no longer shown to third parties."
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
      "f": "Wer ist für den Datenschutz verantwortlich?",
      "a": "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom. Datenschutzanfragen an support@fiaon.com. Zuständige Aufsicht für Kunden in Deutschland: die Landesdatenschutzbehörde Ihres Wohnsitzes."
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
  "/en/security": [
    {
      "f": "May a bank query my SCHUFA data without my knowledge?",
      "a": "Only with a legal basis — usually your consent in the application (SCHUFA clause) or a legitimate interest when a contract is being initiated. Every query appears as an enquiry in your data copy, with date and recipient."
    },
    {
      "f": "May my landlord demand a credit report?",
      "a": "They may ask for it; you do not have to provide it — in practice it is common, though. Provide the credit report for landlords (without details), never the full data copy."
    },
    {
      "f": "May a debt collector report my data to SCHUFA?",
      "a": "Only under the conditions of Section 31(2) BDSG: a due, undisputed claim, two reminders, a notice of the report. If one of these is missing, the report is unlawful."
    },
    {
      "f": "May FIAON pass my report on to third parties?",
      "a": "No. FIAON passes data on only if you approve it for a specific purpose — for instance the documents for a card application to the card partner. Never for advertising, never sold."
    },
    {
      "f": "May I demand the deletion of my data at FIAON?",
      "a": "At any time (Art. 17 GDPR). After the contract ends we delete report and documents; statutory retention obligations for invoices remain (ten years, accounting data only)."
    },
    {
      "f": "May a credit bureau use data from social networks?",
      "a": "Not under the credit bureaus' code of conduct; the draft scoring law (2024) is meant to prohibit it explicitly, as well as data on origin, health or address as a score criterion."
    },
    {
      "f": "Does FIAON see my online banking?",
      "a": "No. You upload a bank statement as a photo or PDF. Account connection (open banking) is coming as an option — explicitly enabled by you, revocable at any time."
    },
    {
      "f": "Who is responsible for data protection?",
      "a": "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom. Data protection requests to support@fiaon.com. Competent supervisory authority for customers in Germany: the state data protection authority of your place of residence."
    },
    {
      "f": "Is my data used for AI training?",
      "a": "No. Personal data is not used to train models. Anonymised experience (which letters work) improves templates — without names, without references."
    },
    {
      "f": "What happens in the event of a data breach?",
      "a": "Notification to the supervisory authority within 72 hours and information to those affected if there is a risk (Art. 33, 34 GDPR). There is a plan for that, not improvisation."
    },
    {
      "f": "Can I use FIAON without uploading documents?",
      "a": "The report can be obtained with authorisation; the financial analysis needs the bank statement, account and card need your ID. What you do not upload stays out — and we tell you what then is not possible."
    }
  ],
  "/kontakt": [
    {
      "f": "Wann erreiche ich FIAON telefonisch?",
      "a": "Werktags unter +41 44 244 93 01. Außerhalb der Zeiten nutzen Sie „Dringend melden“ – die Meldung liegt am nächsten Werktag als Erstes oben."
    },
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
    },
    {
      "f": "Wohin mit Post, Rechnungen oder rechtlichen Schreiben?",
      "a": "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom. Rechtlich relevante Post bitte zusätzlich als Foto per E-Mail – das spart Tage."
    }
  ],
  "/en/contact": [
    {
      "f": "When can I reach FIAON by phone?",
      "a": "On weekdays on +41 44 244 93 01. Outside those hours use “Report urgently” — the report is at the top of the list first thing on the next working day."
    },
    {
      "f": "I am a customer — where do I ask questions about my file?",
      "a": "Best in the customer area under “Help”: there your contact person sees the file alongside. Urgent matters via this page with “To my contact person”."
    },
    {
      "f": "Can the assistant check my payment or my appointment?",
      "a": "No — it has no access to customer data. You see payment, appointment and documents in the customer area; if something does not add up, support helps."
    },
    {
      "f": "How quickly does the management react to “Urgent”?",
      "a": "The report appears immediately with priority “today” in the management's task list. You usually get a reply on the same working day by phone or e-mail."
    },
    {
      "f": "Where do I send post, invoices or legal letters?",
      "a": "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom. Legally relevant post please additionally as a photo by e-mail — that saves days."
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
  "/fiaon-erfahrungen": [
    {
      "f": "Ist FIAON seriös?",
      "a": "Prüfen Sie uns an den Kriterien, die für jeden Anbieter gelten – sie stehen im Seriositäts-Check auf dieser Seite: Festpreise statt Erfolgsbeteiligung, keine Löschgarantien, Ihre kostenlosen Rechte werden genannt, ein Impressum mit erreichbaren Menschen, kein Zeitdruck, jeder Schritt im Kundenbereich nachlesbar. FIAON LTD ist im britischen Handelsregister eingetragen (Company No. 17318250); Kunden in Deutschland, Österreich und der Schweiz."
    },
    {
      "f": "Was macht FIAON genau?",
      "a": "FIAON beschafft Ihre Bonitätsauskünfte bei SCHUFA, KSV und CRIF, erklärt jede Zeile in Klartext, prüft jeden Eintrag auf Zulässigkeit (§ 31 BDSG) und Verfristung und führt den Schriftwechsel mit Auskunfteien und Gläubigern – anwaltlich geprüfte Vorlagen, Einschreiben, Fristen, Antworten. Danach bereitet FIAON Girokonto und Kreditkarte beim Partnerinstitut vor. Über die Vergabe entscheidet die Bank."
    },
    {
      "f": "Was kostet FIAON?",
      "a": "Die Bonitätsauskunft mit Prüfung kostet einmalig 74 Euro. Die Pakete für die laufende Begleitung laufen über zwölf Monatsraten von 7,99 bis 99,99 Euro; alle Preise stehen offen auf der Preisseite. Keine Erfolgsbeteiligung, keine Gebühr je Schreiben, keine Provision auf Konto oder Karte."
    },
    {
      "f": "Kann FIAON meine SCHUFA-Einträge löschen?",
      "a": "FIAON kann durchsetzen, was das Gesetz hergibt: die Löschung unzulässig gemeldeter, inhaltlich falscher oder verfristeter Einträge. Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf – das sagen wir Ihnen vor der Beauftragung, nicht danach. Wer Ihnen das Gegenteil verspricht, arbeitet unseriös."
    },
    {
      "f": "Wie sehe ich, was FIAON für mich tut?",
      "a": "In Ihrem Kundenbereich: jeder Auftrag, jede eingegangene Auskunft, jedes Schreiben, jede Frist und jede Antwort als nachvollziehbarer Verlauf. Sie müssen nicht anrufen, um den Stand zu erfahren – und Sie geben jedes Schreiben frei, bevor es rausgeht."
    },
    {
      "f": "Arbeitet FIAON auch in Österreich und der Schweiz?",
      "a": "Ja. SCHUFA in Deutschland, KSV1870 und CRIF in Österreich, CRIF, Intrum und das Betreibungsregister in der Schweiz – mit den jeweiligen Rechtsgrundlagen. Rund ein Drittel unserer zahlenden Kunden kommt aus Österreich."
    },
    {
      "f": "Wie kündige ich, wenn ich nicht zufrieden bin?",
      "a": "Jederzeit zum Ende des laufenden Monats, formlos und ohne Grund – im Kundenbereich unter Abo & Zahlungen oder per E-Mail. Das Widerrufsrecht von 14 Tagen gilt zusätzlich."
    },
    {
      "f": "Wo sind die Bewertungen?",
      "a": "FIAON baut die öffentlichen Bewertungsprofile (Trustpilot, ProvenExpert, Google) gerade auf – Kunden erhalten nach dem Startgespräch eine Einladung. Bis die Profile stehen, zeigen wir hier lieber nichts als erfundene Sterne. Prüfbar sind heute: Zahlen aus dem Betrieb, Ablauf, Preise, Team und Sicherheit."
    }
  ],
  "/en/how-fiaon-works": [
    {
      "f": "Is FIAON legitimate?",
      "a": "Test us against the criteria that apply to every provider — they are in the seriousness check on this page: fixed prices instead of a success fee, no deletion guarantees, your free rights are named, a legal notice with reachable people, no time pressure, every step readable in the customer area. FIAON LTD is registered at Companies House (Company No. 17318250); customers in Germany, Austria and Switzerland."
    },
    {
      "f": "What exactly does FIAON do?",
      "a": "FIAON obtains your credit reports from SCHUFA, KSV and CRIF, explains every line in plain language, checks every entry for lawfulness (Section 31 BDSG) and expiry and handles the correspondence with credit bureaus and creditors — templates reviewed by lawyers, registered post, deadlines, replies. Then FIAON prepares a current account and a credit card with the partner institution. The bank decides on the issue."
    },
    {
      "f": "What does FIAON cost?",
      "a": "The credit report with review costs €74 one-off. The plans for ongoing support run over twelve monthly instalments from €7.99 to €99.99; all prices are open on the pricing page. No success fee, no fee per letter, no commission on account or card."
    },
    {
      "f": "Can FIAON delete my SCHUFA entries?",
      "a": "FIAON can enforce what the law allows: the deletion of unlawfully reported, factually wrong or expired entries. Justified, lawfully reported entries stay until the deadline expires — we tell you that before you engage us, not afterwards. Anyone who promises you the opposite is not serious."
    },
    {
      "f": "How do I see what FIAON is doing for me?",
      "a": "In your customer area: every engagement, every report received, every letter, every deadline and every reply as a traceable timeline. You do not have to call to find out the status — and you approve every letter before it goes out."
    },
    {
      "f": "Does FIAON also work in Austria and Switzerland?",
      "a": "Yes. SCHUFA in Germany, KSV1870 and CRIF in Austria, CRIF, Intrum and the debt enforcement register in Switzerland — with the respective legal bases. Around a third of our paying customers are in Austria."
    },
    {
      "f": "How do I cancel if I am not satisfied?",
      "a": "At any time to the end of the current month, informally and without giving a reason — in the customer area under Subscription & payments or by e-mail. The 14-day right of withdrawal applies in addition."
    },
    {
      "f": "Where are the reviews?",
      "a": "FIAON is currently setting up the public review profiles (Trustpilot, ProvenExpert, Google) — customers receive an invitation after the onboarding call. Until the profiles are up, we would rather show nothing here than invented stars. Verifiable today: figures from operations, process, prices, team and security."
    }
  ],
  "/termin": [
    {
      "f": "Was kostet das Gespräch?",
      "a": "Nichts. Es ist ein Telefonat von rund 15 Minuten, ohne Verpflichtung. Danach wissen Sie, was Ihre Auskunft hergibt, welches Paket passt – oder dass die kostenlosen Werkzeuge in Ihrem Fall reichen. Das sagen wir Ihnen genauso."
    },
    {
      "f": "Wer ruft mich an?",
      "a": "Ein Mitarbeiter aus Vertrieb oder Onboarding – ein Mensch mit Namen, der die Plattform selbst täglich nutzt; viele im Team waren selbst Kunden. Kein Callcenter, kein Bot."
    },
    {
      "f": "Was sollte ich bereithalten?",
      "a": "Nichts Pflichtiges. Hilfreich sind: der Brief oder die Auskunft, um die es geht, die ungefähre Höhe offener Forderungen und ein Blick auf den Kontoauszug der letzten drei Monate. Wer schon eine Datenkopie hat, legt sie neben das Telefon."
    },
    {
      "f": "Wie schnell kommt der Rückruf?",
      "a": "Im gewünschten Zeitfenster, spätestens am nächsten Werktag. Wer „so schnell wie möglich“ wählt, wird in der Regel innerhalb weniger Stunden angerufen – zu den Telefonzeiten des Teams (werktags 9 bis 19 Uhr)."
    },
    {
      "f": "Ist das schon das Startgespräch?",
      "a": "Wenn Sie danach ein Paket wählen und die erste Rate eingeht, wird derselbe Termin zum Startgespräch – Sie brauchen keinen zweiten. Wer nur reden wollte, hat geredet. Beides ist in Ordnung."
    },
    {
      "f": "Ich bin schon Kunde – wo buche ich?",
      "a": "Im Kundenbereich unter Hilfe erreichen Sie Ihre Ansprechpartnerin direkt; dort steht auch der nächste Termin. Diese Seite ist für alle, die FIAON noch nicht kennen."
    }
  ],
  "/en/book-a-call": [
    {
      "f": "What does the call cost?",
      "a": "Nothing. It is a phone call of around 15 minutes, with no obligation. Afterwards you know what your report shows, which plan fits — or that the free tools are enough in your case. We tell you that just the same."
    },
    {
      "f": "Who calls me?",
      "a": "Someone from sales or onboarding — a person with a name who uses the platform every day; many in the team were customers themselves. No call centre, no bot."
    },
    {
      "f": "What should I have to hand?",
      "a": "Nothing is required. Helpful: the letter or the report in question, the rough amount of open claims and a look at your bank statements for the last three months. If you already have a data copy, keep it next to the phone."
    },
    {
      "f": "How quickly does the call come?",
      "a": "In the preferred time slot, on the next working day at the latest. If you choose “as soon as possible”, you are usually called within a few hours — during the team's phone hours (weekdays 9 to 19 h)."
    },
    {
      "f": "Is this already the onboarding call?",
      "a": "If you choose a plan afterwards and the first instalment arrives, the same appointment becomes the onboarding call — you do not need a second one. If you just wanted to talk, you have talked. Both are fine."
    },
    {
      "f": "I am already a customer — where do I book?",
      "a": "In the customer area under Help you reach your contact person directly; your next appointment is shown there too. This page is for everyone who does not know FIAON yet."
    }
  ],
  "/vergleich": [
    {
      "f": "Wann ist der Anwalt der bessere Weg?",
      "a": "Wenn die Auskunftei eine eindeutig unzulässige Meldung trotz Löschantrag nicht löscht, wenn Schadensersatz nach Art. 82 DSGVO im Raum steht oder wenn bereits geklagt wird. Dann braucht es jemanden, der vor Gericht auftreten darf. FIAON ist keine Rechtsberatung – und sagt Ihnen, wenn dieser Punkt erreicht ist."
    },
    {
      "f": "Was kostet ein Anwalt für einen SCHUFA-Eintrag?",
      "a": "Ein anwaltliches Schreiben nach RVG liegt je nach Gegenstandswert typischerweise bei 150 bis 300 Euro; Erstberatungen werden oft pauschal bis 190 Euro angeboten. Bei mehreren Einträgen und Nachfassen summiert sich das schnell. Rechtsschutzversicherungen decken Datenschutzstreitigkeiten teils ab – fragen Sie vorher nach."
    },
    {
      "f": "Reicht eine kostenlose Score-App?",
      "a": "Zum Anschauen ja: Score, Einträge, Warnungen. Zum Handeln nein: Keine App schreibt den Löschantrag, verfolgt die Frist oder verhandelt Raten. Nutzen Sie die App für die Einsicht – und die kostenlosen FIAON-Werkzeuge oder ein Paket für die Aktion."
    },
    {
      "f": "Kann ich das wirklich alles selbst machen?",
      "a": "Ja. Die Datenkopie ist kostenlos, die Gesetze sind öffentlich, und die 20 FIAON-Werkzeuge schreiben die Briefe. Was Sie mitbringen müssen: Zeit (rund drei Stunden je Eintrag), Disziplin beim Nachfassen und die Bereitschaft, Fristen selbst im Blick zu behalten."
    },
    {
      "f": "Was unterscheidet FIAON von einem Anwalt?",
      "a": "FIAON ist Verfolgung und Weg: Auskunft beschaffen, jeden Eintrag einordnen, anwaltlich geprüfte Schreiben versenden, Antworten nachhalten, Ratenangebote, Konto und Karte vorbereiten – zu einem Festpreis über zwölf Raten. Ein Anwalt vertritt Sie rechtlich im Einzelfall und darf klagen. Beides schließt sich nicht aus."
    }
  ],
  "/en/compare": [
    {
      "f": "When is a lawyer the better route?",
      "a": "When the credit bureau does not delete a clearly unlawful report despite a deletion request, when damages under Art. 82 GDPR are at stake or when a lawsuit is already under way. Then you need someone who may appear in court. FIAON is not legal advice — and tells you when that point is reached."
    },
    {
      "f": "What does a lawyer cost for a SCHUFA entry?",
      "a": "A lawyer's letter under the German fee schedule (RVG) typically costs €150 to €300 depending on the amount at stake; initial consultations are often offered at a flat rate of up to €190. With several entries and follow-up that adds up quickly. Legal expenses insurance sometimes covers data protection disputes — ask beforehand."
    },
    {
      "f": "Is a free score app enough?",
      "a": "For looking, yes: score, entries, alerts. For acting, no: no app writes the deletion request, tracks the deadline or negotiates instalments. Use the app for insight — and the free FIAON tools or a plan for action."
    },
    {
      "f": "Can I really do all of this myself?",
      "a": "Yes. The data copy is free, the law is public, and the 20 FIAON tools write the letters. What you need to bring: time (around three hours per entry), discipline in following up and the willingness to keep an eye on deadlines yourself."
    },
    {
      "f": "What is the difference between FIAON and a lawyer?",
      "a": "FIAON is follow-up and path: obtain the report, classify every entry, send letters reviewed by lawyers, chase replies, instalment offers, prepare account and card — for a fixed price over twelve instalments. A lawyer represents you legally in the individual case and may sue. The two are not mutually exclusive."
    }
  ],
  "/hilfe": [
    {
      "f": "Wie lange dauert der Antrag?",
      "a": "Etwa zwei Minuten: E-Mail, Name, Geburtsdatum, Telefon, Adresse (füllt sich beim Tippen selbst aus), Beschäftigung, Einkommen, Wunschlimit. Danach nehmen Sie den Vertrag an und sind sofort in Ihrem Bereich."
    },
    {
      "f": "Was passiert nach dem Antrag?",
      "a": "Sie legen ein Passwort fest und wählen: „Jetzt aktivieren“ (Zahlungsdaten mit QR-Code) oder „Zuerst sprechen“ (Termin mit einem Mitarbeiter). Nach Zahlungseingang buchen Sie das Startgespräch – bis dahin bleibt der Bereich geschlossen."
    },
    {
      "f": "Was ist das Startgespräch?",
      "a": "Ein Telefonat von rund 15 Minuten mit einem Mitarbeiter: Lage, Ziel, Unterlagen, nächste Schritte. Es ist Pflicht, weil danach Ihre Auskunft beantragt wird. Wer vorher einen Termin über /termin gebucht hat, braucht keinen zweiten."
    },
    {
      "f": "Kann ich das Paket noch ändern?",
      "a": "Ja – im Antrag, im Startgespräch und danach jederzeit nach oben; nach unten zum nächsten Ratenlauf. Der Paketfinder auf der Preisseite gibt die erste Orientierung."
    },
    {
      "f": "Ich habe den Antrag abgebrochen – was nun?",
      "a": "Sie können jederzeit weitermachen: Der Link in der E-Mail führt zurück in den Antrag. Es entstehen keine Kosten, bis Sie den Vertrag annehmen und die erste Rate zahlen."
    },
    {
      "f": "Wie bezahle ich die erste Rate?",
      "a": "Per Überweisung an die Zahlungsdaten im Kundenbereich (mit QR-Code zum Scannen). Sobald die Bank den Eingang bestätigt, ist Ihr Paket aktiv – „bezahlt“ heißt bei FIAON immer bankbestätigt, nicht nur gemeldet."
    },
    {
      "f": "Wie laufen die weiteren Raten?",
      "a": "Per SEPA-Lastschrift über einen verifizierten Kreditor, jeweils zum Monatsanfang. Sie erteilen das Mandat einmal im Kundenbereich. Zwei Tage vor jeder Abbuchung erinnert der Zahlungskalender."
    },
    {
      "f": "Meine Zahlung ist nicht angekommen – was tun?",
      "a": "Überweisungen brauchen ein bis zwei Bankarbeitstage. Prüfen Sie Verwendungszweck (Ihre Referenz) und Betrag. Ist die Zahlung nach drei Werktagen nicht zugeordnet, melden Sie sich mit Datum und Betrag beim Support – wir suchen sie im Bankbuch."
    },
    {
      "f": "Was passiert, wenn eine Rate nicht abgebucht werden kann?",
      "a": "Sie bekommen eine Nachricht mit einem neuen Termin; es entstehen keine Mahngebühren bei FIAON. Melden Sie sich vor dem Termin, wenn es eng wird – Ihre Ansprechpartnerin kann eine Rate verschieben."
    },
    {
      "f": "Bekomme ich eine Rechnung?",
      "a": "Ja, je Rate im Kundenbereich unter Abo & Zahlungen als PDF – mit Umsatzsteuer ausgewiesen."
    },
    {
      "f": "Wird die Bonitätsauskunft angerechnet?",
      "a": "Wer zuerst nur die Auskunft (74 Euro) bucht und innerhalb von 30 Tagen ein Paket wählt, bekommt den Betrag auf die erste Rate angerechnet – sagen Sie es im Startgespräch."
    },
    {
      "f": "Welche Auskünfte beschafft FIAON?",
      "a": "In Deutschland die SCHUFA (auf Wunsch auch Boniversum, CRIF), in Österreich KSV1870 und CRIF, in der Schweiz CRIF, Intrum und den Betreibungsregisterauszug – mit Ihrer digitalen Vollmacht. Sie füllen kein Formular aus."
    },
    {
      "f": "Wie lange dauert es, bis die Auskunft da ist?",
      "a": "Die Auskunfteien haben einen Monat Zeit (Art. 15 DSGVO); in der Praxis kommen Datenkopien oft nach ein bis drei Wochen. Sobald sie vorliegt, sehen Sie sie innerhalb von 24 Stunden erklärt im Kundenbereich."
    },
    {
      "f": "Was bedeuten die Bewertungen an den Einträgen?",
      "a": "Jeder Eintrag bekommt eine Einordnung: erledigt, löschbar, berichtigbar, angreifbar – oder berechtigt. Berechtigt heißt: zulässig gemeldet und noch in der Frist; daran ändert kein Schreiben etwas, und das sagen wir vorher."
    },
    {
      "f": "Was ist der neue SCHUFA-Score?",
      "a": "Seit dem 17. März 2026 rechnet die SCHUFA mit 100 bis 999 Punkten aus zwölf veröffentlichten Kriterien in fünf Klassen. Er ersetzt den Basisscore in Prozent. FIAON ordnet Ihren Score je Kriterium ein – die Tabelle steht auf der Seite SCHUFA-Score verstehen."
    },
    {
      "f": "Kann ich meine Auskunft selbst kostenlos anfordern?",
      "a": "Ja, die Datenkopie nach Art. 15 DSGVO ist bei jeder Auskunftei kostenlos. Der Selbstauskunft-Generator unter /werkzeuge/selbstauskunft schreibt den Brief. FIAON lohnt sich für die Erklärung, die Prüfung und alles danach."
    },
    {
      "f": "Wer schreibt die Briefe?",
      "a": "FIAON, aus anwaltlich geprüften Vorlagen, mit Ihren Daten und dem passenden Grund (§ 31 BDSG, Art. 16/17/21 DSGVO). Sie sehen jedes Schreiben im Kundenbereich und geben es frei – nichts geht ohne Sie raus."
    },
    {
      "f": "Wie werden die Schreiben versendet?",
      "a": "Ab dem Paket Pro per Einschreiben durch FIAON; im Paket Start bereiten wir sie vor und Sie versenden selbst. Der Nachweis über den Zugang liegt in Ihrer Akte."
    },
    {
      "f": "Wie lange dauert es, bis eine Auskunftei antwortet?",
      "a": "Einen Monat nach Zugang, in Ausnahmefällen mit Mitteilung bis zu drei. FIAON verfolgt die Frist und fasst nach; bei Ablehnung ohne Grund folgt die Beschwerde bei der Datenschutzaufsicht (Art. 77 DSGVO)."
    },
    {
      "f": "Was, wenn ein Gläubiger nicht reagiert?",
      "a": "Dann geht die Aufforderung an die Auskunftei, die selbst prüfen muss – und parallel die Erinnerung mit Frist an den Gläubiger. Sie sehen jeden Schritt und jede Antwort in Ihrer Akte."
    },
    {
      "f": "Ich habe einen Mahnbescheid bekommen – hilft FIAON?",
      "a": "FIAON ist keine Rechtsberatung; die Widerspruchsfrist (zwei Wochen) müssen Sie selbst wahren – der Fristenrechner unter /werkzeuge/mahnbescheid nennt den Tag. Wir prüfen mit Ihnen Forderung, Kosten und Verjährung und formulieren Ratenangebote."
    },
    {
      "f": "Bekomme ich garantiert ein Konto oder eine Karte?",
      "a": "Nein – und wer das verspricht, arbeitet unseriös. FIAON bereitet vor: Girokonto beim Partnerinstitut für jeden Kunden, Kreditkarte, sobald Ihre Akte die Schwelle des Kartenpartners erreicht. Über die Vergabe entscheidet die Bank."
    },
    {
      "f": "Was ist die Karten-Readiness?",
      "a": "Ein Wert, den FIAON aus Einträgen, Einkommen und Kontoverhalten berechnet. Er zeigt, wie nah Sie an der Schwelle des Kartenpartners sind und welcher Schritt sie wie weit bewegt – ein Fortschrittsbalken, kein Versprechen."
    },
    {
      "f": "Ich habe ein Basiskonto – reicht das?",
      "a": "Das Basiskonto ist Ihr gesetzliches Recht und ein guter Boden: Gehaltseingänge, pünktliche Abbuchungen, kein Dauer-Dispo bauen die Kontohistorie, die Banken später lesen. Der Weg über FIAON baut darauf auf."
    },
    {
      "f": "Wie hoch ist der Rahmen am Anfang?",
      "a": "Das entscheidet der Kartenpartner anhand der Akte; typisch beginnt es klein und wächst mit pünktlicher Abrechnung. Die Zeitachse steht auf der Seite Kreditkarte trotz Eintrag – ein typischer Verlauf, kein Versprechen."
    },
    {
      "f": "Wie kündige ich?",
      "a": "Jederzeit zum Ende des laufenden Monats, formlos: im Kundenbereich unter Abo & Zahlungen mit einem Klick oder per E-Mail an support@fiaon.com. Sie bekommen eine Bestätigung; die letzte Rate ist die des laufenden Monats."
    },
    {
      "f": "Gibt es ein Widerrufsrecht?",
      "a": "Ja, 14 Tage ab Vertragsschluss, ohne Angabe von Gründen – die Widerrufsbelehrung und das Musterformular stehen auf der Seite Widerrufsbelehrung. Bereits erbrachte Leistungen (etwa eine beschaffte Auskunft) werden anteilig berechnet."
    },
    {
      "f": "Was passiert mit meinen Daten nach der Kündigung?",
      "a": "Auf Wunsch löschen wir Auskunft, Unterlagen und Akte vollständig (Art. 17 DSGVO) und bestätigen das innerhalb von 30 Tagen. Gesetzliche Aufbewahrungspflichten für Rechnungen bleiben."
    },
    {
      "f": "Laufen meine Schreiben nach der Kündigung weiter?",
      "a": "Bereits versendete Schreiben bleiben wirksam – die Auskunftei muss antworten. Die Nachverfolgung durch FIAON endet mit dem Paket; Sie erhalten alle Unterlagen als Kopie."
    },
    {
      "f": "Wo liegen meine Daten?",
      "a": "Auf Servern in Frankfurt am Main (EU), verschlüsselt übertragen und gespeichert. Details und den Live-Status finden Sie unter /status und /sicherheit."
    },
    {
      "f": "Wer sieht meine Akte?",
      "a": "Ihre Ansprechpartnerin, die Betreiber – und niemand sonst. Partnerbanken sehen nur, was Sie ausdrücklich freigeben; die Einwilligung wird protokolliert und ist widerrufbar."
    },
    {
      "f": "Sieht FIAON mein Online-Banking?",
      "a": "Nein. Sie laden Kontoauszüge als Datei oder Foto hoch; die Kontoanbindung (PSD2) ist in Vorbereitung und wird nur mit Ihrer ausdrücklichen Zustimmung genutzt."
    },
    {
      "f": "Wie bekomme ich eine Kopie meiner Daten bei FIAON?",
      "a": "Im Kundenbereich unter Mein Konto oder per E-Mail – Auskunft nach Art. 15 DSGVO, kostenlos, innerhalb eines Monats."
    },
    {
      "f": "Kann ich als Kunde für FIAON arbeiten?",
      "a": "Ja – viele im Team waren selbst Kunden. Bewerbung in vier Schritten auf der Karriere-Seite; Florentine meldet sich persönlich innerhalb von zwei Werktagen."
    },
    {
      "f": "Fest oder frei?",
      "a": "Beides: Festanstellung oder freie Mitarbeit auf Provision, remote in Deutschland, Österreich und der Schweiz. Niemand spricht mit Kunden, bevor er die Academy bestanden hat."
    },
    {
      "f": "Was verdiene ich?",
      "a": "Das steht im Gespräch und im Vertrag – ehrlich geregelt, keine Fantasiezahlen auf der Website. Auf der Karriere-Seite steht, wie die Zusammenarbeit funktioniert."
    }
  ],
  "/en/help": [
    {
      "f": "How long does the application take?",
      "a": "About two minutes: e-mail, name, date of birth, phone, address (fills in as you type), occupation, income, desired limit. Then you accept the contract and are in your area straight away. The application is currently in German; our team helps in English on the phone."
    },
    {
      "f": "What happens after the application?",
      "a": "You set a password and choose: “Activate now” (payment details with a QR code) or “Talk first” (an appointment with one of our team). After the payment arrives you book the onboarding call — until then the area stays closed."
    },
    {
      "f": "What is the onboarding call?",
      "a": "A phone call of around 15 minutes with one of our team: situation, goal, documents, next steps. It is mandatory because your report is requested afterwards. Anyone who booked a call beforehand does not need a second one."
    },
    {
      "f": "Can I still change the plan?",
      "a": "Yes — in the application, in the onboarding call and upwards at any time afterwards; downwards from the next instalment cycle. The plan finder on the pricing page gives a first orientation."
    },
    {
      "f": "I abandoned the application — what now?",
      "a": "You can continue at any time: the link in the e-mail takes you back into the application. No costs arise until you accept the contract and pay the first instalment."
    },
    {
      "f": "How do I pay the first instalment?",
      "a": "By bank transfer to the payment details in the customer area (with a QR code to scan). As soon as the bank confirms receipt, your plan is active — at FIAON “paid” always means bank-confirmed, not just reported."
    },
    {
      "f": "How do the further instalments work?",
      "a": "By SEPA direct debit through a verified creditor, at the start of each month. You grant the mandate once in the customer area. Two days before each debit the payment calendar reminds you."
    },
    {
      "f": "My payment has not arrived — what should I do?",
      "a": "Bank transfers take one to two banking days. Check the reference (your reference) and the amount. If the payment has not been allocated after three working days, contact support with date and amount — we look for it in the bank ledger."
    },
    {
      "f": "What happens if an instalment cannot be collected?",
      "a": "You get a message with a new date; no reminder fees arise at FIAON. Get in touch before the date if money is tight — your contact person can move an instalment."
    },
    {
      "f": "Do I get an invoice?",
      "a": "Yes, per instalment in the customer area under Subscription & payments as a PDF — with VAT shown."
    },
    {
      "f": "Is the credit report credited?",
      "a": "If you first buy only the report (€74) and choose a plan within 30 days, the amount is credited against the first instalment — say so in the onboarding call."
    },
    {
      "f": "Which reports does FIAON obtain?",
      "a": "In Germany SCHUFA (on request also Boniversum, CRIF), in Austria KSV1870 and CRIF, in Switzerland CRIF, Intrum and the debt enforcement register extract — with your digital authorisation. You fill in no forms."
    },
    {
      "f": "How long until the report arrives?",
      "a": "The credit bureaus have one month (Art. 15 GDPR); in practice data copies often arrive after one to three weeks. As soon as it is there, you see it explained in the customer area within 24 hours."
    },
    {
      "f": "What do the assessments on the entries mean?",
      "a": "Every entry gets a classification: settled, deletable, correctable, challengeable — or justified. Justified means: lawfully reported and still within the deadline; no letter changes that, and we say so beforehand."
    },
    {
      "f": "What is the new SCHUFA score?",
      "a": "Since 17 March 2026 SCHUFA calculates 100 to 999 points from twelve published criteria in five classes. It replaces the base score in per cent. FIAON classifies your score criterion by criterion — the table is on the page Understanding the SCHUFA score."
    },
    {
      "f": "Can I request my report myself free of charge?",
      "a": "Yes, the data copy under Art. 15 GDPR is free at every credit bureau. The self-disclosure generator under /werkzeuge/selbstauskunft writes the letter. FIAON is worth it for the explanation, the review and everything afterwards."
    },
    {
      "f": "Who writes the letters?",
      "a": "FIAON, from templates reviewed by lawyers, with your data and the fitting ground (Section 31 BDSG, Art. 16/17/21 GDPR). You see every letter in the customer area and approve it — nothing goes out without you."
    },
    {
      "f": "How are the letters sent?",
      "a": "From the Pro plan upwards by registered post through FIAON; in the Start plan we prepare them and you send them yourself. The proof of delivery is in your file."
    },
    {
      "f": "How long until a credit bureau replies?",
      "a": "One month after receipt, in exceptional cases with notice up to three. FIAON tracks the deadline and follows up; if refused without reason, a complaint to the data protection authority follows (Art. 77 GDPR)."
    },
    {
      "f": "What if a creditor does not react?",
      "a": "Then the request goes to the credit bureau, which has to check itself — and in parallel the reminder with a deadline to the creditor. You see every step and every reply in your file."
    },
    {
      "f": "I have received a court payment order — does FIAON help?",
      "a": "FIAON is not legal advice; you must keep the objection deadline (two weeks) yourself — the deadline calculator under /werkzeuge/mahnbescheid names the day. We check claim, costs and limitation with you and draft instalment offers."
    },
    {
      "f": "Am I guaranteed an account or a card?",
      "a": "No — and anyone who promises that is not serious. FIAON prepares: a current account with the partner institution for every customer, a credit card as soon as your file reaches the card partner's threshold. The bank decides on the issue."
    },
    {
      "f": "What is card readiness?",
      "a": "A value FIAON calculates from entries, income and account behaviour. It shows how close you are to the card partner's threshold and which step moves it how far — a progress bar, not a promise."
    },
    {
      "f": "I have a basic account — is that enough?",
      "a": "The basic account is your legal right and good ground: salary receipts, punctual debits, no permanent overdraft build the account history that banks read later. The route via FIAON builds on that."
    },
    {
      "f": "How high is the limit at the start?",
      "a": "The card partner decides that on the basis of the file; typically it starts small and grows with statements settled on time. The timeline is on the page A credit card despite an entry — a typical course, not a promise."
    },
    {
      "f": "How do I cancel?",
      "a": "At any time to the end of the current month, informally: in the customer area under Subscription & payments with one click or by e-mail to support@fiaon.com. You get a confirmation; the last instalment is the one for the current month."
    },
    {
      "f": "Is there a right of withdrawal?",
      "a": "Yes, 14 days from the conclusion of the contract, without giving reasons — the withdrawal notice and the model form are on the page Right of withdrawal. Services already provided (such as a report obtained) are charged proportionately."
    },
    {
      "f": "What happens to my data after cancellation?",
      "a": "On request we delete report, documents and file completely (Art. 17 GDPR) and confirm it within 30 days. Statutory retention obligations for invoices remain."
    },
    {
      "f": "Do my letters continue after cancellation?",
      "a": "Letters already sent remain effective — the credit bureau has to reply. Follow-up by FIAON ends with the plan; you receive all documents as copies."
    },
    {
      "f": "Where is my data held?",
      "a": "On servers in Frankfurt am Main (EU), encrypted in transit and at rest. Details and the live status are under /status and /en/security."
    },
    {
      "f": "Who sees my file?",
      "a": "Your contact person, the operators — and nobody else. Partner banks see only what you explicitly approve; the consent is logged and revocable."
    },
    {
      "f": "Does FIAON see my online banking?",
      "a": "No. You upload bank statements as a file or photo; account connection (PSD2) is being prepared and will only be used with your explicit consent."
    },
    {
      "f": "How do I get a copy of my data at FIAON?",
      "a": "In the customer area under My account or by e-mail — access under Art. 15 GDPR, free, within one month."
    },
    {
      "f": "Can I work for FIAON as a customer?",
      "a": "Yes — many in the team were customers themselves. Application in four steps on the careers page; Florentine gets in touch personally within two working days."
    },
    {
      "f": "Employed or freelance?",
      "a": "Both: employment or freelance work on commission, remote in Germany, Austria and Switzerland. Nobody speaks to customers before passing the Academy."
    },
    {
      "f": "What do I earn?",
      "a": "That is settled in the conversation and in the contract — regulated honestly, no fantasy numbers on the website. The careers page explains how the collaboration works."
    }
  ],
  "/ueber-uns": [
    {
      "f": "Warum sitzt FIAON in London, wenn die Kunden in Deutschland, Österreich und der Schweiz sind?",
      "a": "Die Gesellschaft wurde als FIAON LTD im britischen Handelsregister gegründet (Company No. 17318250) – schnell, transparent und mit öffentlich einsehbaren Unterlagen. Der Betrieb, das Team und die Server sind in der DACH-Region: Server in Frankfurt, Support mit Schweizer Nummer, Kunden in drei Ländern. Eine Gesellschaft im EWR ist in Vorbereitung."
    },
    {
      "f": "Wer steht hinter FIAON?",
      "a": "Gründer und Geschäftsführer Justin Schwarzott; Florentine Lombardi (Menschen und Onboarding) und Daniel Stripling (Vertrieb) als Gesellschafter im operativen Betrieb; ein Team aus Vertrieb, Onboarding und Forderungsmanagement – viele davon selbst ehemalige Kunden. Investor und Partner: Schwarzott Capital Partners AG, Zürich. Namen und Gesichter stehen auf der Team-Seite."
    },
    {
      "f": "Ist FIAON eine Bank, ein Inkasso oder eine Kanzlei?",
      "a": "Nichts davon. FIAON ist eine Bonitätsplattform: Auskunft beschaffen und erklären, Einträge nach DSGVO und § 31 BDSG angreifen, Raten verhandeln, Konto und Karte beim Partnerinstitut vorbereiten. Keine Rechtsberatung im Einzelfall, keine Kreditvermittlung, keine eigenen Konten."
    },
    {
      "f": "Wie verdient FIAON Geld?",
      "a": "Mit Festpreisen: der Bonitätsauskunft (74 Euro einmalig) und Paketen über zwölf Monatsraten. Keine Erfolgsbeteiligung, keine Gebühr je Schreiben. Über Partnerbanken kann später eine Vergütung je vermitteltem Konto hinzukommen – das steht offen auf der Partner-Seite."
    },
    {
      "f": "Warum führt FIAON ein öffentliches Entscheidungsregister?",
      "a": "Weil ein Unternehmen, das jederzeit geprüft werden kann, besser geführt wird. Jede Entscheidung mit Datum, Alternativen und Begründung; jeder Tag im Logbuch. Investoren sehen es im Datenraum, Kunden merken es daran, dass Regeln nicht über Nacht wechseln."
    }
  ],
  "/en/about": [
    {
      "f": "Why is FIAON based in London when the customers are in Germany, Austria and Switzerland?",
      "a": "The company was founded as FIAON LTD at Companies House (Company No. 17318250) — quick, transparent and with publicly available filings. Operations, team and servers are in the DACH region: servers in Frankfurt, support on a Swiss number, customers in three countries. A company in the EEA is being prepared."
    },
    {
      "f": "Who is behind FIAON?",
      "a": "Founder and managing director Justin Schwarzott; Florentine Lombardi (people and onboarding) and Daniel Stripling (sales) as shareholders in day-to-day operations; a team in sales, onboarding and collections — many of them former customers themselves. Investor and partner: Schwarzott Capital Partners AG, Zurich. Names and faces are on the team page."
    },
    {
      "f": "Is FIAON a bank, a debt collector or a law firm?",
      "a": "None of those. FIAON is a credit platform: obtain and explain the report, challenge entries under the GDPR and Section 31 BDSG, negotiate instalments, prepare account and card with the partner institution. No legal advice in individual cases, no credit brokerage, no accounts of its own."
    },
    {
      "f": "How does FIAON make money?",
      "a": "With fixed prices: the credit report (€74 one-off) and plans over twelve monthly instalments. No success fee, no fee per letter. Through partner banks a fee per account introduced may be added later — that is stated openly on the partner page."
    },
    {
      "f": "Why does FIAON keep a public decision register?",
      "a": "Because a company that can be audited at any time is run better. Every decision with date, alternatives and reasoning; every day in the logbook. Investors see it in the data room; customers notice it in rules that do not change overnight."
    }
  ],
  "/transparenz": [
    {
      "f": "Warum veröffentlicht FIAON Kennzahlen?",
      "a": "Weil Vertrauen prüfbar sein muss. Wer „Erfahrungen“ sucht, findet sonst nur Behauptungen. Hier stehen Zahlen mit Definition, Stand und Herkunft – und ehrlich das, was noch nicht belastbar gemessen ist."
    },
    {
      "f": "Woher kommen die Zahlen?",
      "a": "Aus der Datenbank der Plattform, mit derselben Definition, die das Chefbüro intern nutzt: zahlende Kunden nur mit bankbestätigter Zahlung und ohne Testkonten, Raten nur mit Zahlungsdatum. Abgerundet, nie geschätzt."
    },
    {
      "f": "Wie oft wird aktualisiert?",
      "a": "Alle vier Wochen, jeweils mit neuem Stand-Datum. Die vier Nordstern-Kennzahlen folgen, sobald sie über mindestens ein Quartal belastbar sind – Ziel ist ein Quartalsbericht."
    },
    {
      "f": "Was veröffentlicht FIAON nicht?",
      "a": "Keine Bewertungen, die es noch nicht gibt; keine Umsatzzahlen außerhalb des Datenraums für Investoren; keine Einzelfälle ohne Freigabe der Kunden. Und keine Zahl ohne Definition."
    }
  ],
  "/en/transparency": [
    {
      "f": "Why does FIAON publish metrics?",
      "a": "Because trust has to be verifiable. Anyone searching for “experiences” otherwise finds only claims. Here are figures with definition, date and source — and, honestly, what has not yet been reliably measured."
    },
    {
      "f": "Where do the figures come from?",
      "a": "From the platform's database, with the same definition the management uses internally: paying customers only with bank-confirmed payment and without test accounts, instalments only with a payment date. Rounded down, never estimated."
    },
    {
      "f": "How often is it updated?",
      "a": "Every four weeks, each time with a new date. The four north-star metrics follow as soon as they are reliable over at least one quarter — the aim is a quarterly report."
    },
    {
      "f": "What does FIAON not publish?",
      "a": "No reviews that do not exist yet; no revenue figures outside the data room for investors; no individual cases without the customers' approval. And no figure without a definition."
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
  "/en/loans-without-schufa": [
    {
      "f": "Are there legitimate loans without SCHUFA?",
      "a": "Yes, but only a narrow category: so-called Swiss loans from foreign banks that make no SCHUFA enquiry and do not report to it. They are limited to small sums (usually €3,500 to €7,500), considerably more expensive than normal instalment loans and require an attachable income. Without a steady income there is nothing there either — anyone who promises otherwise is not selling a loan but a trap."
    },
    {
      "f": "How do I recognise dubious providers?",
      "a": "By three patterns: advance costs (fees, expenses or “insurance” that fall due before the payout), home visits or agent contracts with add-on products, and guarantee promises such as “100 % approval despite negative SCHUFA”. Legitimate lenders never demand money before money flows."
    },
    {
      "f": "What does a loan without SCHUFA cost?",
      "a": "Considerably more: the effective annual rates are usually between 10 and 16 per cent — for a regular instalment loan with a decent credit file it is 5 to 9. On €5,000 over 40 months that quickly makes a difference of €1,000 and more."
    },
    {
      "f": "Does my bank see that I have taken out a loan without SCHUFA?",
      "a": "Not at the credit bureau — that is exactly the purpose. But the instalment appears on your bank statement, and in every later credit check it counts in the household calculation. Concealed instalments that turn up there cost more trust than an explained entry."
    },
    {
      "f": "What is the better route?",
      "a": "In most cases: put the credit file in order instead of circumventing it. Many negative entries can be challenged — wrongly reported, expired or entered without the legal requirements. Once the file is clean, the normal credit market is open again, at normal rates."
    },
    {
      "f": "Does FIAON help with credit brokerage?",
      "a": "No — FIAON does not broker loans and does not sell financial products. FIAON obtains your reports from SCHUFA, KSV and CRIF, checks every entry for whether it can be challenged and enforces deletion or correction where the law allows. The goal is that you do not need a workaround loan."
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
      "a": "Der neue SCHUFA-Score (seit März 2026, 100 bis 999 Punkte) wird bei jeder Anfrage tagesaktuell aus den gespeicherten Daten berechnet. Eine Löschung oder Berichtigung wirkt deshalb, sobald die Auskunftei die Daten geändert hat – eine erledigte Zahlungsstörung zählt nach den veröffentlichten Kriterien allerdings bis zu drei Jahre abgeschwächt nach."
    },
    {
      "f": "Was hat mein Girokonto mit meiner Bonität zu tun?",
      "a": "Bei der Auskunftei: nur die Existenz des Vertrags. Bei der Bank selbst: sehr viel — die Kontoführung ist Teil jeder Kreditprüfung. Ein dauerhaft genutzter Dispo, Rücklastschriften und geplatzte Daueraufträge stehen dort sichtbar. Kontoauszüge der letzten drei Monate entscheiden häufiger über Kredite als der Score."
    }
  ],
  "/en/strengthen-your-credit-file": [
    {
      "f": "How quickly can I strengthen my credit file?",
      "a": "That depends on the lever: a deleted negative entry or a cleared overdraft takes effect within a few weeks to months, as soon as the credit bureau recalculates. A history of punctual payments and long, stable contracts grows over years. Realistic: a first measurable change in three months, a clear one in twelve."
    },
    {
      "f": "What damages the score most?",
      "a": "In this order: hard negative features (enforcement, insolvency), reported payment defaults, many credit enquiries in a short time, many parallel loans and accounts, frequent account changes. Incidentally, place of residence and income do not go into SCHUFA — it does not even know your income."
    },
    {
      "f": "Does it help to cancel old accounts and cards?",
      "a": "Usually no — rather the opposite: long-standing, unremarkably run contracts are a positive feature. Cancel unused SECOND credit cards and second accounts, but keep the oldest banking relationship. Scores read many short-lived contracts as unrest."
    },
    {
      "f": "Do “score booster” apps achieve anything?",
      "a": "The measurable core you can do yourself: get the data copy, have errors corrected, check deadlines. Apps that demand a subscription for that or promise “secret tricks” sell packaged standard knowledge. Beware of anything that promises a guarantee — the credit bureau calculates the score, nobody else."
    },
    {
      "f": "How often is the score recalculated?",
      "a": "The new SCHUFA score (since March 2026, 100 to 999 points) is calculated from the stored data on the day of every enquiry. A deletion or correction therefore takes effect as soon as the credit bureau has changed the data — a settled payment default does, however, count with reduced weight for up to three years under the published criteria."
    },
    {
      "f": "What does my current account have to do with my credit file?",
      "a": "At the credit bureau: only the existence of the contract. At the bank itself: a great deal — account management is part of every credit check. A permanently used overdraft, returned direct debits and failed standing orders are visible there. Bank statements for the last three months decide loans more often than the score."
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
  "/en/credit-bureaus": [
    {
      "f": "Which credit bureau is responsible for me?",
      "a": "The one of the country in which you enter into contracts: in Germany mainly SCHUFA (alongside Creditreform Boniversum and CRIF), in Austria KSV1870 and CRIF Austria, in Switzerland CRIF and Intrum. Anyone who moves or works across borders often has data in two countries — and should check both."
    },
    {
      "f": "Do I get free access everywhere?",
      "a": "Yes. In Germany and Austria under Art. 15 GDPR, in Switzerland under Art. 25 of the revised Data Protection Act. The bureaus also sell paid products — for checking your own data the free data copy is always enough."
    },
    {
      "f": "Is data exchanged between the countries?",
      "a": "Not automatically: a Swiss bank does not see SCHUFA entries, a KSV entry stays in Austria. But international groups such as CRIF are active in several countries, and with cross-border contracts (car leasing, say) providers sometimes enquire in the neighbouring country. One should not rely on the separation."
    },
    {
      "f": "Do the deletion deadlines apply equally everywhere?",
      "a": "No — that is the most important difference: Germany deletes settled claims after three years (18 months with the 100-day rule), Austria knows for the “KSV entry” after full payment a deletion after three years from the warning list, Switzerland stores enforcements for five years in the debt enforcement register. Anyone who transfers deadlines from one country to another is calculating wrongly."
    },
    {
      "f": "Does FIAON help in all three countries?",
      "a": "Yes — that is the core of the offer: obtaining, checking and enforcement at SCHUFA, KSV1870 and CRIF from one hand, with the respective national rules. The country pages for Austria and Switzerland explain the particularities."
    }
  ],
  "/schufa-score-verstehen": [
    {
      "f": "Was ist ein guter SCHUFA-Score?",
      "a": "Seit März 2026 läuft die Skala von 100 bis 999 Punkten. Ab 776 Punkten gilt die Bonität als „hervorragend“, von 709 bis 775 als „gut“, von 642 bis 708 als „akzeptabel“, darunter als „ausreichend“. Wer eine offene Zahlungsstörung hat, bekommt keinen Punktwert, sondern die Klasse „ungenügend“. Nach Angaben der SCHUFA liegen rund 62 Prozent der Menschen in der besten Klasse."
    },
    {
      "f": "Wo sehe ich meinen SCHUFA-Score kostenlos?",
      "a": "Seit dem 17. März 2026 digital und kostenlos: im SCHUFA-Account (app.schufa.de) oder über die bonify-App – mit allen zwölf Kriterien und den Punkten je Kriterium. Daneben bleibt die Datenkopie nach Art. 15 DSGVO per Post kostenlos; nur sie zeigt, welche Stelle was gemeldet hat. FIAON bestellt die Datenkopie im Rahmen der Bonitätsauskunft für Sie mit."
    },
    {
      "f": "Was ist aus dem Basisscore und den Branchenscores geworden?",
      "a": "Der Basisscore (0 bis 100 Prozent) ist mit dem 17. März 2026 abgelöst. Die sechs Branchenscores – für Banken, Sparkassen, Genossenschaftsbanken, Telekommunikation, Handel und Versandhandel – werden durch den einen neuen Score ersetzt; für Unternehmen gilt eine Übergangsfrist bis Ende 2028. Die Verbraucherzentrale stellte im Juni 2026 fest, dass erst etwa ein Viertel der Vertragspartner den neuen Score nutzte – Ihre Bank kann übergangsweise noch mit einem alten Wert arbeiten."
    },
    {
      "f": "Wie oft wird der SCHUFA-Score neu berechnet?",
      "a": "Der neue Score wird bei jeder Anfrage aus den aktuell gespeicherten Daten berechnet – nicht mehr vierteljährlich wie der alte Basisscore. Eine Löschung oder Berichtigung wirkt deshalb beim nächsten Abruf, sobald die Auskunftei die Daten geändert hat."
    },
    {
      "f": "Warum bekomme ich bei zwei Banken unterschiedliche Entscheidungen bei gleichem Score?",
      "a": "Weil der SCHUFA-Score nur EIN Baustein ist. Banken rechnen eigene Scorings mit eigenen Grenzen und gewichten Einkommen, Kontoführung und Produktart dazu. Dieselben 720 Punkte können bei der einen Bank für eine Karte reichen und bei der anderen nicht – deshalb ist der Kontoauszug oft entscheidender als die Zahl."
    },
    {
      "f": "Wie schnell verbessert sich die Zahl nach einer Löschung?",
      "a": "Der Eintrag verschwindet mit der Löschung aus der Auskunft; beim nächsten Abruf rechnet der Score ohne ihn. Eine erledigte Zahlungsstörung wirkt nach den veröffentlichten Kriterien allerdings bis zu drei Jahre nach Erledigung abgeschwächt nach – anders als eine gelöschte, die nie hätte gemeldet werden dürfen. Ein Versprechen, dass eine bestimmte Zahl erreicht wird, kann niemand seriös geben."
    }
  ],
  "/en/schufa-score": [
    {
      "f": "What is a good SCHUFA score?",
      "a": "Since March 2026 the scale runs from 100 to 999 points. From 776 points the credit standing counts as “excellent”, from 709 to 775 as “good”, from 642 to 708 as “acceptable”, below that as “sufficient”. Anyone with an open payment default gets no points value but the class “insufficient”. According to SCHUFA, around 62 per cent of people are in the best class."
    },
    {
      "f": "Where can I see my SCHUFA score free of charge?",
      "a": "Since 17 March 2026 digitally and free: in the SCHUFA account (app.schufa.de) or via the bonify app — with all twelve criteria and the points per criterion. Alongside, the data copy under Art. 15 GDPR by post remains free; only it shows which body reported what. FIAON orders the data copy for you as part of the credit report."
    },
    {
      "f": "What has become of the base score and the industry scores?",
      "a": "The base score (0 to 100 per cent) was replaced on 17 March 2026. The six industry scores — for banks, savings banks, cooperative banks, telecommunications, retail and mail order — are replaced by the one new score; for companies a transition period applies until the end of 2028. The consumer advice centre found in June 2026 that only about a quarter of contractual partners were using the new score — your bank may temporarily still work with an old value."
    },
    {
      "f": "How often is the SCHUFA score recalculated?",
      "a": "The new score is calculated from the currently stored data at every enquiry — no longer quarterly like the old base score. A deletion or correction therefore takes effect at the next retrieval, as soon as the credit bureau has changed the data."
    },
    {
      "f": "Why do I get different decisions from two banks with the same score?",
      "a": "Because the SCHUFA score is only ONE building block. Banks run their own scoring with their own thresholds and weigh in income, account management and product type. The same 720 points can be enough for a card at one bank and not at another — that is why the bank statement is often more decisive than the number."
    },
    {
      "f": "How quickly does the number change after a deletion?",
      "a": "The entry disappears from the report with the deletion; at the next retrieval the score calculates without it. A settled payment default does, however, count with reduced weight for up to three years after settlement under the published criteria — unlike a deleted one that should never have been reported. Nobody can seriously promise that a particular number will be reached."
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
  "/en/request-your-credit-report": [
    {
      "f": "Is a credit report really possible free of charge?",
      "a": "Yes. The data copy under Art. 15 GDPR is free by law — at SCHUFA, KSV and CRIF. It contains all stored data including reporting date and reporting body. What the bureaus charge for is only the packaging (a credit certificate to pass on) — and what FIAON charges for is the work around it: obtaining, explaining, checking."
    },
    {
      "f": "What does the credit report via FIAON cost?",
      "a": "€74, one-off. Included: obtaining your reports, preparation in plain language, the check of every entry for lawfulness and expiry, and an action plan. No success fee, no subscription required — serious work does not charge per “deleted entry”."
    },
    {
      "f": "How long until I have my report?",
      "a": "The application takes about two minutes. Depending on the bureau and the route, the credit bureaus deliver the data copy within a few days to about four weeks (legal maximum: one month). As soon as it is there, you see preparation and review in your customer area — usually within 24 hours."
    },
    {
      "f": "What is the difference between a data copy and a credit certificate?",
      "a": "The data copy is for YOU: complete, with every entry and every detail — and free. The credit bureaus' credit certificate is for THIRD PARTIES (landlords, say): abridged, meant for showing, and paid. Anyone who wants to understand or change their situation needs the data copy."
    },
    {
      "f": "Does SCHUFA see that I am requesting a report?",
      "a": "Self-disclosure is neutral: it is not stored as an enquiry that other banks see, and it does not change your score. You can request it as often as you like."
    },
    {
      "f": "Does FIAON also check KSV (Austria) and CRIF (Switzerland)?",
      "a": "Yes. FIAON works across the whole DACH region and obtains the reports of all three bureaus from one hand. The rights are comparable: in Austria the GDPR applies directly, Switzerland has its own rights of access and rectification under the revised DSG."
    },
    {
      "f": "Can FIAON guarantee that entries are deleted?",
      "a": "No — and nobody can, seriously. Justified, lawfully reported entries stay until the deadline expires. What FIAON does: hold every entry against the legal requirements and challenge what can be challenged. You can recognise providers with deletion guarantees as not serious."
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
  "/en/debt-collection-letter": [
    {
      "f": "Do I have to react to a debt collection letter at all?",
      "a": "Ignoring is the worst option — but reacting does not mean paying. Reacting means: check, and depending on the result pay or object in writing. Anyone who does nothing at all risks a court payment order, further costs and in the end a negative entry."
    },
    {
      "f": "May a collection agency simply make a SCHUFA entry?",
      "a": "No. Section 31 BDSG requires among other things two reminders at least four weeks apart, timely notice of the impending report — and the claim must not be disputed. Anyone who objects in time and with reasons blocks the report until the matter is clarified."
    },
    {
      "f": "What happens if I really cannot pay the claim?",
      "a": "Get in touch in writing and propose realistic instalments — collection agencies almost always accept, because a paying instalment is worth more than a title. Important: only promise amounts you can definitely keep. A failed agreement worsens your position."
    },
    {
      "f": "Are the high collection fees lawful?",
      "a": "Often not in full. The remuneration is capped; for small, undisputed claims the limit is low. Demand a breakdown and pay the principal claim plus the permissible costs first — inflated items you may dispute."
    },
    {
      "f": "How do I recognise fake debt collection?",
      "a": "Pressure with unrealistic deadlines (24 to 48 hours), payment only to foreign accounts or by voucher card, no entry in the register of legal service providers, no traceable claim. When in doubt: do not pay, do not call, demand evidence in writing."
    },
    {
      "f": "I already have an entry — what now?",
      "a": "Check whether it was lawfully reported (two reminders, notice, not disputed) and whether the deletion deadline is running or has expired. Settled claims are deleted after three years, after 18 months if settled within 100 days. FIAON checks that for you — the rules are in the guide on removing an entry."
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
  "/en/entries-and-limitation": [
    {
      "f": "Does a SCHUFA entry disappear automatically after the deadline?",
      "a": "It should — the credit bureaus delete to the day under their code of conduct. In practice expired entries nevertheless keep remaining: after system changes, with settlements never recorded, with duplicate reports. That is why comparing your own data copy against the deadlines is worthwhile — an exceeded deadline is the clearest ground for deletion of all."
    },
    {
      "f": "Is limitation the same as the deletion period?",
      "a": "No, and this confusion costs hard cash: LIMITATION concerns the claim itself (usually three years to the end of the year) — after that you no longer have to pay if you rely on it. The STORAGE PERIOD concerns the entry at the credit bureau and runs independently. A time-barred claim can still be on file — and a paid claim remains visible for up to three years despite payment."
    },
    {
      "f": "When exactly does the 18-month rule apply?",
      "a": "When the reported claim is paid in full within 100 days of the report and no other negative features exist. Then the storage period shortens from three years to 18 months. The rule has applied since 2024 and is calculated to the day."
    },
    {
      "f": "Can I achieve an early deletion?",
      "a": "For lawfully reported, factually correct entries before the deadline expires, generally not — providers who promise that across the board are not serious. Entries can be challenged if they were reported without the requirements of Section 31 BDSG, are factually wrong or their period has already expired. That is more common than many think."
    },
    {
      "f": "Does the period run from the invoice, the reminder or the payment?",
      "a": "For settled claims the period runs from the date of SETTLEMENT (payment), not from the invoice or the report. For credit enquiries from the day of the enquiry, for the discharge of residual debt from the day it was granted. That is exactly why the checker above asks for the appropriate date per entry type."
    },
    {
      "f": "Does this also apply in Austria and Switzerland?",
      "a": "The basic rights (access, rectification, erasure) are comparable — the GDPR applies directly in Austria, Switzerland has the revised DSG. The specific storage practices of KSV and CRIF differ in detail. FIAON checks all three bureaus; the country pages for Austria and Switzerland explain the differences."
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
  "/en/current-account-despite-poor-credit": [
    {
      "f": "Can I really get a current account despite a negative SCHUFA record?",
      "a": "An account on a credit basis is achievable for most people — and in Germany there is even a legal right to a basic account (Section 31 ZKG). FIAON prepares the route and tidies up the credit file; the bank itself always decides on the opening. That is exactly why we promise no opening — but a cleanly prepared application."
    },
    {
      "f": "What does an active account do for my credit file?",
      "a": "A well-run account with regular receipts and punctual debits generates over time exactly the data that risk models read positively: stability, history, reliability. It is no magic trick and does not work overnight — it is the foundation on which everything else builds."
    },
    {
      "f": "What is the difference between a basic account and the account via FIAON?",
      "a": "The basic account is your legal right at every bank that runs accounts — credit basis, full basic functions, but often comparatively expensive and with no route to a card or a limit. The FIAON route aims at a full current account with the partner including a card as the GOAL — combined with the tidying-up of your credit file. Both routes are in the table on this page."
    },
    {
      "f": "Does FIAON run accounts itself?",
      "a": "No. FIAON is not a bank. Account and card come from the partner institution; FIAON obtains and checks your reports, prepares the application and accompanies the route. The bank decides on opening, card and limit under its own rules."
    },
    {
      "f": "How long does the route to an account take?",
      "a": "The FIAON application takes about two minutes. After that the pace depends on two things: how quickly the credit bureaus deliver (days to about four weeks) and how the bank decides. Nobody seriously promises you a fixed date here — but you see every step in your customer area."
    },
    {
      "f": "Does the account application at FIAON cost extra?",
      "a": "The route to an account is part of the FIAON plans; the prices are transparent on the pricing page. There is no success commission on an account opening — so our guidance stays free of wrong incentives."
    },
    {
      "f": "What happens if the bank refuses?",
      "a": "Then we tell you honestly — with what can be derived from the credit file: which entries get in the way, which can be challenged, what the 100-day rule can achieve. Often the refusal is the start of the real work: tidy up the credit file, then apply again. A legal right to the basic account always remains alongside."
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
  "/en/instalments-and-credit-file": [
    {
      "f": "Do punctual instalments really strengthen my credit file?",
      "a": "Yes — payment behaviour is the core feature of every risk model. An instalment contract that runs as agreed over months continuously generates positive data: history, reliability, stability. Nobody can seriously promise a specific score number from that — but the direction is clear, and it is entirely in your hands."
    },
    {
      "f": "Does buying on instalments harm the score in principle?",
      "a": "A single, serviced instalment contract is no blemish. What tips the picture: many parallel financings, maxed-out limits and zero-per-cent purchases by the dozen — they read as thin cover. Rule of thumb: as few parallel contracts as possible, and each of them punctual."
    },
    {
      "f": "What happens after ONE missed instalment?",
      "a": "A single late instalment does not yet trigger a SCHUFA entry — it starts the escalation: reminder, formal reminder, default costs. It becomes dangerous from the second reminder with a threat of reporting (Section 31 BDSG requires exactly this chain before a report). Anyone who reacts in this phase and pays or reaches an agreement almost always prevents the entry."
    },
    {
      "f": "A returned direct debit — how bad is that?",
      "a": "A returned direct debit costs fees and is a warning signal to the contractual partner, but is not reported automatically. Frequent returns lead to contracts being terminated — and THOSE then end up in the report. The best protection is banal: standing order or direct debit on the right account and a look at the calendar before the debit day."
    },
    {
      "f": "Is there any point in paying instalments EARLY?",
      "a": "For your credit file what counts above all is AS AGREED — punctual is the standard the models reward. Early repayment saves interest and closes the contract positively; it is not a turbo for the score. More important is that no instalment ever breaks."
    },
    {
      "f": "I am already in arrears — what is clever now?",
      "a": "Act immediately, in writing: contact the creditor, offer realistic instalments, obtain confirmation. If a reported claim is settled in full within 100 days, the storage period shortens to 18 months. And in parallel check whether a report already made was lawful at all — the rules are in our debt collection guide."
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
  "/en/reading-your-credit-report": [
    {
      "f": "How do I get my credit report for free?",
      "a": "Via the data copy under Article 15 GDPR — informally or via the credit bureaus' forms, free by law and as often as you like. Our free tool prepares the request for SCHUFA, KSV and CRIF. The bureaus have one month; it usually arrives sooner."
    },
    {
      "f": "What is the difference between a self-disclosure and a data copy?",
      "a": "Colloquially both mean the same thing: the report about your own data. Legally precise is the data copy under Article 15 GDPR — complete and free. The bureaus' paid products (credit certificate) are shortened versions for showing, not for checking."
    },
    {
      "f": "In which order is it best to read the report?",
      "a": "Exactly in the order of the checklist above: first master data, then contracts, then claims including markers and deadlines, then enquiries — and the score last. Anyone who reads the other way round looks for the cause at the wrong end."
    },
    {
      "f": "What do I do with an entry I cannot attribute?",
      "a": "Do not ignore it: ask the credit bureau in writing who reported it and on what basis (some of this is already in the data copy). If you still do not know the matter, object and demand evidence. Unknown entries can point to a mix-up or misuse."
    },
    {
      "f": "How often should I check my report?",
      "a": "Once a year as routine — and additionally before every big step: flat hunting, financing, self-employment. Your own enquiry is neutral, it does not change your score and is not shown to others."
    },
    {
      "f": "Does FIAON take over this check completely?",
      "a": "Yes — that is the credit report with check: FIAON obtains the data copies from all three bureaus, explains every line in plain language and holds every entry against Section 31 BDSG and the deletion periods. You get the list you would draw up by hand here — finished and with an action plan."
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
  "/en/schufa-neutral-enquiries": [
    {
      "f": "What exactly does “SCHUFA-neutral” mean?",
      "a": "Neutral means: the enquiry is stored as a conditions enquiry — visible only to you, with no effect whatsoever on your score. Banks that enquire later do not see it. The loan enquiry, by contrast, is visible to other institutions for ten days and flows into the calculation."
    },
    {
      "f": "Do I get worse offers with a conditions enquiry?",
      "a": "No. The bank checks the same data and tells you the conditions it would offer with a real application. The difference lies solely in the report to SCHUFA — not in the quality of the offer. Only when you really want the contract does the conditions enquiry become a loan enquiry."
    },
    {
      "f": "How do I recognise which type of enquiry the bank makes?",
      "a": "Ask literally: “Are you making a conditions enquiry or a loan enquiry?” Reputable institutions and comparison portals answer clearly and often advertise with “SCHUFA-neutral” themselves. If in doubt it is in the documents — the feature is called “enquiry about loan conditions”."
    },
    {
      "f": "What do I do if a conditions enquiry was wrongly stored as a loan enquiry?",
      "a": "That happens and can be corrected: request the reclassification from the bank and the rectification from SCHUFA (Article 16 GDPR), with your correspondence as evidence. In your own data copy you see how every enquiry is stored."
    },
    {
      "f": "How much do several loan enquiries push the score down?",
      "a": "SCHUFA does not name an exact figure — the formula is a trade secret. The mechanism is documented: several loan enquiries in a short time read as failed financing attempts. So: compare exclusively via conditions enquiries, the real loan enquiry only for the contract you actually sign."
    },
    {
      "f": "Does the difference also apply to current accounts and mobile contracts?",
      "a": "There it works differently: account and contract enquiries are separate types of enquiry with their own treatment. The conditions trick is a loan topic. With accounts what counts more is how many you hold — more on that on the score page."
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
  "/en/delete-a-schufa-entry": [
    {
      "f": "Can a justified SCHUFA entry be deleted?",
      "a": "A factually correct, lawfully reported entry before its period expires: no — providers who promise exactly that across the board are not reputable. But a considerable share of entries is NOT lawfully reported: without the two required reminders, despite a disputed claim or after the deletion period has expired. These entries can be challenged, and their deletion is a legal right."
    },
    {
      "f": "How long does a settled entry stay stored?",
      "a": "In principle three years from settlement, to the day. Since 2024 the 100-day rule applies: anyone who pays within 100 days of the report and has no other negative features is out after 18 months. The discharge of residual debt after insolvency is deleted after only six months."
    },
    {
      "f": "What does it cost to have an entry deleted?",
      "a": "Doing it yourself costs nothing but time: data copy, check, letters, deadlines — all templates and rules are public, our tools prepare every step for free. Anyone who wants to hand over obtaining, checking and enforcing instructs a service like FIAON with transparent plan prices — reputable providers never charge per “deleted entry” on a success basis and promise no guarantees."
    },
    {
      "f": "Does deleting an entry really achieve anything?",
      "a": "Yes, often considerably: negative entries are the heaviest single feature in the score. If the entry falls away, score class and conditions improve — from the mobile contract to the flat to the loan interest rate. The effect does not occur overnight; the credit bureaus recalculate their scores at intervals."
    },
    {
      "f": "Can I do this with KSV (Austria) and CRIF (Switzerland) too?",
      "a": "Yes. The GDPR applies directly in Austria; Switzerland has comparable rights to information and rectification under the revised Data Protection Act (DSG). The deadlines and customs differ in detail — the country pages for Austria and Switzerland explain them."
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
  "/en/how-the-platform-works": [
    {
      "f": "How long until I see my report?",
      "a": "Usually within 24 hours of receipt at FIAON. The credit bureaus themselves need between a few days and four weeks depending on country and route."
    },
    {
      "f": "What if all entries are justified?",
      "a": "Then we say so. You get the deletion dates, the 100-day rule where it applies, and the route to account and card via your value rather than via the clear-up."
    },
    {
      "f": "Can I change or cancel the plan?",
      "a": "Yes – in the application, in the onboarding call and in the customer area under Plan & payments. Twelve instalments, then you decide freely."
    },
    {
      "f": "Do I have to talk to someone?",
      "a": "Once, 15 minutes. The onboarding call is mandatory because it makes the difference. After that everything runs via the area, phone and e-mail as needed."
    },
    {
      "f": "Who sees my data?",
      "a": "Your contact and the staff working on your file. Nobody else. Data is never sold or passed on for advertising."
    }
  ],
  "/werkzeuge/basiskonto": [
    {
      "f": "Wer hat Anspruch auf ein Basiskonto?",
      "a": "Jeder Verbraucher mit rechtmäßigem Aufenthalt in der EU – auch ohne festen Wohnsitz, auch mit negativen Einträgen bei SCHUFA oder anderen Auskunfteien, auch in der Insolvenz (§ 31 ZKG). Die Bonität ist kein Ablehnungsgrund. Das Konto wird auf Guthabenbasis geführt; ein Dispo gehört nicht dazu."
    },
    {
      "f": "Welche Bank muss das Konto eröffnen?",
      "a": "Jede Bank, die Zahlungskonten für Verbraucher anbietet – Sparkassen, Volksbanken, Privatbanken, Direktbanken. Sie dürfen sich das Basiskonto nicht gegenseitig zuschieben. Sie können sich die Bank aussuchen; sinnvoll ist eine, bei der Sie später auch Karte und Überweisungen bequem nutzen."
    },
    {
      "f": "Was darf die Bank verlangen und was kosten darf es?",
      "a": "Ausweis oder Pass, bei fehlender Meldeadresse eine Erreichbarkeitsanschrift. Das Entgelt muss angemessen sein und sich an marktüblichen Kontoführungsentgelten orientieren (§ 41 ZKG); der BGH hat überhöhte Basiskonto-Gebühren mehrfach gekippt (u. a. XI ZR 119/19 vom 30.06.2020). Vergleichen Sie – die Gebühren unterscheiden sich erheblich."
    },
    {
      "f": "Aus welchen Gründen darf die Bank ablehnen?",
      "a": "Nur aus den im Gesetz genannten: Sie führen bereits ein Zahlungskonto in Deutschland, das Sie nutzen können; Sie wurden in den letzten drei Jahren wegen einer vorsätzlichen Straftat gegen die Bank verurteilt; Sie haben ein früheres Konto bei dieser Bank durch schwere Vertragsverletzung verloren; oder es liegen Verstöße gegen das Geldwäschegesetz vor (§§ 35, 36 ZKG). Ein SCHUFA-Eintrag steht nicht in dieser Liste."
    },
    {
      "f": "Was macht die BaFin im Verwaltungsverfahren?",
      "a": "Sie prüft, ob die Ablehnung oder die Verzögerung rechtmäßig war, und ordnet gegenüber der Bank die Eröffnung des Kontos an, wenn nicht (§ 48 ZKG). Das Verfahren ist kostenlos, der Antrag geht per Formular oder online an die BaFin in Bonn. Beizulegen sind Ihr Antrag bei der Bank und – falls vorhanden – die schriftliche Ablehnung."
    }
  ],
  "/en/tools/basic-account": [
    {
      "f": "Who is entitled to a basic account?",
      "a": "Every consumer legally resident in the EU – even without a fixed address, even with negative entries at SCHUFA or other credit bureaus, even in insolvency (Section 31 ZKG). Creditworthiness is not a ground for refusal. The account is run on a credit basis; an overdraft is not part of it."
    },
    {
      "f": "Which bank has to open the account?",
      "a": "Every bank that offers payment accounts to consumers – savings banks, cooperative banks, private banks, direct banks. They may not pass the basic account on to each other. You can choose the bank; sensible is one where you can later also use card and transfers conveniently."
    },
    {
      "f": "What may the bank demand and what may it cost?",
      "a": "ID card or passport, and a contact address if you have no registered address. The fee must be reasonable and in line with usual market account fees (Section 41 ZKG); the Federal Court of Justice has repeatedly struck down excessive basic account fees (including XI ZR 119/19 of 30 June 2020). Compare – the fees differ considerably."
    },
    {
      "f": "On which grounds may the bank refuse?",
      "a": "Only on those named in the law: you already hold a payment account in Germany that you can use; you were convicted in the last three years of an intentional criminal offence against the bank; you lost a previous account at this bank through a serious breach of contract; or there are breaches of the Anti-Money Laundering Act (Sections 35, 36 ZKG). A SCHUFA entry is not on this list."
    },
    {
      "f": "What does BaFin do in the administrative procedure?",
      "a": "It examines whether the refusal or the delay was lawful and orders the bank to open the account if not (Section 48 ZKG). The procedure is free of charge; the application goes by form or online to BaFin in Bonn. Enclose your application to the bank and – if available – the written refusal."
    }
  ],
  "/werkzeuge/kartenkosten": [
    {
      "f": "Was ist eine Kreditkarte mit Sicherheitsleistung?",
      "a": "Eine echte Kreditkarte, deren Rahmen durch eine Kaution gedeckt ist, die Sie vorher hinterlegen – meist in Höhe des Rahmens. Der Herausgeber trägt kein Risiko, deshalb gibt es sie oft auch mit negativen Einträgen. Die Kaution liegt fest, solange die Karte läuft; manche Herausgeber zahlen keine Zinsen darauf. Der Vorteil: Sie funktioniert wie eine Kreditkarte – Hotel, Mietwagen, Kaution – und meldet bei einigen Anbietern eine Zahlungshistorie."
    },
    {
      "f": "Ist Prepaid dasselbe wie Debit?",
      "a": "Nein. Prepaid-Karten laden Sie auf; sie hängen an keinem Girokonto und kosten oft Aufladegebühren. Debitkarten (Visa Debit, Debit Mastercard) buchen sofort vom Girokonto ab – ohne Aufladung, ohne Rahmen. Für Alltag und Online-Kauf sind beide gleichwertig; bei Hotels und Mietwagen werden Prepaid und Debit häufig abgelehnt, weil keine Kaution blockiert werden kann."
    },
    {
      "f": "Welche Karte baut Bonität auf?",
      "a": "Nur eine Karte, deren Zahlungsverhalten gemeldet wird – das sind in Deutschland vor allem echte Kreditkarten mit Rahmen und Vertragsmeldung an die SCHUFA. Prepaid- und Debitkarten werden in der Regel nicht gemeldet; sie schaden nicht, bauen aber nichts auf. Was Bonität wirklich baut, ist das geführte Girokonto dahinter: Gehaltseingänge, keine Rückgaben, kein Dauer-Dispo."
    },
    {
      "f": "Was sind Opportunitätskosten der Kaution?",
      "a": "Das Geld, das als Kaution liegt, arbeitet nicht: Bei 1.000 Euro Kaution und 2,5 Prozent Tagesgeldzins verlieren Sie rund 25 Euro im Jahr – zusätzlich zur Jahresgebühr. Der Rechner zählt das mit, damit Kaution und Prepaid ehrlich vergleichbar werden. Wer die Kaution später zurückbekommt, hat sie nicht verloren – aber drei Jahre nicht nutzen können."
    },
    {
      "f": "Welche Karte bekomme ich über FIAON?",
      "a": "Das entscheidet der Kartenpartner anhand Ihrer Akte – FIAON bereitet vor und stellt den Antrag, wenn Ihre Readiness die Schwelle erreicht. Für jeden Kunden gibt es zunächst ein Girokonto mit Debitkarte; die Kreditkarte mit Rahmen kommt, wenn Auskunft und Kontoführung sie tragen. Kein Versprechen, sondern ein Weg mit Etappen."
    }
  ],
  "/en/tools/card-costs": [
    {
      "f": "What is a credit card with a security deposit?",
      "a": "A real credit card whose limit is covered by a deposit you lodge beforehand – usually equal to the limit. The issuer bears no risk, which is why it is often available even with negative entries. The deposit sits idle as long as the card runs; some issuers pay no interest on it. The advantage: it works like a credit card – hotel, hire car, deposit – and with some providers reports a payment history."
    },
    {
      "f": "Is prepaid the same as debit?",
      "a": "No. You top up prepaid cards; they are attached to no current account and often cost top-up fees. Debit cards (Visa Debit, Debit Mastercard) debit the current account immediately – no top-up, no limit. For everyday life and online shopping both are equivalent; at hotels and car hire prepaid and debit are frequently refused because no deposit can be blocked."
    },
    {
      "f": "Which card builds a credit file?",
      "a": "Only a card whose payment behaviour is reported – in Germany that is above all real credit cards with a limit and contract reporting to SCHUFA. Prepaid and debit cards are usually not reported; they do no harm, but build nothing. What really builds a credit file is the well-run current account behind it: salary receipts, no returns, no permanent overdraft."
    },
    {
      "f": "What are the opportunity costs of the deposit?",
      "a": "The money sitting as a deposit does not work: with a €1,000 deposit and 2.5 per cent savings interest you lose around €25 a year – on top of the annual fee. The calculator counts that so that deposit and prepaid become honestly comparable. Anyone who gets the deposit back later has not lost it – but could not use it for three years."
    },
    {
      "f": "Which card do I get via FIAON?",
      "a": "The card partner decides that on the basis of your file – FIAON prepares and submits the application when your readiness reaches the threshold. Every customer first gets a current account with a debit card; the credit card with a limit comes when report and account management carry it. No promise, but a route with stages."
    }
  ],
  "/werkzeuge/schuldenplan": [
    {
      "f": "Lawine oder Schneeball – was ist besser?",
      "a": "Rechnerisch die Lawine: Wer das Extra-Geld immer auf die Schuld mit dem höchsten Zins legt, zahlt am wenigsten Zinsen und ist am frühesten fertig. Praktisch gewinnt oft der Schneeball: Wer die kleinste Schuld zuerst tilgt, hat nach wenigen Monaten einen Gläubiger weniger – und hält deshalb durch. Der Rechner zeigt, wie groß der Unterschied bei Ihren Zahlen ist. Ist er klein, nehmen Sie den Schneeball."
    },
    {
      "f": "Welche Schulden gehören in den Plan?",
      "a": "Alle mit fester Rate: Ratenkredite, Dispo (mit dem Betrag, den Sie monatlich abbauen wollen), Kreditkartenrahmen, Ratenkäufe, Inkassoforderungen mit Ratenvereinbarung. Nicht hinein gehören Miete, Strom und laufende Verträge – das sind Fixkosten, die im Budget vorher abgezogen sind."
    },
    {
      "f": "Was, wenn das Budget die Mindestraten nicht deckt?",
      "a": "Dann ist kein Plan der Welt die Lösung, sondern ein Gespräch: mit den Gläubigern über niedrigere Raten (Ratenplan-Rechner) und mit einer kostenlosen, staatlich anerkannten Schuldnerberatung. Sie kann Raten bündeln, Vergleiche verhandeln und – wenn nötig – den Weg in die Verbraucherinsolvenz begleiten. Der Rechner sagt Ihnen ehrlich, wenn Sie an diesem Punkt sind."
    },
    {
      "f": "Sollte ich lieber umschulden?",
      "a": "Wenn ein neuer Kredit alle teuren Schulden zu einem deutlich niedrigeren Zins ablöst und die Rate ins Budget passt: ja – der Umschuldungsrechner rechnet es durch. Voraussetzung ist eine Bank, die den Kredit gibt; mit negativen Einträgen ist das schwer. Dann ist der Plan mit vorhandenen Mitteln der realistische Weg."
    },
    {
      "f": "Wie halte ich den Plan durch?",
      "a": "Alle Raten auf einen Tag direkt nach dem Gehalt, per Dauerauftrag. Das Extra-Geld ebenfalls automatisch. Einen Puffer von einer Monatsrate auf dem Konto. Jeden getilgten Gläubiger feiern – und dessen Rate sofort auf die nächste Schuld legen, statt sie im Alltag zu verbrauchen. Genau das ist der Schneeball-Effekt."
    }
  ],
  "/en/tools/debt-free-plan": [
    {
      "f": "Avalanche or snowball – which is better?",
      "a": "Mathematically the avalanche: anyone who always puts the extra money on the debt with the highest interest pays the least interest and finishes earliest. In practice the snowball often wins: anyone who pays off the smallest debt first has one creditor fewer after a few months – and therefore keeps going. The calculator shows how big the difference is with your figures. If it is small, take the snowball."
    },
    {
      "f": "Which debts belong in the plan?",
      "a": "All with a fixed instalment: instalment loans, overdraft (with the amount you want to reduce it by each month), credit card limits, instalment purchases, debt collection claims with an instalment agreement. Rent, electricity and running contracts do not belong in it – those are fixed costs already deducted from the budget."
    },
    {
      "f": "What if the budget does not cover the minimum instalments?",
      "a": "Then no plan in the world is the solution, but a conversation: with the creditors about lower instalments (instalment plan calculator) and with free, state-recognised debt counselling. It can bundle instalments, negotiate settlements and – if necessary – accompany you into consumer insolvency. The calculator tells you honestly when you are at that point."
    },
    {
      "f": "Should I consolidate instead?",
      "a": "If a new loan pays off all expensive debts at a clearly lower rate and the instalment fits the budget: yes – the consolidation calculator works it out. The precondition is a bank that grants the loan; with negative entries that is hard. Then the plan with existing means is the realistic route."
    },
    {
      "f": "How do I stick to the plan?",
      "a": "All instalments on one day right after your salary, by standing order. The extra money automatically too. A buffer of one monthly instalment in the account. Celebrate every creditor paid off – and put their instalment straight onto the next debt instead of spending it in everyday life. That is exactly the snowball effect."
    }
  ],
  "/werkzeuge/dispo-rechner": [
    {
      "f": "Schadet ein Dispo meiner SCHUFA?",
      "a": "Der eingeräumte Dispo wird der SCHUFA in der Regel nicht gemeldet – erst eine Kündigung mit offener Forderung oder eine geduldete Überziehung, die die Bank als Vertragsverletzung wertet. Aber: Banken und Kartenpartner lesen den Kontoauszug. Ein dauerhaft ausgereizter Dispo ist dort das deutlichste Warnsignal, unabhängig vom Score."
    },
    {
      "f": "Ist ein Ratenkredit zur Ablösung des Dispos sinnvoll?",
      "a": "Rechnerisch fast immer, wenn der Kreditzins deutlich unter dem Dispozins liegt (typisch 5 bis 9 Prozent gegenüber 11 und mehr) und Sie die Rate sicher tragen. Voraussetzung: Der Dispo wird danach nicht wieder aufgebaut. Fragen Sie mit einer Konditionsanfrage an, nicht mit einer Kreditanfrage – sie ist SCHUFA-neutral."
    },
    {
      "f": "Was, wenn die Bank den Dispo kündigt?",
      "a": "Sie darf das mit angemessener Frist – und die offene Summe wird auf einmal fällig. Reagieren Sie sofort schriftlich mit einem Ratenangebot; eine geplatzte Rückzahlung nach Kündigung ist der Weg zum Negativeintrag. Der Ratenplan-Rechner formuliert das Angebot."
    },
    {
      "f": "Wie komme ich aus dem Dispo, wenn kein Kredit möglich ist?",
      "a": "Mit einem festen Abbau-Betrag pro Monat, direkt nach dem Gehaltseingang, und einem Dispo-Limit, das Sie selbst bei der Bank senken lassen – Schritt für Schritt, damit der alte Stand nicht wieder erreicht wird. Der Rechner zeigt, wie viele Monate das dauert und was es an Zinsen spart, wenn Sie den Betrag nur um 50 Euro erhöhen."
    },
    {
      "f": "Was ist eine geduldete Überziehung?",
      "a": "Alles, was über das eingeräumte Dispo-Limit hinausgeht. Dafür verlangen viele Banken einen noch höheren Zins – oft 14 bis 18 Prozent – und dürfen die Überziehung jederzeit zurückfordern. Die geduldete Überziehung ist die teuerste Form von Kredit, die es im Alltag gibt."
    }
  ],
  "/en/tools/overdraft-calculator": [
    {
      "f": "Does an overdraft harm my SCHUFA record?",
      "a": "The granted overdraft is usually not reported to SCHUFA – only a termination with an open claim, or a tolerated overdraft that the bank treats as a breach of contract. But: banks and card partners read the bank statement. A permanently maxed-out overdraft is the clearest warning sign there, regardless of the score."
    },
    {
      "f": "Is an instalment loan to pay off the overdraft sensible?",
      "a": "Mathematically almost always, if the loan rate is clearly below the overdraft rate (typically 5 to 9 per cent against 11 and more) and you can carry the instalment safely. Precondition: the overdraft is not built up again afterwards. Enquire with a conditions enquiry, not a loan enquiry – it is SCHUFA-neutral."
    },
    {
      "f": "What if the bank cancels the overdraft?",
      "a": "It may do so with reasonable notice – and the open sum becomes due in one go. React immediately in writing with an instalment offer; a failed repayment after cancellation is the route to a negative entry. The instalment plan calculator drafts the offer."
    },
    {
      "f": "How do I get out of the overdraft if no loan is possible?",
      "a": "With a fixed reduction amount per month, right after your salary arrives, and an overdraft limit that you have the bank lower yourself – step by step, so the old level is not reached again. The calculator shows how many months that takes and what it saves in interest if you raise the amount by only 50 euros."
    },
    {
      "f": "What is a tolerated overdraft?",
      "a": "Everything beyond the granted overdraft limit. For that many banks charge an even higher rate – often 14 to 18 per cent – and may demand repayment at any time. The tolerated overdraft is the most expensive form of credit in everyday life."
    }
  ],
  "/werkzeuge/pfaendungsrechner": [
    {
      "f": "Was ist der Unterschied zwischen Lohnpfändung und P-Konto?",
      "a": "Bei der Lohnpfändung behält der Arbeitgeber den pfändbaren Teil ein und überweist ihn an den Gläubiger – Grundlage ist die Tabelle zu § 850c ZPO. Das P-Konto schützt das Guthaben auf dem Konto vor der Kontopfändung: Bis zum Freibetrag können Sie verfügen, egal woher das Geld kommt. Beides kann gleichzeitig laufen; das P-Konto schützt dann das, was nach der Lohnpfändung ankommt."
    },
    {
      "f": "Wie bekomme ich ein P-Konto?",
      "a": "Jedes Girokonto kann auf Verlangen in ein Pfändungsschutzkonto umgewandelt werden – die Bank muss das innerhalb von vier Geschäftstagen tun (§ 850k ZPO). Es darf nur ein P-Konto je Person geben; die Bank darf dafür kein höheres Entgelt verlangen als für das normale Konto. Der Grundfreibetrag gilt sofort; die Erhöhungen brauchen eine Bescheinigung."
    },
    {
      "f": "Wer stellt die Bescheinigung für den erhöhten Freibetrag aus?",
      "a": "Arbeitgeber, Familienkasse, Sozialleistungsträger, Schuldnerberatungsstellen, Rechtsanwälte, Steuerberater oder das Vollstreckungsgericht (§ 903 ZPO). Die kostenlose Schuldnerberatung ist der einfachste Weg. Ohne Bescheinigung gilt nur der Grundbetrag – auch wenn Sie Kinder haben."
    },
    {
      "f": "Was passiert mit Geld über dem Freibetrag?",
      "a": "Es ist für den Gläubiger reserviert – die Bank darf es aber erst im Folgemonat auskehren (Moratorium, § 900 ZPO). Nicht verbrauchtes Guthaben unter dem Freibetrag können Sie bis zu drei Monate ansparen (§ 899 Abs. 2 ZPO). Eine Nachzahlung wie Weihnachtsgeld ist deshalb nicht verloren, aber zeitlich zu planen."
    },
    {
      "f": "Gilt die Tabelle auch in Österreich und der Schweiz?",
      "a": "Nein. In Österreich gilt das Existenzminimum nach der Exekutionsordnung (§ 291a EO, jährlich angepasst), in der Schweiz das betreibungsrechtliche Existenzminimum, das das Betreibungsamt individuell nach den Richtlinien der Konferenz der Betreibungs- und Konkursbeamten berechnet. Dieses Werkzeug rechnet ausschließlich nach deutschem Recht."
    }
  ],
  "/en/tools/attachment-calculator": [
    {
      "f": "What is the difference between wage attachment and the P-Konto?",
      "a": "In a wage attachment the employer withholds the attachable part and transfers it to the creditor – the basis is the table on Section 850c ZPO. The P-Konto protects the credit balance in the account from account attachment: up to the exempt amount you can dispose of it, wherever the money comes from. Both can run at the same time; the P-Konto then protects what arrives after the wage attachment."
    },
    {
      "f": "How do I get a P-Konto?",
      "a": "Any current account can be converted into an attachment protection account on request – the bank must do so within four business days (Section 850k ZPO). There may be only one P-Konto per person; the bank may not charge more for it than for the normal account. The basic exempt amount applies immediately; the increases need a certificate."
    },
    {
      "f": "Who issues the certificate for the increased exempt amount?",
      "a": "Employers, the family benefits office, social benefit agencies, debt counselling centres, lawyers, tax advisers or the enforcement court (Section 903 ZPO). Free debt counselling is the simplest route. Without a certificate only the basic amount applies – even if you have children."
    },
    {
      "f": "What happens to money above the exempt amount?",
      "a": "It is reserved for the creditor – but the bank may only pay it out in the following month (moratorium, Section 900 ZPO). Unused credit below the exempt amount can be saved up for up to three months (Section 899(2) ZPO). A back payment such as a Christmas bonus is therefore not lost, but needs to be planned in time."
    },
    {
      "f": "Does the table also apply in Austria and Switzerland?",
      "a": "No. In Austria the subsistence minimum under the Enforcement Code applies (Section 291a EO, adjusted annually); in Switzerland the enforcement-law subsistence minimum, which the enforcement office calculates individually under the guidelines of the Conference of Debt Enforcement and Bankruptcy Officials. This tool calculates exclusively under German law."
    }
  ],
  "/werkzeuge/widerspruch": [
    {
      "f": "Kann ich mit diesem Schreiben jeden Eintrag löschen lassen?",
      "a": "Nein. Ein inhaltlich richtiger, zulässig gemeldeter Eintrag bleibt bis zum Ablauf der Speicherfrist – auch nach dem besten Brief. Das Schreiben wirkt dort, wo die Meldung die gesetzlichen Voraussetzungen nicht erfüllt hat (§ 31 Abs. 2 BDSG), wo Daten falsch sind (Art. 16 DSGVO) oder wo die Frist abgelaufen ist (Art. 17 DSGVO)."
    },
    {
      "f": "Schreibe ich an die Auskunftei oder an den Gläubiger?",
      "a": "An beide. Die Auskunftei ist rechtlich verantwortlich für die Daten, die sie speichert, und muss prüfen. Der Gläubiger hat gemeldet und kann die Meldung zurücknehmen – oft geht das schneller. Deshalb erzeugt das Werkzeug zwei Schreiben."
    },
    {
      "f": "Wie lange hat die Auskunftei Zeit zu antworten?",
      "a": "Unverzüglich, spätestens innerhalb eines Monats nach Eingang (Art. 12 Abs. 3 DSGVO). Bei komplizierten Fällen darf sie die Frist um zwei Monate verlängern, muss das aber innerhalb des ersten Monats mitteilen. Deshalb steht im Schreiben eine Frist von vier Wochen."
    },
    {
      "f": "Was tue ich, wenn die Auskunftei ablehnt oder nicht antwortet?",
      "a": "Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde (Art. 77 DSGVO) – für die SCHUFA ist das der Hessische Beauftragte für Datenschutz und Informationsfreiheit. Zusätzlich gibt es den Ombudsmann der SCHUFA. Beides ist kostenlos. FIAON übernimmt diese Eskalation für Kunden."
    },
    {
      "f": "Soll ich per E-Mail oder per Post schicken?",
      "a": "Per Post als Einschreiben mit Rückschein – oder per Einwurf-Einschreiben. Sie brauchen später den Nachweis, wann das Schreiben zugegangen ist. Eine Kopie des Ausweises verlangen Auskunfteien oft zur Identifikation; schwärzen Sie darauf alles außer Name, Anschrift und Geburtsdatum."
    }
  ],
  "/en/tools/deletion-request": [
    {
      "f": "Can I have every entry deleted with this letter?",
      "a": "No. A factually correct, lawfully reported entry stays until the storage period expires – even after the best letter. The letter works where the report did not meet the legal requirements (Section 31(2) BDSG), where data is wrong (Article 16 GDPR) or where the period has expired (Article 17 GDPR)."
    },
    {
      "f": "Do I write to the credit bureau or to the creditor?",
      "a": "To both. The credit bureau is legally responsible for the data it stores and must examine. The creditor made the report and can withdraw it – that is often faster. That is why the tool generates two letters."
    },
    {
      "f": "How long does the credit bureau have to reply?",
      "a": "Without undue delay, at the latest within one month of receipt (Article 12(3) GDPR). In complicated cases it may extend the period by two months, but must say so within the first month. That is why the letter sets a deadline of four weeks."
    },
    {
      "f": "What do I do if the credit bureau refuses or does not reply?",
      "a": "Complaint to the competent data protection supervisory authority (Article 77 GDPR) – for SCHUFA that is the Hessian Commissioner for Data Protection and Freedom of Information. In addition there is the SCHUFA ombudsman. Both are free of charge. FIAON takes over this escalation for customers."
    },
    {
      "f": "Should I send by e-mail or by post?",
      "a": "By post as registered mail with return receipt – or as registered delivery. You will later need proof of when the letter was received. Credit bureaus often demand a copy of your ID for identification; black out everything on it except name, address and date of birth."
    }
  ],
  "/werkzeuge/mahnbescheid": [
    {
      "f": "Prüft das Gericht, ob die Forderung berechtigt ist?",
      "a": "Nein. Das Mahnverfahren ist ein automatisiertes Verfahren: Das Mahngericht prüft nur, ob der Antrag formal vollständig ist – nicht, ob die Forderung besteht. Deshalb kommen auch verjährte, überhöhte oder erfundene Forderungen als Mahnbescheid. Der Widerspruch ist Ihr einziger Hebel, und er kostet nichts."
    },
    {
      "f": "Muss ich den Widerspruch begründen?",
      "a": "Nein. Ein Kreuz im Feld „Ich widerspreche dem Anspruch insgesamt“, Datum, Unterschrift – das genügt (§ 694 ZPO). Eine Begründung können Sie später im streitigen Verfahren liefern. Wichtig ist nur, dass der Widerspruch innerhalb von zwei Wochen beim Mahngericht EINGEHT."
    },
    {
      "f": "Was passiert nach dem Widerspruch?",
      "a": "Der Gläubiger muss entscheiden, ob er klagt. Erst dann prüft ein Gericht die Forderung inhaltlich – mit Ihren Einwänden (Verjährung, überhöhte Inkassokosten, nie bestellt). Viele Inkassounternehmen klagen bei begründetem Widerspruch nicht. Ohne Widerspruch bekommen sie den Titel ohne jede Prüfung."
    },
    {
      "f": "Ich habe die zwei Wochen verpasst – ist alles verloren?",
      "a": "Nicht sofort. Der Gläubiger muss den Vollstreckungsbescheid erst beantragen; gegen den haben Sie erneut zwei Wochen ab Zustellung für den Einspruch (§ 700 ZPO). Auch ein verspäteter Widerspruch wird als Einspruch gegen den Vollstreckungsbescheid gewertet. Erst wenn auch diese Frist verstreicht, ist die Forderung tituliert – 30 Jahre vollstreckbar."
    },
    {
      "f": "Führt ein Mahnbescheid zu einem SCHUFA-Eintrag?",
      "a": "Der Mahnbescheid selbst nicht. Ein Vollstreckungsbescheid oder ein Urteil ist dagegen eine titulierte Forderung, die unabhängig von § 31 Abs. 2 Nr. 4 BDSG gemeldet werden darf – auch wenn Sie die Forderung bestreiten. Deshalb ist die Widerspruchsfrist die wichtigste Frist im ganzen Weg."
    }
  ],
  "/en/tools/court-payment-order": [
    {
      "f": "Does the court examine whether the claim is justified?",
      "a": "No. The dunning procedure is automated: the Mahngericht only checks whether the application is formally complete – not whether the claim exists. That is why time-barred, inflated or invented claims also arrive as court payment orders. The objection is your only lever, and it costs nothing."
    },
    {
      "f": "Do I have to give reasons for the objection?",
      "a": "No. A cross in the box “Ich widerspreche dem Anspruch insgesamt”, date, signature – that is enough (Section 694 ZPO). You can provide reasons later in the contested proceedings. What matters is only that the objection is RECEIVED by the Mahngericht within two weeks."
    },
    {
      "f": "What happens after the objection?",
      "a": "The creditor has to decide whether to sue. Only then does a court examine the claim on its merits – with your objections (limitation, excessive debt collection costs, never ordered). Many debt collectors do not sue after a reasoned objection. Without an objection they get the title without any examination."
    },
    {
      "f": "I missed the two weeks – is everything lost?",
      "a": "Not immediately. The creditor first has to apply for the enforcement order; against that you again have two weeks from service for an objection (Section 700 ZPO). A late objection is also treated as an objection to the enforcement order. Only when that deadline also passes is the claim titled – enforceable for 30 years."
    },
    {
      "f": "Does a court payment order lead to a SCHUFA entry?",
      "a": "The court payment order itself does not. An enforcement order or a judgment, by contrast, is a titled claim that may be reported regardless of Section 31(2) no. 4 BDSG – even if you dispute the claim. That is why the objection deadline is the most important deadline on the whole route."
    }
  ],
  "/werkzeuge/inkasso-antwort": [
    {
      "f": "Muss ich auf einen Inkassobrief überhaupt antworten?",
      "a": "Rechtlich nicht – aber Schweigen ist die schlechteste Antwort. Ein bestrittener Anspruch darf nicht an Auskunfteien gemeldet werden (§ 31 Abs. 2 Nr. 4 Buchst. d BDSG); wer nicht widerspricht, bestreitet nicht. Ein kurzes, sachliches Schreiben schützt Sie vor der Meldung und zwingt das Inkasso, seine Unterlagen zu zeigen."
    },
    {
      "f": "Was muss ein Inkassounternehmen mir mitteilen?",
      "a": "Seit dem 1. Oktober 2021 mit der ersten Geltendmachung (§ 13a RDG): Name und Anschrift des Auftraggebers, den Forderungsgrund – bei Verträgen mit Vertragsgegenstand und Datum des Vertragsschlusses –, bei Zinsen die Berechnung, bei Inkassokosten Art, Höhe und Entstehungsgrund, und ob es sich um eine abgetretene Forderung handelt. Fehlt das, verlangen Sie es – genau das tut der Brief."
    },
    {
      "f": "Darf ich die Forderung bestreiten, obwohl sie vielleicht stimmt?",
      "a": "Sie dürfen jederzeit Nachweise verlangen und die Forderung bis zur Vorlage bestreiten. Das ist kein Betrug, sondern Ihr Recht: Wer Geld von Ihnen will, muss belegen, wofür. Stellt sich die Forderung als berechtigt heraus, zahlen oder vereinbaren Sie Raten – dann mit korrigierten Kosten."
    },
    {
      "f": "Was tue ich, wenn nach dem Brief ein Mahnbescheid kommt?",
      "a": "Innerhalb von zwei Wochen Widerspruch beim Mahngericht einlegen – das Formular liegt bei, eine Begründung ist nicht nötig. Der Mahnbescheid-Fristenrechner nennt Ihnen den letzten Tag. Ohne Widerspruch wird die Forderung tituliert, egal ob sie berechtigt ist."
    },
    {
      "f": "Kann das Inkasso trotzdem einen SCHUFA-Eintrag veranlassen?",
      "a": "Nicht rechtmäßig, solange Sie bestritten haben. Geschieht es doch, ist der Eintrag angreifbar – nutzen Sie den Widerspruch-Generator für den Löschantrag an die Auskunftei. Heben Sie Ihr Schreiben und den Einlieferungsbeleg auf: Sie sind der Beweis, dass die Forderung bestritten war."
    }
  ],
  "/en/tools/reply-to-debt-collector": [
    {
      "f": "Do I have to reply to a debt collection letter at all?",
      "a": "Not legally – but silence is the worst reply. A disputed claim may not be reported to credit bureaus (Section 31(2) no. 4(d) BDSG); anyone who does not object does not dispute. A short, factual letter protects you from the report and forces the debt collector to show its documents."
    },
    {
      "f": "What must a debt collection company tell me?",
      "a": "Since 1 October 2021, with the first demand (Section 13a RDG): name and address of the client, the basis of the claim – for contracts the subject matter and the date of conclusion –, for interest the calculation, for debt collection costs type, amount and reason, and whether the claim has been assigned. If that is missing, demand it – that is exactly what the letter does."
    },
    {
      "f": "May I dispute the claim even though it might be right?",
      "a": "You may demand evidence at any time and dispute the claim until it is provided. That is not fraud but your right: anyone who wants money from you must prove what for. If the claim turns out to be justified, pay or agree instalments – then with corrected costs."
    },
    {
      "f": "What do I do if a court payment order arrives after the letter?",
      "a": "Object at the Mahngericht within two weeks – the form is enclosed, no reasons are needed. The court payment order deadline calculator names your last day. Without an objection the claim becomes titled, whether or not it is justified."
    },
    {
      "f": "Can the debt collector still cause a SCHUFA entry?",
      "a": "Not lawfully, as long as you have disputed. If it happens anyway, the entry can be challenged – use the objection generator for the deletion request to the credit bureau. Keep your letter and the posting receipt: they are the proof that the claim was disputed."
    }
  ],
  "/werkzeuge/mahngebuehren": [
    {
      "f": "Darf ein Gläubiger für die erste Mahnung Gebühren verlangen?",
      "a": "In der Regel nicht. Die erste Mahnung nach Fälligkeit ist das, was Sie überhaupt erst in Verzug setzt (§ 286 Abs. 1 BGB) – ihre Kosten entstehen vor dem Verzug und sind kein Verzugsschaden. Anders nur, wenn Sie schon vorher in Verzug waren: bei einem festen Zahlungsdatum im Vertrag oder 30 Tage nach einer Rechnung, die auf diese Folge hinweist (§ 286 Abs. 2 und 3 BGB)."
    },
    {
      "f": "Wie hoch dürfen Mahngebühren sein?",
      "a": "So hoch wie der tatsächliche Schaden: Porto, Papier, Druck – typischerweise um einen Euro. Personal, Software, Verwaltung darf nicht umgelegt werden. Der BGH hat eine Pauschale von 2,50 Euro gegenüber Verbrauchern für unwirksam erklärt, weil die echten Kosten bei 0,76 Euro lagen (26.06.2019, VIII ZR 95/18). Pauschalen von 5, 7,50 oder 10 Euro sind gegenüber Verbrauchern nicht haltbar."
    },
    {
      "f": "Und die 40-Euro-Pauschale?",
      "a": "Sie gilt ausschließlich, wenn der Schuldner kein Verbraucher ist (§ 288 Abs. 5 BGB) – also zwischen Unternehmen. Taucht sie in einer Mahnung an Sie als Privatperson auf, ist sie unzulässig. Das Gleiche gilt für „Bearbeitungsgebühren“, „Kontoführungsgebühren“ oder „Adressermittlung“ ohne Nachweis."
    },
    {
      "f": "Wie hoch dürfen Verzugszinsen sein?",
      "a": "Fünf Prozentpunkte über dem Basiszinssatz der Bundesbank (§ 288 Abs. 1 BGB); der Basiszinssatz wird zum 1. Januar und 1. Juli festgesetzt. Ein höherer Zins ist nur zulässig, wenn er vertraglich vereinbart oder als konkreter Schaden nachgewiesen ist – etwa, weil der Gläubiger selbst einen teureren Kredit in Anspruch nehmen musste."
    },
    {
      "f": "Was tue ich mit überhöhten Gebühren?",
      "a": "Die Hauptforderung zahlen (wenn sie berechtigt ist), die überhöhten Nebenkosten schriftlich zurückweisen – mit dem Text aus dem Prüfer. Viele Gläubiger streichen die Posten dann stillschweigend. Bleiben sie hart, muss der Gläubiger die Kosten einklagen und nachweisen; das tut bei einem Euro Streitwert niemand."
    }
  ],
  "/en/tools/reminder-fees": [
    {
      "f": "May a creditor charge fees for the first reminder?",
      "a": "Usually not. The first reminder after the due date is what puts you in default in the first place (Section 286(1) BGB) – its costs arise before the default and are not damage caused by default. It is different only if you were already in default beforehand: with a fixed payment date in the contract or 30 days after an invoice that points out this consequence (Section 286(2) and (3) BGB)."
    },
    {
      "f": "How high may reminder fees be?",
      "a": "As high as the actual damage: postage, paper, printing – typically around one euro. Staff, software, administration may not be passed on. The Federal Court of Justice declared a flat rate of 2.50 euros towards consumers invalid because the real costs were 0.76 euros (26 June 2019, VIII ZR 95/18). Flat rates of 5, 7.50 or 10 euros are not sustainable towards consumers."
    },
    {
      "f": "And the 40-euro flat rate?",
      "a": "It applies exclusively when the debtor is not a consumer (Section 288(5) BGB) – that is, between businesses. If it appears in a reminder to you as a private individual, it is inadmissible. The same applies to “processing fees”, “account keeping fees” or “address tracing” without evidence."
    },
    {
      "f": "How high may default interest be?",
      "a": "Five percentage points above the Bundesbank base rate (Section 288(1) BGB); the base rate is set on 1 January and 1 July. A higher rate is permissible only if agreed in the contract or proven as specific damage – for example because the creditor itself had to take out a more expensive loan."
    },
    {
      "f": "What do I do with excessive fees?",
      "a": "Pay the principal claim (if it is justified), reject the excessive ancillary costs in writing – with the text from the checker. Many creditors then quietly drop the items. If they stay firm, the creditor has to sue for the costs and prove them; nobody does that for one euro in dispute."
    }
  ],
  "/werkzeuge/ratenplan": [
    {
      "f": "Muss ein Gläubiger Ratenzahlung annehmen?",
      "a": "Nein. Eine Forderung ist auf einmal fällig; Ratenzahlung ist ein Entgegenkommen. In der Praxis nehmen Gläubiger und Inkassounternehmen realistische Angebote fast immer an – sie bekommen sonst gar nichts oder müssen teuer vollstrecken. Entscheidend ist, dass die Rate tragfähig ist und pünktlich kommt."
    },
    {
      "f": "Wie hoch sollte die Rate sein?",
      "a": "So hoch, dass sie auch in einem schlechten Monat sicher kommt – nicht so hoch, wie es sich im besten Monat anfühlt. Faustregel aus der Schuldnerberatung: höchstens die Hälfte des Betrags, der nach allen Fixkosten übrig bleibt. Eine geplatzte Rate kostet mehr Vertrauen als eine kleine Rate über einen längeren Zeitraum."
    },
    {
      "f": "Was ist mit Zinsen und Inkassokosten?",
      "a": "Fragen Sie im Angebot ausdrücklich nach dem Verzicht auf weitere Verzugszinsen und Kosten ab Beginn der Ratenzahlung. Viele Gläubiger stimmen zu, weil die Sicherheit der Zahlung mehr wert ist. Die bisher aufgelaufenen Inkassokosten sollten Sie vorher mit dem Inkassokosten-Prüfer nachrechnen – überhöhte Posten gehören nicht in den Ratenplan."
    },
    {
      "f": "Verhindert ein Ratenplan den SCHUFA-Eintrag?",
      "a": "Nicht automatisch, aber oft: Solange eine Ratenvereinbarung besteht und eingehalten wird, gilt die Forderung in der Regel nicht mehr als fällig im Sinne von § 31 Abs. 2 BDSG – eine Meldung wäre angreifbar. Deshalb steht im Schreiben die Bitte um Bestätigung, dass während der Ratenzahlung keine Meldung erfolgt. Lassen Sie sich das schriftlich geben."
    },
    {
      "f": "Ist eine Ratenvereinbarung ein Schuldanerkenntnis?",
      "a": "Sie kann so gewertet werden – und lässt die Verjährung neu beginnen (§ 212 BGB). Prüfen Sie deshalb VOR dem Angebot, ob die Forderung vielleicht schon verjährt oder überhaupt berechtigt ist. Ein Ratenplan ist der richtige Schritt bei einer berechtigten, nicht verjährten Forderung – nicht bei einer zweifelhaften."
    }
  ],
  "/en/tools/instalment-plan": [
    {
      "f": "Does a creditor have to accept instalments?",
      "a": "No. A claim is due in one go; instalments are a concession. In practice creditors and debt collectors almost always accept realistic offers – otherwise they get nothing at all or have to enforce expensively. What matters is that the instalment is sustainable and arrives on time."
    },
    {
      "f": "How high should the instalment be?",
      "a": "High enough that it arrives safely even in a bad month – not as high as it feels in the best month. Rule of thumb from debt counselling: at most half of the amount left after all fixed costs. A bounced instalment costs more trust than a small instalment over a longer period."
    },
    {
      "f": "What about interest and debt collection costs?",
      "a": "In the offer, expressly ask for a waiver of further default interest and costs from the start of the instalments. Many creditors agree because the certainty of payment is worth more. Recalculate the debt collection costs accrued so far with the debt collection cost checker beforehand – excessive items do not belong in the instalment plan."
    },
    {
      "f": "Does an instalment plan prevent the SCHUFA entry?",
      "a": "Not automatically, but often: as long as an instalment agreement exists and is kept, the claim is usually no longer considered due within the meaning of Section 31(2) BDSG – a report could be challenged. That is why the letter asks for confirmation that no report is made during the instalments. Get that in writing."
    },
    {
      "f": "Is an instalment agreement an acknowledgement of debt?",
      "a": "It can be treated as one – and restarts the limitation period (Section 212 BGB). So check BEFORE the offer whether the claim may already be time-barred or justified at all. An instalment plan is the right step for a justified, non-time-barred claim – not for a doubtful one."
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
  "/en/tools": [
    {
      "f": "What do the FIAON tools cost?",
      "a": "Nothing. All tools are free, require no sign-up and no e-mail address. The calculations run in your browser — nothing is transmitted and nothing is stored."
    },
    {
      "f": "Do the tools replace professional help?",
      "a": "No. They give a well-founded first assessment under the applicable rules — they do not provide a binding check of your individual case. In serious over-indebtedness the first route is free, state-recognised debt counselling."
    },
    {
      "f": "Where do the rules in the tools come from?",
      "a": "From the published sources: the code of conduct of the credit bureaus (2024 version), Section 31 BDSG, Articles 15 and 17 GDPR, Section 6a PAngV, Sections 195 ff. and 500 ff. BGB, the RVG for debt collection costs and the case law of the Federal Court of Justice and the European Court of Justice. Every tool names its basis at the bottom of the page."
    },
    {
      "f": "Why does FIAON provide this for free?",
      "a": "Because the first question — what is stored about me, and what of it can be challenged? — is one everyone should be able to answer themselves. Anyone who then wants someone to take over obtaining, checking and enforcing already knows us."
    }
  ],
  "/status": [
    {
      "f": "Wo liegen meine Daten?",
      "a": "Auf Servern in Frankfurt am Main (EU) bei einem Hosting-Anbieter mit europäischer Region; die Datenbank liegt in derselben Region. Der Umzug aus einer US-Region nach Frankfurt wurde am 24.08.2026 abgeschlossen. Sicherungen liegen ebenfalls in der EU."
    },
    {
      "f": "Wie sind die Daten geschützt?",
      "a": "Verschlüsselte Übertragung (TLS), verschlüsselte Speicherung, Zugriff nur für den Ansprechpartner, der Ihre Akte führt, und die Betreiber. Hochgeladene Unterlagen werden beim Hochladen geprüft. Zahlungen laufen per SEPA über einen verifizierten Kreditor – FIAON speichert keine Kartendaten."
    },
    {
      "f": "Was bedeutet der grüne Punkt oben?",
      "a": "Ihr Browser hat gerade den Gesundheitspfad der Plattform abgefragt und eine Antwort bekommen. Denselben Pfad nutzt unser Hosting, um eine neue Version erst dann Verkehr zu geben, wenn sie antwortet – Deploys laufen dadurch ohne Unterbrechung."
    },
    {
      "f": "Wann wird gewartet?",
      "a": "Deploys erfolgen mehrmals wöchentlich ohne Unterbrechung. Wartung mit Ausfall kündigen wir hier und im Kundenbereich mindestens 24 Stunden vorher an und legen sie nicht in die Telefonzeiten des Teams."
    },
    {
      "f": "Wen erreiche ich bei einer Störung?",
      "a": "Support +41 44 244 93 01 oder support@fiaon.com. Kunden nutzen zusätzlich „Dringend melden“ auf der Kontaktseite – die Meldung landet direkt bei der Geschäftsführung."
    }
  ],
  "/en/status": [
    {
      "f": "Where is my data?",
      "a": "On servers in Frankfurt am Main (EU) with a hosting provider in a European region; the database is in the same region. The move from a US region to Frankfurt was completed on 24 August 2026. Backups are also in the EU."
    },
    {
      "f": "How is the data protected?",
      "a": "Encrypted transfer (TLS), encrypted storage, access only for the contact who manages your file and the operators. Uploaded documents are checked on upload. Payments run via SEPA through a verified creditor – FIAON stores no card details."
    },
    {
      "f": "What does the green dot at the top mean?",
      "a": "Your browser has just queried the platform's health endpoint and received a reply. Our hosting uses the same endpoint to route traffic to a new version only once it responds – so deploys run without interruption."
    },
    {
      "f": "When is maintenance done?",
      "a": "Deploys happen several times a week without interruption. Maintenance with downtime is announced here and in the customer area at least 24 hours in advance and is not scheduled during the team's phone hours."
    },
    {
      "f": "Who do I reach in an incident?",
      "a": "Support on +41 44 244 93 01 or support@fiaon.com. Customers can also use “Report urgently” on the contact page – the report goes straight to the management."
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
  "/en/careers": [
    {
      "f": "Does FIAON employ people or only pay commission?",
      "a": "Both. Employment in all areas, freelance work above all in sales, onboarding and receivables management, working students in marketing, engineering, onboarding and operations."
    },
    {
      "f": "Where do I work?",
      "a": "Mostly remote in Germany, Austria or Switzerland. Meetings take place in Zurich; legal and operations partly on site."
    },
    {
      "f": "Do I need experience?",
      "a": "Depending on the area. In sales and onboarding the academy teaches you everything; in engineering, legal and operations we expect experience. Tell us honestly where you stand."
    },
    {
      "f": "How does the interview go?",
      "a": "A video call with Florentine or Daniel, 30 minutes, no trick questions. Then a trial day or a trial task – and a decision within a week."
    },
    {
      "f": "When can I start?",
      "a": "As soon as it fits. We are growing fast and always need support – a start is possible at any time."
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
  "/en/partners": [
    {
      "f": "Do I receive data without the customer's consent?",
      "a": "No. The customer decides to whom FIAON shows their file. The consent is logged and can be revoked at any time."
    },
    {
      "f": "Does FIAON decide on account or card?",
      "a": "No. FIAON prepares and documents. You decide on account, card and limit – by your criteria."
    },
    {
      "f": "How is remuneration regulated?",
      "a": "Per deal, on request per collected instalment. The rule is in the contract, every statement is traceable in the platform."
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
  "/en/press": [
    {
      "f": "May I interview FIAON customers?",
      "a": "Yes, on request we put you in touch with customers who want to tell their story – with their consent and anonymised on request."
    },
    {
      "f": "Are there figures on customers and revenue?",
      "a": "For reporting we provide audited key figures on request. We name the sources for the market figures on request."
    },
    {
      "f": "Is FIAON a bank or a loan broker?",
      "a": "Neither. FIAON is a platform that makes creditworthiness visible and repairs it. The respective partner bank always decides on account, card and limit."
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
  "/en/tools/loan-calculator": [
    {
      "f": "How is the monthly instalment of an instalment loan calculated?",
      "a": "Using the annuity formula: the instalment stays the same every month, but its composition changes. At the start it contains a lot of interest and little repayment, at the end it is the other way round. The calculator uses exactly this formula with monthly interest."
    },
    {
      "f": "What is the two-thirds rate?",
      "a": "Under Section 6a of the German Price Indication Ordinance (PAngV) banks must state the effective annual rate at which at least two thirds of customers actually get the advertised loan. The headline rate in advertising often applies only to the best credit files — the two-thirds rate is the more realistic figure."
    },
    {
      "f": "Why do I get a higher rate than advertised?",
      "a": "Most banks set rates depending on creditworthiness: the better the score and the ability to service the debt, the cheaper the loan. Negative entries, many enquiries in a short time or a maxed-out overdraft make the same loan considerably more expensive — often by several percentage points."
    },
    {
      "f": "Is a shorter term worthwhile?",
      "a": "Almost always, if the instalment stays affordable: at the same rate the total cost falls with every monthly instalment saved. The calculator shows the total cost for your input — change the term and compare for yourself."
    },
    {
      "f": "Does this calculator store my data?",
      "a": "No. All calculations run in your browser. Nothing is transmitted, nothing is stored and no sign-up is required."
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
  "/en/tools/debt-consolidation": [
    {
      "f": "What is debt consolidation?",
      "a": "You take out a new loan and use it to pay off existing loans and the overdraft. It makes sense when the new rate is lower than the weighted rate of the old contracts — then instalment, total cost or both fall."
    },
    {
      "f": "When is consolidation worthwhile?",
      "a": "As a rule of thumb: the higher the old rates and the longer the remaining term, the bigger the lever. The strongest effect comes from paying off a permanently used overdraft charged at 10 to 13 per cent. For old loans with less than a year to run the effort is rarely worth it."
    },
    {
      "f": "May I repay my instalment loan early?",
      "a": "Yes. For consumer loans early repayment is permitted by law (Section 500 BGB). The bank may charge an early repayment fee of at most one per cent of the remaining debt — at most 0.5 per cent if less than twelve months remain."
    },
    {
      "f": "Does consolidation worsen my score?",
      "a": "In the short term the new loan enquiry may be visible; if you make it as a conditions enquiry it is score-neutral. In the medium term consolidation often has a positive effect: fewer parallel contracts, a cleared overdraft and punctual instalments are exactly what credit bureaus read as order."
    },
    {
      "f": "Does this calculator store my data?",
      "a": "No. All calculations run in your browser. Nothing is transmitted, nothing is stored and no sign-up is required."
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
  "/en/tools/debt-check": [
    {
      "f": "From when does someone count as over-indebted?",
      "a": "Over-indebted is anyone who can no longer meet their due payment obligations with the available income and assets in the long run. A single tight month is not over-indebtedness — what is decisive is whether the gap repeats month after month and the arrears grow."
    },
    {
      "f": "Which debt ratio is still all right?",
      "a": "As a rule of thumb in lending practice: all instalments together should not exceed 30 to 35 per cent of net income. Above 40 per cent it gets tight, because unforeseen expenses no longer have room. The check calculates exactly this ratio."
    },
    {
      "f": "What does a debt counselling service do — and what does it cost?",
      "a": "State-recognised debt counselling centres (for example from Caritas, Diakonie, AWO or the consumer advice centres) are free of charge. They provide an overview, negotiate with creditors, protect the subsistence minimum (P-Konto) and accompany you into consumer insolvency if necessary."
    },
    {
      "f": "Is consumer insolvency the end?",
      "a": "No — it is a regulated fresh start: since 2020 the procedure takes only three years, after which the remaining debts are discharged. The entry about the discharge of residual debt has been deleted only six months after it is granted since 2023."
    },
    {
      "f": "Does this check store my details?",
      "a": "No. All calculations run in your browser. Nothing is transmitted, nothing is stored and no sign-up is required."
    }
  ],
};

/** Die Begriffe von /glossar-bonitaet (39). */
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
    "wort": "Basisscore (bis März 2026)",
    "text": "Der frühere Prozentwert (0 bis 100), den die SCHUFA vierteljährlich berechnete. Seit dem 17. März 2026 abgelöst durch den neuen SCHUFA-Score von 100 bis 999 Punkten. Alte Auskünfte und manche Vertragspartner zeigen übergangsweise noch den Prozentwert."
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
    "wort": "Branchenscore (bis März 2026)",
    "text": "Bis März 2026 berechnete die SCHUFA neben dem Basisscore sechs Branchenwerte – Banken, Sparkassen, Genossenschaftsbanken, Telekommunikation, Handel, Versandhandel. Der neue SCHUFA-Score ersetzt sie durch einen einzigen Wert, den Verbraucher und Vertragspartner gleichermaßen sehen."
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
    "wort": "Score-Klasse",
    "text": "Seit März 2026 ordnet die SCHUFA jeden Score einer von fünf Klassen zu: hervorragend (776–999), gut (709–775), akzeptabel (642–708), ausreichend (100–641), ungenügend (offene Zahlungsstörung, kein Punktwert). Die Klasse ist die Sprache, in der Vertragspartner den Score lesen."
  },
  {
    "wort": "Score",
    "text": "Die statistische Schätzung Ihrer Zahlungswahrscheinlichkeit, als Zahl – bei der SCHUFA seit März 2026 zwischen 100 und 999 Punkten aus zwölf veröffentlichten Kriterien. Die Merkmale sind bekannt: Zahlungshistorie, Negativmerkmale, Anfragen, Kontenlandschaft, Historie-Alter."
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

/** Die Begriffe von /en/credit-glossary (39). */
export const SEO_GLOSSAR_EN: { wort: string; text: string }[] = [
  {
    "wort": "Enquiry (loan / conditions)",
    "text": "Every credit check by a bank leaves an enquiry in your report. The type is decisive: the loan enquiry is visible to other banks for ten days and flows into the score, the conditions enquiry stays neutral. When comparing, always demand the neutral type."
  },
  {
    "wort": "Credit bureau (Auskunftei)",
    "text": "A company that collects credit-relevant data and passes it on to contractual partners: in Germany above all SCHUFA, in Austria the KSV, in Switzerland the CRIF. Credit bureaus decide nothing — they deliver the data on which others decide."
  },
  {
    "wort": "Basic account (Basiskonto)",
    "text": "The account for everyone under Section 31 ZKG: every bank in Germany that runs accounts must open it on request, on a credit basis and with basic functions — regardless of creditworthiness. It is the legal safety net when no other account comes about."
  },
  {
    "wort": "Base score (until March 2026)",
    "text": "The former percentage value (0 to 100) that SCHUFA calculated quarterly. Replaced since 17 March 2026 by the new SCHUFA score of 100 to 999 points. Old reports and some contractual partners still show the percentage value for a transitional period."
  },
  {
    "wort": "Disputed claim",
    "text": "A claim you have objected to with reasons. It may not be reported to credit bureaus (Section 31 BDSG) — the timely, written objection is therefore your strongest tool against impending entries."
  },
  {
    "wort": "Creditworthiness (Bonität)",
    "text": "The assessment of whether someone can and will meet their payment obligations. It is fed by data (entries, history) and behaviour (punctual payments) — and it can be changed: data can be cleaned up, behaviour documented."
  },
  {
    "wort": "Credit report (Bonitätsauskunft)",
    "text": "The look into your own data. Free as a data copy under Article 15 GDPR; as a checked FIAON report with retrieval from three bureaus, plain-language explanation and a check of every entry for a one-off €74."
  },
  {
    "wort": "Industry score (until March 2026)",
    "text": "Until March 2026 SCHUFA calculated six industry values alongside the base score – banks, savings banks, cooperative banks, telecommunications, retail, mail order. The new SCHUFA score replaces them with a single value that consumers and contractual partners see alike."
  },
  {
    "wort": "CRIF",
    "text": "The leading credit bureau in Switzerland. Information and rectification there are governed by the revised Data Protection Act (DSG) — the rights are comparable to the GDPR, the procedures differ in detail."
  },
  {
    "wort": "Data copy (Article 15 GDPR)",
    "text": "Your legal right to a complete, free copy of all data a credit bureau stores about you — including reporting date and reporting body. The basis of every serious check; the paid products show less."
  },
  {
    "wort": "Own enquiry (Eigenauskunft)",
    "text": "The colloquial umbrella term for looking at your own credit bureau data. It is neutral: it does not change the score and is visible to nobody but you — possible as often as you like."
  },
  {
    "wort": "Settlement marker (Erledigungsvermerk)",
    "text": "The marker that a reported claim has been paid — with a date. Only this date starts the deletion period (three years). If the marker is missing despite payment, that is a case for rectification with evidence."
  },
  {
    "wort": "Geoscoring",
    "text": "Assessment based on where you live. It may only play a role when hardly any other data is available — and never be the sole criterion. Anyone who suspects a refusal “because of the address” should check their own data: usually it is something else."
  },
  {
    "wort": "Current account (contract data)",
    "text": "Accounts and cards appear in the report as contract data — not as a value judgement, but as a record of what exists. On termination they must be removed; an “active” account from 2022 in today's report is a case for rectification."
  },
  {
    "wort": "Hundred-day rule",
    "text": "Since 2024: if a reported claim is paid in full within 100 days and there are no other negative features, the storage period shortens from three years to 18 months. Settling quickly is therefore real money for your credit file."
  },
  {
    "wort": "Debt collection (Inkasso)",
    "text": "Commercial collection of claims on behalf of a creditor. A debt collection letter is an assertion on letterhead — some justified, many inflated, a few invented. Check first (register, claim, costs), then pay or object."
  },
  {
    "wort": "Conditions enquiry (Konditionsanfrage)",
    "text": "The SCHUFA-neutral type of enquiry: the bank checks the same data and names real conditions, but the enquiry stays invisible to others and score-free. The right tool for comparing loans — demand it expressly."
  },
  {
    "wort": "Loan enquiry (Kreditanfrage)",
    "text": "The real application type: stored for twelve months, visible to other banks for ten days, flows into the score. Belongs with the contract you actually sign — not with the comparison beforehand."
  },
  {
    "wort": "KSV (Kreditschutzverband)",
    "text": "Austria's major credit bureau (KSV1870). The GDPR applies directly in Austria — data copy, rectification and deletion work under the same articles as in Germany."
  },
  {
    "wort": "Deletion period (Löschfrist)",
    "text": "The span after which an entry must disappear from the report: three years from settlement, 18 months under the 100-day rule, six months after discharge of residual debt, twelve months for enquiries. Calculated to the day — and exceeded surprisingly often."
  },
  {
    "wort": "Deletion (Article 17 GDPR)",
    "text": "Your right to the removal of unlawful, wrong or expired data. Not an act of grace by the credit bureau but a right — assert it in writing, with reasons and a deadline, to the credit bureau and the reporting body."
  },
  {
    "wort": "Court payment order (Mahnbescheid)",
    "text": "The court dunning procedure (yellow envelope): the court does NOT examine the claim on its merits. Against a court payment order you have 14 days to object — the form is enclosed. Letting it pass leads to an enforcement order."
  },
  {
    "wort": "Report (Section 31 BDSG)",
    "text": "An open claim may only be reported to credit bureaus under conditions: two reminders at least four weeks apart, timely notice of the report, claim not disputed. If one is missing, the entry can be challenged."
  },
  {
    "wort": "Negative feature (Negativmerkmal)",
    "text": "An entry about behaviour not in line with the contract: reported open claims, titles, insolvency. Negative features are the heaviest single weight in the score — and the first point to check in every report: are they lawful, correct and within the period?"
  },
  {
    "wort": "Ombudsman",
    "text": "SCHUFA's free conciliation body for disputes between consumers and the credit bureau. The route there is open when objection and deletion demand lead nowhere — in parallel the data protection supervisory authority remains."
  },
  {
    "wort": "Positive feature (Positivmerkmal)",
    "text": "Data about behaviour in line with the contract: the long-held account, the serviced loan, the clean series of payments. Positive features do not arise overnight — but reliably, from time and punctuality."
  },
  {
    "wort": "Instalment payment (Ratenzahlung)",
    "text": "The supreme discipline of creditworthiness: every punctual instalment is a positive data point, every bounced one starts the escalation staircase towards an entry. One debit day, one buffer, one reminder — usually that is all it takes."
  },
  {
    "wort": "Discharge of residual debt (Restschuldbefreiung)",
    "text": "The end point of personal insolvency: the remaining debts are extinguished. The entry about it has been deleted after only six months since 2023 — if it stays longer, that is a clear case for deletion."
  },
  {
    "wort": "Returned direct debit (Rücklastschrift)",
    "text": "A bounced debit. It is not reported automatically, but costs fees and trust with the contractual partner — and repeated returns lead to terminations, which do end up in the report."
  },
  {
    "wort": "SCHUFA",
    "text": "Germany's largest credit bureau: data on around 68 million people, fed by banks, retailers and telecommunications providers. SCHUFA decides no applications — it delivers data and scores to its contractual partners."
  },
  {
    "wort": "Score class",
    "text": "Since March 2026 SCHUFA assigns every score to one of five classes: excellent (776–999), good (709–775), acceptable (642–708), sufficient (100–641), insufficient (open payment default, no point value). The class is the language in which contractual partners read the score."
  },
  {
    "wort": "Score",
    "text": "The statistical estimate of your probability of paying, as a number – at SCHUFA since March 2026 between 100 and 999 points from twelve published criteria. The features are known: payment history, negative features, enquiries, account landscape, age of history."
  },
  {
    "wort": "Self-disclosure (Selbstauskunft)",
    "text": "See data copy and own enquiry: your own free look at the stored data. How to read it — master data, markers, deadlines, duplicate reports — is in the checklist."
  },
  {
    "wort": "Storage period (Speicherfrist)",
    "text": "The time an entry may stand — not to be confused with the limitation of the claim. A paid claim stays visible for up to three years despite payment; a time-barred one may still be recorded. Two clocks, two rules."
  },
  {
    "wort": "Titled claim",
    "text": "A claim with a court title (judgment, enforcement order): enforceable for 30 years and reportable regardless of any dispute. The reason never to let the objection to a court payment order lapse."
  },
  {
    "wort": "Limitation (Verjährung)",
    "text": "The end of a claim's enforceability — for everyday claims usually three years to the end of the year. You do not have to pay what is time-barred, but you must INVOKE the limitation; nothing happens by itself."
  },
  {
    "wort": "Enforcement order (Vollstreckungsbescheid)",
    "text": "The second stage after the court payment order: the assertion becomes an enforceable title — attachable, valid for 30 years. Here too a 14-day period for the objection applies; after that it becomes laborious."
  },
  {
    "wort": "Written objection (Widerspruch)",
    "text": "Your formal no — against a claim (to creditor and debt collector), against a court payment order (to the court, 14 days) or against an entry (to the credit bureau). Always in writing, always verifiable, always with reasons."
  },
  {
    "wort": "Payment history",
    "text": "The chronicle of your payment behaviour — the memory of creditworthiness. It cannot be bought and cannot be faked, only built: with punctual instalments, well-run accounts and the time both need."
  }
];
