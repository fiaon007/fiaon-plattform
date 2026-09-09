// ═══════════════════════════════════════════════════════════════════════════
// ERZEUGT — NICHT VON HAND ÄNDERN.
// Quelle: shared/fiaon-seo-seiten.ts · Generator: scripts/seo-kurz-erzeugen.ts
//
// Die Kurzfassung der Seitentabelle für den Browser: nur Titel, Beschreibung,
// Sprache und Schwesterpfad. Die vollständige Tabelle mit Lead, Abschnitten,
// Fragen und Glossar bleibt auf dem Server — sie wäre im Bündel jeder Seite
// über 400 kB tote Fracht (Befund des Seobility-Berichts vom 02.09.2026).
// ═══════════════════════════════════════════════════════════════════════════

export interface SeoKurz { titel: string; beschreibung: string; sprache?: "de" | "en"; schwester?: string }

export const SEO_KURZ: Record<string, SeoKurz> = {
  "/": {"titel":"Bonität verstehen, Einträge löschen, Karte | FIAON","beschreibung":"FIAON holt Ihre SCHUFA-, KSV- oder CRIF-Auskunft, erklärt jeden Eintrag, versendet geprüfte Schreiben und bereitet Konto und Karte vor.","sprache":"de","schwester":"/en"},
  "/abo-kuendigen": {"titel":"Kündigung — FIAON","beschreibung":"Kündigen Sie Ihr FIAON-Abonnement."},
  "/agb": {"titel":"AGB von FIAON – Vertrag, Raten, Kündigung, Haftung","beschreibung":"Die Bedingungen für die Leistungen von FIAON: Vertragsschluss, zwölf Monatsraten, Zahlung per SEPA, Widerruf, Kündigung und Haftung."},
  "/als-kunde": {"titel":"Kundenansicht — FIAON","beschreibung":"Interne Ansicht des Kundenbereichs für Mitarbeiter."},
  "/antrag": {"titel":"Antrag stellen — FIAON","beschreibung":"Ihr Antrag bei FIAON in wenigen Schritten: Paket wählen, Angaben machen, Vertrag annehmen – und sofort in Ihrem Bereich."},
  "/app": {"titel":"Mein FIAON","beschreibung":"Ihr persönlicher FIAON-Bereich: Ziel, Stand und nächster Schritt."},
  "/app/demo": {"titel":"Mein FIAON — Demo-Ansicht","beschreibung":"Feste Vorführdaten des FIAON-Kundenbereichs, kein echtes Konto."},
  "/app/login": {"titel":"Anmelden — Mein FIAON","beschreibung":"Melden Sie sich in Ihrem FIAON-Kundenbereich an."},
  "/auskunfteien": {"titel":"Auskunfteien im Vergleich: SCHUFA, KSV1870, CRIF","beschreibung":"SCHUFA, KSV1870 und CRIF im Überblick: wer was speichert, welche Rechte gelten und wo die Regelwerke in DE, AT und CH auseinandergehen.","sprache":"de","schwester":"/en/credit-bureaus"},
  "/banking": {"titel":"Girokonto trotz negativem Eintrag — FIAON","beschreibung":"Das Basiskonto steht Ihnen per Gesetz zu – auch mit Eintrag."},
  "/banking/dashboard": {"titel":"Investoren-Banking — FIAON","beschreibung":"Geschützter Bereich."},
  "/bonitaet": {"titel":"SCHUFA-Vollauskunft am selben Werktag — FIAON","beschreibung":"Ihre vollständige Auskunft mit Erklärung: welcher Eintrag woher stammt, wie lange er bleibt, welcher angreifbar ist. Durch FIAON beantragt, 74 € einmalig."},
  "/bonitaet-antrag": {"titel":"Bonitätsauskunft beantragen — FIAON","beschreibung":"Beantragen Sie Ihre geprüfte Bonitätsauskunft bei FIAON."},
  "/bonitaet-danke": {"titel":"Vielen Dank — FIAON","beschreibung":"Ihre Anfrage ist bei uns eingegangen."},
  "/bonitaet-service": {"titel":"Bonitäts-Auszug: Erklärung des Service — FIAON","beschreibung":"Was der Bonitäts-Auszug über FIAON leistet: Beschaffung bei SCHUFA, KSV oder CRIF, Erklärung jedes Eintrags und der nächste Schritt für jeden Eintrag."},
  "/bonitaet-verbessern": {"titel":"Bonität verbessern · Die Hebel nach Wirkung geordnet","beschreibung":"Welche Hebel wirklich wirken, welche Monate brauchen und welche nichts bringen – mit 90-Tage-Plan und kostenlosen Werkzeugen.","sprache":"de","schwester":"/en/strengthen-your-credit-file"},
  "/bonitaetsauskunft-beantragen": {"titel":"Bonitätsauskunft beantragen: kostenlos oder geprüft","beschreibung":"Bonitätsauskunft kostenlos nach Art. 15 DSGVO selbst anfordern oder für 74 € geprüft beschaffen lassen: Ablauf, Unterschied, nächster Schritt.","sprache":"de","schwester":"/en/request-your-credit-report"},
  "/business": {"titel":"Firmenkreditkarte & Unternehmensbonität – FIAON Business","beschreibung":"Firmenkreditkarte mit Zahlungsziel und saubere Unternehmensbonität: FIAON beschafft die Auskunft, bereinigt Einträge, bereitet Kartenanträge vor.","sprache":"de","schwester":"/en/business"},
  "/business-antrag": {"titel":"Firmenantrag — FIAON Business","beschreibung":"Ihr Firmenantrag bei FIAON: Unternehmen, Rechtsform, Inhaber, Wunschrahmen – in drei Minuten."},
  "/cookie-einstellungen": {"titel":"Cookie-Einstellungen — FIAON","beschreibung":"Entscheiden Sie selbst, welche Cookies gesetzt werden. Notwendige Cookies lassen sich nicht abwählen, alle anderen jederzeit widerrufen."},
  "/datenraum": {"titel":"Datenraum: Due Diligence auf Anfrage — FIAON","beschreibung":"FIAON wird geführt, als würde morgen verkauft: Entscheidungsregister, Logbuch, Kennzahlen, Verträge und Technik-Dokumentation – auf Anfrage unter NDA."},
  "/datenschutz": {"titel":"Datenschutzerklärung — FIAON","beschreibung":"Welche Daten FIAON verarbeitet, auf welcher Rechtsgrundlage, wie lange wir sie speichern und welche Rechte Sie nach der DSGVO haben – bis zur Löschung."},
  "/demo": {"titel":"Demo-Konto: der Kundenbereich, durchgespielt — FIAON","beschreibung":"Der FIAON-Kundenbereich im besten Fall – mit Platzhalterdaten – und die Sicht des Mitarbeiters im Startgespräch. Kein Login, keine echten Daten."},
  "/demo/kundenbereich": {"titel":"Demo-Kundenbereich — FIAON","beschreibung":"Der Kundenbereich mit Platzhalterdaten."},
  "/demo/produkt": {"titel":"Produkt-Demo — FIAON","beschreibung":"Die Produktansicht von FIAON."},
  "/eintrag-verjaehrung": {"titel":"SCHUFA-Eintrag und Verjährung: alle Fristen erklärt","beschreibung":"Wann ein SCHUFA-Eintrag verschwinden muss: Verjährungs-Checker, alle Speicherfristen je Eintragsart, berechtigt oder unberechtigt, der Weg bei Verfristung.","sprache":"de","schwester":"/en/entries-and-limitation"},
  "/en": {"titel":"Credit reports in English: SCHUFA, KSV1870, CRIF","beschreibung":"FIAON obtains your SCHUFA, KSV1870 or CRIF report, explains every entry in English, sends reviewed letters and prepares your account.","sprache":"en","schwester":"/"},
  "/en/about": {"titel":"About FIAON: history, milestones and principles","beschreibung":"Who is behind FIAON, what has happened since 2025, and which principles the company holds to. Registered in London, data in Frankfurt.","sprache":"en","schwester":"/ueber-uns"},
  "/en/austria": {"titel":"FIAON in Austria: KSV1870, CRIF and your rights","beschreibung":"KSV1870, CRIF and the banks' warning lists explained: free self-disclosure, your GDPR rights in Austria, and how FIAON prepares account and card.","sprache":"en","schwester":"/oesterreich"},
  "/en/book-a-call": {"titel":"Book a call: 15 minutes with a person, free | FIAON","beschreibung":"Talk to a person before you decide. Pick a time slot, we call back on the next working day at the latest. Free and without obligation.","sprache":"en","schwester":"/termin"},
  "/en/business": {"titel":"FIAON Business: company card, payment terms, clean file","beschreibung":"Company card with up to 58 days of payment terms. FIAON obtains the credit reports, sorts out wrong entries and prepares a clean file.","sprache":"en","schwester":"/business"},
  "/en/careers": {"titel":"Careers at FIAON: remote in DACH, employed or freelance","beschreibung":"Working at FIAON: employed or freelance, remote in Germany, Austria and Switzerland. Seven areas, academy before the first customer call.","sprache":"en","schwester":"/karriere"},
  "/en/compare": {"titel":"FIAON, a lawyer, a score app or yourself? The comparison","beschreibung":"SCHUFA entry deleted: FIAON, a lawyer, a score app or doing it yourself. An honest comparison of cost, duration and follow-up.","sprache":"en","schwester":"/vergleich"},
  "/en/contact": {"titel":"Contact & support: phone, e-mail, assistant, urgent matters","beschreibung":"FIAON support: phone +41 44 244 93 01, e-mail support@fiaon.com. An assistant that knows the platform, and a direct line to the management.","sprache":"en","schwester":"/kontakt"},
  "/en/credit-bureaus": {"titel":"SCHUFA, KSV1870, CRIF: credit bureaus compared | FIAON","beschreibung":"Who stores what in Germany, Austria and Switzerland: your rights, deletion deadlines and how SCHUFA, KSV1870 and CRIF differ.","sprache":"en","schwester":"/auskunfteien"},
  "/en/credit-card": {"titel":"Credit card despite a SCHUFA entry: the route via your file","beschreibung":"Which card is realistic despite a SCHUFA entry, how the limit grows over twelve months and what issuers see. The bank decides on card and limit.","sprache":"en","schwester":"/kreditkarte"},
  "/en/credit-glossary": {"titel":"Credit glossary: every term explained | FIAON","beschreibung":"Score class, data copy, deletion period, court payment order: the credit glossary explains every term in plain language and links to the topic page.","sprache":"en","schwester":"/glossar-bonitaet"},
  "/en/current-account-despite-poor-credit": {"titel":"Current account despite poor credit: honest route | FIAON","beschreibung":"A current account despite a poor credit record: what is achievable, what an active account builds, and what nobody can promise.","sprache":"en","schwester":"/girokonto-trotz-negativer-bonitaet"},
  "/en/debt-collection-letter": {"titel":"Debt collection letter? Check first, then pay | FIAON","beschreibung":"Received a debt collection letter? The calm five-step plan: check the claim, work out the costs, keep the deadlines, prevent an entry.","sprache":"en","schwester":"/inkasso-brief-erhalten"},
  "/en/delete-a-schufa-entry": {"titel":"Delete a SCHUFA entry: deadlines, rights, next steps","beschreibung":"Which SCHUFA entries can be challenged, how long each one may stay on file, and the four steps to a written deletion request.","sprache":"en","schwester":"/schufa-eintrag-loeschen"},
  "/en/entries-and-limitation": {"titel":"SCHUFA entries and limitation: all the deadlines | FIAON","beschreibung":"When a SCHUFA entry has to disappear: the expiry checker, every storage period per entry type and the route when a deadline has run out.","sprache":"en","schwester":"/eintrag-verjaehrung"},
  "/en/guide": {"titel":"Guide: SCHUFA, credit standing and collection | FIAON","beschreibung":"Deleting an entry, requesting your data copy free of charge, a card despite an entry, KSV and CRIF – checked guides, honest and without promises.","sprache":"en","schwester":"/ratgeber"},
  "/en/help": {"titel":"Help centre: answers on application, payment and report","beschreibung":"Application, payment, report, letters, account and card, cancellation, privacy and jobs: the FIAON help centre answers the common questions.","sprache":"en","schwester":"/hilfe"},
  "/en/how-fiaon-works": {"titel":"FIAON reviews: the process explained honestly","beschreibung":"Bank-confirmed figures, the process in three steps, what we do not promise, and a seriousness check that works on any provider.","sprache":"en","schwester":"/fiaon-erfahrungen"},
  "/en/how-the-platform-works": {"titel":"How the FIAON platform works, from report to card","beschreibung":"How the FIAON platform works: three layers, the route from application to card, three countries – and what it is not.","sprache":"en","schwester":"/plattform-konzept"},
  "/en/instalments-and-credit-file": {"titel":"Instalments and your credit file: strongest lever | FIAON","beschreibung":"How instalments shape your credit file: the twelve-month logic, the four stages of arrears and six habits that keep payments on time.","sprache":"en","schwester":"/ratenzahlung-und-bonitaet"},
  "/en/loans-without-schufa": {"titel":"Loans without SCHUFA: what is really behind them","beschreibung":"What genuinely exists, what it costs, how to spot fraud in seconds, and why putting your credit file in order is the better route.","sprache":"en","schwester":"/kredit-ohne-schufa"},
  "/en/partners": {"titel":"Become a partner: banks, credit bureaus, introducers | FIAON","beschreibung":"For banks, credit bureaus, creditors and introducers: FIAON hands you a repaired, documented customer file – with consent.","sprache":"en","schwester":"/partner"},
  "/en/personal": {"titel":"Personal credit file, account and card | FIAON","beschreibung":"For personal customers: FIAON obtains your credit report, explains every entry, sends the approved letters and prepares account and card.","sprache":"en","schwester":"/privatkunden"},
  "/en/press": {"titel":"Press: FIAON facts, figures, imagery, contact","beschreibung":"FIAON in the media: a short profile, figures we can put on the record, interview topics, press imagery and a direct contact for journalists.","sprache":"en","schwester":"/presse"},
  "/en/pricing": {"titel":"Pricing and plans: twelve instalments, no surprises | FIAON","beschreibung":"What FIAON costs: four plans in twelve monthly instalments, or the credit report alone. Plus what doing the same work yourself costs.","sprache":"en","schwester":"/preise"},
  "/en/reading-your-credit-report": {"titel":"Reading your credit report: 10-point checklist | FIAON","beschreibung":"Understand your credit report: the interactive 10-point checklist, the 5 most common mistakes and an explained sample extract. Check your report now.","sprache":"en","schwester":"/selbstauskunft-checkliste"},
  "/en/request-your-credit-report": {"titel":"Requesting your credit report: free or reviewed | FIAON","beschreibung":"The free route under Art. 15 GDPR beside the reviewed FIAON route for €74: obtaining, plain-language explanation, every entry checked.","sprache":"en","schwester":"/bonitaetsauskunft-beantragen"},
  "/en/schufa-neutral-enquiries": {"titel":"SCHUFA-neutral enquiries: how to do it right | FIAON","beschreibung":"Ask a bank about a loan without touching your score: conditions enquiry or loan enquiry, the right sentence, and what stays in your file.","sprache":"en","schwester":"/schufa-neutral-anfragen"},
  "/en/schufa-score": {"titel":"Understanding the SCHUFA score: new scale 100–999, table","beschreibung":"The new SCHUFA score since March 2026: a scale from 100 to 999, five classes, twelve criteria with points, as a table with the levers behind it.","sprache":"en","schwester":"/schufa-score-verstehen"},
  "/en/security": {"titel":"Privacy & security: how FIAON handles your credit data","beschreibung":"EU hosting, encryption, authorisation, your approval before every letter, deletion on request. Plus a privacy check: who may see your credit file?","sprache":"en","schwester":"/sicherheit"},
  "/en/status": {"titel":"FIAON status: availability, data location, incidents","beschreibung":"Live status of the FIAON platform: availability, data location in Frankfurt, encryption, maintenance and every known incident.","sprache":"en","schwester":"/status"},
  "/en/strengthen-your-credit-file": {"titel":"Strengthening your credit file: the levers ranked by effect","beschreibung":"Which levers on your credit file really work, which take months, which do nothing, and what the 90-day plan tackles first.","sprache":"en","schwester":"/bonitaet-verbessern"},
  "/en/switzerland": {"titel":"FIAON in Switzerland: enforcement register, CRIF, Intrum","beschreibung":"Debt enforcement register extract, CRIF and Intrum explained, access under Art. 25 DSG, blocking unjustified enforcements, and the path to a card.","sprache":"en","schwester":"/schweiz"},
  "/en/team": {"titel":"FIAON team: the people you reach by phone","beschreibung":"Who answers when you call FIAON: sales, onboarding and collections, three shareholders in daily operations and an investor in Zurich.","sprache":"en","schwester":"/team"},
  "/en/tools": {"titel":"Free SCHUFA and credit tools — FIAON","beschreibung":"Twenty free calculators, checkers and letter generators on SCHUFA, credit files, debt collection and loans: deletion request, deadlines, debt plan.","sprache":"en","schwester":"/werkzeuge"},
  "/en/tools/attachment-calculator": {"titel":"Attachment calculator 2026: exempt amount and P-Konto","beschreibung":"Enter net income and maintenance obligations: what an attachment may take, what is left exempt, what a P-Konto protects. 2026 values.","sprache":"en","schwester":"/werkzeuge/pfaendungsrechner"},
  "/en/tools/basic-account": {"titel":"Basic account refused or no reply? The helper | FIAON","beschreibung":"Refused a basic account, or no reply at all? The helper counts the ten-day deadline under Section 33 ZKG and drafts reminder and BaFin letter.","sprache":"en","schwester":"/werkzeuge/basiskonto"},
  "/en/tools/business-card-check": {"titel":"Business card check: what is missing before you apply","beschreibung":"Check legal form, company age, annual accounts, business account and entries – the check names the gaps in the order they are best closed.","sprache":"en","schwester":"/werkzeuge/firmenkarte"},
  "/en/tools/business-credit-index": {"titel":"Business credit index reader: what your rating means","beschreibung":"Enter an index from 100 to 600 – the reader gives the class, the probability of default and the features that carry the most weight.","sprache":"en","schwester":"/werkzeuge/bonitaetsindex"},
  "/en/tools/business-credit-report": {"titel":"Business credit report: who holds what on your company","beschreibung":"The guide names the relevant credit agencies, the access right that applies to company and owner – and drafts the letter.","sprache":"en","schwester":"/werkzeuge/firmenauskunft"},
  "/en/tools/card-check": {"titel":"Card check: which credit option is realistic | FIAON","beschreibung":"Five details, no credit bureau enquiry: an honest read on which card is realistic today and what opens the next step. Free, no sign-up.","sprache":"en","schwester":"/werkzeuge/karten-check"},
  "/en/tools/card-costs": {"titel":"Card cost comparison: deposit, prepaid or debit? | FIAON","beschreibung":"Deposit, prepaid or debit card: compare fees, top-up charges and the deposit lying idle over three years, and see what each card delivers.","sprache":"en","schwester":"/werkzeuge/kartenkosten"},
  "/en/tools/check-my-entry": {"titel":"Can my entry be challenged? Five questions, one answer","beschreibung":"Five questions on your SCHUFA, KSV1870 or CRIF entry: can it be challenged under Section 31 BDSG, or does it stand? A free, honest answer.","sprache":"en","schwester":"/werkzeuge/eintrag-pruefen"},
  "/en/tools/court-payment-order": {"titel":"Court payment order deadline: object by when? | FIAON","beschreibung":"Served with a Mahnbescheid? Enter the date and the calculator names the last day to object (Sections 694, 700 ZPO) and what to tick. Free.","sprache":"en","schwester":"/werkzeuge/mahnbescheid"},
  "/en/tools/debt-check": {"titel":"Debt check: am I over-indebted? | FIAON","beschreibung":"Enter income, expenses and instalments – an honest assessment with debt ratio, free income and next steps. If serious: free debt counselling first.","sprache":"en","schwester":"/werkzeuge/schulden-check"},
  "/en/tools/debt-collection-costs": {"titel":"Debt collection cost checker: are the fees too high? | FIAON","beschreibung":"Enter principal claim and costs demanded – the checker recalculates the permissible fees under the RVG and Section 13e RDG and drafts the rejection.","sprache":"en","schwester":"/werkzeuge/inkassokosten"},
  "/en/tools/debt-consolidation": {"titel":"Debt consolidation calculator: combine loans, save | FIAON","beschreibung":"Enter your loans and overdraft and see both routes: keep paying, or combine into one loan. Includes the early repayment fee under Section 500 BGB.","sprache":"en","schwester":"/werkzeuge/umschuldung"},
  "/en/tools/debt-free-plan": {"titel":"Debt-free plan: avalanche or snowball? Calculator | FIAON","beschreibung":"Enter up to six debts and your budget: the calculator compares avalanche and snowball month by month – date, interest, payoff order.","sprache":"en","schwester":"/werkzeuge/schuldenplan"},
  "/en/tools/deletion-deadline": {"titel":"Deletion deadline calculator: when is my SCHUFA entry gone?","beschreibung":"Enter the type of entry and the key dates. The calculator names the deletion deadline to the day and shows when an early challenge is possible.","sprache":"en","schwester":"/werkzeuge/loeschfrist"},
  "/en/tools/deletion-request": {"titel":"Deletion request and objection against a SCHUFA entry","beschreibung":"Deletion request under Article 17 GDPR and objection under Section 31 BDSG: pick the reason, enter the facts, get two German letters.","sprache":"en","schwester":"/werkzeuge/widerspruch"},
  "/en/tools/early-payment-discount": {"titel":"Early payment discount calculator: what 2 % is really worth","beschreibung":"Enter the discount rate, period and payment term – the calculator gives the effective annual rate and sets it against your overdraft.","sprache":"en","schwester":"/werkzeuge/skonto"},
  "/en/tools/instalment-plan": {"titel":"Agreeing instalments: calculator and offer letter | FIAON","beschreibung":"Enter the claim and your headroom. The calculator names an instalment that holds, the term, and writes the German offer letter to the creditor.","sprache":"en","schwester":"/werkzeuge/ratenplan"},
  "/en/tools/late-payment-interest": {"titel":"Late payment calculator for companies: interest and 40 euro","beschreibung":"Enter the amount and the dates – the calculator gives interest at nine points above base rate, the 40-euro fixed sum and the demand text.","sprache":"en","schwester":"/werkzeuge/verzugszinsen"},
  "/en/tools/limitation-check": {"titel":"Limitation check: is an old claim time-barred? | FIAON","beschreibung":"Due date, court title, last acknowledgement: the check names the limitation date under the BGB and gives you the German wording for the plea.","sprache":"en","schwester":"/werkzeuge/verjaehrung"},
  "/en/tools/loan-calculator": {"titel":"Loan calculator: monthly instalment and total cost | FIAON","beschreibung":"Work out the monthly instalment, total cost and interest share of a loan, then see the same loan at the two-thirds rate.","sprache":"en","schwester":"/werkzeuge/kreditrechner"},
  "/en/tools/monthly-headroom": {"titel":"Monthly headroom calculator: income and fixed costs | FIAON","beschreibung":"Enter your income and fixed costs. The calculator shows what is left each month, and what a bank reads from that figure. Free, no sign-up.","sprache":"en","schwester":"/werkzeuge/spielraum"},
  "/en/tools/overdraft-calculator": {"titel":"Overdraft calculator: what the minus costs | FIAON","beschreibung":"Enter your balance and rate: see what a permanent minus costs over a year, how long a fixed monthly reduction takes, which exit saves more.","sprache":"en","schwester":"/werkzeuge/dispo-rechner"},
  "/en/tools/reminder-fees": {"titel":"Reminder fees: how much may a creditor charge?","beschreibung":"Enter how many reminders you had and what each one cost. The checker shows what Sections 286 and 288 BGB allow and drafts your reply.","sprache":"en","schwester":"/werkzeuge/mahngebuehren"},
  "/en/tools/reply-to-debt-collector": {"titel":"Reply to the debt collector: dispute, demand evidence","beschreibung":"Received a debt collection letter? Choose your situation – the generator writes the German reply: evidence under Section 13a RDG, costs, limitation.","sprache":"en","schwester":"/werkzeuge/inkasso-antwort"},
  "/en/tools/request-your-data-copy": {"titel":"Data copy request generator: your free credit report | FIAON","beschreibung":"Generate the finished letter for your free data copy under Article 15 GDPR: to SCHUFA, KSV1870, CRIF or Intrum. Copy, print, sign, send.","sprache":"en","schwester":"/werkzeuge/selbstauskunft"},
  "/en/transparency": {"titel":"Transparency report: FIAON figures with definition and date","beschreibung":"What FIAON measures, how each number is defined and when it was counted: paying customers, instalments, countries, tools and guides.","sprache":"en","schwester":"/transparenz"},
  "/en/what-is-fiaon": {"titel":"What is FIAON? The operating system for creditworthiness","beschreibung":"What FIAON is: one operating system for your creditworthiness. See your SCHUFA, KSV1870 or CRIF file, correct it, then open account and card.","sprache":"en","schwester":"/was-ist-fiaon"},
  "/fiaon-erfahrungen": {"titel":"FIAON Erfahrungen: Zahlen, Ablauf, Grenzen – ehrlich","beschreibung":"FIAON Erfahrungen: bankbestätigte Zahlen, der Ablauf in drei Schritten, die Grenzen – und ein Check aus sechs Fragen für jeden Anbieter.","sprache":"de","schwester":"/en/how-fiaon-works"},
  "/girokonto-trotz-negativer-bonitaet": {"titel":"Girokonto trotz negativer Bonität: der ehrliche Weg","beschreibung":"Girokonto trotz negativer Bonität: was erreichbar ist, was ein geführtes Konto aufbaut, Basiskonto oder FIAON-Weg – ohne leere Versprechen.","sprache":"de","schwester":"/en/current-account-despite-poor-credit"},
  "/glossar-bonitaet": {"titel":"Bonitäts-Glossar: alle Begriffe von A bis Z erklärt","beschreibung":"Von Anfrage bis Zahlungshistorie: das Bonitäts-Glossar erklärt jeden Begriff in Klartext – Score-Klasse, Datenkopie, Löschfrist, Mahnbescheid.","sprache":"de","schwester":"/en/credit-glossary"},
  "/hilfe": {"titel":"Hilfe-Center: Antworten zu Antrag, Zahlung und Auskunft","beschreibung":"Die häufigen Fragen zu Antrag, Zahlung, Auskunft, Schreiben, Konto und Kündigung – kurz beantwortet, mit Suche im FIAON-Hilfe-Center.","sprache":"de","schwester":"/en/help"},
  "/impressum": {"titel":"Impressum: FIAON LTD, London – Anbieterkennzeichnung","beschreibung":"Anbieterkennzeichnung von fiaon.com: FIAON LTD, London, Registernummer 17318250, Vertretung, Kontakt und Verbraucherstreitbeilegung."},
  "/inkasso-brief-erhalten": {"titel":"Inkasso-Brief erhalten? Erst prüfen, dann zahlen","beschreibung":"Inkasso-Brief erhalten? So prüfen Sie Forderung, Kosten und Fristen – und halten einen SCHUFA-Eintrag auf, bevor Sie zahlen.","sprache":"de","schwester":"/en/debt-collection-letter"},
  "/investoren": {"titel":"Investoren: das Modell hinter FIAON und der Datenraum","beschreibung":"Für Investoren: der Platz zwischen Auskunftei und Bank, das Modell dahinter, drei Erlösquellen, vier Kennzahlen und der Datenraum unter NDA."},
  "/justin": {"titel":"Termin mit Justin Schwarzott, Gründer von FIAON","beschreibung":"Wählen Sie eine Zeit – Justin Schwarzott ruft Sie an. 30 Minuten, telefonisch, höchstens drei Gespräche am Tag. Für Partner, Investoren, Presse und Kunden."},
  "/karriere": {"titel":"Karriere bei FIAON: remote in DACH, fest oder frei","beschreibung":"Arbeiten bei FIAON: fest oder frei, remote im DACH-Raum. Sieben Bereiche, Academy vor dem ersten Kundengespräch, Bewerbung in vier Schritten.","sprache":"de","schwester":"/en/careers"},
  "/karte-sichern": {"titel":"Karte sichern — FIAON","beschreibung":"Sichern Sie sich Ihre Karte über FIAON."},
  "/kontakt": {"titel":"Kontakt zu FIAON: Telefon, E-Mail und Rückruf","beschreibung":"Telefon +41 44 244 93 01, support@fiaon.com oder Rückruf: Sie erreichen einen Menschen, der Ihre Akte kennt – werktags, ohne Warteschleife.","sprache":"de","schwester":"/en/contact"},
  "/kredit-ohne-schufa": {"titel":"Kredit ohne SCHUFA: Was wirklich dahintersteckt","beschreibung":"Kredit ohne SCHUFA: welche Angebote seriös sind, was sie kosten, woran Sie Betrug erkennen – und warum die Auskunft der bessere Weg ist.","sprache":"de","schwester":"/en/loans-without-schufa"},
  "/kreditkarte": {"titel":"Kreditkarte trotz SCHUFA-Eintrag: der ehrliche Weg","beschreibung":"Welche Karte trotz Eintrag heute realistisch ist, wie der Rahmen in zwölf Monaten wächst und was Herausgeber sehen. Die Bank entscheidet.","sprache":"de","schwester":"/en/credit-card"},
  "/login": {"titel":"Anmelden — FIAON","beschreibung":"Melden Sie sich in Ihrem FIAON-Kundenbereich an."},
  "/mein-bereich": {"titel":"Mein Bereich — FIAON","beschreibung":"Ihr persönlicher Bereich bei FIAON."},
  "/oesterreich": {"titel":"Bonität in Österreich: KSV1870, CRIF, Ihre Rechte","beschreibung":"Bonität in Österreich: KSV1870 und CRIF erklärt, Datenkopie nach Art. 15 DSGVO, Löschfristen, Warnliste der Banken. FIAON bereinigt Einträge.","sprache":"de","schwester":"/en/austria"},
  "/partner": {"titel":"Partner werden: Banken, Auskunfteien, Inkasso, Vermittler","beschreibung":"Für Banken, Kartenherausgeber, Auskunfteien, Inkasso und Vermittler: FIAON übergibt Kunden mit geprüfter Bonität und mit deren Einwilligung.","sprache":"de","schwester":"/en/partners"},
  "/passwort-vergessen": {"titel":"Passwort vergessen — FIAON","beschreibung":"Setzen Sie Ihr Passwort für den FIAON-Kundenbereich zurück."},
  "/plattform-konzept": {"titel":"Plattform-Konzept: So funktioniert FIAON im Überblick","beschreibung":"Wie die FIAON-Plattform aufgebaut ist: drei Schichten, der Weg von der Auskunft bis zur Karte, Rechte in DACH und was bewusst nicht dazugehört.","sprache":"de","schwester":"/en/how-the-platform-works"},
  "/preise": {"titel":"Preise & Pakete: FIAON ab 7,99 € im Monat","beschreibung":"Alle Preise und Pakete auf einen Blick: Start, Pro, Ultra, High-End, Business. Was enthalten ist, was es kostet, was Selbermachen kostet.","sprache":"de","schwester":"/en/pricing"},
  "/presse": {"titel":"Presse: Fakten, Bildmaterial und Ansprechpartner","beschreibung":"Pressebereich von FIAON: Kurzprofil, Themen für Interviews, Bildmaterial auf Anfrage und ein Ansprechpartner, der am selben Werktag antwortet.","sprache":"de","schwester":"/en/press"},
  "/privacy": {"titel":"Datenschutzerklärung: Zweck, Fristen und Ihre Rechte","beschreibung":"Welche Daten FIAON erhebt, wozu, auf welcher Rechtsgrundlage, wie lange wir speichern und welche Rechte Sie nach der DSGVO haben."},
  "/privatkunden": {"titel":"Bonität verbessern & Kreditkarte für Privatkunden","beschreibung":"Einträge bereinigen, Girokonto eröffnen, Kreditkarte bis 25.000 €: FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, versendet die Schreiben.","sprache":"de","schwester":"/en/personal"},
  "/ratenzahlung-und-bonitaet": {"titel":"Ratenzahlung und Bonität: Ihr stärkster Hebel","beschreibung":"Wie Ratenzahlung auf Bonität wirkt: zwölf Monatsraten, die vier Stufen bei Rückstand und der Zahlungskalender im Kundenbereich.","sprache":"de","schwester":"/en/instalments-and-credit-file"},
  "/ratgeber": {"titel":"Ratgeber: SCHUFA, Bonität, Inkasso erklärt | FIAON","beschreibung":"Ratgeber zu SCHUFA, KSV1870 und CRIF: Einträge verstehen, Auskunft kostenlos anfordern, Bonität einordnen. Geprüft, ohne leere Versprechen.","sprache":"de","schwester":"/en/guide"},
  "/schufa-eintrag-loeschen": {"titel":"SCHUFA-Eintrag löschen lassen: Fristen, Rechte, Weg","beschreibung":"SCHUFA-Eintrag löschen lassen: welche Einträge angreifbar sind, welche Fristen laufen, welche Rechte Sie haben, der Weg in vier Schritten.","sprache":"de","schwester":"/en/delete-a-schufa-entry"},
  "/schufa-neutral-anfragen": {"titel":"SCHUFA-neutral anfragen: Konditions- statt Kreditanfrage","beschreibung":"Konditionsanfrage statt Kreditanfrage: der Unterschied, der eine Satz für die Bank und was in Ihrer Auskunft gespeichert bleibt.","sprache":"de","schwester":"/en/schufa-neutral-enquiries"},
  "/schufa-score-verstehen": {"titel":"SCHUFA-Score verstehen: neue Skala 100–999, Tabelle","beschreibung":"Der neue SCHUFA-Score seit März 2026: Skala 100 bis 999, fünf Klassen, zwölf Kriterien mit Punkten – als Tabelle erklärt, mit den Hebeln dahinter.","sprache":"de","schwester":"/en/schufa-score"},
  "/schweiz": {"titel":"Bonität in der Schweiz: Betreibungsregister, CRIF, Intrum","beschreibung":"Bonität in der Schweiz: Betreibungsregisterauszug, CRIF und Intrum erklärt, Nichtbekanntgabe nach Art. 8a SchKG, Auskunft nach Art. 25 DSG.","sprache":"de","schwester":"/en/switzerland"},
  "/scp-datenraum": {"titel":"Datenraum","beschreibung":"Vertraulicher Zugang."},
  "/selbstauskunft-checkliste": {"titel":"Selbstauskunft lesen: die 10-Punkte-Checkliste","beschreibung":"Selbstauskunft lesen und verstehen: zehn Punkte in fester Reihenfolge, die fünf häufigsten Fehler und was Sie tun, wenn ein Eintrag falsch ist.","sprache":"de","schwester":"/en/reading-your-credit-report"},
  "/sicherheit": {"titel":"Datenschutz & Sicherheit bei FIAON: Wer darf was?","beschreibung":"Wie FIAON Ihre Bonitätsdaten schützt: Server in Frankfurt, Vollmacht vor jeder Auskunft, Freigabe vor jedem Schreiben, Löschung auf Wunsch.","sprache":"de","schwester":"/en/security"},
  "/start": {"titel":"Start — FIAON","beschreibung":"Ihr Einstieg bei FIAON."},
  "/status": {"titel":"FIAON Status: Verfügbarkeit, Datenstandort, Störungen","beschreibung":"Läuft FIAON gerade? Live-Prüfung, Datenstandort Frankfurt, Verschlüsselung, Regeln für Wartung und die Liste bekannter Störungen – prüfbar.","sprache":"de","schwester":"/en/status"},
  "/team": {"titel":"Das Team hinter FIAON: Gründer, Vertrieb, Onboarding","beschreibung":"Wer hinter FIAON steht: Justin Schwarzott als Gründer, Florentine Lombardi im Onboarding, Daniel Stripling im Vertrieb – und das Team am Telefon.","sprache":"de","schwester":"/en/team"},
  "/termin": {"titel":"Startgespräch buchen: 15 Minuten mit einem Menschen","beschreibung":"Lieber erst reden? Zeitfenster wählen – ein Mitarbeiter ruft Sie an, erklärt, was Ihre Auskunft hergibt und welches Paket passt. Kostenlos.","sprache":"de","schwester":"/en/book-a-call"},
  "/terms": {"titel":"Allgemeine Geschäftsbedingungen — FIAON","beschreibung":"Die Bedingungen für die Nutzung dieser Website und des Kundenbereichs."},
  "/transparenz": {"titel":"FIAON Transparenzbericht: Zahlen mit Definition, Stand","beschreibung":"Was FIAON misst und veröffentlicht: zahlende Kunden, bezahlte Raten, Länder, Werkzeuge, Ratgeber – bankbestätigt, mit Definition und Stand.","sprache":"de","schwester":"/en/transparency"},
  "/ueber-uns": {"titel":"Über FIAON: Geschichte, Meilensteine und Haltung","beschreibung":"Warum es FIAON gibt, welche Meilensteine seit der Gründung zählen und woran sich das Haus hält. Die Geschichte in Daten statt Werbeworten.","sprache":"de","schwester":"/en/about"},
  "/vereinbarung": {"titel":"Vertrauliches Dokument — FIAON","beschreibung":"Diese Seite ist geschützt."},
  "/vergleich": {"titel":"Vergleich: FIAON, Anwalt, Score-App oder selbst machen","beschreibung":"SCHUFA-Eintrag löschen lassen: FIAON, Anwalt, Score-App oder selbst im ehrlichen Vergleich – Kosten, Dauer, Verfolgung, Konto danach.","sprache":"de","schwester":"/en/compare"},
  "/was-ist-fiaon": {"titel":"Was ist FIAON? Einsicht, Aktion, Zugang erklärt","beschreibung":"Von der ersten Auskunft bis zum bereinigten Eintrag: Wie FIAON arbeitet, was in jedem Schritt passiert und woran Sie erkennen, dass es vorangeht.","sprache":"de","schwester":"/en/what-is-fiaon"},
  "/werkzeuge": {"titel":"SCHUFA und Bonität: kostenlose Werkzeuge | FIAON","beschreibung":"Zwanzig kostenlose Rechner, Prüfer und Briefe zu SCHUFA, Bonität, Inkasso und Kredit: Löschantrag, Fristen, Pfändung, Dispo, Schuldenplan.","sprache":"de","schwester":"/en/tools"},
  "/werkzeuge/basiskonto": {"titel":"Basiskonto abgelehnt oder keine Antwort? Der Helfer","beschreibung":"Basiskonto beantragt? Der Helfer rechnet die Zehn-Tage-Frist (§ 33 ZKG), nennt die zulässigen Ablehnungsgründe und den Weg zur BaFin (§ 48 ZKG).","sprache":"de","schwester":"/en/tools/basic-account"},
  "/werkzeuge/bonitaetsindex": {"titel":"Bonitätsindex-Deuter: Was Ihre Firmennote bedeutet","beschreibung":"Bonitätsindex von 100 bis 600 eingeben – der Deuter nennt Klasse, Ausfallwahrscheinlichkeit und die Merkmale mit dem größten Gewicht.","sprache":"de","schwester":"/en/tools/business-credit-index"},
  "/werkzeuge/dispo-rechner": {"titel":"Dispo-Rechner: Was die Dauer im Minus wirklich kostet","beschreibung":"Dispo-Stand und Zins eingeben – der Rechner zeigt, was das Minus im Jahr kostet, was ein Ratenkredit spart und wie lange der Abbau dauert.","sprache":"de","schwester":"/en/tools/overdraft-calculator"},
  "/werkzeuge/eintrag-pruefen": {"titel":"Ist mein SCHUFA-Eintrag angreifbar? Kurzprüfung","beschreibung":"Fünf Fragen zum SCHUFA-, KSV- oder CRIF-Eintrag: Die Kurzprüfung zeigt, ob er angreifbar, verfristet oder berechtigt ist. Ohne Anmeldung.","sprache":"de","schwester":"/en/tools/check-my-entry"},
  "/werkzeuge/firmenauskunft": {"titel":"Firmenauskunft: Wer was über Ihr Unternehmen speichert","beschreibung":"Der Fahrplan nennt die zuständigen Auskunfteien, das anwendbare Auskunftsrecht für Firma und Inhaber – und formuliert das Schreiben.","sprache":"de","schwester":"/en/tools/business-credit-report"},
  "/werkzeuge/firmenkarte": {"titel":"Firmenkarten-Check: Was vor dem Antrag noch fehlt","beschreibung":"Rechtsform, Alter, Jahresabschluss, Geschäftskonto und Einträge prüfen – der Check nennt die Lücken in der Reihenfolge zum Abarbeiten.","sprache":"de","schwester":"/en/tools/business-card-check"},
  "/werkzeuge/inkasso-antwort": {"titel":"Inkasso-Antwortbrief: bestreiten, Nachweise verlangen","beschreibung":"Inkassobrief erhalten? Vier Lagen zur Wahl – der Generator schreibt den Antwortbrief: Nachweise nach § 13a RDG, Kosten, Verjährung, Zahlungsbeleg.","sprache":"de","schwester":"/en/tools/reply-to-debt-collector"},
  "/werkzeuge/inkassokosten": {"titel":"Inkassokosten prüfen: Sind die Gebühren zu hoch?","beschreibung":"Hauptforderung und Inkassokosten eingeben. Der Prüfer rechnet die zulässigen Gebühren nach RVG und § 13e RDG nach und zeigt, was zu hoch ist.","sprache":"de","schwester":"/en/tools/debt-collection-costs"},
  "/werkzeuge/karten-check": {"titel":"Karten-Check: Debit, Prepaid oder Kreditrahmen?","beschreibung":"Fünf Angaben, eine ehrliche Einordnung: Welcher Kartenweg heute realistisch ist. Ohne Anfrage bei einer Auskunftei, ohne Spur in Ihrem Score.","sprache":"de","schwester":"/en/tools/card-check"},
  "/werkzeuge/kartenkosten": {"titel":"Kreditkarte mit Kaution, Prepaid oder Debit: Kostenvergleich","beschreibung":"Kaution, Prepaid oder Debit: Der Rechner legt Gebühren, Aufladekosten und gesperrtes Geld auf drei Jahre um und zeigt, was jede Karte kostet.","sprache":"de","schwester":"/en/tools/card-costs"},
  "/werkzeuge/kreditrechner": {"titel":"Kreditrechner: Monatsrate und Gesamtkosten berechnen","beschreibung":"Kreditrechner: Betrag, Laufzeit und Zins eingeben, Monatsrate, Gesamtkosten und Zinsanteil sofort sehen. Mit dem Zwei-Drittel-Zins nach § 6a PAngV.","sprache":"de","schwester":"/en/tools/loan-calculator"},
  "/werkzeuge/loeschfrist": {"titel":"Löschfrist-Rechner: Wann ist mein SCHUFA-Eintrag weg?","beschreibung":"Art des Eintrags und Daten eingeben – der Rechner nennt das taggenaue Löschdatum, mit 100-Tage-Regel und Sechs-Monats-Frist. Kostenlos.","sprache":"de","schwester":"/en/tools/deletion-deadline"},
  "/werkzeuge/mahnbescheid": {"titel":"Mahnbescheid-Fristenrechner: Widerspruch bis wann?","beschreibung":"Zustelldatum eingeben, letzten Tag erfahren: Der Rechner nennt die Frist für Widerspruch oder Einspruch (§§ 694, 700 ZPO) und die Folgen.","sprache":"de","schwester":"/en/tools/court-payment-order"},
  "/werkzeuge/mahngebuehren": {"titel":"Mahngebühren-Prüfer: Wie hoch dürfen Mahnkosten sein?","beschreibung":"Mahngebühren nachrechnen: Anzahl und Höhe eingeben – der Prüfer sagt, was nach §§ 286, 288 BGB und BGH VIII ZR 95/18 zulässig ist.","sprache":"de","schwester":"/en/tools/reminder-fees"},
  "/werkzeuge/pfaendungsrechner": {"titel":"Pfändungsrechner 2026: Freibetrag und P-Konto-Schutz","beschreibung":"Netto und Unterhaltspflichten eingeben – der Rechner nennt den pfändbaren Betrag und den Freibetrag auf dem P-Konto. Werte ab 1. Juli 2026.","sprache":"de","schwester":"/en/tools/attachment-calculator"},
  "/werkzeuge/ratenplan": {"titel":"Ratenzahlung vereinbaren: Rechner und Angebotsschreiben","beschreibung":"Ratenzahlung vereinbaren: Der Rechner nennt eine Rate, die auch im schlechten Monat hält, und formuliert das Angebotsschreiben an den Gläubiger.","sprache":"de","schwester":"/en/tools/instalment-plan"},
  "/werkzeuge/schulden-check": {"titel":"Schulden-Check: Bin ich überschuldet? Ehrliche Antwort","beschreibung":"Schulden-Check: Einnahmen, Ausgaben und Raten eingeben. Sie sehen Schuldenquote, freies Einkommen und den nächsten sinnvollen Schritt.","sprache":"de","schwester":"/en/tools/debt-check"},
  "/werkzeuge/schuldenplan": {"titel":"Schuldenfrei-Plan: Rechner für Lawine und Schneeball","beschreibung":"Bis zu sechs Schulden und Ihr Budget eingeben – der Rechner simuliert Lawine und Schneeball: Monate bis schuldenfrei, Zinsen, Reihenfolge.","sprache":"de","schwester":"/en/tools/debt-free-plan"},
  "/werkzeuge/selbstauskunft": {"titel":"Selbstauskunft kostenlos anfordern: Brief-Generator","beschreibung":"Kostenlose Datenkopie nach Art. 15 DSGVO anfordern: Der Generator erzeugt den fertigen Brief an SCHUFA, KSV1870, CRIF oder Intrum.","sprache":"de","schwester":"/en/tools/request-your-data-copy"},
  "/werkzeuge/skonto": {"titel":"Skonto-Rechner: Was zwei Prozent wirklich wert sind","beschreibung":"Skontosatz, Frist und Zahlungsziel eingeben – der Rechner nennt den effektiven Jahreszins und stellt ihn gegen Ihren Kontokorrent.","sprache":"de","schwester":"/en/tools/early-payment-discount"},
  "/werkzeuge/spielraum": {"titel":"Haushaltsrechner: Was bleibt Ihnen monatlich?","beschreibung":"Einnahmen und Fixkosten eintragen: Der Haushaltsrechner zeigt Ihren monatlichen Spielraum und die Fixkostenquote. Kostenlos zu nutzen.","sprache":"de","schwester":"/en/tools/monthly-headroom"},
  "/werkzeuge/umschuldung": {"titel":"Umschuldungsrechner: Kredite zusammenlegen und sparen","beschreibung":"Kostenloser Umschuldungsrechner: Kredite und Dispo eintragen und sehen, was Weiterlaufen kostet und Zusammenlegen spart.","sprache":"de","schwester":"/en/tools/debt-consolidation"},
  "/werkzeuge/verjaehrung": {"titel":"Verjährungsrechner: Ist die Forderung verjährt?","beschreibung":"Fälligkeit, Titel und letzte Anerkennung eingeben: Der Rechner nennt das Verjährungsdatum nach BGB und formuliert die Einrede. Kostenlos.","sprache":"de","schwester":"/en/tools/limitation-check"},
  "/werkzeuge/verzugszinsen": {"titel":"Verzugsrechner für Firmen: Zinsen und 40-Euro-Pauschale","beschreibung":"Betrag und Daten eingeben – der Rechner ermittelt Verzugszinsen mit neun Punkten über dem Basiszins, die 40-Euro-Pauschale und den Brieftext.","sprache":"de","schwester":"/en/tools/late-payment-interest"},
  "/werkzeuge/widerspruch": {"titel":"Löschantrag & Widerspruch gegen SCHUFA-Eintrag: Generator","beschreibung":"Löschantrag nach Art. 17 DSGVO und Widerspruch nach § 31 BDSG in zwei Minuten: Grund wählen, Eckdaten eintragen, zwei fertige Musterschreiben.","sprache":"de","schwester":"/en/tools/deletion-request"},
  "/widerrufsbelehrung": {"titel":"Widerrufsbelehrung: Ihr Widerrufsrecht bei FIAON","beschreibung":"Widerrufsrecht bei FIAON LTD: vierzehn Tage Frist, die richtige Form, die Folgen des Widerrufs und das Muster-Widerrufsformular."},
};

