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
  "/": {"titel":"Bonität verstehen, Einträge löschen, Karte — FIAON","beschreibung":"FIAON beschafft Ihre SCHUFA-, KSV- oder CRIF-Auskunft, erklärt jeden Eintrag, versendet geprüfte Schreiben und öffnet die Tür zu Konto und Kreditkarte.","sprache":"de","schwester":"/en"},
  "/abo-kuendigen": {"titel":"Kündigung — FIAON","beschreibung":"Kündigen Sie Ihr FIAON-Abonnement."},
  "/agb": {"titel":"Allgemeine Geschäftsbedingungen (AGB) — FIAON","beschreibung":"Die Bedingungen für die Leistungen von FIAON: Vertragsschluss, Laufzeit von zwölf Monatsraten, Zahlung per SEPA, Kündigung, Widerruf und Haftung."},
  "/als-kunde": {"titel":"Kundenansicht — FIAON","beschreibung":"Interne Ansicht des Kundenbereichs für Mitarbeiter."},
  "/antrag": {"titel":"Antrag stellen — FIAON","beschreibung":"Ihr Antrag bei FIAON in wenigen Schritten: Paket wählen, Angaben machen, Vertrag annehmen – und sofort in Ihrem Bereich."},
  "/auskunfteien": {"titel":"Auskunfteien im Vergleich: SCHUFA, KSV1870, CRIF","beschreibung":"SCHUFA, KSV1870, CRIF und Betreibungsregister im Vergleich: Wer speichert was, welche Rechte gelten, welche Löschfristen laufen – in DE, AT und CH.","sprache":"de","schwester":"/en/credit-bureaus"},
  "/banking": {"titel":"Girokonto trotz negativem Eintrag — FIAON","beschreibung":"Das Basiskonto steht Ihnen per Gesetz zu – auch mit Eintrag."},
  "/banking/dashboard": {"titel":"Investoren-Banking — FIAON","beschreibung":"Geschützter Bereich."},
  "/bonitaet": {"titel":"SCHUFA-Vollauskunft am selben Werktag — FIAON","beschreibung":"Ihre vollständige Auskunft mit Erklärung: welcher Eintrag woher stammt, wie lange er bleibt, welcher angreifbar ist. Durch FIAON beantragt, 74 € einmalig."},
  "/bonitaet-antrag": {"titel":"Bonitätsauskunft beantragen — FIAON","beschreibung":"Beantragen Sie Ihre geprüfte Bonitätsauskunft bei FIAON."},
  "/bonitaet-danke": {"titel":"Vielen Dank — FIAON","beschreibung":"Ihre Anfrage ist bei uns eingegangen."},
  "/bonitaet-service": {"titel":"Bonitäts-Auszug: Erklärung des Service — FIAON","beschreibung":"Was der Bonitäts-Auszug über FIAON leistet: Beschaffung bei SCHUFA, KSV oder CRIF, Erklärung jedes Eintrags und der nächste Schritt für jeden Eintrag."},
  "/bonitaet-verbessern": {"titel":"Bonität verbessern: die Hebel, die wirklich wirken","beschreibung":"Bonität verbessern: Welche Maßnahmen wirklich wirken, welche Monate brauchen und welche nichts bringen – mit 90-Tage-Plan und kostenlosen Werkzeugen.","sprache":"de","schwester":"/en/strengthen-your-credit-file"},
  "/bonitaetsauskunft-beantragen": {"titel":"Bonitätsauskunft beantragen: kostenlos oder geprüft","beschreibung":"Bonitätsauskunft beantragen: kostenlos nach Art. 15 DSGVO oder geprüft über FIAON für 74 € – Ablauf, Dauer und der Unterschied Datenkopie oder Zertifikat.","sprache":"de","schwester":"/en/request-your-credit-report"},
  "/business": {"titel":"Firmenkreditkarte & Unternehmensbonität — FIAON Business","beschreibung":"Firmenkreditkarte mit Zahlungsziel und saubere Unternehmensbonität: FIAON beschafft die Auskunft, bereinigt Einträge, bereitet Kartenanträge vor.","sprache":"de","schwester":"/en/business"},
  "/business-antrag": {"titel":"Firmenantrag — FIAON Business","beschreibung":"Ihr Firmenantrag bei FIAON: Unternehmen, Rechtsform, Inhaber, Wunschrahmen – in drei Minuten."},
  "/cookie-einstellungen": {"titel":"Cookie-Einstellungen — FIAON","beschreibung":"Entscheiden Sie selbst, welche Cookies gesetzt werden. Notwendige Cookies lassen sich nicht abwählen, alle anderen jederzeit widerrufen."},
  "/datenraum": {"titel":"Datenraum: Due Diligence auf Anfrage — FIAON","beschreibung":"FIAON wird geführt, als würde morgen verkauft: Entscheidungsregister, Logbuch, Kennzahlen, Verträge und Technik-Dokumentation – auf Anfrage unter NDA."},
  "/demo": {"titel":"Demo-Konto: der Kundenbereich, durchgespielt — FIAON","beschreibung":"Der FIAON-Kundenbereich im besten Fall – mit Platzhalterdaten – und die Sicht des Mitarbeiters im Startgespräch. Kein Login, keine echten Daten."},
  "/demo/kundenbereich": {"titel":"Demo-Kundenbereich — FIAON","beschreibung":"Der Kundenbereich mit Platzhalterdaten."},
  "/demo/produkt": {"titel":"Produkt-Demo — FIAON","beschreibung":"Die Produktansicht von FIAON."},
  "/eintrag-verjaehrung": {"titel":"SCHUFA-Eintrag und Verjährung: alle Fristen erklärt","beschreibung":"Wann ein SCHUFA-Eintrag verschwinden muss: Verjährungs-Checker, alle Speicherfristen je Eintragsart, berechtigt oder unberechtigt, der Weg bei Verfristung.","sprache":"de","schwester":"/en/entries-and-limitation"},
  "/en": {"titel":"FIAON in English: your credit file, explained and acted on","beschreibung":"FIAON obtains your SCHUFA, KSV or CRIF report, explains every entry, sends reviewed letters and prepares account and card. Germany, Austria, Switzerland.","sprache":"en","schwester":"/"},
  "/en/about": {"titel":"About FIAON: history, milestones and principles","beschreibung":"Why FIAON exists, who is behind it, what has happened since it was founded and what the company holds to: courtesy, no guarantees, every decision recorded.","sprache":"en","schwester":"/ueber-uns"},
  "/en/austria": {"titel":"FIAON in Austria: KSV1870, CRIF and your rights","beschreibung":"KSV1870 and CRIF explained, self-disclosure under Art. 15 GDPR, deletion deadlines, the banks' warning lists — and how FIAON prepares account and card.","sprache":"en","schwester":"/oesterreich"},
  "/en/book-a-call": {"titel":"Book a call: 15 minutes with a person, free | FIAON","beschreibung":"Rather talk first? Choose a time slot — one of our team calls you, explains what your report shows and which plan fits. Free and without obligation.","sprache":"en","schwester":"/termin"},
  "/en/business": {"titel":"FIAON Business: company card, payment terms, clean file","beschreibung":"Company credit card, up to 58 days of payment terms, a clean company credit file: FIAON obtains the reports, cleans up entries, prepares the application.","sprache":"en","schwester":"/business"},
  "/en/careers": {"titel":"Careers at FIAON: remote in DACH, employed or freelance","beschreibung":"Working at FIAON: employed or freelance, remote in Germany, Austria and Switzerland. Seven areas, academy before the first customer call.","sprache":"en","schwester":"/karriere"},
  "/en/compare": {"titel":"FIAON, a lawyer, a score app or yourself? The comparison","beschreibung":"Having a SCHUFA entry deleted: FIAON, a lawyer, a score app or doing it yourself in an honest comparison — cost, duration, follow-up, account afterwards.","sprache":"en","schwester":"/vergleich"},
  "/en/contact": {"titel":"Contact & support: phone, e-mail, assistant, urgent matters","beschreibung":"FIAON support: phone +41 44 244 93 01, e-mail support@fiaon.com. An assistant that knows the platform, and a direct line to the management.","sprache":"en","schwester":"/kontakt"},
  "/en/credit-bureaus": {"titel":"SCHUFA, KSV1870, CRIF: credit bureaus compared | FIAON","beschreibung":"Who stores what in Germany, Austria and Switzerland — rights, deletion deadlines and differences between SCHUFA, KSV1870, CRIF and the Swiss register.","sprache":"en","schwester":"/auskunfteien"},
  "/en/credit-card": {"titel":"A credit card despite a SCHUFA entry: the route via report","beschreibung":"Which card is realistic today, how the limit grows over twelve months and what issuers really see. FIAON prepares — the bank decides on card and limit.","sprache":"en","schwester":"/kreditkarte"},
  "/en/credit-glossary": {"titel":"Credit glossary: every term explained | FIAON","beschreibung":"From enquiry to payment history: the credit glossary explains every term in plain language – score class, data copy, deletion period, court payment order.","sprache":"en","schwester":"/glossar-bonitaet"},
  "/en/current-account-despite-poor-credit": {"titel":"Current account despite poor credit: honest route | FIAON","beschreibung":"A current account despite a poor credit record: what is really achievable, what an active account builds for your credit file, and what nobody can promise.","sprache":"en","schwester":"/girokonto-trotz-negativer-bonitaet"},
  "/en/debt-collection-letter": {"titel":"Debt collection letter? Check first, then pay | FIAON","beschreibung":"Received a debt collection letter: the calm five-step plan — check the claim, work out the costs, know the deadlines, prevent an entry. Checked for free.","sprache":"en","schwester":"/inkasso-brief-erhalten"},
  "/en/delete-a-schufa-entry": {"titel":"Deleting a SCHUFA entry: deadlines, rights, route | FIAON","beschreibung":"Deleting a SCHUFA entry: which entries can be challenged (Section 31 BDSG), all deletion periods as a table, the route in four steps with free tools.","sprache":"en","schwester":"/schufa-eintrag-loeschen"},
  "/en/entries-and-limitation": {"titel":"SCHUFA entries and limitation: all the deadlines | FIAON","beschreibung":"When a SCHUFA entry has to disappear: expiry checker, all storage periods per entry type and the route when a period has expired. Check the deadline now.","sprache":"en","schwester":"/eintrag-verjaehrung"},
  "/en/help": {"titel":"Help centre: answers on application, payment and report","beschreibung":"Application, payment, report, letters, account and card, cancellation, privacy, joining the team: the FIAON help centre answers the most common questions.","sprache":"en","schwester":"/hilfe"},
  "/en/how-fiaon-works": {"titel":"FIAON reviews: how FIAON works, explained honestly","beschreibung":"Bank-confirmed figures, the process in three steps, what we do not promise — and a seriousness check that applies to every provider, including us.","sprache":"en","schwester":"/fiaon-erfahrungen"},
  "/en/how-the-platform-works": {"titel":"How FIAON works: the platform concept day by day | FIAON","beschreibung":"The whole platform explained: three layers, the route day by day, plan finder, customer area, onboarding call, DACH, security – and what FIAON is not.","sprache":"en","schwester":"/plattform-konzept"},
  "/en/instalments-and-credit-file": {"titel":"Instalments and your credit file: strongest lever | FIAON","beschreibung":"How instalments affect SCHUFA and your credit file: the twelve-instalment logic, the four escalation stages with arrears and six practical tips.","sprache":"en","schwester":"/ratenzahlung-und-bonitaet"},
  "/en/loans-without-schufa": {"titel":"Loans without SCHUFA: what is really behind them","beschreibung":"What legitimately exists, what it costs, how to spot fraud in 30 seconds — and why the better route is usually to put your credit file in order.","sprache":"en","schwester":"/kredit-ohne-schufa"},
  "/en/partners": {"titel":"Become a partner: banks, credit bureaus, introducers — FIAON","beschreibung":"For banks, card issuers, credit bureaus, debt collectors and introducers: FIAON brings customers with a repaired, documented credit file – with consent.","sprache":"en","schwester":"/partner"},
  "/en/personal": {"titel":"Personal: credit file, current account, credit card | FIAON","beschreibung":"Clean up entries, open an account, a credit card up to €25,000 — FIAON obtains your report, explains every entry, sends the letters and opens the door.","sprache":"en","schwester":"/privatkunden"},
  "/en/press": {"titel":"Press: facts, figures, imagery, contact — FIAON","beschreibung":"FIAON in the media: short profile, market figures to quote, topics for interviews and guest articles, imagery and a contact on the same working day.","sprache":"en","schwester":"/presse"},
  "/en/pricing": {"titel":"Pricing and plans: twelve instalments, no surprises | FIAON","beschreibung":"What FIAON costs: monthly plans in twelve instalments, cancellable monthly, or the credit report on its own. Every service compared with doing it yourself.","sprache":"en","schwester":"/preise"},
  "/en/reading-your-credit-report": {"titel":"Reading your credit report: 10-point checklist | FIAON","beschreibung":"Understand your credit report: the interactive 10-point checklist, the 5 most common mistakes and an explained sample extract. Check your report now.","sprache":"en","schwester":"/selbstauskunft-checkliste"},
  "/en/request-your-credit-report": {"titel":"Requesting your credit report: free or reviewed | FIAON","beschreibung":"The free route under Art. 15 GDPR and the reviewed FIAON route for €74 compared: obtaining, plain-language explanation, a check of every entry.","sprache":"en","schwester":"/bonitaetsauskunft-beantragen"},
  "/en/schufa-neutral-enquiries": {"titel":"SCHUFA-neutral enquiries: how to do it right | FIAON","beschreibung":"Enquire about a loan without affecting your score: the difference between a conditions enquiry and a loan enquiry, and the right sentences for the bank.","sprache":"en","schwester":"/schufa-neutral-anfragen"},
  "/en/schufa-score": {"titel":"Understanding the SCHUFA score: new scale 100–999, table","beschreibung":"The new SCHUFA score since March 2026: a scale from 100 to 999, five classes, twelve criteria with points — as a table, with the levers behind it.","sprache":"en","schwester":"/schufa-score-verstehen"},
  "/en/security": {"titel":"Privacy & security: how FIAON handles your credit data","beschreibung":"EU hosting, encryption, authorisation, approval before every letter, deletion on request. Plus a privacy check: who may do what with your credit data?","sprache":"en","schwester":"/sicherheit"},
  "/en/status": {"titel":"FIAON status: availability, data location, incidents","beschreibung":"Is FIAON up right now? Live check of the platform, data location Frankfurt, encryption, maintenance rules and the list of known incidents – verifiable.","sprache":"en","schwester":"/status"},
  "/en/strengthen-your-credit-file": {"titel":"Strengthening your credit file: the levers ranked by effect","beschreibung":"Which measures really work, which take months and which achieve nothing — with a 90-day plan, free tools and the rules behind SCHUFA, KSV and CRIF scores.","sprache":"en","schwester":"/bonitaet-verbessern"},
  "/en/switzerland": {"titel":"FIAON in Switzerland: enforcement register, CRIF, Intrum","beschreibung":"The debt enforcement register extract, CRIF and Intrum explained, access under Art. 25 DSG, blocking unjustified enforcements — and the path to a card.","sprache":"en","schwester":"/schweiz"},
  "/en/team": {"titel":"The FIAON team: the people you reach on the phone","beschreibung":"Sales, onboarding and collections — anyone who calls FIAON speaks to one of these people. Three shareholders in daily operations, one investor in Zurich.","sprache":"en","schwester":"/team"},
  "/en/tools": {"titel":"Free SCHUFA and credit tools — FIAON","beschreibung":"Twenty free calculators, checkers and letter generators on SCHUFA, credit files, debt collection and loans: deletion request, deadlines, debt plan.","sprache":"en","schwester":"/werkzeuge"},
  "/en/tools/attachment-calculator": {"titel":"Attachment calculator 2026: exempt amount and P-Konto","beschreibung":"Enter net income and maintenance obligations – the attachable amount under Section 850c ZPO and the P-Konto protection. Values from 1 July 2026. Free.","sprache":"en","schwester":"/werkzeuge/pfaendungsrechner"},
  "/en/tools/basic-account": {"titel":"Basic account refused or no reply? The helper | FIAON","beschreibung":"Applied for a basic account? The helper calculates the ten-day deadline (Section 33 ZKG), names permissible refusal grounds and drafts the reminder.","sprache":"en","schwester":"/werkzeuge/basiskonto"},
  "/en/tools/card-check": {"titel":"Card check: which credit card is realistic for me? | FIAON","beschreibung":"Five details – an honest assessment of which card route is realistic today (debit, prepaid, credit limit) and what opens the next step. Free, no sign-up.","sprache":"en","schwester":"/werkzeuge/karten-check"},
  "/en/tools/card-costs": {"titel":"Card cost comparison: deposit, prepaid or debit? | FIAON","beschreibung":"Credit card with a deposit, prepaid or debit card: fees, top-up costs and the idle deposit spread over three years – and which card delivers what. Free.","sprache":"en","schwester":"/werkzeuge/kartenkosten"},
  "/en/tools/check-my-entry": {"titel":"Can my entry be challenged? Five questions, one answer","beschreibung":"Five questions, one honest assessment: whether your SCHUFA, KSV or CRIF entry can be deleted – under Section 31 BDSG, deletion periods and case law. Free.","sprache":"en","schwester":"/werkzeuge/eintrag-pruefen"},
  "/en/tools/court-payment-order": {"titel":"Court payment order deadline: object by when? | FIAON","beschreibung":"Received a Mahnbescheid? Enter the date of service – the calculator names the last day for objection (Sections 694, 700 ZPO) and what to tick. Free.","sprache":"en","schwester":"/werkzeuge/mahnbescheid"},
  "/en/tools/debt-check": {"titel":"Debt check: am I over-indebted? | FIAON","beschreibung":"Enter income, expenses and instalments – an honest assessment with debt ratio, free income and next steps. If serious: free debt counselling first.","sprache":"en","schwester":"/werkzeuge/schulden-check"},
  "/en/tools/debt-collection-costs": {"titel":"Debt collection cost checker: are the fees too high? | FIAON","beschreibung":"Enter principal claim and costs demanded – the checker recalculates the permissible fees under the RVG and Section 13e RDG and drafts the rejection.","sprache":"en","schwester":"/werkzeuge/inkassokosten"},
  "/en/tools/debt-consolidation": {"titel":"Debt consolidation calculator: combine loans, save | FIAON","beschreibung":"Enter existing loans and overdraft – see what continuing costs and what consolidation saves, with the early repayment fee under Section 500 BGB. Free.","sprache":"en","schwester":"/werkzeuge/umschuldung"},
  "/en/tools/debt-free-plan": {"titel":"Debt-free plan: avalanche or snowball? Calculator | FIAON","beschreibung":"Enter up to six debts and your budget – the calculator simulates avalanche (most expensive first) and snowball (smallest first): months, interest, order.","sprache":"en","schwester":"/werkzeuge/schuldenplan"},
  "/en/tools/deletion-deadline": {"titel":"Deletion deadline calculator: when is my SCHUFA entry gone?","beschreibung":"Enter the type of entry and the dates – the calculator names the deletion date to the day, with the 100-day rule and the six-month period after insolvency.","sprache":"en","schwester":"/werkzeuge/loeschfrist"},
  "/en/tools/deletion-request": {"titel":"Deletion request and objection against a SCHUFA entry","beschreibung":"Deletion request under Article 17 GDPR and objection under Section 31 BDSG in two minutes: choose the reason, enter the facts, two finished German letters.","sprache":"en","schwester":"/werkzeuge/widerspruch"},
  "/en/tools/instalment-plan": {"titel":"Agreeing instalments: calculator and offer letter | FIAON","beschreibung":"Enter claim and headroom – the calculator names an instalment that holds, the term, and writes the German offer to the creditor with a waiver request.","sprache":"en","schwester":"/werkzeuge/ratenplan"},
  "/en/tools/limitation-check": {"titel":"Limitation check: is the old claim time-barred? | FIAON","beschreibung":"Enter due date, title and last acknowledgement – the check names the limitation date under the BGB and provides the German wording for the plea.","sprache":"en","schwester":"/werkzeuge/verjaehrung"},
  "/en/tools/loan-calculator": {"titel":"Loan calculator: monthly instalment and total cost | FIAON","beschreibung":"Free loan calculator: enter amount, term and rate – see monthly instalment, total cost and interest share, with the two-thirds rate under Section 6a PAngV.","sprache":"en","schwester":"/werkzeuge/kreditrechner"},
  "/en/tools/monthly-headroom": {"titel":"Monthly headroom calculator: what is left each month | FIAON","beschreibung":"Enter income and fixed costs – the calculator shows your monthly headroom, the fixed-cost ratio and what card partners read from it. Free, no sign-up.","sprache":"en","schwester":"/werkzeuge/spielraum"},
  "/en/tools/overdraft-calculator": {"titel":"Overdraft calculator: what a permanent overdraft costs","beschreibung":"Enter overdraft balance and rate – see what the minus costs per year, what an instalment loan saves and how long a fixed monthly reduction takes. Free.","sprache":"en","schwester":"/werkzeuge/dispo-rechner"},
  "/en/tools/reminder-fees": {"titel":"Reminder fee checker: how high may reminder costs be?","beschreibung":"Enter the number of reminders and the fee – the checker says what is permissible under Sections 286, 288 BGB and case law and drafts the rejection.","sprache":"en","schwester":"/werkzeuge/mahngebuehren"},
  "/en/tools/reply-to-debt-collector": {"titel":"Reply to the debt collector: dispute, demand evidence","beschreibung":"Received a debt collection letter? Choose your situation – the generator writes the German reply: evidence under Section 13a RDG, costs, limitation.","sprache":"en","schwester":"/werkzeuge/inkasso-antwort"},
  "/en/tools/request-your-data-copy": {"titel":"Data copy request generator: your free credit report | FIAON","beschreibung":"Generate the finished letter for your free data copy under Article 15 GDPR in one minute – to SCHUFA, KSV1870, CRIF or Intrum. Copy, print, send. Free.","sprache":"en","schwester":"/werkzeuge/selbstauskunft"},
  "/en/transparency": {"titel":"FIAON transparency report: figures with definition and date","beschreibung":"What FIAON measures and publishes: paying customers, paid instalments, countries, tools, guides — bank-confirmed, with definition, date and source.","sprache":"en","schwester":"/transparenz"},
  "/en/what-is-fiaon": {"titel":"What is FIAON? The operating system for creditworthiness","beschreibung":"FIAON shows you what SCHUFA, KSV or CRIF hold on you, repairs it with you and opens the door to an account, a card and finance. Three layers, one path.","sprache":"en","schwester":"/was-ist-fiaon"},
  "/fiaon-erfahrungen": {"titel":"FIAON Erfahrungen: So arbeitet FIAON — ehrlich erklärt","beschreibung":"FIAON Erfahrungen: bankbestätigte Zahlen, der Ablauf in drei Schritten, was wir nicht versprechen – und ein Seriositäts-Check, der für jeden Anbieter gilt.","sprache":"de","schwester":"/en/how-fiaon-works"},
  "/girokonto-trotz-negativer-bonitaet": {"titel":"Girokonto trotz negativer Bonität: der ehrliche Weg","beschreibung":"Girokonto trotz negativer Bonität: was wirklich erreichbar ist, was ein aktives Konto für Ihre Bonität baut, Basiskonto oder FIAON-Weg – ohne Versprechen.","sprache":"de","schwester":"/en/current-account-despite-poor-credit"},
  "/glossar-bonitaet": {"titel":"Bonitäts-Glossar: alle Begriffe von A bis Z erklärt","beschreibung":"Von Anfrage bis Zahlungshistorie: das Bonitäts-Glossar erklärt jeden Begriff in Klartext – Score-Klasse, Datenkopie, Löschfrist, Mahnbescheid, Restschuld.","sprache":"de","schwester":"/en/credit-glossary"},
  "/hilfe": {"titel":"Hilfe-Center: Antworten zu Antrag, Zahlung, Auskunft","beschreibung":"Antrag, Zahlung, Auskunft, Schreiben, Konto und Karte, Kündigung, Datenschutz, Mitarbeiter werden: das FIAON-Hilfe-Center mit Suche.","sprache":"de","schwester":"/en/help"},
  "/impressum": {"titel":"Impressum: FIAON LTD, London — Anbieterkennzeichnung","beschreibung":"Anbieterkennzeichnung: FIAON LTD, 128 City Road, London, Company Registration Number 17318250, Vertretung, Kontakt und Verbraucherstreitbeilegung."},
  "/inkasso-brief-erhalten": {"titel":"Inkasso-Brief erhalten? Erst prüfen, dann zahlen","beschreibung":"Inkasso-Brief erhalten: der ruhige 5-Schritte-Plan – Forderung prüfen, Kosten nachrechnen, Fristen kennen, SCHUFA-Eintrag verhindern. Mit freien Prüfern.","sprache":"de","schwester":"/en/debt-collection-letter"},
  "/investoren": {"titel":"Investoren: das Modell hinter FIAON und der Datenraum","beschreibung":"Warum der Platz zwischen Auskunftei und Bank unbesetzt ist, wie FIAON ihn besetzt, drei Erlösquellen, vier Kennzahlen – und der Datenraum unter NDA."},
  "/karriere": {"titel":"Karriere bei FIAON: remote in DACH, fest oder frei","beschreibung":"Arbeiten bei FIAON: fest angestellt oder frei, remote in Deutschland, Österreich und der Schweiz. Sieben Bereiche, Academy vor dem ersten Kundengespräch.","sprache":"de","schwester":"/en/careers"},
  "/karte-sichern": {"titel":"Karte sichern — FIAON","beschreibung":"Sichern Sie sich Ihre Karte über FIAON."},
  "/kontakt": {"titel":"Kontakt & Support: FIAON erreichen — Telefon, E-Mail","beschreibung":"Schreiben Sie uns Ihr Anliegen, fragen Sie den Assistenten oder lassen Sie sich zurückrufen. Telefon +41 44 244 93 01, support@fiaon.com – werktags.","sprache":"de","schwester":"/en/contact"},
  "/kredit-ohne-schufa": {"titel":"Kredit ohne SCHUFA: Was wirklich dahintersteckt","beschreibung":"Kredit ohne SCHUFA: Was es seriös gibt, was es kostet, woran Sie Betrug in 30 Sekunden erkennen – und warum der bessere Weg meist über die Auskunft führt.","sprache":"de","schwester":"/en/loans-without-schufa"},
  "/kreditkarte": {"titel":"Kreditkarte trotz SCHUFA-Eintrag: der ehrliche Weg","beschreibung":"Kreditkarte trotz Eintrag: Welche Karte heute realistisch ist, wie der Rahmen in zwölf Monaten wächst und was Herausgeber sehen. Die Bank entscheidet.","sprache":"de","schwester":"/en/credit-card"},
  "/login": {"titel":"Anmelden — FIAON","beschreibung":"Melden Sie sich in Ihrem FIAON-Kundenbereich an."},
  "/mein-bereich": {"titel":"Mein Bereich — FIAON","beschreibung":"Ihr persönlicher Bereich bei FIAON."},
  "/oesterreich": {"titel":"Bonität in Österreich: KSV1870, CRIF, Ihre Rechte","beschreibung":"Bonität in Österreich: KSV1870 und CRIF erklärt, Selbstauskunft nach Art. 15 DSGVO, Löschfristen, Warnliste der Banken – und wie FIAON Einträge bereinigt.","sprache":"de","schwester":"/en/austria"},
  "/partner": {"titel":"Partner werden: Banken, Auskunfteien, Vermittler — FIAON","beschreibung":"Für Banken, Kartenherausgeber, Auskunfteien, Inkasso und Vermittler: FIAON bringt Kunden mit reparierter, dokumentierter Bonität – mit Einwilligung.","sprache":"de","schwester":"/en/partners"},
  "/passwort-vergessen": {"titel":"Passwort vergessen — FIAON","beschreibung":"Setzen Sie Ihr Passwort für den FIAON-Kundenbereich zurück."},
  "/plattform-konzept": {"titel":"So funktioniert FIAON: Plattform-Konzept Tag für Tag","beschreibung":"Die ganze Plattform erklärt: drei Schichten, der Weg Tag für Tag, Paketfinder, Kundenbereich, Startgespräch, DACH, Sicherheit – und was FIAON nicht ist.","sprache":"de","schwester":"/en/how-the-platform-works"},
  "/preise": {"titel":"Preise & Pakete: FIAON ab 7,99 € im Monat","beschreibung":"Alle FIAON-Pakete auf einen Blick: Start, Pro, Ultra, High-End und Business – was enthalten ist, was es kostet, was Selbermachen kostet. Zwölf Raten.","sprache":"de","schwester":"/en/pricing"},
  "/presse": {"titel":"Presse: Fakten, Zahlen, Bildmaterial, Ansprechpartner","beschreibung":"FIAON in den Medien: Kurzprofil, Marktzahlen zum Zitieren, Themen für Interviews und Gastbeiträge, Bildmaterial und ein Ansprechpartner am selben Werktag.","sprache":"de","schwester":"/en/press"},
  "/privacy": {"titel":"Datenschutzerklärung — FIAON","beschreibung":"Welche Daten FIAON verarbeitet, auf welcher Rechtsgrundlage, wie lange wir sie speichern und welche Rechte Sie nach der DSGVO haben – bis zur Löschung."},
  "/privatkunden": {"titel":"Bonität verbessern & Kreditkarte für Privatkunden","beschreibung":"Einträge bereinigen, Girokonto eröffnen, Kreditkarte bis 25.000 €: FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, versendet die Schreiben.","sprache":"de","schwester":"/en/personal"},
  "/ratenzahlung-und-bonitaet": {"titel":"Ratenzahlung und Bonität: Ihr stärkster Hebel","beschreibung":"Wie Raten auf SCHUFA und Bonität wirken: die 12-Raten-Logik, die vier Eskalationsstufen bei Rückstand, sechs Praxis-Tipps und der FIAON-Zahlungskalender.","sprache":"de","schwester":"/en/instalments-and-credit-file"},
  "/ratgeber": {"titel":"Ratgeber: SCHUFA, Bonität, Inkasso erklärt | FIAON","beschreibung":"SCHUFA-Eintrag löschen, Auskunft kostenlos anfordern, Kreditkarte trotz Eintrag, KSV und CRIF – geprüfte Ratgeber von FIAON, ehrlich und ohne Versprechen."},
  "/schufa-eintrag-loeschen": {"titel":"SCHUFA-Eintrag löschen lassen: Fristen, Rechte, Weg","beschreibung":"SCHUFA-Eintrag löschen lassen: Welche Einträge angreifbar sind (§ 31 BDSG), alle Löschfristen als Tabelle, der Weg in vier Schritten mit freien Werkzeugen.","sprache":"de","schwester":"/en/delete-a-schufa-entry"},
  "/schufa-neutral-anfragen": {"titel":"SCHUFA-neutral anfragen: Konditions- statt Kreditanfrage","beschreibung":"Kredit anfragen ohne Score-Wirkung: der Unterschied zwischen Konditions- und Kreditanfrage, die richtigen Sätze für die Bank – und was gespeichert bleibt.","sprache":"de","schwester":"/en/schufa-neutral-enquiries"},
  "/schufa-score-verstehen": {"titel":"SCHUFA-Score verstehen: neue Skala 100–999, Tabelle","beschreibung":"Der neue SCHUFA-Score seit März 2026: Skala 100 bis 999, fünf Klassen, zwölf Kriterien mit Punkten – als Tabelle erklärt, mit den Hebeln dahinter.","sprache":"de","schwester":"/en/schufa-score"},
  "/schweiz": {"titel":"Bonität in der Schweiz: Betreibungsregister, CRIF, Intrum","beschreibung":"Bonität in der Schweiz: Betreibungsregisterauszug, CRIF und Intrum erklärt, Auskunft nach Art. 25 DSG, Löschung unbegründeter Betreibungen (Art. 8a SchKG).","sprache":"de","schwester":"/en/switzerland"},
  "/scp-datenraum": {"titel":"Datenraum","beschreibung":"Vertraulicher Zugang."},
  "/selbstauskunft-checkliste": {"titel":"Selbstauskunft lesen: die 10-Punkte-Checkliste","beschreibung":"Selbstauskunft verstehen: die interaktive 10-Punkte-Checkliste, die fünf häufigsten Fehler beim Lesen und ein erklärter Muster-Ausschnitt Ihrer Datenkopie.","sprache":"de","schwester":"/en/reading-your-credit-report"},
  "/sicherheit": {"titel":"Datenschutz & Sicherheit bei FIAON: Wer darf was?","beschreibung":"Wie FIAON mit Ihren sensibelsten Daten umgeht: EU-Hosting, Verschlüsselung, Vollmacht vor jeder Auskunft, Freigabe vor jedem Schreiben, Löschung auf Wunsch","sprache":"de","schwester":"/en/security"},
  "/start": {"titel":"Start — FIAON","beschreibung":"Ihr Einstieg bei FIAON."},
  "/status": {"titel":"FIAON Status: Verfügbarkeit, Datenstandort, Störungen","beschreibung":"Läuft FIAON gerade? Live-Prüfung, Datenstandort Frankfurt, Verschlüsselung, Regeln für Wartung und die Liste bekannter Störungen – prüfbar.","sprache":"de","schwester":"/en/status"},
  "/team": {"titel":"Das Team hinter FIAON: Gründer, Vertrieb, Onboarding","beschreibung":"Wer bei FIAON arbeitet: Justin Schwarzott (Gründer), Florentine Lombardi (Onboarding), Daniel Stripling (Vertrieb) und das Team am Telefon. Mit Namen.","sprache":"de","schwester":"/en/team"},
  "/termin": {"titel":"Startgespräch buchen: 15 Minuten mit einem Menschen","beschreibung":"Lieber erst reden? Zeitfenster wählen – ein Mitarbeiter ruft Sie an, erklärt, was Ihre Auskunft hergibt und welches Paket passt. Kostenlos.","sprache":"de","schwester":"/en/book-a-call"},
  "/terms": {"titel":"Allgemeine Geschäftsbedingungen — FIAON","beschreibung":"Die Bedingungen für die Nutzung dieser Website und des Kundenbereichs."},
  "/transparenz": {"titel":"FIAON Transparenzbericht: Zahlen mit Definition, Stand","beschreibung":"Was FIAON misst und veröffentlicht: zahlende Kunden, bezahlte Raten, Länder, Werkzeuge, Ratgeber – bankbestätigt, mit Definition und Stand.","sprache":"de","schwester":"/en/transparency"},
  "/ueber-uns": {"titel":"Über FIAON: Geschichte, Meilensteine und Haltung","beschreibung":"Warum es FIAON gibt, wer dahintersteht, was seit der Gründung passiert ist und woran sich das Haus hält: Sie-Form, keine Garantien, alles im Register.","sprache":"de","schwester":"/en/about"},
  "/vereinbarung": {"titel":"Vertrauliches Dokument — FIAON","beschreibung":"Diese Seite ist geschützt."},
  "/vergleich": {"titel":"FIAON, Anwalt, Score-App oder selbst? Der Vergleich","beschreibung":"SCHUFA-Eintrag löschen lassen: FIAON, Anwalt, Score-App oder selbst im ehrlichen Vergleich – Kosten, Dauer, Verfolgung, Konto danach.","sprache":"de","schwester":"/en/compare"},
  "/was-ist-fiaon": {"titel":"Was ist FIAON? Einsicht, Aktion, Zugang erklärt","beschreibung":"Von der ersten Auskunft bis zum bereinigten Eintrag: Wie FIAON arbeitet, was in jedem Schritt passiert und woran Sie erkennen, dass es vorangeht.","sprache":"de","schwester":"/en/what-is-fiaon"},
  "/werkzeuge": {"titel":"Kostenlose SCHUFA- und Bonitäts-Werkzeuge — FIAON","beschreibung":"Zwanzig kostenlose Rechner, Prüfer und Brief-Generatoren zu SCHUFA, Bonität, Inkasso und Kredit: Löschantrag, Fristen, Pfändung, Dispo, Schuldenplan.","sprache":"de","schwester":"/en/tools"},
  "/werkzeuge/basiskonto": {"titel":"Basiskonto abgelehnt oder keine Antwort? Der Helfer","beschreibung":"Basiskonto beantragt? Der Helfer rechnet die Zehn-Tage-Frist (§ 33 ZKG), nennt die zulässigen Ablehnungsgründe und den Weg zur BaFin (§ 48 ZKG).","sprache":"de","schwester":"/en/tools/basic-account"},
  "/werkzeuge/dispo-rechner": {"titel":"Dispo-Rechner: Was der Dauer-Dispo wirklich kostet","beschreibung":"Dispo-Stand und Zins eingeben – der Rechner zeigt, was das Minus im Jahr kostet, was ein Ratenkredit spart und wie lange der Abbau dauert.","sprache":"de","schwester":"/en/tools/overdraft-calculator"},
  "/werkzeuge/eintrag-pruefen": {"titel":"Ist mein SCHUFA-Eintrag angreifbar? Kurzprüfung","beschreibung":"Fünf Fragen, eine ehrliche Einschätzung: Ob Ihr SCHUFA-, KSV- oder CRIF-Eintrag gelöscht werden kann – nach § 31 BDSG und Löschfristen. Ohne Anmeldung.","sprache":"de","schwester":"/en/tools/check-my-entry"},
  "/werkzeuge/inkasso-antwort": {"titel":"Inkasso-Antwortbrief: bestreiten, Nachweise verlangen","beschreibung":"Inkassobrief erhalten? Lage wählen – der Generator schreibt die Antwort: Nachweise nach § 13a RDG, Kosten zurückweisen, Verjährung, Zahlungsbeleg.","sprache":"de","schwester":"/en/tools/reply-to-debt-collector"},
  "/werkzeuge/inkassokosten": {"titel":"Inkassokosten prüfen: Sind die Gebühren zu hoch?","beschreibung":"Hauptforderung und Inkassokosten eingeben – der Prüfer rechnet die zulässigen Gebühren nach RVG und § 13e RDG nach und formuliert die Zurückweisung.","sprache":"de","schwester":"/en/tools/debt-collection-costs"},
  "/werkzeuge/karten-check": {"titel":"Karten-Check: Welche Kreditkarte ist realistisch?","beschreibung":"Fünf Angaben, eine ehrliche Einschätzung: Welcher Kartenweg heute realistisch ist – Debit, Prepaid oder Rahmen – und was den nächsten Schritt öffnet.","sprache":"de","schwester":"/en/tools/card-check"},
  "/werkzeuge/kartenkosten": {"titel":"Kreditkarte mit Kaution, Prepaid oder Debit: Kostenvergleich","beschreibung":"Kaution, Prepaid oder Debit: Der Rechner legt Gebühren, Aufladekosten und die festliegende Kaution auf drei Jahre um und zeigt, was jede Karte kann.","sprache":"de","schwester":"/en/tools/card-costs"},
  "/werkzeuge/kreditrechner": {"titel":"Kreditrechner: Monatsrate und Gesamtkosten berechnen","beschreibung":"Kostenloser Kreditrechner: Betrag, Laufzeit und Zins eingeben – Monatsrate, Gesamtkosten und Zinsanteil sofort sehen. Mit Zwei-Drittel-Zins (§ 6a PAngV).","sprache":"de","schwester":"/en/tools/loan-calculator"},
  "/werkzeuge/loeschfrist": {"titel":"Löschfrist-Rechner: Wann ist mein SCHUFA-Eintrag weg?","beschreibung":"Art des Eintrags und Daten eingeben – der Rechner nennt das taggenaue Löschdatum, mit 100-Tage-Regel und Sechs-Monats-Frist nach Insolvenz. Kostenlos.","sprache":"de","schwester":"/en/tools/deletion-deadline"},
  "/werkzeuge/mahnbescheid": {"titel":"Mahnbescheid-Fristenrechner: Widerspruch bis wann?","beschreibung":"Mahnbescheid erhalten? Zustelldatum eingeben – der Rechner nennt den letzten Tag für Widerspruch oder Einspruch (§§ 694, 700 ZPO) und die Folgen.","sprache":"de","schwester":"/en/tools/court-payment-order"},
  "/werkzeuge/mahngebuehren": {"titel":"Mahngebühren-Prüfer: Wie hoch dürfen Mahnkosten sein?","beschreibung":"Mahngebühren nachrechnen: Anzahl und Höhe eingeben – der Prüfer sagt, was nach §§ 286, 288 BGB und BGH VIII ZR 95/18 zulässig ist.","sprache":"de","schwester":"/en/tools/reminder-fees"},
  "/werkzeuge/pfaendungsrechner": {"titel":"Pfändungsrechner 2026: Freibetrag und P-Konto-Schutz","beschreibung":"Netto und Unterhaltspflichten eingeben – der Rechner nennt den pfändbaren Betrag nach § 850c ZPO und den P-Konto-Schutz. Werte ab 1. Juli 2026.","sprache":"de","schwester":"/en/tools/attachment-calculator"},
  "/werkzeuge/ratenplan": {"titel":"Ratenzahlung vereinbaren: Rechner und Angebotsschreiben","beschreibung":"Forderung und Spielraum eingeben – der Rechner nennt eine Rate, die hält, und schreibt das Angebot an den Gläubiger mit Bitte um Zins- und Meldeverzicht.","sprache":"de","schwester":"/en/tools/instalment-plan"},
  "/werkzeuge/schulden-check": {"titel":"Schulden-Check: Bin ich überschuldet? Ehrliche Antwort","beschreibung":"Kostenloser Schulden-Check: Einnahmen, Ausgaben und Raten eingeben – ehrliche Einschätzung mit Schuldenquote, freiem Einkommen und den nächsten Schritten.","sprache":"de","schwester":"/en/tools/debt-check"},
  "/werkzeuge/schuldenplan": {"titel":"Schuldenfrei-Plan: Lawine oder Schneeball? Rechner","beschreibung":"Bis zu sechs Schulden und Ihr Budget eingeben – der Rechner simuliert Lawine und Schneeball: Monate bis schuldenfrei, Zinsen, Reihenfolge.","sprache":"de","schwester":"/en/tools/debt-free-plan"},
  "/werkzeuge/selbstauskunft": {"titel":"Selbstauskunft kostenlos anfordern: Brief-Generator","beschreibung":"In einer Minute den fertigen Brief für Ihre kostenlose Datenkopie nach Art. 15 DSGVO erzeugen – an SCHUFA, KSV1870, CRIF oder Intrum. Ohne Speicherung.","sprache":"de","schwester":"/en/tools/request-your-data-copy"},
  "/werkzeuge/spielraum": {"titel":"Haushaltsrechner: Was bleibt Ihnen monatlich?","beschreibung":"Einnahmen und Fixkosten eingeben – der Rechner zeigt Ihren monatlichen Spielraum, die Fixkostenquote und was Kartenpartner daraus ablesen. Kostenlos.","sprache":"de","schwester":"/en/tools/monthly-headroom"},
  "/werkzeuge/umschuldung": {"titel":"Umschuldungsrechner: Kredite zusammenlegen und sparen","beschreibung":"Kostenloser Umschuldungsrechner: Kredite und Dispo eintragen – sehen, was Weiterlaufen kostet und was Zusammenlegen spart. Mit Vorfälligkeitsentschädigung.","sprache":"de","schwester":"/en/tools/debt-consolidation"},
  "/werkzeuge/verjaehrung": {"titel":"Verjährungsrechner: Ist die Forderung verjährt?","beschreibung":"Fälligkeit, Titel und letzte Anerkennung eingeben – der Rechner nennt das Verjährungsdatum nach BGB und formuliert die Einrede der Verjährung. Kostenlos.","sprache":"de","schwester":"/en/tools/limitation-check"},
  "/werkzeuge/widerspruch": {"titel":"Löschantrag & Widerspruch gegen SCHUFA-Eintrag: Generator","beschreibung":"Löschantrag nach Art. 17 DSGVO und Widerspruch nach § 31 BDSG in zwei Minuten: Grund wählen, Eckdaten eintragen, zwei fertige Musterschreiben.","sprache":"de","schwester":"/en/tools/deletion-request"},
  "/widerrufsbelehrung": {"titel":"Widerrufsbelehrung: Ihr Widerrufsrecht bei FIAON","beschreibung":"Ihr Widerrufsrecht als Verbraucher: Frist von 14 Tagen, Form, Folgen des Widerrufs und das Muster-Widerrufsformular – für alle Verträge mit FIAON LTD."},
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
