// ═══════════════════════════════════════════════════════════════════════════
// /business/auftrag/:ref — „MEIN AUFTRAG": die Texte (17.09.2026, E-188)
//
// Die Pakete von FIAON Global nennen einen eigenen Dokumentenraum, einen
// Pflichtenkalender und einen festen Ansprechpartner. Hier ist der Ort dafür:
// eine Seite je Auftrag, erreichbar über den Link aus den Mails — ohne Konto,
// ohne Passwort. Etappen-Titel, Unterlagen und Fristen kommen vom Server
// (shared/fiaon-global-bereich.ts); hier steht nur, was der Bildschirm sagt.
// Sie-Form, keine Zusage: Über Konto, Karte und Rahmen entscheidet das Institut.
// ═══════════════════════════════════════════════════════════════════════════

const de = {
  metaTitel: "Mein Auftrag — FIAON Global",
  metaBeschreibung: "Stand Ihres Auftrags bei FIAON Global: Etappen, nächster Schritt, Dokumente, Pflichtenkalender und Ihr Ansprechpartner.",
  pille: "FIAON Global · Mein Auftrag",
  laedt: "Ihr Auftrag wird geladen …",

  status: { offen: "Wartet auf Zahlungseingang", bezahlt: "Zahlung eingegangen", gestartet: "In Arbeit", abgeschlossen: "Abgeschlossen", storniert: "Storniert" } as Record<string, string>,
  zahlungOffenTitel: "Ihr Auftrag beginnt mit dem Zahlungseingang.",
  zahlungOffenText: "Vertrag und Rechnung haben Sie per E-Mail erhalten. Sobald Ihre Überweisung eingegangen ist, meldet sich Ihr Ansprechpartner für das Startgespräch.",
  zurZahlung: "Zur Zahlungsseite",

  wegTitel: "Ihr Weg",
  etappeStand: { fertig: "abgeschlossen", jetzt: "läuft", offen: "folgt" } as Record<string, string>,
  seit: (tag: string) => `seit ${tag}`,

  schrittTitel: "Ihr nächster Schritt",
  schrittBis: (tag: string) => `bis ${tag}`,
  schrittLeer: "Im Moment ist nichts von Ihnen nötig. Ihr Ansprechpartner meldet sich, sobald der nächste Schritt ansteht.",
  stichtag: "Vereinbarter Stichtag für Gesellschaft und EIN",

  unterlagenTitel: "Unterlagen, die wir von Ihnen brauchen",
  unterlagenLead: "Laden Sie jede Unterlage einmal hoch — als PDF oder Foto. Ihr Ansprechpartner sieht sie sofort.",
  vorhanden: "liegt vor",
  fehlt: "fehlt noch",
  hochladen: "Hochladen",
  laedtHoch: "Wird hochgeladen …",
  uploadGesperrt: "Der Dokumentenraum öffnet sich mit dem Zahlungseingang.",
  uploadFehler: "Die Datei konnte nicht hochgeladen werden. Erlaubt sind PDF, JPG, PNG und HEIC bis 15 MB.",
  uploadZuGross: "Die Datei ist größer als 15 MB.",

  raumTitel: "Dokumentenraum",
  raumLead: "Alles, was zu Ihrer Gesellschaft gehört — von Ihnen und von uns.",
  raumLeer: "Noch keine Dokumente.",
  vonIhnen: "von Ihnen",
  vonFiaon: "von FIAON",
  weitereDatei: "Weitere Datei hochladen",
  oeffnen: "Öffnen",
  vertragPdf: "Vertrag (PDF)",
  rechnungPdf: "Rechnung (PDF)",

  fristenTitel: "Pflichtenkalender",
  fristenLead: "Termine, die für Ihre US-Gesellschaft regelmäßig anfallen. Ihr Steuerberater bzw. US-CPA bestätigt die für Sie geltenden Fristen.",
  fristenLeer: "Der Kalender füllt sich, sobald Ihre Gesellschaft gegründet ist.",
  erledigt: "erledigt",

  verlaufTitel: "Verlauf",
  verlaufLeer: "Noch keine Einträge.",

  nachrichtTitel: "Nachricht an Ihren Ansprechpartner",
  nachrichtPlatz: "Ihre Frage oder Ihr Hinweis …",
  nachrichtSenden: "Nachricht senden",
  nachrichtSendet: "Wird gesendet …",
  nachrichtOk: "Ihre Nachricht ist angekommen. Ihr Ansprechpartner meldet sich bei Ihnen.",
  nachrichtFehler: "Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",

  seiteAnsprech: "Ihr Ansprechpartner",
  seiteAnsprechLeer: "Ihr Ansprechpartner wird mit dem Start benannt.",
  seiteAuftrag: "Ihr Auftrag",
  seiteGesellschaft: "Ihre US-Gesellschaft",
  seiteReferenz: "Referenz",
  seiteHinweis: "Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut. Steuerliche und rechtliche Fragen beantworten Steuerberater und Anwälte auf eigenes Mandat.",

  zugangTitel: "Zugang zu Ihrem Auftrag",
  zugangAbgelaufen: "Dieser Link ist abgelaufen oder ungültig. Fordern Sie einen neuen an — er kommt an die E-Mail-Adresse Ihres Auftrags.",
  zugangOhne: "Geben Sie die E-Mail-Adresse Ihres Auftrags ein. Sie erhalten sofort einen neuen Link.",
  zugangEmail: "E-Mail-Adresse",
  zugangKnopf: "Link anfordern",
  zugangSendet: "Wird gesendet …",
  zugangOk: "Wenn zu dieser Adresse ein Auftrag besteht, ist der Link jetzt unterwegs.",
  zurSeite: "Zu FIAON Global",
};