/** Pfad → Eintrag, mit derselben Normalisierung wie seoSeite() auf dem Server. */
export function seoKurz(pfad: string): SeoKurz | null {
  const p = (pfad.split("?")[0].replace(/\/+$/, "") || "/").toLowerCase();
  return SEO_KURZ[p] ?? null;
}

/** Die Schwesterseite in der anderen Sprache — für den Sprachwechsler. */
export function schwesterKurz(pfad: string, ziel: "de" | "en"): string | null {
  const e = seoKurz(pfad);
  if (!e) return null;
  const eigene = e.sprache ?? "de";
  if (eigene === ziel) return pfad;
  return e.schwester ?? null;
}

/** Die zwanzig Werkzeuge — Reihenfolge und Texte wie in der großen Tabelle. */
export const WERKZEUGE_KURZ = [
 {
  "pfad": "/werkzeuge/selbstauskunft",
  "name": "Datenkopie anfordern",
  "frage": "Was steht über mich in den Auskunfteien?",
  "satz": "Erzeugt das fertige Schreiben nach Art. 15 DSGVO — für SCHUFA, KSV und CRIF, kostenlos statt Bezahl-Abo."
 },
 {
  "pfad": "/werkzeuge/eintrag-pruefen",
  "name": "Ist mein Eintrag angreifbar?",
  "frage": "Kann dieser Eintrag gelöscht werden?",
  "satz": "Fünf Fragen, eine ehrliche Einschätzung nach § 31 BDSG und der Rechtsprechung."
 },
 {
  "pfad": "/werkzeuge/loeschfrist",
  "name": "Löschfrist-Rechner",
  "frage": "Wann ist mein Eintrag von selbst weg?",
  "satz": "Taggenaues Löschdatum — mit 100-Tage-Regel und Sechs-Monats-Frist nach Insolvenz."
 },
 {
  "pfad": "/werkzeuge/verjaehrung",
  "name": "Verjährungs-Prüfer",
  "frage": "Muss ich diese alte Forderung noch zahlen?",
  "satz": "Prüft die regelmäßige Verjährung und was sie unterbricht."
 },
 {
  "pfad": "/werkzeuge/inkassokosten",
  "name": "Inkassokosten-Prüfer",
  "frage": "Darf das Inkasso so viel verlangen?",
  "satz": "Vergleicht die Forderung mit den gesetzlichen Obergrenzen."
 },
 {
  "pfad": "/werkzeuge/kreditrechner",
  "name": "Kreditrechner",
  "frage": "Was kostet dieser Kredit wirklich?",
  "satz": "Monatsrate, Gesamtkosten, Tilgungsplan — und die Rate beim Zwei-Drittel-Zins."
 },
 {
  "pfad": "/werkzeuge/umschuldung",
  "name": "Umschuldungsrechner",
  "frage": "Weiterzahlen oder zusammenlegen?",
  "satz": "Alte Kredite und Dispo gegen ein neues Angebot gerechnet — mit Vorfälligkeitsentschädigung."
 },
 {
  "pfad": "/werkzeuge/schulden-check",
  "name": "Schulden-Check",
  "frage": "Wie ernst ist meine Lage?",
  "satz": "Schuldenquote und freies Einkommen — mit ehrlicher Ampel und den nächsten Schritten."
 },
 {
  "pfad": "/werkzeuge/spielraum",
  "name": "Spielraum-Rechner",
  "frage": "Wie viel Rate trage ich?",
  "satz": "Haushaltsrechnung, wie eine Bank sie ansetzt."
 },
 {
  "pfad": "/werkzeuge/karten-check",
  "name": "Karten-Check",
  "frage": "Welche Kreditkarte ist realistisch?",
  "satz": "Debit, Prepaid oder echter Rahmen — was heute geht und was den nächsten Schritt öffnet."
 },
 {
  "pfad": "/werkzeuge/widerspruch",
  "name": "Löschantrag & Widerspruch",
  "frage": "Wie bekomme ich den Eintrag weg?",
  "satz": "Grund wählen, Eckdaten eintragen — zwei fertige Schreiben an Auskunftei und Gläubiger (Art. 17 DSGVO, § 31 BDSG)."
 },
 {
  "pfad": "/werkzeuge/mahnbescheid",
  "name": "Mahnbescheid-Fristenrechner",
  "frage": "Bis wann muss ich widersprechen?",
  "satz": "Zustelldatum eingeben — der letzte Tag für Widerspruch oder Einspruch, taggenau mit Feiertagen."
 },
 {
  "pfad": "/werkzeuge/inkasso-antwort",
  "name": "Inkasso-Antwortbrief",
  "frage": "Was antworte ich dem Inkasso?",
  "satz": "Bestreiten, Nachweise nach § 13a RDG verlangen, Kosten zurückweisen oder Verjährung einwenden — als Brief."
 },
 {
  "pfad": "/werkzeuge/mahngebuehren",
  "name": "Mahngebühren-Prüfer",
  "frage": "Darf die Mahnung so viel kosten?",
  "satz": "Rechnet nach, was ein Gläubiger für Mahnungen verlangen darf — und formuliert die Zurückweisung."
 },
 {
  "pfad": "/werkzeuge/ratenplan",
  "name": "Ratenplan-Rechner",
  "frage": "Welche Rate nimmt der Gläubiger an?",
  "satz": "Aus Forderung und Spielraum die Rate, die hält — mit dem Angebotsschreiben inklusive Zins- und Meldeverzicht."
 },
 {
  "pfad": "/werkzeuge/schuldenplan",
  "name": "Schuldenfrei-Plan",
  "frage": "In welcher Reihenfolge werde ich schuldenfrei?",
  "satz": "Lawine oder Schneeball, Monat für Monat simuliert — Datum, Zinsen, Reihenfolge."
 },
 {
  "pfad": "/werkzeuge/dispo-rechner",
  "name": "Dispo-Rechner",
  "frage": "Was kostet mein Dauer-Dispo?",
  "satz": "Zinsen im Jahr, Ratenkredit zur Ablösung, Abbau in festen Raten — drei Wege nebeneinander."
 },
 {
  "pfad": "/werkzeuge/pfaendungsrechner",
  "name": "Pfändungsrechner 2026",
  "frage": "Was bleibt mir bei einer Pfändung?",
  "satz": "Freibetrag nach § 850c ZPO und P-Konto-Schutz — Werte ab 1. Juli 2026."
 },
 {
  "pfad": "/werkzeuge/basiskonto",
  "name": "Basiskonto-Helfer",
  "frage": "Basiskonto abgelehnt oder keine Antwort?",
  "satz": "Zehn-Tage-Frist, zulässige Ablehnungsgründe, Erinnerung an die Bank und der Weg zur BaFin."
 },
 {
  "pfad": "/werkzeuge/kartenkosten",
  "name": "Kartenkosten-Vergleich",
  "frage": "Kaution, Prepaid oder Debit?",
  "satz": "Drei Kartenwege auf drei Jahre gerechnet — inklusive der Kaution, die stillliegt."
 },
 {
  "pfad": "/werkzeuge/bonitaetsindex",
  "name": "Bonitätsindex-Deuter",
  "frage": "Was bedeutet meine Firmennote?",
  "satz": "Index von 100 bis 600 einordnen — mit der veröffentlichten Ausfallwahrscheinlichkeit und den Merkmalen, die am schwersten wiegen."
 },
 {
  "pfad": "/werkzeuge/verzugszinsen",
  "name": "Verzugsrechner für Firmen",
  "frage": "Rechnung überfällig – was steht mir zu?",
  "satz": "Zinsen mit neun Punkten über dem Basiszins, die 40-Euro-Pauschale und die fertige Nachforderung."
 },
 {
  "pfad": "/werkzeuge/skonto",
  "name": "Skonto-Rechner",
  "frage": "Skonto ziehen oder Ziel ausnutzen?",
  "satz": "Skonto als Jahreszins gerechnet und gegen den Kontokorrent gestellt — in beide Richtungen."
 },
 {
  "pfad": "/werkzeuge/firmenkarte",
  "name": "Firmenkarten-Check",
  "frage": "Was fehlt vor dem Kartenantrag?",
  "satz": "Rechtsform, Alter, Offenlegung, Konto und Einträge — die Lücken in der Reihenfolge, in der sie sich schließen lassen."
 },
 {
  "pfad": "/werkzeuge/firmenauskunft",
  "name": "Firmenauskunft-Fahrplan",
  "frage": "Wer speichert was über meine Firma?",
  "satz": "Zuständige Stellen, das Recht je Rechtsform — und das fertige Schreiben an die Auskunftei."
 }
];

