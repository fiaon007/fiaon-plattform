// /werkzeuge/karten-check · /en/tools/card-check — Wörterbuch (03.09.2026). Generator teilt an „const en".
export interface KcErgebnis { stufe: string; titel: string; text: string; schritt: string; link: string; linkText: string }
const de = {
  metaTitel: "Karten-Check · Welche Kreditkarte ist für mich realistisch?",
  metaBeschreibung: "Kostenlos, ohne Anmeldung: Fünf Angaben – eine ehrliche Einschätzung, welcher Kartenweg heute realistisch ist (Debit, Prepaid, Rahmen) und was den nächsten Schritt öffnet.",
  pille: "Werkzeug · kostenlos, ohne Anmeldung", h1a: "Welche Karte ist ", h1b: "realistisch?",
  lead: "Fünf Angaben, keine Anfrage bei einer Auskunftei, keine Spur im Score – nur eine ehrliche Einordnung und der nächste Schritt.",
  frageVon: (i: number, n: number) => `Frage ${i} von ${n}`,
  fragen: [
    { key: "einkommen", frage: "Regelmäßiges Einkommen im Monat (netto)?", optionen: [["u1200", "Unter 1.200 €"], ["1200", "1.200 – 2.000 €"], ["2000", "2.000 – 3.500 €"], ["3500", "Über 3.500 €"]] },
    { key: "art", frage: "Wie sind Sie beschäftigt?", optionen: [["fest", "Angestellt, unbefristet"], ["befristet", "Befristet oder in Probezeit"], ["selbst", "Selbstständig / freiberuflich"], ["sonst", "Studium, Rente, Leistungen"]] },
    { key: "eintraege", frage: "Negative Einträge bei SCHUFA, KSV oder CRIF?", optionen: [["keine", "Keine bekannt"], ["erledigt", "Ja, aber erledigt (bezahlt)"], ["offen", "Ja, offen"], ["weiss", "Weiß ich nicht"]] },
    { key: "konto", frage: "Wie läuft Ihr Girokonto?", optionen: [["sauber", "Ohne Rücklastschriften, meist im Plus"], ["dispo", "Oft im Dispo"], ["rueck", "Rücklastschriften in den letzten Monaten"], ["keins", "Ich habe derzeit kein eigenes Konto"]] },
    { key: "karte", frage: "Was hatten Sie bisher?", optionen: [["kredit", "Kreditkarte mit Rahmen"], ["debit", "Nur Debit- oder Girocard"], ["prepaid", "Prepaid-Kreditkarte"], ["gekuendigt", "Karte wurde mir gekündigt"]] },
  ] as { key: string; frage: string; optionen: [string, string][] }[],
  ergebnisse: {
    konto: { stufe: "Zuerst das Konto", titel: "Der erste Schritt ist ein Girokonto – und das steht Ihnen zu.", text: "Ohne Konto keine Karte. Auf ein Basiskonto haben Sie in Deutschland einen Rechtsanspruch (Zahlungskontengesetz), unabhängig von Einträgen. Danach: drei Monate sauber führen, dann ist eine Debit- oder Prepaid-Karte der nächste Schritt.", schritt: "Basiskonto beantragen; FIAON bereitet die Eröffnung bei einer Partnerbank vor.", link: "/girokonto-trotz-negativer-bonitaet", linkText: "Basiskonto: So geht es" },
    prepaid: { stufe: "Prepaid oder Debit", titel: "Heute realistisch: eine Karte ohne Rahmen – und der Weg zum Rahmen ist klar.", text: "Mit offenen Einträgen oder Rücklastschriften prüft kaum ein Herausgeber einen Kreditrahmen. Eine Prepaid-Kreditkarte oder Debit-Mastercard funktioniert überall, wo eine Karte verlangt wird. Parallel gehört der Eintrag geprüft: Ist er überhaupt berechtigt? Wann läuft seine Frist ab?", schritt: "Eintrag prüfen lassen – viele sind angreifbar. Konto sauber führen. In 6–12 Monaten neu bewerten.", link: "/werkzeuge/eintrag-pruefen", linkText: "Ist mein Eintrag angreifbar?" },
    klein: { stufe: "Kreditkarte mit kleinem Rahmen", titel: "Realistisch: eine echte Kreditkarte mit überschaubarem Rahmen – der wächst.", text: "Erledigte Einträge oder ein befristeter Vertrag sind keine Sperre, aber Herausgeber starten vorsichtig: Rahmen von 500 bis 2.000 Euro sind üblich. Entscheidend ist, was die Auskunft heute zeigt – und ob die Löschfristen bereits laufen. Nach sechs Monaten pünktlicher Nutzung lässt sich der Rahmen anpassen.", schritt: "Auskunft beschaffen und prüfen, ob erledigte Einträge noch gespeichert sein dürfen (drei Jahre, seit 2024 oft nur 18 Monate).", link: "/werkzeuge/loeschfrist", linkText: "Löschfrist berechnen" },
    rahmen: { stufe: "Kreditkarte mit Rahmen", titel: "Gute Ausgangslage: Eine Kreditkarte mit Rahmen ist realistisch – bis 25.000 € bei guter Bonität.", text: "Stabiles Einkommen, sauberes Konto, keine offenen Einträge – das ist das Profil, das Kartenpartner sehen wollen. Über Karte und Rahmen entscheidet die Bank; FIAON sorgt dafür, dass die Auskunft stimmt und die Unterlagen vollständig sind.", schritt: "Auskunft prüfen lassen – auch unauffällige Profile haben oft alte Anfragen oder Adressfehler, die den Rahmen drücken.", link: "/privatkunden", linkText: "Karte über FIAON" },
  } as Record<string, KcErgebnis>,
  naechsterSchritt: "Ihr nächster Schritt", fiaonUebernimmt: "FIAON übernimmt das",
  fuss: "Einordnung, keine Zusage: Über Karte und Rahmen entscheidet immer die Bank. Es wird keine Auskunft abgefragt, nichts gespeichert.",
  zwischenrufFett: "Die Karte kommt über die Auskunft.", zwischenruf: " FIAON beschafft sie, bereinigt, was angreifbar ist, und bereitet den Kartenantrag vor.", zwischenrufKnopf: "Auskunft beschaffen",
};
const en: typeof de = {
  metaTitel: "Card check · Which credit card is realistic for me?",
  metaBeschreibung: "Free, no sign-up: five details – an honest assessment of which card route is realistic today (debit, prepaid, credit limit) and what opens the next step.",
  pille: "Tool · free, no sign-up", h1a: "Which card is ", h1b: "realistic?",
  lead: "Five details, no enquiry at a credit bureau, no trace in your score – just an honest assessment and the next step.",
  frageVon: (i, n) => `Question ${i} of ${n}`,
  fragen: [
    { key: "einkommen", frage: "Regular monthly income (net)?", optionen: [["u1200", "Under €1,200"], ["1200", "€1,200 – 2,000"], ["2000", "€2,000 – 3,500"], ["3500", "Over €3,500"]] },
    { key: "art", frage: "How are you employed?", optionen: [["fest", "Employed, permanent"], ["befristet", "Fixed-term or on probation"], ["selbst", "Self-employed / freelance"], ["sonst", "Studying, retired, benefits"]] },
    { key: "eintraege", frage: "Negative entries at SCHUFA, KSV or CRIF?", optionen: [["keine", "None known"], ["erledigt", "Yes, but settled (paid)"], ["offen", "Yes, open"], ["weiss", "I do not know"]] },
    { key: "konto", frage: "How is your current account running?", optionen: [["sauber", "No returned direct debits, mostly in credit"], ["dispo", "Often overdrawn"], ["rueck", "Returned direct debits in recent months"], ["keins", "I currently have no account of my own"]] },
    { key: "karte", frage: "What have you had so far?", optionen: [["kredit", "Credit card with a limit"], ["debit", "Only a debit or Girocard"], ["prepaid", "Prepaid credit card"], ["gekuendigt", "My card was cancelled"]] },
  ],
  ergebnisse: {
    konto: { stufe: "The account first", titel: "The first step is a current account – and you are entitled to one.", text: "No account, no card. In Germany you have a legal right to a basic account (Payment Accounts Act), regardless of entries. After that: run it cleanly for three months, then a debit or prepaid card is the next step.", schritt: "Apply for a basic account; FIAON prepares the opening with a partner bank.", link: "/girokonto-trotz-negativer-bonitaet", linkText: "Basic account: how it works" },
    prepaid: { stufe: "Prepaid or debit", titel: "Realistic today: a card without a limit – and the route to a limit is clear.", text: "With open entries or returned direct debits hardly any issuer considers a credit limit. A prepaid credit card or debit Mastercard works everywhere a card is required. In parallel the entry belongs checked: is it justified at all? When does its period expire?", schritt: "Have the entry checked – many can be challenged. Run the account cleanly. Reassess in 6–12 months.", link: "/werkzeuge/eintrag-pruefen", linkText: "Can my entry be challenged?" },
    klein: { stufe: "Credit card with a small limit", titel: "Realistic: a real credit card with a modest limit – which grows.", text: "Settled entries or a fixed-term contract are no barrier, but issuers start cautiously: limits of €500 to €2,000 are usual. What matters is what the report shows today – and whether the deletion periods are already running. After six months of punctual use the limit can be adjusted.", schritt: "Obtain the report and check whether settled entries may still be stored (three years, since 2024 often only 18 months).", link: "/werkzeuge/loeschfrist", linkText: "Calculate the deletion deadline" },
    rahmen: { stufe: "Credit card with a limit", titel: "Good starting position: a credit card with a limit is realistic – up to €25,000 with a good credit file.", text: "Stable income, clean account, no open entries – that is the profile card partners want to see. The bank decides on card and limit; FIAON makes sure the report is right and the documents are complete.", schritt: "Have the report checked – even unremarkable profiles often have old enquiries or address errors that push the limit down.", link: "/privatkunden", linkText: "Card via FIAON" },
  },
  naechsterSchritt: "Your next step", fiaonUebernimmt: "FIAON takes this over",
  fuss: "An assessment, not a promise: the bank always decides on card and limit. No report is requested, nothing is stored.",
  zwischenrufFett: "The card comes via the report.", zwischenruf: " FIAON obtains it, clears up what can be challenged and prepares the card application.", zwischenrufKnopf: "Obtain the report",
};
export const WZ_KARTEN_CHECK_WOERTER = { de, en };