const en: typeof de = {
  metaTitel: "My order — FIAON Global",
  metaBeschreibung: "Status of your FIAON Global order: stages, next step, documents, compliance calendar and your contact.",
  pille: "FIAON Global · My order",
  laedt: "Loading your order …",

  status: { offen: "Awaiting payment", bezahlt: "Payment received", gestartet: "In progress", abgeschlossen: "Completed", storniert: "Cancelled" },
  zahlungOffenTitel: "Your order starts once payment has been received.",
  zahlungOffenText: "You have received contract and invoice by email. As soon as your transfer has arrived, your contact will get in touch for the kick-off call.",
  zurZahlung: "Go to the payment page",

  wegTitel: "Your path",
  etappeStand: { fertig: "completed", jetzt: "in progress", offen: "to follow" },
  seit: (tag: string) => `since ${tag}`,

  schrittTitel: "Your next step",
  schrittBis: (tag: string) => `by ${tag}`,
  schrittLeer: "Nothing is needed from you at the moment. Your contact will get in touch as soon as the next step is due.",
  stichtag: "Agreed date for company and EIN",

  unterlagenTitel: "Documents we need from you",
  unterlagenLead: "Upload each document once — as a PDF or photo. Your contact sees it straight away.",
  vorhanden: "received",
  fehlt: "still missing",
  hochladen: "Upload",
  laedtHoch: "Uploading …",
  uploadGesperrt: "The document room opens once payment has been received.",
  uploadFehler: "The file could not be uploaded. PDF, JPG, PNG and HEIC up to 15 MB are allowed.",
  uploadZuGross: "The file is larger than 15 MB.",

  raumTitel: "Document room",
  raumLead: "Everything that belongs to your company — from you and from us.",
  raumLeer: "No documents yet.",
  vonIhnen: "from you",
  vonFiaon: "from FIAON",
  weitereDatei: "Upload another file",
  oeffnen: "Open",
  vertragPdf: "Contract (PDF)",
  rechnungPdf: "Invoice (PDF)",

  fristenTitel: "Compliance calendar",
  fristenLead: "Dates that recur for your US company. Your tax adviser or US CPA confirms the deadlines that apply to you.",
  fristenLeer: "The calendar fills up once your company has been formed.",
  erledigt: "done",

  verlaufTitel: "Timeline",
  verlaufLeer: "No entries yet.",

  nachrichtTitel: "Message to your contact",
  nachrichtPlatz: "Your question or note …",
  nachrichtSenden: "Send message",
  nachrichtSendet: "Sending …",
  nachrichtOk: "Your message has arrived. Your contact will get back to you.",
  nachrichtFehler: "The message could not be sent. Please try again.",

  seiteAnsprech: "Your contact",
  seiteAnsprechLeer: "Your contact is named when work starts.",
  seiteAuftrag: "Your order",
  seiteGesellschaft: "Your US company",
  seiteReferenz: "Reference",
  seiteHinweis: "The institution alone decides on account, card and limit. Tax and legal questions are answered by tax advisers and lawyers under their own engagement.",

  zugangTitel: "Access to your order",
  zugangAbgelaufen: "This link has expired or is invalid. Request a new one — it is sent to the email address of your order.",
  zugangOhne: "Enter the email address of your order. You will receive a new link straight away.",
  zugangEmail: "Email address",
  zugangKnopf: "Request link",
  zugangSendet: "Sending …",
  zugangOk: "If an order exists for this address, the link is now on its way.",
  zurSeite: "To FIAON Global",
};

export const GLOBAL_AUFTRAG_WOERTER = { de, en };