export const WERKZEUGE_KURZ_EN = [
 {
  "pfad": "/werkzeuge/selbstauskunft",
  "name": "Request your data copy",
  "frage": "What do the credit bureaus hold about me?",
  "satz": "Generates the finished letter under Article 15 GDPR — for SCHUFA, KSV and CRIF, free instead of a paid subscription."
 },
 {
  "pfad": "/werkzeuge/eintrag-pruefen",
  "name": "Can my entry be challenged?",
  "frage": "Can this entry be deleted?",
  "satz": "Five questions, one honest assessment under Section 31 BDSG and case law."
 },
 {
  "pfad": "/werkzeuge/loeschfrist",
  "name": "Deletion deadline calculator",
  "frage": "When is my entry gone by itself?",
  "satz": "Deletion date to the day — with the 100-day rule and the six-month period after insolvency."
 },
 {
  "pfad": "/werkzeuge/verjaehrung",
  "name": "Limitation check",
  "frage": "Do I still have to pay this old claim?",
  "satz": "Checks the regular limitation period and what interrupts it."
 },
 {
  "pfad": "/werkzeuge/inkassokosten",
  "name": "Debt collection cost checker",
  "frage": "May the debt collector demand that much?",
  "satz": "Compares the claim with the statutory caps."
 },
 {
  "pfad": "/werkzeuge/kreditrechner",
  "name": "Loan calculator",
  "frage": "What does this loan really cost?",
  "satz": "Monthly instalment, total cost, repayment schedule — and the instalment at the two-thirds rate."
 },
 {
  "pfad": "/werkzeuge/umschuldung",
  "name": "Debt consolidation calculator",
  "frage": "Keep paying or consolidate?",
  "satz": "Old loans and overdraft calculated against a new offer — with the early repayment fee."
 },
 {
  "pfad": "/werkzeuge/schulden-check",
  "name": "Debt check",
  "frage": "How serious is my situation?",
  "satz": "Debt ratio and free income — with an honest traffic light and the next steps."
 },
 {
  "pfad": "/werkzeuge/spielraum",
  "name": "Monthly headroom calculator",
  "frage": "How much instalment can I carry?",
  "satz": "A household calculation the way a bank does it."
 },
 {
  "pfad": "/werkzeuge/karten-check",
  "name": "Card check",
  "frage": "Which credit card is realistic?",
  "satz": "Debit, prepaid or a real limit — what works today and what opens the next step."
 },
 {
  "pfad": "/werkzeuge/widerspruch",
  "name": "Deletion request & objection",
  "frage": "How do I get the entry removed?",
  "satz": "Choose the reason, enter the key facts — two finished letters to the credit bureau and the creditor (Article 17 GDPR, Section 31 BDSG)."
 },
 {
  "pfad": "/werkzeuge/mahnbescheid",
  "name": "Court payment order deadline calculator",
  "frage": "By when do I have to object?",
  "satz": "Enter the date of service — the last day for objection, to the day including public holidays."
 },
 {
  "pfad": "/werkzeuge/inkasso-antwort",
  "name": "Reply to the debt collector",
  "frage": "What do I reply to the debt collector?",
  "satz": "Dispute, demand evidence under Section 13a RDG, reject costs or plead limitation — as a letter."
 },
 {
  "pfad": "/werkzeuge/mahngebuehren",
  "name": "Reminder fee checker",
  "frage": "May the reminder cost that much?",
  "satz": "Recalculates what a creditor may charge for reminders — and drafts the rejection."
 },
 {
  "pfad": "/werkzeuge/ratenplan",
  "name": "Instalment plan calculator",
  "frage": "Which instalment will the creditor accept?",
  "satz": "From claim and headroom the instalment that holds — with the offer letter including waiver of interest and reporting."
 },
 {
  "pfad": "/werkzeuge/schuldenplan",
  "name": "Debt-free plan",
  "frage": "In which order do I become debt-free?",
  "satz": "Avalanche or snowball, simulated month by month — date, interest, order."
 },
 {
  "pfad": "/werkzeuge/dispo-rechner",
  "name": "Overdraft calculator",
  "frage": "What does my permanent overdraft cost?",
  "satz": "Interest per year, an instalment loan to pay it off, reduction in fixed instalments — three routes side by side."
 },
 {
  "pfad": "/werkzeuge/pfaendungsrechner",
  "name": "Attachment calculator 2026",
  "frage": "What is left to me in an attachment?",
  "satz": "Exempt amount under Section 850c ZPO and P-Konto protection — values from 1 July 2026."
 },
 {
  "pfad": "/werkzeuge/basiskonto",
  "name": "Basic account helper",
  "frage": "Basic account refused or no reply?",
  "satz": "Ten-day deadline, permissible grounds for refusal, reminder to the bank and the route to BaFin."
 },
 {
  "pfad": "/werkzeuge/kartenkosten",
  "name": "Card cost comparison",
  "frage": "Deposit, prepaid or debit?",
  "satz": "Three card routes calculated over three years — including the deposit that sits idle."
 }
];
